---
title: "创建带参的 ViewModel 实例"
date: 2018-08-18 11:25:06
categories:
  - Android
tags :
  - ViewModel
---

Android Jet Pack 的 `ViewModel` 为开发者在处理配置变更时数据保存带来了一定便捷性，但是如果定义的 `ViewModel` 子类构造器有参数，那么还要提供一个对应的 `ViewModelProvider.Factory` 实现。
<!--more-->
那么问题来了，这都是一些样板代码，枯燥无意义，所以更加优雅的方式还是通过工具自动创建。

## 工具实现
不废话了，直接上代码：
```java
public class VMFactory {
    private static final Map<String, Constructor<?>> cacheMap = new WeakHashMap<>();

    public static <T extends ViewModel> T viewModel(Fragment frag, Class<T> vmClazz, final Object... params) {
        return ViewModelProviders.of(frag, factory(vmClazz, params)).get(vmClazz);
    }

    public static <T extends ViewModel> T viewModel(FragmentActivity activity, Class<T> vmClazz, final Object... params) {
        return ViewModelProviders.of(activity, factory(vmClazz, params)).get(vmClazz);
    }

    private static <T extends ViewModel> ViewModelProvider.Factory factory(Class<T> vmClazz, final Object... params) {
        if (params == null || params.length == 0) {
            return new ViewModelProvider.NewInstanceFactory();
        } else {
            return (ViewModelProvider.Factory) Proxy.newProxyInstance(vmClazz.getClassLoader(), new Class[]{ViewModelProvider.Factory.class}, (obj, method, objs) -> {
                if (method.getDeclaringClass() == Object.class
                        || Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && method.isDefault()
                        || !method.getName().equals("create")) {
                    return method.invoke(obj, objs);
                }
                StringBuilder keyBuilder = new StringBuilder(objs[0].getClass().getCanonicalName());
                Class<?>[] paramTypes = new Class[params.length];
                for (int i = 0; i < params.length; i++) {
                    paramTypes[i] = params[i].getClass();
                    keyBuilder.append(paramTypes[i].getCanonicalName());
                }
                final String key = keyBuilder.toString();
                Constructor<?> constructor = cacheMap.get(key);
                if (constructor != null) {
                    return constructor.newInstance(params);
                }
                for (Constructor<?> declaredConstructor: vmClazz.getDeclaredConstructors()) {
                    if (areAssignableFrom(declaredConstructor.getParameterTypes(), paramTypes)) {
                        cacheMap.put(key, declaredConstructor);
                        if (!declaredConstructor.isAccessible()) {
                            declaredConstructor.setAccessible(true);
                            Object instance = declaredConstructor.newInstance(params);
                            declaredConstructor.setAccessible(false);
                            return instance;
                        }
                        return declaredConstructor.newInstance(params);
                    }
                }
                cacheMap.remove(key);
                throw new RuntimeException("cannot create an instance of " + vmClazz.getCanonicalName() + " with params: " + Arrays.asList(paramTypes).toString());
            });
        }
    }

    private static boolean areAssignableFrom(Class<?>[] constructorParameterTypes, Class<?>[] paramTypes) {
        if (constructorParameterTypes.length == paramTypes.length) {
            for (int i = 0; i < paramTypes.length; i++) {
                if (!constructorParameterTypes[i].isAssignableFrom(paramTypes[i])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
}
```

再简单 BB 几句。

可以看到 `factory` 方法里主要用到了 **动态代理**，其实也可以直接创建匿名内部类，我们不纠结这个问题。

通过 `vmClazz.getDeclaredConstructors()` 拿到所有构造器，然后通过传入的参数逐个进行匹配直到找到目标构造器。然后将目标构造器丢到缓存里，毕竟找到一个构造器执行了挺多的反射操作。

通过构造器匹配的方式，调用 `ViewModel` 哪个构造器完全取决于你传什么参数。即使构造器是 `private` 修饰，也能完成实例创建，其实如果了解 `ViewModel` 创建及保存原理，用 `private` 修饰其实应该是一个最佳实践。


## 性能问题
移动设备上的 **反射** 还是挺扎眼的，始终逃不过性能这道坎，所以也做了一个简单的性能测试。
在我的 一加3 Android 8.1.0 上对比通过 `ViewModelProvider.Factory` 实例和动态代理对象的创建 `ViewModel` 耗时，后者耗时大概是前者的 **2.5** 倍，当然这只是 **初次执行** 的情况，当动态代理方式有缓存之后，两者耗时基本一致了。

## 后话
不管怎么样，实例创建还是通过反射来完成的（虽然 `ViewModelProvider.NewInstanceFactory` 也是通过反射），肯定存在性能损耗，所以后续优化可以从访问修饰符上入手，目前的想法是通过 **注解处理器** 创建一个辅助类，收集所有 `ViewModel`，在编译时根据访问修饰符选择 `new` 还是 `Constrctor#newInstance`。


完整代码在 [这里](https://github.com/dashMrl/AutoVM)，里面也有之前实践过程中写的编译时创建 `ViewModelProvider.Factory` 实现类的注解处理器。
