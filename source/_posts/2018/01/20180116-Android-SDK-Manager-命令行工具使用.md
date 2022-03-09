---
title: Android SDK Manager 命令行工具使用
date: 2018-01-16 17:34:40
categories:
  - Android
tags:
  - Android SDK
---

一般情况下，我们都是通过 Android Studio 来进行 Android SDK 的管理的，更新啥的都是点点鼠标完成了，当然，我们知道 AS 只是做了一个封装。不过有时候，我们只是想安装更新，并不想启动 AS，那么这时候通过命令行就会轻量很多；在 CI 中，更加是没有 AS 的，那么这时候命令行操作成为了唯一的选择。

<!--more-->

在 sdk 25.2.3 及以上，Android SDK 提供的了 `android_home/tools/bin/sdkmanager` 来代替原来的 `android` 。

## 概览
先进入到 `android_home/tools/bin/sdkmanager` 来看看 `sdkmanager` 提供哪些操作选项：

```shell
$ ./sdkmanager --help
Usage:
  sdkmanager [--uninstall] [<common args>] [--package_file=<file>] [<packages>...]
  sdkmanager --update [<common args>]
  sdkmanager --list [<common args>]
  sdkmanager --licenses [<common args>]
  sdkmanager --version
```

这里看到 sdkmanager 只提供的几个操作，所以学习成本还是很少的，下面挨个学个遍。

## 显示 package
执行 `./sdkmanager --list` 就能显示 **已安装** 和 **可安装** 的包。
![](https://i.loli.net/2018/01/26/5a6a0fd31ef55.png)

## 安装 package
执行 `./sdkmanager <packages>` 就能安装指定的包了，其中 <packages> 替换成你要安装的包，如：
```shell
$ ./sdkmanager "build-tools;27.0.3" "tools"
```
这里包名就是 `--list` 输出中的 **Path** 。

如果要安装的包很多，手动输这么包名肯定要疯了，而且每次 安装/更新 都要输一遍，sdk 也提供一个使用配置文件的方式来安装：
```shell
./sdkmanager --package_file=packages.txt
```
只需要提供一个 `packages.txt` 文件就可以简化安装多个包的命令了，这个文件里面的内容就是你所要安装的所有包名，一个包占一行，像这样：
```
patcher;v4
platforms;android-27
build-tools;27.0.3
platform-tools
tools
lldb;3.0
cmake;3.6.4111459
ndk-bundle
extras;android;m2repository
extras;google;m2repository
extras;m2repository;com;android;support;constraint;constraint-layout-solver;1.0.2
extras;m2repository;com;android;support;constraint;constraint-layout;1.0.2
emulator
system-images;android-27;google_apis;x86
```

## 卸载 package
执行 `./sdkmanager --uninstall <packages>` 可以卸载指定的 package，和安装过程类似，也支持通过配置文件来卸载。

## 更新 package
执行 `./sdkmanager --update` 就可以升级所有已安装的 package。

## 其他
执行 `./sdkmanager --licenses` 可以显示所有可安装包的但是没有同意的协议，并且提供一个接受的选项。
建议在安装之前执行一遍。

执行 `./sdkmanager --version` 显示信息，没啥好说的。

## Options
sdkmanager 每条命令都提供一些命名参数，下面直接通过表格给出：

| Options                                      | Description                                                                      |
| :------------------------------------------- | :------------------------------------------------------------------------------- |
| --sdk_root=path                              | 相当于覆盖 ANDROID_HOME 的值，下载到指定的 SDK 目录 ，不过一般情况下不会使用这个 |
| --channel=channel_id                         | 可选值 {0,1,2,3}，分别代表 {Stable,Beta,Dev,Cannary}                             |
| --include_obsolete                           | 用于 `--list` 和 `--update`，是否显示一些过时的package                           |
| --no_https                                   | 强制使用 HTTP 而不是 HTTPS 进行传输                                              |
| --verbose                                    | 啰嗦模式，输出详细信息                                                          |
| --proxy={http &#124; socks}                  | 指定代理模式                                                                     |
| --proxy_host={IP_address &#124; DNS_address} | 代理服务器的 IP 地址                                                             |
| --proxy_port=port_number                     | 代理服务器端口                                                                   |

> Note: 如果想要安装一个非当前平台的 package , 可以设置环境变量 `REPO_OS_OVERRIDE` 的值（{"windows", "macosx","linux"}）来指定。


## 最佳实践
最常见的操作就是安装和更新，卸载除了在某些磁盘空间极其紧张的情况下是不太可能会执行的，所以这里针对这两个操作做一些简单的配置。

`sdkmanager` 有一点比较坑，就是通过配置文件指定需要安装/更新的包，执行完后会把配置文件删除，所以最好每次拷贝一下在进行操作。
为了方便的操作，我们可以在 `ANDROID_HOME` 目录下添加三个文件：packages.txt、install_packages.sh、update_packages.sh 来简化操作。

直接看代码，先看 install_packages.sh：
```shell
#!/bin/bash
# 保存当前路径
cwd=`pwd`
# 配置文件
package_file=packages.txt
# sdkmanager 所在的相对路径
manager_dir=tools/bin/
# 拷贝一份配置文件到 sdkmanager 所在目录
cp ${package_file} ${manager_dir}
# 进入 sdkmanager 所在目录
cd ${manager_dir}
# 先签一下不平等条款
./sdkmanager --licenses
# 看看 sdkmanager 信息
./sdkmanager --version
# 逐个安装 package
for p in $(cat ${package_file})
do
    ./sdkmanager "${p}" --verbose --no_https
done
# 回到之前的目录
cd ${cwd}
```

再看 update_packages.sh：
```shell
#!/bin/bash
cwd=`pwd`
manager_dir=tools/bin/
cd ${manager_dir}
./sdkmanager --update --verbose --no_https
cd ${cwd}
```
这个比安装的简单多了，就不赘述了。



> 最近在搭建 Jenkins 时候，因为是登录到了真实的服务器上进行操作，意外地发现被墙了，泣不成声。然后想到了国内的镜像服务，不过都失败了，最后在 [这里](http://blog.csdn.net/lq18111292117/article/details/53447479) 找到了答案。
>
> 访问 http://ping.chinaz.com/ ，然后测试 dl.google.com ，把你所在地区对应的 IP 写入 `/etc/hosts` ，然后重新执行命令就好了。
