---
title: Android Architecture Components 之 Lifecycle
date: 2017-12-21 23:53:58
categories:
  - Android
tags:
  - LifeCycle
  - AAC
---

现在都流行 MVP + RxJava2 开发，然后 RxJava 带来的一个问题就是需要在适当的时候取消订阅关系以避免 **内存泄露** ，最常见的做法就是在 `Activity/Fragment#onDestroy()` 方法中调用 `disposable.dispose()` 来解决。然后，官方文档中是用 `LocationManager` 来举例，这种情况就比较典型，需要重写 Activity/Fragment 的每个生命周期方法来处理它的状态。官方文档中又单独封装了一个类来处理，保持生命周期方法中的代码不会太臃肿。但是这还是没有彻底解决问题，毕竟还是要重写方法，难免不会有一次忘记重写某个生命周期函数。最理想的情况就是，我们封装的类能够 **自动察觉** 到生命周期的变化。

<!--more-->

## Lifecycle
正式开始前，先了解几个概念。
Lifecycle 这个类封装了组件的生命周期信息，并且使得这些信息可以被其他人监视。

Lifecycle 使用两个 枚举类 来追踪和它关联的组件生命周期：
- Event：这个枚举类代表了生命周期 **变化**，并且与 Activity/Fragment 中的生命周期回调方法一一对应
- State：生命周期组件当前的状态

下面是官方文档上的一张示意图，它展示了 Event、State 之间的关系：
![States and events that comprise the Android activity lifecycle](https://developer.android.com/images/topic/libraries/architecture/lifecycle-states.svg)

一般情况下，我们更关心的可能是生命周期状态的变化，通过监听这些变化来作出相应的处理，这里我们通过实现 `LifecycleObserver` 来完成监听：
```java
public class MyObserver implements LifecycleObserver {
    @OnLifecycleEvent(Lifecycle.Event.ON_RESUME)
    public void onResume() {
        // ...
    }
    @OnLifecycleEvent(Lifecycle.Event.ON_PAUSE)
    public void onPause() {
        // ...
    }
}
```
我们看到，通过 **注解** 的方式就能指定某个方法在哪个生命周期事件发生时被调用，至于如何注册这个 Observer ，等另一个类讲解之后再说。

## LifecycleOwner
刚刚介绍了 Lifecycle 这类，以及如何监听它的各种事件，但是我们还需要一个能偶提供的 Lifecycle 的宿主，这里就需要使用到 `LifecycleOwner` 。

LifecycleOwner 是一个 **只有一个方法** 的接口，它表示这个类能够提供 `Lifecycle` 。最新 support 包里的 `AppCompatActivity/Fragment` 已经实现了这个接口，所以我们可以直接使用：
```java
public class LifecycActivity extends AppCompatActivity{
    public void onCreate(...) {
        getLifecycle().addObserver(new MyLifecycleObserver());
    }
}
```
就这样简单的一行代码，就可以完成生命周期事件的监听了。

> 注意：在 `MyObserver` 中，在执行生命周期相关的操做前最好判断一下当前生命周期。这时官方原话，我暂时还不知道是什么原因，先留个坑，等看了源码再过来补充。


## 实战
了解完这个生命周期感知的类，还需要思考怎么利用这个特性来改进我们现有的代码。这里我们通过改造一个 MVP 来练习：

### 定义基类
按照 MVP 的套路，我们需要先定义 V 和 P 的基类/接口：

```java
public interface AbsView {
}
```
这里 AbsView 什么接口方法都没有定义，飘过。

```java
public abstract class AbsPresenter<V extends AbsView> implements LifecycleObserver {
    private static final String TAG = "AbsPresenter";
    private CompositeDisposable compositeDisposable = new CompositeDisposable();
    protected WeakReference<V> view = new WeakReference(null);

    public setView(V v) {
        view = new WeakReference<>(v);
        if (v instanceof LifecycleOwner) {
            ((LifecycleOwner) v).getLifecycle().addObserver(this);
        }
    }

    protected void addDisposable(Disposable d) {
        compositeDisposable.add(d);
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_PAUSE)
    protected void onPause() {}

    @OnLifecycleEvent(Lifecycle.Event.ON_STOP)
    protected void onStop() {}

    @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
    protected void onDestroy() {
        Log.d(TAG, "lifecycle component state onDestroy");
        compositeDisposable.clear();
        view.clear();
    }
}
```
我们重点看看这个 AbsPresenter ，它实现了 LifecycleObserver，同时定义一系列被 `Lifecycle.Event` 标注的方法，这些方法在 Activity/Fragment 的生命周期变化的时候被调用，所以我们就可以把 RxJava2 的 **解订阅操作** 放在 `onDestroy` 这个方法里面。
需要注意的是，这些生命周期感知的方法不能使用 private 修饰，否则编译不过。

完成了这些基础工作，我们就可以专注于业务逻辑，而避免自己重写 onDestroy 方法解除订阅，也避免的因为疏忽忘记重写而造成内存泄漏的问题。

### 定义协议
按照 Google Samples 中的套路，我们再定义一个协议接口：
```java
public interface LOContract {
    abstract class BaseLifecyclePresenter extends AbsPresenter<LifecycleView> {
        public BaseLifecyclePresenter(LifecycleView lifecycleView) {
            super(lifecycleView);
        }
        abstract void getMsg();
    }

    interface LifecycleView extends AbsView {
        void showMsg(String msg);
    }
}
```

### 实现VP
最后就是实现了

LOActivity 实现 LifecycleView
```java
public class LOActivity extends AppCompatActivity implements LifecycleObserverContract.LifecycleView {
    private BaseLifecyclePresenter p;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ...
        p = new LOPresenter();
        p.setView(this);
        findViewById(R.id.load_btn).setOnClickListener(
            view -> p.getMsg()
        );
    }

    @Override
    public void showMsg(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }
}
```
LOPresenter 实现 BaseLifecyclePresenter
```java
public class LOPresenter extends LifecycleObserverContract.BaseLifecyclePresenter {
    private static final String TAG = "LOPresenter";
    @Override
    void getMsg() {
        Disposable d = Observable
                .fromCallable(() -> {
                    // 模拟一个耗时操作
                    Thread.sleep(5000);
                    return "message";
                })
                .subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe(
                        msg -> view.get().showMsg(msg),
                        Throwable::printStackTrace,
                        () -> Log.i(TAG, "onComplete")
                );
        addDisposable(d);
    }
}
```
编译运行，点击按钮，五秒钟后就能看到一条 toast 弹出，点击返回退出当前界面，在 logcat 里面能看到 `AbsPresenter#onDestroy()` 方法被调用：

![](https://i.loli.net/2017/12/22/5a3d0d11994c7.png)


![](https://i.loli.net/2017/12/22/5a3d0d686977f.png)

这里看到 `AbsPresenter#onDestroy()` 被自动调用了，完全不需要我们处理。



完整代码在 [这里](https://github.com/dashMrl/Android_Demos/tree/15a266e6edfd10b2c4dd39b32f6d9e66dafec66e)
