---
title: 撸个简单的 JSbridge
date: 2018-01-09 21:59:21
categories:
  - [Hybrid]
  - [Android]
tags:
  - Webview
  - JSB
---

这两年 Web 技术栈一直在努力地向移动端和后端延展（这里没有引战的意思），当然这也是技术发展所带来的必然结果。移动互联网早期主要以原生开发为主，但到现在，业务不断发展，版本也需要快速迭代，原生开发效率很明显难以跟上，这时候 Web 开发的优势就显现出来了。

<!--more-->

（废话讲的差不多了）

## Hybrid
Hybrid App 中文名叫：混合App，即原生应用和 WebApp 的结合体，它兼顾了 **原生应用** 的体验和 **WebApp** 的开发效率（这里定义应该是狭义的）。
最常见的 Hybrid 的实现方式是通过 JSBridge 来打通 Native Code 和 JavaScript 之间的隔阂。
这篇文章中我们一起来简单实现一个 JSBridge。


## 背景知识
在 Android 上实现 Hybrid 是通过 Webview 来实现的，所以下面再简单过一下 Webview 的一些基本知识。

### Webview
通常我们会使用 `webview.loadUrl(url)` 来加载一个页面，这个方法还可以用来执行 JS 代码：
```java
webview.loadUrl("javascript:console.log\(called by Native\)");
```
这里通过 `javascript` 这个伪协议来调用或执行 JS 代码。

### WebSettings
这个类主要是完成 Webview 的一些配置工作，比如允许执行 JS。要实现 JSBridge ，就必须允许执行 JS。

### WebviewClient
这个类会收到 JS 环境中的各种事件，比如资源请求、页面加载完成、点击了一个链接等。

### WebChromeClient
这个类主要用来辅助 WebView 进行一些界面上的工作，比如弹出对话框等。


## 通信方式
要实现 JSBridge ，还得提供一条合适的通信通道，目前主要方式有三种：

- webViewClient.shouldOverrideUrlLoading(WebView,WebResourceRequest)
    当需要加载一个新的 url 的时候，WebView 会先询问 WebViewClient 是否需要进行拦截。利用这个回调，可以构造自己的 schema ，在 url 中携带各种动作信息和参数等。这种方式一般是在 JS 中创建一个不可见的 iframe，然后改变 iframe 的 src 属性就可以了（微信就是这么实现的）。
- webChromeClient.onJSPrompt(wv,url,message,defaultValue,callback)
    还有另外两个类似的回调方法，不过因为使用频率都比这个方法高，一般都不会去占用。这里主要用到第三个参数： message ，通过它传递 Json 字符串，可以方便拿到各种信息，比上面的方式略简单一些（不是很喜欢这种方式）。
- webView.addJavascriptInterface(object,name)
    这种方式应该是效率最高、调用最自然的一种，不过在 Android 4.2 之前有安全问题，如果不需要兼容4.2 及以下版本，应该是比较推荐使用这个种方式。这种方式将 Native 中的一个对象挂载到 JS 的window 上，并命名为 name，然后 JS 中就能够通过 `window.name.funname(params)` 的方式来调用 Native 中被 JavascriptInterface 注解所标记的方法了（这里可以实现 JS 同步调用 Native ）

上面的只是完成了 JS 发消息到 Native ，Native 通知 JS 可以通过 `webview.loadUrl(url)` 来实现。

## 需要考虑的问题
- 通信协议
    需要制定统一的消息格式，这个还算比较简单
- 回调
    Webview 渲染线程和一般的 UI 线程不是同一线程，所以需要通过回调在子线程拿到返回值
- 传递信息长度
    如果通过 `webViewClient.shouldOverrideUrlLoading` 还要注意 url 的长度，不过一般情况下是不会有这种问题的
- 线程
    Native 只能在主线程调用 JS，接收到的 JS 调用在子线程


