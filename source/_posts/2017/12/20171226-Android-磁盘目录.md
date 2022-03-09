---
title: Android 磁盘目录
date: 2017-12-26 11:16:28
categories:
  - Android
---

每次遇到存储这一块的时候，都要去看 [官方文档](https://developer.android.com/training/basics/data-storage/files.html) ；但是这里有一个蛋疼的问题就是，官方文档中没有对特定方法返回的路径进行说明。所以每次都会在这个问题上耗费十多分钟来 **看文档** 和 **写 Demo** 来找到符合要求的方法，这次就做个笔记，以防不时之需。

<!--more-->

## 内部存储
官方术语：**Internal Storage**
我的理解就是 **系统存储空间** ，也就是一般情况下，用户无法通过文件管理器查看。应用安装的时候会分配这样的一个空间，当用户卸载的时候系统会清理掉这部分存储空间。
获取方式：
```java
// /data/user/0/your.package.name/cache
Context.getCacheDir().absolutePath()

// /data/user/0/your.package.name/files
Context.getFilesDir().absolutePath()
```

这两种也能够满足大部分的需求了。


## 外部存储
官方术语： **External Storage**
理解成 **用户存储空间** 可能比较恰当，因为用户通过一个文件管理器就可以把这部分存储空间看个遍（除非有这么闲）。
这部分空间又要分成两部分：**private** + **public**
### private 外部存储
这部分空间通常用来进行缓存或一些私有的文件。虽然系统没有提供 API 来读取其他应用的这部分空间，但是可以简单通过 **字符串拼接** 的方式来直接操作其他应用的这部分空间，所以这部分空间的 **安全性不是很高** ，所以一些关乎应用正常运行的文件还是会被丢到 **internal Storage** 。
当应用被用户卸载的时候，这部分空间也会像内部存储一样被清理。
获取方式：
```java
// /storage/emulated/0/Android/data/your.package.name/cache
Context.getExternalCacheDir()

// /storage/emulated/0/Android/data/your.package.name/files
Context.getExternalFilesDir(null)
Context.getExternalFilesDir("")

// /storage/emulated/0/Android/data/your.package.name/files/dirName
Context.getExternalFilesDir("dirName")
```


### public 外部存储
这部分空间所有应用都能共享，会有一些诸如：Alarms、Music、Pictures 等为命名的文件夹，这也是用户最容易接触到的存储空间。如果应用在这里放了啥东西，就算应用被卸载这些文件还是会继续留着，所以很多 app 就在这里放一些缓存或者配置文件啥的，如果用户重新安装应用，能够继续使用一些配置或者缓存。
获取方式：
```java
Environment.getExternalStorageDirectory();


Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_ALARMS);
```

### 外部存储的状态
在对外部存储进行操作之前还需要检测下它的状态，比如 SD 卡被移除（现在手机都没SD 卡槽了）、PC 通过 USB 读取这部分空间的时候。
检测方式：
```java
String state = Environment.getExternalStorageState();

// 当外部存储 可读可写 时语句返回值为 true
state.equals(Environment.MEDIA_MOUNTED)；

// 当外部存储 至少可读 时语句返回值为 true
state.equals(Environment.MEDIA_MOUNTED)||state.equals(Environment.MEDIA_MOUNTED_READ_ONLY);
```

---
这些 api 应该能够满足大部分需求，然对应的路径不同的系统可能会有不同，所以通过字符串硬编码读取这些路径是绝对不可取的。