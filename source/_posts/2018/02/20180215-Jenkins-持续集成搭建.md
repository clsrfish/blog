---
title: Jenkins-持续集成搭建
date: 2018-02-15 09:26:33
categories:
  - CI
tags:
  - Jenkins
  - Gitlab
---

平时做开发，关注得比较多的是具体的开发工作，等开发完成进行部署的时候，需要做一系列繁琐的工作，例如上传到测试平台等，这些事情的价值实在是没有多少，而且保不准哪时候就会出叉子；而且这次发版的一些信息也是相对闭塞的，基本上只有参与开发的人员可以得知。所以这些工作的自动化显得尤为必要，而 Jenkins 就是这样的一种工具，当然还有很多其他的，不过它比较流行且开源免费，非常适合团队自建。

<!--more-->

> 这里以 Gitlab、Android 为例来讲解，宿主机为 CentOS，所以关于 GItLab 的安装也就不说明了。



## 准备工作

为了避免在自己机器上配置不必要的环境，造成污染，这里使用 Docker 的来进行安装。关于 Docker 的使用，不是本文的重点。

选一个你喜欢的目录，创建一个 build_jenkins.sh：

```shell
docker image rm jenkins:android -f
docker build -t jenkins:android .
```

接着创建一个 dockerfile：

```dockerfile
FROM jenkins/jenkins:2.107-alpine
LABEL maintainer "xinliugm@gmail.com"
USER root
RUN apk update \
        && apk upgrade \
        && echo "Asia/Shanghai" > /etc/timezone
USER jenkins
ENV ANDROID_HOME=/docker-android-home \
		 GRADLE_USER_HOME=/docker-gradle-home
```

这里只需要关注最后两行，这里指定了两个环境变量，等会我们会创建相应的目录用于保存 SDK 和 gradle ，通过 Volumn 挂载到 Docker 容器上。

然后再创建一个 run_jenkins.sh：

```shell
docker run \
    --rm -u root -d -p 8080:8080 -p 50000:50000 \
    -v /path2/docker-jenkins-home:/var/jenkins_home  \
    -v /path2/docker-android-home:/docker-android-home \
    -v /path2/docker-gradle-home:/docker-gradle-home \
    jenkins:android
```

接着几个目录：

```shell
mkdir docker-jenkins-home docker-android-home docker-gradle-home
```

最后创建一个 .dockerignore ：

```shell
run_jenkins.sh
build_jenkins.sh
docker-gradle-home/
docker-android-home/
docker-jenkins-home/
```

