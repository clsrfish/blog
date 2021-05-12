---
title: Activity 生命周期
date: 2018-01-06 02:04:02
categories:
  - Android
tags:
  - Lifecycle
  - Activity

---

Activity 的生命周期是每位 Android 开发都必须掌握的基本知识，以致于几乎所有的 Android ，入门书籍在前几章就会开始讲生命周期。这篇文章大体上是官方文档的个人理解，内容上可能会有一些出入。

<!--more-->

## 定义

随着用户的操作，应用会在几个状态之间进行一系列的切换，映射到 Activity 上就是一系列的生命周期回调：onCreate()、onStart()、onResume()、onPause()、onStop() 以及 onDestroy()。当 Activity 切换到不同的状态时，系统会调用对应的生命周期回调方法。

下图是官方对 Activity 状态转移的图示：

![](https://developer.android.com/guide/components/images/activity_lifecycle.png)

通过重写这些生命周期方法，以便在适当的时候做出处理，比如保存数据、停止音乐、释放数据库连接等，根据应用的复杂程度，并不是必须重写所有的生命周期回调方法。



## 生命周期方法

这一节会分别对主要生命周期回调进行一些说明。

### onCreate()

这个方法一般情况下必须重写，系统创建 Activity 实例之后就会调用这个方法，Activity 进入 `Created` 状态。这个回调方法里面主要完成一些整个 Activity 生命周期中只需要执行一次的逻辑，例如初始化控件等。 Activity 不会在这个方法停留，执行完后马上相继调用 `onStart()` 和  `onResume()` 。



### onStart()

当应用进入 `Started` 状态时，系统会调用这个方法，这是 Activity 对用户可见，但是还不能和用户进行交互。这个方法里面主要做一些 UI 相关的初始化操作，这个方法执行完 Activity 就会迅速进入下一个状态 `Resumed` 。



### onResume()

当 Activity 进入 `Resumed` 状态，系统也会调用这个方法，同时 Activity 也能和用户进行交互了。Activity 一旦进入 `Resumed` 状态，将会一直保持这个状态，知道有事件使得当前 Activity 失去焦点，例如来电、返回 HomeScreen 等。当 Activity 每次回到前台时，系统都会调用这个方法，所以不要在这个方法里面进行非必须的开销大的初始化操作。



### onPause()

当系统调用这个方法的时候，表示 Activity 失去焦点，进入 `Paused` 状态，变得不可交互，但是还是可见的。这个方法里面不适合做一些诸如数据保存、网络请求等重量级的操作，应该考虑将它们交给 `onStop()` 来完成，否则一个很常见的问题就是会导致启动其它 Activity 变得很慢。

这个方法的执行完成 **不代表** Activity 离开 `Paused` 状态，只有当这个 Activity 变得 **完全不可见** 时才会转入 `Stopped` 状态。



### onStop()

当 Activity 变得 **完全不可见** 时，系统就会调用这个方法，同时进入 `Stopped` 状态，并且从 WindowsManager 上解绑。这时可以做一些相对比较重的资源释放操作。这时候 Activity 会呆在内存里头，直到进入 `Destroyed` 状态。



### onDestroy()

在 Activity 被销毁之前这个方法会被调用，这也是生命周期里面的最后一个方法，所有的资源释放操作必须在这个方法结束前完成。



## 生命周期其它

在基本的流程之外，还有一些经典的知识点需要我们能够通过生命周期来进行解释。

### onStart/onPause、onResume/onStop

有些初学者可能并没有很清楚地知道为什么需要两对生命周期回调，其实这里抓住要点就很好懂了，关键就是可交互与不可交互、可见与不可见。

结合启动一个窗口主题的 Activity 的问题，设置它们四的理由就很清晰了。当 ActivityA 启动一个窗口主题的 ActivityB，B获取到焦点，A 变得不可交互，但是 A 还是可见的，B 开始和用户进行交互。如果把可见性和可交互性状态交个同一对回调方法，简单推敲下就会发现问题了。



### startActivity 时两个 Activity 的生命周期

当 A 启动 B 时，它俩的生命周期回调之间的顺序如何？这个问题其实也很好理解，同样是根据不同生命周期方法调用之后 Activity 状态特点来进行判断。所以简单推敲后我们可以得到下面的顺序：

- A : onPause()
- B : onCreate()
- B : onStart()
- B : onResume()
- A : onStop()

通过这里也可以解释为什么 onPause() 里面只能做一些轻量操作，而 onStop() 里面可以进行开销稍大的操作了。



### 回收

当系统资源紧张的时候，系统会选择性杀死一些没那么重要的 Activity；系统通常不是直接杀死Activity，而是直接杀死 Activity 所在进程。进程和Activity 状态之间的关系可用下列表格表示：

| 被杀可能性 | 进程状态                                   | Activity 状态             |
| ---------- | ------------------------------------------ | ------------------------- |
| Least      | Foreground（having or about to get focus） | Created、Started、Resumed |
| More       | Background（lost focus）                   | Paused                    |
| Most       | Background（not visible）                  | Stopped                   |
| Most       | Empty                                      | Destroyed                 |
