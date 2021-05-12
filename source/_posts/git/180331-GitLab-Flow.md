---
title: GitLab Flow
date: 2018-03-31 09:44:27
categories:
  - Git
tags:
  - GitLab Flow
---

GitLab Flow 在 Git Flow 和 GitHub Flow 中进行了一个折衷，避免了 Git Flow 的复杂性，又使得 GitHub Flow 不便于发版审核的问题。

<!--more-->

> GitLab 比较鸡贼，提出好几种分支管理模式，还不能满足你需求？

## 使用 production 分支

![](https://about.gitlab.com/images/git_flow/production_branch.png)

GitHub Flow 认为每一次的合并操作都会产生一个可发布的版本，但是这只适合诸如 SaaS 类应用；并且还无法处理无法精确控制发布时间或只能在规定时间里merge的问题。

这种情况下，可以开一个 production 分支来反应部署的代码。每次部署都要把 master 分支合并到 production，大概的部署时间能在 commit 记录中反映出来，如果使用脚本进行自动部署，那么时间会更加精确。



## 使用 environment 分支

![](https://about.gitlab.com/images/git_flow/environment_branches.png)

在这种分支管理模式下，master 分支作为代码上游，通过将 master 合并到 pre-productiopn 部署 pre-production 环境，同理将 pre-production 合并到 production 部署 production 环境。这种下行的方式保证所有代码在所有环境中都测试通过。如果要 cherry-pick 一个 hotfix，这个通常发生在 feature 分支上，在合并到主分支后，不要删除 feature 分支。当 master 分支上代码通过测试后（通常是CI），就可以合并到其他分支了。


## 使用 release 分支

![](https://about.gitlab.com/images/git_flow/release_branches.png)

只有当你需要将软件发布出去时（比如app），你才需要使用 release 分支。在这种情况下，每一个分支包含一个小版本号（例如 2-3-stable）。stable 分支会从 master 分支创建并且尽可能晚地创建，尽可能晚地创建可以减少后续修复 bug 所花时间（因为需要将 hotfix 代码合并到多个 stable 分支上）。

当一个 release 分支创建之后，只有非常严重的 bug 才能把代码直接合并到 release 分支，一般情况下都是先把代码合并到 master，然后通过 cherry-pick 合并到 release 分支。注意不要忘了把修复代码合并到其它有问题的分支中去。

这种模式也叫 **上游优先** ，Google 和 RedHat 也有在实践这一模式。每当一个修复被合并时，一个新的 release 分支就会被创建并且打上 tag。



## 总结
相对于 GitHub Flow ，通过增加一些分支创建策略，来实现更加复杂的功能， 本质上也没有太多的提高。所以采用怎样的分支策略，还是要考虑具体情况和需求。



> 参考链接：
>
> https://about.gitlab.com/2014/09/29/gitlab-flow/