## 动手
撸 JSbrdige 所需要的基本知识也就这些了，还有一些小坑点在实现的过程中来说明。
这里以我已经完成的 [JSBridge](https://github.com/dashMrl/JStraw) 为例来进行说明。
> 因为 JavaScript 实现比较简单，所以主要讲 Native（kotlin） 的实现，

### 核心类说明
JSBridge 核心还是一个通信协议，所以需要一些规范化的抽象。

#### Request/Response
仿照 HTTP 协议，定义出请求响应类，这里就直接看源码就 OK 了：
```kotlin
/**
* Native 调用 JS 或者 JS 调用 Native 的请求封装
*/
data class Request<T>(
        @SerializedName("handler_name")//对于不同功能，我们提供不同的 Handler 处理
        val handlerName: String,
        @SerializedName("callback_id")//在另外一段完成操作后进行回调用的
        val callbackId: Int,
        @SerializedName("params")// Handler 处理所需要的数据
        val params: T
) {
    companion object {
        fun <T> create(callId: String, callbackId: Int, params: T): Request<T> {
            return Request(callId, callbackId, params)
        }
    }
}


/**
* Native 对 JS 或者 JS 对 Native 的响应的封装
*/
data class Response<out T>(
        @SerializedName("status")//状态，成功、失败或取消
        val status: Int,
        @SerializedName("msg")//状态的简单解释
        val msg: String,
        @SerializedName("body")//响应数据
        val data: T
) {
    companion object {
        internal val STATUS_OK = 0
        internal val STATUS_FAILED = 1
        internal val STATUS_CANCEL = 2
        fun <T> success(msg: String = "success", data: T): Response<T> = Response(STATUS_OK, msg, data)
        fun cancel(msg: String = "canceled"): Response<Unit> = Response(STATUS_CANCEL, msg, Unit)
        fun failed(msg: String = "failed"): Response<Unit> = Response(STATUS_FAILED, msg, Unit)
    }
}
```

#### NativeHandler<in T, out R>
对于 JS 的请求，需要有特定的类来进行处理，这里还是直接看源码：
```kotlin
interface NativeHandler<in T, out R> {// T 表示接收请求参数类型，R 表示响应参数类型
    fun name(): String
    fun handleJSCall(requestStr: String, wv: WebView) {//kotlin 接口可以有方法实现
        Log.d("NativeHandler",requestStr)
        val request = JsonUtil.json2Obj<Request<T>>(requestStr)
        handle(request.params, JSCallback(wv, request.callbackId))
    }

    fun handle(data: T, callback: JSCallback<R>)
}
```
应对不同类型的请求，可以通过实现不同的 NativeHandler 来实现，其中 `name()` 应该返回一个全局唯一的、易于识别的字符串用于标识这个 Handler，重写 `handle()` 来处理请求并响应。要注意的是，`handle()` 方法默认运行在子线程，所以如果想操作 UI ，还要进行线程切换（JSCallback 内部进行了线程切换）。
> 最好是做到每个请求都响应一些状态，让另外一端知道请求是失败还是成功又或者取消了等

#### Pivot
这个类是通信的枢纽，对 JS 的调用与接受 JS 的请求都是在这里。
```kotlin
internal interface IPivot {
    fun callJS(handlerName: String, params: String, callback: NativeCallback<*>)

    fun callFromJS(handlerName: String, request: String)

    fun responseFromJS(callbackId: Int, data: String)
}
```

#### JStraw
这个类用于对外暴露 API 接口，有些接口需要隐藏，所以使用 `internal` 进行修饰：
```kotlin
abstract class IJStraw {//interface 不能使用 internal 所以改成 abstract class
    abstract  fun <T> callJS(handlerName: String, data: String = ""): NativeCallback<T>

    abstract fun registerNativeHandler(handler: NativeHandler<*, *>)
    abstract internal fun findNativeHandler(handlerName: String): NativeHandler<*, *>?

    abstract internal fun addCallback(callbackId: Int, callback: NativeCallback<*>)
    abstract internal fun removeCallback(callbackId: Int): NativeCallback<*>?
}
```
这样，通过几行代码就可以完成 Native 调用 JS：
```kotlin
jstraw.callJS<String>("js_handler","json data")
    .success { result: String -> toast(result) }
	.failed { msg -> toast(msg) }
	.canceled { toast("canceled") }
	.error { e -> toast(e.message.toString()) }
	.exec()
```

> 到这里，Native 端的大概轮廓就出来了，剩下的只剩下一些细节方面的东西了

#### JS 实现
因为 JS 实现真的是容易，所以下面直接贴代码（凑字数）：
```javascript
let uniqueId = 1;//用于回调标示
let callbacks = {};//保存 回调
let handlers = {};//Native 调用的处理集合
// 注册 handler ,需要一个 handlerName 进行标识
let registerJSHandler = (handlerName, handler) => {
    handlers[handlerName] = {
        handleNativeCall: (request) => {
            handler.handle(request, {
                success: (body = {}) => {
                    pivot.responseFromJS(request.callback_id, JSON.stringify({
                        status: 0,
                        msg: 'success',
                        body: body
                    }));
                },
                failed: (msg = "failed") => {
                    pivot.responseFromJS(request.callback_id, JSON.stringify({
                        status: 1,
                        msg: msg,
                        body: {}
                    }));
                },
                cancel: (reason = 'canceled') => {
                    pivot.responseFromJS(request.callback_id, JSON.stringify({
                        status: 2,
                        msg: reason,
                        body: {}
                    }))
                }
            })
        }
    };
};
//调用 Native 功能的方法，需要 Native 端的 handler标识 和 参数
//这里使用 Promise 来使得调用流程更加方便
let callNative = (handlerName, params = {}) => {
    let callbackId = uniqueId++;
    const request = {
        handler_name: handlerName,
        callback_id: callbackId,
        params: params
    };
    return new Promise((resolve, reject) => {
        try {
            callbacks[callbackId] = {
                onResponse: (response) => {
                    resolve(response);
                }
            };
            pivot.callFromJS(handlerName, JSON.stringify(request));
        } catch (e) {
            reject(e);
            delete callbacks[callbackId];
        }
    });
};
//通过定义 straw 来将模块中的函数暴露出去
window.straw = {
    callNative: callNative,
    registerJSHandler: registerJSHandler
};

//called by native code
window.callFromNative = (request) => {
    let handlerName = request.handler_name;
    if (handlers[handlerName]) {
        handlers[handlerName].handleNativeCall(request);
    } else {
        console.log('undefined handler');
    }

};
//called by native code
window.responseFromNative = (callbackId, response) => {
    if (callbacks[callbackId]) {
        callbacks[callbackId].onResponse(response);
        delete callbacks[callbackId];
    }
};
// 因为这段 JS 代码是在页面加载完成之后才进行注入的，JS 端使用时需要监听这个事件的完成
const event = new Event('onStrawInit');
document.dispatchEvent(event);
```
另外，通过 JS 对象的特性，我们可以非常方便的向 Native 端暴露接口，具体代码如下：
```javascript
//定义 Native 端接口集合
const nativeApiList = [{
    "funName":"isLogin",
    "handlerName": "loginHandler",
    "needParams": false
}];

let apiGenerator = (nativeApi) => {
    if (nativeApi.needParams) {
        return (params) => {
            return straw.callNative(nativeApi.handlerName, params);
        };
    } else {
        return () => {
            return straw.callNative(nativeApi.handlerName);
        };
    }
};
//利用 JS 对象类似于键值对的特性动态绑定函数
let apiFactory = (list) => {
    list.forEach((nativeApi) => {
        straw[`${nativeApi.funName}`] = apiGenerator(nativeApi);
    });
};
//function apiFactory() below should be called after straw.bundle-x.x.x.js is injected
if (window.straw) {
    apiFactory(nativeApiList);
} else {
    document.addEventListener('onStrawInit', (event) => {
        console.log('Straw inited');
        apiFactory(nativeApiList);
    });
}
```
Native 要是实现上面的功能就比较蛋疼了！！！


## 坑点
上面大概就是实现 JSBridge 的思路，在这之外还有一些问题需要注意。

### 注入时机
刚刚也说了，JSbridge JS 端代码一般是在客户端本地的，并没直接添加到网页里，所以我们需要将这段 JS 注入网页，最容易想到的就是在页面加载完成的时候进行注入。 `webViewClient.onPageFinished()`  能够完成网页加载完成的事件，那就继承一个呗。但是考虑到开发者可能还想在这方法里面进行一些其他操作，为了不起冲突，包装一下：

```kotlin
class JStrawWebViewClient(
    private val puppetWVC: WebViewClient?, private var jsUrl: String)
: WebViewClient() {
    override fun onPageFinished(view: WebView?, url: String?) {
        InjectUtil.injectJS(view, jsUrl)
        puppetWVC?.onPageFinished(view, url)
    }
}
```
puppetWVC 就是用户自己的 WebViewClient 实例。

### 注入安全性
注入非常简单，定义一个 `script` 节点，将这个节点插入网页就好了：

```javascript
var script = document.createElement('script');
script.src = '$jsUrl';
var firstScript = document.scripts[0];
firstScript.parentNode.insertBefore(script,firstScript);
```

一看没毛病，觉得完全OK。但是如果这个 jsUrl 是 `file:///android_asset/jstraw.js` ，并且你加载的网页不是应用内置的，那么 WebView 内核是不会去加载的，因为它会认为是 **网页主动** 想要拿到本地的资源（事实上是被我们注入的）。但是如果 jsUrl 是 `https://host/path/jstraw.js` 类型，那么 WebView 是会去尝试加载的。

知道了这些，我们再考虑这些情况，加载一个非本地网页，理想情况是应用内部、SD 卡和网络上的 JS 文件 都能注入。那么怎么才能使得 这三种情况都被满足呢？

又要用到 WebViewClient 了，这次需要重写的是 `shouldInterceptRequest` 这个方法，这个方法会在 WebView 请求每一个资源之前调用一次，如果返回 null 那么，WebView 就自己去加载，如果返回 nonnull ，那么WebView 就会使用我们的提供的资源。

那么，考虑的安全性限制，我们对 jsUrl 来进行一个转换，如果是来自 应用内部 或者 SD 卡，那就对它改造下，改成 WebView 认可的格式，然后我们再在  `shouldInterceptRequest`  中来解析并返回资源就OK 了。

> 也可以利用这个方法来接管 WebView 的缓存，使得整个应用的网络请求都能被监控到。


[完整代码](https://github.com/dashMrl/JStraw)


## 参考文章

[android 中的 Hybrid 开发](https://juejin.im/entry/577a6f41128fe10056539e03)

[记一次 Webview Jsbridge 接口封装](https://quanru.github.io/2016/10/02/%E8%AE%B0%E4%B8%80%E6%AC%A1%20Webview%20Jsbridge%20%E6%8E%A5%E5%8F%A3%E5%B0%81%E8%A3%85/)

[JSBridge](https://github.com/lzyzsd/JsBridge)
