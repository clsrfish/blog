---
title: Git Flow（译）
date: 2018-03-31 00:35:31
categories:
  - Git
tags:
  - Tools
---

在这篇文章中，我将会向大家讲解我大约一年前引入一些项目（公司或者私有的）里并且被事实证明为非常成功的开发模式。我早就想写一些关于这方面的东西，但是直到现在才找到时间来完整地完成这些东西。这里我不会讨论任何项目细节方面的东西，仅仅讨论分支策略和发版管理。

<!--more-->

![](http://nvie.com/img/git-model@2x.png)

## 为什么选择 Git

网上有各种关于 Git 和其他版本控制系统的优缺点比较，当然也有很多意见不一致的地方。作为一名开发者，我更偏向于使用 Git。Git 确实改变了开发者对于分支管理的思考方式。在传统的 CVS/Subversio 的世界中，分支合并和创建通常被认为有一点吓人（通常是冲突）并且你一段时间内只会做一次。

但是使用 Git，这些操纵将会变得非常简单，并且它们会成为你日常工作流中核心的一部分。例如，在 CVS/Subversion 的文档中，分支的创建和合并被安排在最后三章作为高级功能；与此同时，所有的 Git 文档里面，这些都是在前三章中的基础部分进行讲解的。

由于 Git 的简便性和可复现性，分支创建与合并再也不令人望而生畏。版本控制系统本就应该只辅助完成分支的创建于合并。

关于工具的讨论就到这里，让我们接着看开发模式。接下来我要讲解的开发模式，不过是一套流程，为了更好地管理开发进展，每个团队成员都必须遵守它。



## 去中心化和中心化

我们使用一个中心仓库来配合分支管理模型。需要注意的是，这个中心仓库仅仅是被看作中心仓库，毕竟 Git 是去中心化版本控制系统，这里只是为了便于理解。我们通常把这个中心仓库叫做 **origin** ，大多数 Git 用户应该非常熟悉这个名字。

![](http://nvie.com/img/centr-decentr@2x.png) 每个开发者从这个仓库拉取或向它提交代码。除了这个中心化的 **pull-push** 关系外，每位开发者还会从其它的子团队拉取代码。例如，在向中心仓库提交之前，这种模式对于那种有几个团队一起开发一个功能的时候非常有效。在上面的图示中，有由 Alice 与 Bob、Alice 与 David 以及 Clair 与 David 组成的子团队。



## 主要分支

![](http://nvie.com/img/main-branches@2x.png)

一个比较核心的问题，这个开发模式受现有开发模式的启发。中心仓库保持两个永久的分支：

- master
- develop

origin 的 master 分支，大部分 Git 用户都不会陌生。与 master 分支共存的还有一个 develop 分支。

我们认为 origin/master 分支上的代码总是对应着一个预发布状态的代码。

origin/master 分支存放着下一个版本的更改。有些人把这个分支叫做 ”integration branch“。所有的 nightly 自动化构建都是从这个分支产生的。

当 develop 分支的代码达到一个稳定状态并且可以发布时，所有的更改都应该被合并到 master 分支上，并且打上版本号的 tag。关于这个过程更加详细的信息将会在下面讲解。

因此，每次变更合并到 master 分支，都代表着一个生产环境发布。这一点上我们会非常谨慎，所以我们可以使用 Git hook 脚本来使得当变更提交到 master 上时，代码会自动构建并发布到我们的生产服务器上。



## 支撑分支

在 master 和 develop 分支之外，我们的开发模式使用一些支撑分支来辅助多个团队并行开发，追踪功能变更，准备版本发布以及快速修复线上问题。不像 **主要分支** ，这些分支通常有一个有限的生命周期，因为它们最后都会被移除。

这些不同的分支是：

- Feature branches
- Release branches
- Hotfix branches

这些分支有它们各自的目的，并且有一套严格的规则来限制它们从哪些分支产生，以及最终合并到哪些分支。我们马上就会讨论这些规则。

毫无疑问，这些分支在技术的角度来讲是比较“特殊的”。它们根据使用方式来进行分类，当然它们也还是普通的分支。



### Feature braches

![](http://nvie.com/img/fb@2x.png)

- 可能产生于：

  develop


- 必须合并到：

  develop


- 命名要求：

  除了 master、develop、release-\* 、hotfix-\*

feature 分支通常用来为下一个或者接下来的版本开发新的功能。一个功能分支最终被合并到哪一个release版本是未知的。只要这个功能还在开发，功能分支就会一直存在，但是最终还是会被合并到develop分支或者抛弃并删除。

功能分支通常指存在于开发者的仓库中，并不会提交到 origin 中去。

####  创建 feature 分支

```shell
$ git checkout -b feature-hello develop
```

将会从 develop 分支创建 feature-hello 分支。

#### 合并分支

```shell
$ git checkout feature-hello
$ git merge develop
$ git checkout develop
$ git merge feature-hello
$ git branch -d feature-hello
```

这里会先将 develop 分支合并到 feature 分支，最后再合并回 develop 分支，这样可以避免在 develop 分支上解决冲突，避免 develop 分支被污染，最后删除 feature 分支。



### Release branches

- 可能产生于：

  develop

- 必须合并到：

  develop 和 master

- 命名要求：

  release-\*

release 分支为一个生产发布做准备。这里允许做一些小的 bug 修复并准备一些发布所需的元数据（如 版本号、构建日期等）。通过在 release 上做这些工作，develop 可以继续为下一次大版本发布做准备。

当 develop 分支达到一个比较理想的发布状态时，就可以创建 release 分支了。这时还需要保证所有的功能都开发完毕并且合并到了 develop 分支。下一个版本的功能分支必须在这次的 release 分支创建之后才能创建。

release 分支在创建之后就会拥有一个版本号，但是这个时候还不能确定我的下一个 release 版本号是多少，因为这个还会受一系列因素的影响，比如代码提交次数等。

#### 创建 release 分支

release 分支从 develop 分支产生。

```shell
# 版本号依实际情况变化
$ git checkout -b release-1.2 develop
```

这个新分支会一直存在直到正式发布。在此之前，小的 bug 修复可以提交到这个分支。这个分支上禁止添加新功能。release 分支最后必须合并到 develop 和 master 分支。

#### 结束 release 分支

当 release 分支的代码到达可以真正发布的状态时，需要做一些处理工作。首先， release 分支必须合并到 master 分支，然后 master 分支上的 commit 必须打上 tag 用于历史版本的查询。最后，release 分支上的变化必须合并到 develop 分支。

```shell
$ git checkout master
$ git merge release-1.2
$ git tag -a 1.2
$ git checkout develop
$ git merge release-1.2
$ git branch -d release-1.2
```



### Hotfix branches

![](http://nvie.com/img/hotfix-branches@2x.png)

- 可能产生于：

  master

- 必须合并到：

  develop 和 master

- 命名要求：

  hotfix-\*

hotfix 分支和 release 分支很像，它们都准备了一次新的版本发布，尽管 hotfix 是预料之外的。当线上版本出现非预期的问题时，就会创建 hotfix 分支，并且标记上版本信息。

利用 hotfix 分支可以做到一个成员继续开发，而另一个成员进行 bug 修复。

#### 创建 hotfix 分支

从 master 分支创建 hotfix 分支，例如当前 master 版本号为 1.2，那么 hotfix 版本号就应该为 1.2.1。

```shell
$ git checkout -b hotfix-1.2.1 master
```

#### 结束 hotfix 分支

当完成 bug 修复后，hotfix 分支需要被合并到 master 和 develop 分支。这部分操作和 release 分支很像：

```shell
$ git checkout master
$ git merge --no-ff hotfix-1.2.1
$ git tag -a 1.2.1
$ git checkout develop
$ git merge --no-ff hotfix-1.2.1
$ git branch -d hotfix-1.2.1
```



## 总结

这里并没有引入什么新的东西到分支模型，文章开头的图示被证明对我们的项目非常有帮助。它展现了一个易于理解的精致思维模型，并且使得团队成员能够理解整个项目的分支管理和发布过程。


> 原文链接: http://nvie.com/posts/a-successful-git-branching-model/?spm=a2c4e.11153940.blogcont68655.9.9277436ekX25Dp
> 参考链接：
> https://yq.aliyun.com/articles/68655
>
> http://nvie.com/posts/a-successful-git-branching-model/?spm=a2c4e.11153940.blogcont68655.9.9277436ekX25Dp