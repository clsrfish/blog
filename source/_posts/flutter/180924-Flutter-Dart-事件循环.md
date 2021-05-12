---
title: 【Flutter】Dart 事件循环
date: 2018-09-24 18:37:58
categories:
  - [Flutter]
tags:
  - Dart
---

> 基于 Dart VM version: 2.1.0-dev.4.0.flutter-4eb879133a (Tue Sep 18 19:20:33 2018 +0000) on "macos_x64"

Dart 和 JS 类似，也是单线程的设计，所以内部存在一个**事件循环**。

基于单线程，我们可以得出这样的结论：**Dart 的函数一旦执行，便不会被打断，直到函数执行完成才会执行其他 Dart 代码**。

<!--more-->

## 事件循环和队列

和 Android 的消息机制非常类似，会有一个消息队列，然后有一个循环♻️不断的从队列里面取消息进行处理/执行。

![](https://webdev.dartlang.org/articles/performance/images/event-loop-example.png)



## Dart 中事件循环实现

Dart 事件循环实现了两条队列：**event queue**、**microtask queue** 。

- **event queue**：包含所有外部的事件，包含不局限于I/O、鼠标、绘制、isolate 消息传递，这些消息产生于 Dart 代码或者系统，例如使用 `Future`。
- **microtask queue**：这个队列的作用类似 Android 的 `sendMessageAtFront` 方法，也即该队列的事件总是会被优先处理，但是由它的名字可知，这个队列里面的事件处理绝不能是耗时计算等，否则会导致 event queue  中事件无法及时处理导致 UI 卡顿。这个队列里的消息一般都来自 Dart 代码（`scheduleMicroyask()`）。

![](https://webdev.dartlang.org/articles/performance/images/both-queues.png)



## 关于使用 Future 几点有趣的事实

- 使用 `Future#then` 设置的回调函数会在 `Future` 变成 complete 状态后立即执行而**不是**将这个回调插入队列

- 如果 `Future` 在 `Future#then` 调用之前已经是 complete 状态，那么这个回调会被插入 microtask queue。实现这样例子有：`Future.value(2333)` 。

  ```dart
  main(List<String> args) {
    Future.value("value").then(print);
    scheduleMicrotask(() => print("micro"));
    print("main");
  }
  /**
   * main
   * value
   * micro
   */
  ```

- 使用 `Future#sync` 时，传入 sync 等函数立即执行（不插入任何队列），后续操作会被添加到 microtask queue。

  ```dart
  main(List<String> args) {
    Future.sync(() {
      print("sync");
      return 2333;
    }).then(print);
    scheduleMicrotask(() => print("micro"));
    print("main");
  }
  /**
   * sync
   * main
   * 2333
   * micro
   */
  ```




> 9001、9002 bug 的问题，会导致 microtask 表现会有异常，不想说话



## Reference

https://webdev.dartlang.org/articles/performance/event-loop