到这里，准备工作应该是已经做完了，不过因为这里是以 Android 为例，所以还要安装 AndroidSDK 到 docker-android-home，执行命令 `wget https://dl.google.com/android/repository/sdk-tools-linux-3859397.zip -O sdk.zip && unzip sdk.zip -d ./docker-android-home `  ，更多的请查看 [Android SDK Manager 命令行工具使用](http://xinsbackyard.tech/posts/cffbd71.html) 。



## 初次启动 Jenkins

上一步已经把基本的配置完成了，接着尝试启动 Jenkins。

### 构建镜像

执行  `./build_jenkins.sh` ，可能需要等几分钟，等执行完之后，执行 `docker images` 就可以看到我们构建好的镜像了：

```shell
REPOSITORY          TAG                 IMAGE ID            CREATED             SIZE
jenkins             android             ba16d690f728        5 seconds ago       226MB
jenkins/jenkins     2.107-alpine        e4a40fbe78e6        12 hours ago        223MB
```



### 启动容器

执行 `./run_jenkins.sh` ，终端输出一段 id 后容器就在后台开始运行了，不过首次启动 jenkins 为了便于解决可能出现的坑，可以去掉脚本中的 `-d` 参数。



### 访问 Jenkins

打开浏览器访问 `http://localhost:8080` ，可以看到下面的界面：

![](https://i.loli.net/2018/02/15/5a852df08d3cb.jpg)

按照提示，填入初始密码，点击 Continue 会让我们安装插件，选择推荐安装，安装好后会让你注册一个管理员账户：

![](https://i.loli.net/2018/02/15/5a85353ca25f6.png)

这里邮件地址到后面还会有用，填的时候稍微认真点。点击 Save and Finish 后就进入到了 Jenkins 的主页了：

![](https://i.loli.net/2018/02/15/5a85361cbc560.png)



## 安装插件

到这里我们已经成功搭建并启动了 Jenkins，正式开始创建项目之前，除了默认安装的插件外，还有一些其他的插件需要安装。

点击 `Manage Jenkins` ，然后点击 `Manage Plugins` ，接着选中 `Available` Tab，在搜索框中输入 “Gitlab”，选中 “GitLab”、“GitLab Authentication” 以及 “GItLab Hook” 这三个插件，然后点击 **install without restart** 。



## SSH 公钥

为了使得每一个新建项目不用重复配置密钥啥的，我们创建一个全局的密钥用来访问 GItLab 上所有的仓库。

### 创建密钥

首先需要生成 Jenkins 服务器的密钥，所以就要进入 docker 容器执行命令。

执行 `docker ps` 查看 jenkins 容器的 id，然后执行 `docker exec -it <id> /bin/bash` 就进入了容器分配的一个 shell，先执行 `su jenkins` 切换到 jenkins 用户， 最后就是执行生成密钥的命令了。



### 部署密钥至 GitLab

使用管理员账户登录 GitLab，然后点击右上角的小扳手进入 **Admin Area** ，然后选择 **Deploy Keys** ，接下来添加进去就好了。

> 也可以把SSH 公钥添加到自己的账户中，不过权限可能会有问题。



## 创建 Job

插件、密钥准备好后，就可以开始创建一个持续集成的项目了。

### 配置 GitLab 仓库

我们前面配置好了 GitLab 上的公钥，不过还不能直接访问所有的项目，所以还要设置一下。进入到你项目的仓库面板，然后进入 **Settings** 界面，选中 **Deploy Keys** ，将上一节中添加的公钥添加（**ENABLE**）到你的项目中就可以了。



### 创建 Jenkin Job

点击 **New Item** ，随便输入个名字，选中 **Freestyle Project** ，点击 **OK** 就创建了一个坑位。

![](https://i.loli.net/2018/02/16/5a86c657ea17d.png)



### 配置 Job

上一步只是创建了一个坑位，接下来还需要配置源代码地址、触发器等。

### 源码管理

最重要的是源代码在哪里。选中 **Source Code Managment** ，选中 **Git** 单选按钮🔘。

![](https://i.loli.net/2018/02/16/5a86cc53e12f4.png)

**Credential** 选择 jenkins，这是 Jenkins 自带的，默认使用 `.ssh/id_rsa` 作为私钥，下面的代码分支看自己情况。

> 这里 Jenkins 会自动尝试连接这个仓库，如果连接失败就提示错误，根据提示进行纠正就好了。

### 触发器

然后选中 **Build Trigger** 选项卡，选中 **Build when a change is pushed to GitLab.** 。

![](https://i.loli.net/2018/02/16/5a86ce82b6875.png)

提示信息里面指出，我们还需要设置 GitLab 仓库 WebHook，以便在提交代码到仓库的时候，GitLab 可以通知 Jenkins 开始构建。

所以接下来还需要再对 GitLab 项目进行配置，还是进入到 **Settings** ，然后选中 **Web Hooks** ，填入上一张图里面 **URL** 的值。

![](https://i.loli.net/2018/02/16/5a86d004de28d.png)

这样就可以在提交代码到分支的时候进行构建了。

> 因为我这里的 Jenkins 是跑的本地服务，而 GitLab 是已经上线的服务，所以触发器是无法正常工作的。



### 构建配置

上面的算是完成基础配置，真正的构建配置还没有完成。选中 **Build** 选项卡，然后在 **Add Build Step** 下拉菜单中选中 **Invoke Gradle Script** 。

![](https://i.loli.net/2018/02/16/5a86dadd835f5.png)

在 Tasks 框中填入要执行的 task 名称，就跟命令行执行 Gradle 命令差不多。

点击 **Save**

> 到这里，一个最简单的 Job 就算是创建好了



## 开始构建

点击 **Build Now** 手动开始构建，然后会在下面看到出现一个构建任务，点击去可以查看更多信息，比如 **Console Output** 。

![](https://i.loli.net/2018/02/16/5a86e72160612.png)



### 镜像问题

可能你并没有看到的如上图中的输出，而是得到如下的错误输出：

```shell
* What went wrong:
Execution failed for task ':app:mergeDebugResources'.
> Error: java.util.concurrent.ExecutionException: java.lang.RuntimeException: No server to serve request. Check logs for details.
```

这是因为我们的镜像是基于 **Alpine** 的，缺少 aapt2 依赖的一些动态链接库，这些动态链接库本应该是包含在 glibc 里面的，但是 **Alpine Linux** 自带的 glibc 是精简版，所以还需要自己安装一个完整的 glibc。

[GitHub](https://github.com/sgerrand/alpine-pkg-glibc)  上有打包好的安装包，直接拿来用就好，省得自己编译。按照 README 里面的说明，将 dockerfile 修改成如下：

```dockerfile
FROM jenkins/jenkins:2.107-alpine
LABEL maintainer "xinliugm@gmail.com"
USER root
ENV GLIBC_VERSION=2.27-r0
RUN apk update && \
        apk upgrade && \
        echo "Asia/Shanghai" > /etc/timezone && \
        # add curl for download
        apk add curl && \
        # download packages for glibc, see https://github.com/sgerrand/alpine-pkg-glibc for more info
        curl -L -o glibc-${GLIBC_VERSION}.apk \
        "https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VERSION}/glibc-${GLIBC_VERSION}.apk" && \
        curl -L -o glibc-bin-${GLIBC_VERSION}.apk \
        "https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VERSION}/glibc-bin-${GLIBC_VERSION}.apk" && \
        # install them
        apk add --allow-untrusted glibc-${GLIBC_VERSION}.apk glibc-bin-${GLIBC_VERSION}.apk && \
        # remove curl
        apk del curl && \
        # remove cache and downloaded files
        rm -fr glibc-${GLIBC_VERSION}.apk glibc-bin-${GLIBC_VERSION}.apk /var/cache/apk/*

ENV ANDROID_HOME=/docker-android-home \
		 GRADLE_USER_HOME=/docker-gradle-home
USER jenkins
```

如果没什么问题就能够正常编译了。



> 后续配置等有时间了再来补充吧