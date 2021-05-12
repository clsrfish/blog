---
title: Retrofit 拆轮子之构建流程分析
date: 2018-01-06 01:49:39
comments:
  - Android
tags:
  - Retrofit
---

在使用 OkHttp 的时候，还是要自己构建 Request 的，我们的目的是请求一个 url 并拿到数据，构建流程不利于逻辑清晰，特别是当需要 Post 上传数据的时候。Square 显然是看到了这个问题，便推出了 Retrofit 来解决这个问题。

<!--more-->

Retrofit 使用注解的方式来定义一个后端接口，在 **运行时** 解析，动态构建出请求逻辑并执行。有时候还是会遇上一些坑，所以最快捷的方式就是阅读它的源码，知道了内部逻辑，自然而然就知道了问题出在哪里。

> 这里基于 Retrofit：2.4.0-SNAPSHOT 分析

# 构建流程分析
Retrofit 简化请求的构建，使得网络请求就像简单的函数调用一样。这次就分析下面的案例：
```java
interface MyService {
  @GET("/user")
  Observable<User> getUser();
}

Retrofit retrofit = new Retrofit.Builder()
    .baseUrl("https://example.com/")
    .addConverterFactory(GsonConverterFactory.create())
    .addCallAdapterFactory(RxJava2CallAdapterFactory.create())
    .build();

MyService service = retrofit.create(MyService.class);

Observable<User> observable = service.getUser();
```

- Retrofit：2.4.0-SNAPSHOT

## 请求流程概览
忽略前面 Retrofit 实例的配置和构建，直接分析后面的请求发起过程，下面是整个流程的概览图：
![](https://i.loli.net/2018/01/06/5a4fbb5eeba30.png)

> 参照[@stay4it](http://www.jianshu.com/p/fb8d21978e38) 的流程图作了简化。

## 重要类剖析

### ServiceMethod
JavaDoc 中的注释是这样的：Adapts an invocation of an interface method into an HTTP call。大概意思就是把我们定义的接口方法包装成一个 HTTP 请求。在构建一个 ServiceMethod 实例时会解析我们定义的接口方法，解析注解以及返回值等等并确定 CallAdapter 和 Converter。

### CallAdapter
CallAdapter 是个接口，在 retrofit-calladapters 这个 module 下有它的实现类。这个类的作用是将一个 Call<R> 转换成一个 T，比如 Call<User> -> Observable<User> ，从而直接拿到想要的类型值。
```java
public interface CallAdapter<R, T> {
  Type responseType();
  //核心方法
  T adapt(Call<R> call);

  abstract class Factory {

  public abstract @Nullable CallAdapter<?, ?> get(Type returnType, Annotation[] annotations,
        Retrofit retrofit);
  }
}
```

### Converter
请求/响应体转换，将实例转换成 HTTP 能接受的形式，或者从 HTTP 中转换出想要的类型。在 retrofit-converters 这个 Module 下有它的一些实现类，如 GsonXXXBodyConverter，它能实现 Call<ResponseBody> -> Call<User> 的转换。
```java
public interface Converter<F, T> {
  T convert(F value) throws IOException;

  abstract class Factory {
    public @Nullable Converter<ResponseBody, ?> responseBodyConverter(Type type,
        Annotation[] annotations, Retrofit retrofit) {
      return null;
    }

    public @Nullable Converter<?, RequestBody> requestBodyConverter(Type type,
        Annotation[] parameterAnnotations, Annotation[] methodAnnotations, Retrofit retrofit) {
      return null;
    }

    public @Nullable Converter<?, String> stringConverter(Type type, Annotation[] annotations,
        Retrofit retrofit) {
      return null;
    }
  }
}
```

### OkHttpCall
对 OkHttp 的Call 进行了一个包装，然后完成一些 Call 的操作，这里的 Call 是指 okhttp3.Call。
