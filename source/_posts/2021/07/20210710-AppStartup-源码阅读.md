---
title: AppStartup 源码阅读
sticky: 0
date: 2021-07-10 08:44:34
updated: 2021-07-10 23:16:22
categories:
  - Android
tags:
  - Jetpack
---

## App Startup 介绍&使用

官方介绍 App Startup 是一个启动期间优化组件/库初始化的库：

> Streamline startup sequences and explicitly set the order of initialization.
>
> Instead of defining separate *content providers* for each component you need to initialize, App Startup allows you to define component initializers that share a single content provider. This can significantly improve app startup time.

介绍里提到了 ContentProvider，ContentProvider 会在应用启动（`Application#onCreate` 之前）初始化并回调 `onCreate`。基于此，很多三方库就会自定义 ContentProvider 并在 `onCreate` 中执行初始化操作，给库用户一种“不用初始化”的错觉，采用这种方式的三方库有 LeakCanary、WorkManager 等。

Trade-off 无处不在，这里也不例外。自定义 ContentProvider 虽然使库更易于使用，但代价是开销增加。

郭霖老师在[《Jetpack新成员，App Startup一篇就懂》](https://blog.csdn.net/guolin_blog/article/details/108026357)中提到，一个空 ContentProvider 也会有 2ms（特定机型）的耗时，一般初具规模的应用都会有几十上百三方库依赖，如果这些库都在启动期间初始化一个 ContentProvider，累计开销就会非常可观。

所以 App Startup 就提供一个统一的 ContentProvider，三方库们复用同一个组件，避免无意义的开销。


### 简单上手

每个初始化操作都被抽象成 `Initializer` 接口，开发者实现它并实现 `create` 方法：

```kotlin
package com.example

class UrInitializer : Initializer<Unit> {
    override create(context: Context) {
        // staff here
    }

    override fun dependencies(): List<Class<out Initializer<*>>> {
        return emptyList()
    }
}
```

然后在 `AndroidManifest.xml` 中声明并注册你自定义的初始化类：

```xml
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx-startup"
    android:exported="false"
    tools:node="merge">
    <meta-data android:name="com.example.UrInitializer"
        android:value="androidx.startup" />
</provider>
```

> 如果 `UrInitializer` 是其它某个 `Initliazer` 的依赖，则可以不在 `AndroidManifest` 声明。
>
> 另一个需要注意的是 value 取值需要写死 "androidx.startup"。

这样 `UrInitializer#create` 就会在启动期间自动执行了。

如果你不想在启动期间自动初始化，而是需要时再初始化，可以在对应的 `meta-data` 节点下添加 `tools:node="remove"`。然后在使用前手动触发初始化：

```kotlin
AppInitializer.getInstance(context)
    .initializeComponent(UrInitializer::class.java)
```


[官网](https://developer.android.com/topic/libraries/app-startup) 上有关于 App Startup 更详细的介绍。

## App Startup 实现

上面可以看到 App Startup 暴露的 API 非常少，自然它的实现也比较简单，核心逻辑在 [`AppInistialzier`](https://github.com/androidx/androidx/blob/androidx-main/startup/startup-runtime/src/main/java/androidx/startup/AppInitializer.java) 中。

应用启动时，[`InitializationProvider#onCreate`](https://github.com/androidx/androidx/blob/androidx-main/startup/startup-runtime/src/main/java/androidx/startup/InitializationProvider.java) 被调用，进而调用到 `AppInitializer#discoverAndInitialize`：

```java
public class InitializationProvider extends ContentProvider {
    @Override
    public final boolean onCreate() {
        Context context = getContext();
        AppInitializer.getInstance(context).discoverAndInitialize();
        return true;
    }
}
```

所有 `Initializer` 发现与初始化都发生在 AppInitializer 里，下面就看下 `discoverAndInitialize` 中解析 Manifest 的逻辑：

```java
void discoverAndInitialize() {
    ComponentName provider = new ComponentName(mContext.getPackageName(),
            InitializationProvider.class.getName());
    ProviderInfo providerInfo = mContext.getPackageManager()
            .getProviderInfo(provider, GET_META_DATA);
    Bundle metadata = providerInfo.metaData;
    // androidx.startup
    String startup = mContext.getString(R.string.androidx_startup);
    Set<Class<?>> initializing = new HashSet<>();
    Set<String> keys = metadata.keySet();
    for (String key : keys) {
        String value = metadata.getString(key, null);
        if (!startup.equals(value)) continue;

        Class<?> clazz = Class.forName(key);
        if (!Initializer.class.isAssignableFrom(clazz)) continue;

        doInitialize((Class<? extends Initializer<?>>) clazz, initializing);
    }
}
```

这里可以看到 `android:value="androidx.startup"` 是起一个过滤的作用，所有 meta-data 会被解析成 Bundle 中的键值对。

`doInitialize` 中使用 DFS 完成实际初始化操作：

```java
synchronized <T> T doInitialize(
        @NonNull Class<? extends Initializer<?>> component,
        @NonNull Set<Class<?>> initializing) {

    if (initializing.contains(component)) {
        String message = String.format(
                "Cannot initialize %s. Cycle detected.", component.getName()
        );
        throw new IllegalStateException(message);
    }
    Object result;
    if (mInitialized.containsKey(component)) {
        result = mInitialized.get(component);
    } else {
        initializing.add(component);
        Object instance = component.getDeclaredConstructor().newInstance();
        Initializer<?> initializer = (Initializer<?>) instance;
        List<Class<? extends Initializer<?>>> dependencies =
                initializer.dependencies();

        for (Class<? extends Initializer<?>> clazz : dependencies) {
            if (!mInitialized.containsKey(clazz)) {
                // DFS
                doInitialize(clazz, initializing);
            }
        }

        result = initializer.create(mContext);

        initializing.remove(component);
        mInitialized.put(component, result);
    }
    return (T) result;
}
```

`doInitialize` 首先会判断依赖是否成环，确保不会出现死循环。

App Startup 核心代码不过百行，原理还是非常简单。

## 不足与改进

虽然官方介绍 App Startup 能够优化启动期间三方库的初始化带来的多余性能开销，一定程度上简化代码，但是实际商业产品中有太多需要考虑的问题了，比如：

- 任务优先级：App Startup 中 component 初始化顺序是不可控的，最先被用到的服务却不是第一个初始化，造成等待。
- 线程控制：App Startup 默认在主线程初始化，但是实际上很多库并不需要在主线程初始化，将这部分任务转移至子线程可以降低冷启动开销压力；同时线程还要支持优先级，保证重要任务尽快被执行。
- 多进程：某些库可能只在特定进程初始化并提供跨进程服务，比如 push 进程。
- 监听事件：优化冷启动性能时，凡是首屏之前不需要用到的服务都不应该初始化，那么就要在首屏上屏后发出通知并初始化。
- 耗时监控：商业产品还要对性能进行监控，避免性能劣化，冷启时间增加。

GitHub 上有个 App Startup 增强版 —— [android-startup](https://github.com/idisfkj/android-startup) ，解决了一些不足，有兴趣的可以去学习一波。

后面也打算根据自己的理解造个轮子。

## 参考文章

[app-startup](https://developer.android.com/topic/libraries/app-startup)

[Decrease startup time with Jetpack App Startup](https://android-developers.googleblog.com/2020/07/decrease-startup-time-with-jetpack-app.html)
