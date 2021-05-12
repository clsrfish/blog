---
title: "[Android 踩坑] 明文传输"
date: 2018-09-29T10:52:51+08:00
categories:
    - Android
tags:
    - HTTP
---

昨天晚上 Glide 加载图片突然出现：
```
Exception: IOException java.io.IOException: Cleartext HTTP traffic to * not permitted
```
明确指出不允许明文传输，测试机器是 Android P 的模拟器。

<!--more-->

这个问题是 Android P 在安全方面的一个变更，所以也是坑了一大波人，即 SO 上有答案。

## 解决办法
去年开始 Google 和 Apple 都在 HTTPS 方面加紧推进，但是并没有强制，只是在一些方面设一些小坑。Android P 之前明文传输还是默认支持的，但是在 Android P 及更高的版本上明文传输默认被禁止，所以如果不加配置就运行在 Android P 设备上就会出现异常。

### 方案一
方案一比较简单，`AndroidManifest.xml` 添加 **一行** 配置就行了：
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest ...>
    ...
    <application
        android:usesCleartextTraffic="true">
        ...
    </application>
</manifest>
```

### 方案二
比较推荐这种，灵活性更高。
首先提供一个配置文件：
```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">your.domain</domain>
    </domain-config>
</network-security-config>
```
然后把这个配置文件在 `AndroidManifest.xml` 中声明：
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest ...>
    ...
    <application
        ...
        android:networkSecurityConfig="@xml/network_security_config"
        ...>
        ...
    </application>
</manifest>
```

这个配置文件可以提供更细粒度的域名配置、证书配置等，具体的可以看[官方文档](https://developer.android.com/training/articles/security-config#CleartextTrafficPermitted)
