---
title: React Native 之环境搭建
date: 2017-12-26 11:01:59
categories:
  - [Android]
  - [React Native]
---

> 来自 GitBook，完成第一篇迁移

最近 React Native、weex 等跨平台框架都好火的样子，要是再不看看，可能就要听不懂他们前端的话了。万事开头难，搭环境、跑 Demo 啥的基本上没有不遇坑，当然解决之后也是蛮开心的。

<!--more-->

## 平台
OS：Ubuntu 17.04
IDE：Android Studio

> 本来呢，不想在主力机上装各种环境，便想在只有 Windows 小破旧电脑上装，结果还是受不了 Windows ，于是也给 旧电脑装了 Ubuntu。

## 配置过程
我是按照ReactNative中文社区的 [教程](https://reactnative.cn/docs/0.47/getting-started.html#content) 来配置的，一套流程走下来基本上也没什么问题。

### node 安装
打开 Terminal 执行下面几条命令就完成了 node 的安装：
```shell
$ sudo apt-get install -y build-essential    # -y 表示不留缓存
$ curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
$ sudo apt-get install -y nodejs
$ sudo ln -s /usr/bin/nodejs /usr/bin/node    #进行软链接
```
这里遇到了一个问题，在执行完第二条命令的时候，最后输出了一段提示：
>\## Confirming "zesty" is supported...
>
>\+ curl -sLf -o /dev/null 'https://deb.nodesource.com/node_5.x/dists/zesty/Release'

>\## Your distribution, identified as "zesty", is not currently supported, please contact NodeSource at https://github.com/nodesource/distributions/issues if you think this is incorrect or would like your distribution to be considered for support

大概意思就是说当前的运行的 Ubuntu 发行版还没有得到正式的支持，不过也没有感觉到不兼容的问题，忽略就好了。如果是其他版本的操作系统，可能就没有这个问题了。

### npm 、yarn 、react-native-cli 安装
上一步安装完 node 似乎并没有帮我们一并安装 npm ，所以还得多一条命令：
```shell
$ sudo apt install -y npm
$ sudo npm install -g yarn react-native-cli
```
**yarn** 是 FB 提供的 npm 替代品，能够加速 node 模块的下载（照抄的）。
**react-native-cli** 是 ReactNative 命令行工具，有他之后我们就可以在 Terminal 里面完成 创建、初始化、更新、运行打包服务（packager）等任务了。

虽然说 yarn 加速node 模块下载，如果源在高墙之外，估计想快也快不起来。这里我们还要给 yarn 设置一下镜像源：
```shell
$ yarn config set registry https://registry.npm.taobao.org --global
$ yarn config set disturl https://npm.taobao.org/dist --global
```

> 其实我个人不是很喜欢这种更改镜像的办法，看自己梯子的速度吧

### Android Dev 环境

#### JDK
安装之前先下载可能存在的 OpenJDK，执行：
```shell
$sudo apt purge openjdk-\*
```

首先前往 [JDK 站点](http://www.oracle.com/technetwork/java/javase/downloads/index.html) 下载一个合适的 JDK tar.gz 压缩包。下载完之后我们执行命令来进行安装：
```
# 解压到指定目录
$ sudo mkdir -p /usr/local/java            #创建 JDK 安装目录
$ tar -zxvf jdk-8u144-linux-x64.tar.gz -C /usr/local/java    #这里文件名可能不一样

# 配置ubuntu的JDK和JRE的位置， jdk1.8.0_144 替换成你的目录名
$ sudo update-alternatives --install "/usr/bin/java" "java" "/usr/local/java/jdk1.8.0_144/bin/java" 1
$ sudo update-alternatives --install "/usr/bin/javac" "javac" "/usr/local/java/jdk1.8.0_144/bin/javac" 1
$ sudo update-alternatives --install "/usr/bin/javaws" "javaws" "/usr/local/java/jdk1.8.0_144/bin/javaws" 1

# 配置Oracle为系统默认JDK/JRE
$ sudo update-alternatives --set java /usr/local/java/jdk1.8.0_144/bin/java
$ sudo update-alternatives --set javac /usr/local/java/jdk1.8.0_144/bin/javac
$ sudo update-alternatives --set javaws /usr/local/java/jdk1.8.0_144/bin/javaws
```
完成这些步骤后 JDK 环境就配好了，有些文章可能说还要配置环境变量，不过不配置也能够正常使用。

#### Android Studio
Linux 版本的 SDK 和 Studio 都只提供zip，非常友好（之前用 Windows 也一直用的这种）。
先去 [Android 官方文档网站](https://developer.android.com/studio/index.html) 下载好压缩包。下载好之后还是使用命令行进行解压(安装)：
```
$ wget https://dl.google.com/dl/android/studio/ide-zips/3.0.0.10/android-studio-ide-171.4263559-linux.zip -P ~/Downloads
$ mkdir ~/Android
$ unzip ~/Downloads/android-studio-ide-171.4263559-linux.zip -d ~/Android
```
解压完成也就安转好了，我之前安装一直都是下载 Studio 和 SDK 两个压缩包，刚刚看文旦才知道只下载 Studio 就可以了，反正到时候还是会下载 SDK 的。
我们接着运行 Studio 来完成 SDK 的安装，也可以顺便进行一些个性化设置：
```shell
$ cd ~/Android/android-studio/bin
$ ./studio.sh &
```
在下载 SDK 的界面，我们把 SDK 路径设为 `~/Android/android-sdk` ，这里只是为了后面的讲述方便，也可以自行更改。
Linux 也无法避免需要配置 SDK 环境变量的问题，打开 `~/.bashrc` ，在你喜欢的位置（推荐最后面）加入下面两行：
```
export ANDROID_HOME=~/Android/android-sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```
然后执行：
```shell
$ source ~/.bashrc
```
Android 开发环境也配置好了。至于 ReactNative 中文社区教程中说的要下载对应版本的 build-tools 啥的，我们先忽略，后面会提到。


> 至于其他的工具或配置选项，有兴趣就看 中文社区 的教程。


## 测试
随便找个没有超级用户权限的目录，执行下面的操作：
```shell
$ mkdir -p ~/Documents/AnroidProjects
$ cd ~/Documents/AndroidProjects
$ react-native init AwesomeRN
$ cd AwesomeProject
$ react-native run-android
```
我可能比较倒霉，第三条第五条命令报错，GitHub、SO 上逛了 n 圈，遇到类似或相同错误的人还不少，下面讲讲我遇到的错误表现和解决办法。

### 第三条：初始化项目
执行完第三条命令，最后 Terminal 输出了如下错误：
> this._nextStatusStr = util.format(format, ...args)
>
> ​                                     ^^^
>
>
> SyntaxError: Unexpected token ...
>    at exports.runInThisContext (vm.js:53:16)

最终在 [这里](http://blog.csdn.net/xocom/article/details/76933996) 找到了解决方案：
```shell
$ sudo npm install -g npm
$ sudo npm cache clean -f
$ sudo npm install -g n
$ sudo n stable
```
具体干了什么我也不清楚，大概是升了个级，反正问题解决了。所以在安装完 npm 之后执行上面的操作就可以避免这个错误了。
再次执行第三条命令，成功后会得到下面的提示：
```
To run your app on iOS:
   cd /media/xinliu/Files/Projects/Android/AwesomeRN
   react-native run-ios
   - or -
   Open ios/AwesomeRN.xcodeproj in Xcode
   Hit the Run button
To run your app on Android:
   cd /media/xinliu/Files/Projects/Android/AwesomeRN
   Have an Android emulator running (quickest way to get started), or a device connected
   react-native run-android
```

### 第五条：运行
真没想到在这里还会遇到坑，敲入命令， Enter 一扣，立马见到输出中有：
```
Starting JS server...
Building and installing the app on the device (cd android && ./gradlew installDebug)...
```
紧接着输出的就是执行 `./gradlew installDebug` 的输出（中间会下载gradle 和一些其他的模块），眼看进度在增长，最后跑出个异常：
```
* What went wrong:
Execution failed for task ':app:mergeDebugResources'.
> Error: java.util.concurrent.ExecutionException: java.lang.RuntimeException: AAPT process not ready to receive commands

* Try:
Run with --stacktrace option to get the stack trace. Run with --info or --debug option to get more log output.

BUILD FAILED

Total time: 7.096 secs
Could not install the app on the device, read the error above for details.
Make sure you have an Android emulator running or a device connected and have
set up your Android development environment:
https://facebook.github.io/react-native/docs/android-setup.html
```
然后各种搜索，见得最多的是执行 `cd android && ./gradlew clean` ，这不就是 “clean project” 么，本以为有效，然并卵。
后来还是在 [SO](https://stackoverflow.com/questions/40284811/run-react-native-app-in-device) 上找到了答案，修改 "android/app/build.gradle"：
```
compileSdkVersion 26
buildToolsVersion "26.0.1"

minSdkVersion 21
targetSdkVersion 26
```
我都给换成最新的，然后居然成功了。中文社区教程中还强调了只能 **buildToolsVersion “23.0.1”** ，特别是看到有些文章给出的答案是按照中文社区的教程重新来一遍，真的是坑。所以之前并按照教程中说的安装特定版本 build-tools 啥的。
如果此时有模拟器正在运行，执行完第五条命令后就应该能够跑起来了。用真机测试的话，看 [这里](https://reactnative.cn/docs/0.47/running-on-device-android.html#content)。

> 其实也可以不修改 gradle 脚本，因为第五条命令的作用就是打包一个 js bundle ，然后在 8081 端口启动 nodejs 服务器，再使用 gradle 进行 apk 打包安装。所以我们可以使用 Android Studio 来打包安装，然后在 `AwesomeRN` 目录执行 `react-native start` 启动服务器，最终效果是“一样”的。


## 小测试
安装好应用之后，第一次打开应用会跳转到授权界面，然后再回到 app，这时可能会看见 app 顶部闪过的绿色提示：“loading from localhost：8081”，似乎有点动态从服务拉取界面的意思。我们进入 app 在系统内部位置：`/data/data/com.awesomern`，然后里面会有一个 **files** 文件夹，里面有个 **ReactNativeDevBundle.js** 文件，刚才加载的就是这个文件。干点坏事，把它删了，关闭应用之后重新进入，又有可能看见闪过的绿色提示，回到刚才的 “files” 目录，会发下刚删掉的文件又出现，仔细看还会发现时间戳也变了。

还有一个问题就是这个 bundle 有点大，弱网环境的加载速度的肯定不能忍，配合上 **rsync** 或 **bsdiff** 等差量算法来拉去差量包会是一个比较好的选择。

## 总结
成功跑起来很开心，ReactNative 的实时更新界面确实很棒，虽然一个空壳 App 打出来就 TM 10多M。
