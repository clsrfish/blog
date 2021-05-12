---
title: GitHub Flow
date: 2018-03-31 09:44:20
categories:
  - Git
tags:
  - GitHub Flow
---

在 [这篇](http://xinsbackyard.tech/posts/9144d7b5.html) 文章中，Git Flow 整体管理看起来非常规范，但是一个很明显的问题就是太复杂并需要长期维护两个分支，分支太多，导致需要频繁的进行分支切换，这些过程中难免不会出问题；特别是现在的大型工程都采用持续集成/交付进行管理，这样就需要有一个分支能够保证上面的代码都是随时都可以发布的。

<!--more-->

GitHub Flow 就是对 Git Flow 的一种精简，并且非常适用于持续集成。



## 理解 GitHub Flow

![](https://i.loli.net/2018/03/31/5abef3132dff2.jpg)



GitHub Flow 相对于 Git Flow，它只保留了一个 master 分支，任何功能的添加都需要创建一个新分支，并且这些新的分支在被其他成员审阅之前是不会被合并到 maste 分支上的。显然，master 分支总是处于一个可发布的状态，同时这种模式非常适合不断有新功能添加的项目。

如果有多个人（团队）进行开发，GitHub Flow 推荐使用 pull request 的方式来进行合作。



## 管理流程

Git Flow 的管理流程也非常简单，大致的分为下面的几个步骤：

- 创建功能分支
- 提交功能分支
- 请求一个 pull request（GitLab 中叫做 merge request）
- 讨论并进行代码审查
- 发布并进行测试
- 合并到 master ，如果 pull request 中使用了特定的关键字，如 `Close #32` ，那么相关 issue 会被自动关闭



## 问题

这种模式的好处是可以快速的进行功能添加，非常灵活迅速，很适合一些开源项目。但是对于大多数的商业项目，例如 iOS App，每次上架新版都需要审核	，但是审核的这段时间开发不能停止，这就导致线上的版本于 master 分支相比，不总是同步。所以为了解决这个问题，还是需要开一个 production 分支来追踪线上版本，进行 bug 修复更改小版本号以及合并回主分支。



> 参考链接：
>
> https://help.github.com/articles/github-flow/
>
> https://guides.github.com/introduction/flow/
