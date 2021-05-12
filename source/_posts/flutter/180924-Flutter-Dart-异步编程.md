---
title: 【Flutter】Dart 异步编程
date: 2018-09-24 18:37:43
categories:
  - [Flutter]
tags:
  - Dart
---

> 基于 Dart VM version: 2.1.0-dev.4.0.flutter-4eb879133a (Tue Sep 18 19:20:33 2018 +0000) on "macos_x64"

Dart 基础库提供了大量返回值类型为 `Future`  和 `Stream` 的函数，这些函数都是异步函数，当调用这些函数的时候，函数在完成一些“基础配置“后就会立马返回，而不是等待函数执行完成。


<!--more-->

## Future

在 JS 世界里，有 `Promise` ，Dart 中相应实现为 `Future` 。在语意上，`Future` 表示将来某个时间开始并完成的事情的结果，这和 `Promise` 含义相近。

下面是一个简单🌰：

```dart
main(List<String> args) {
  new Future(() {
    return "success";
  }).then((s) {
    print(s);
  });
  print("main");
}
/**
 * 输出
 * main
 * success
 */
```

所以可以知道 Future 在创建后立马返回，而不是执行里面的方法体。



### 异常处理

Future 异常处理有两种方式，一种是通过 `then` 函数的**可选命名参数**：`onError`；第二种是通过 `catchError` 方法。不过更加完善的异常处理一般是两个方式配合使用，看🌰：

```dart
main(List<String> args) {
  new Future(() {
    throw Exception("the first exception");
  }).then((_) => 12, onError: (e) {
    print('onError callback: ${e}');
    return 123;
  }).then((s) {
    throw Exception("the second exception:${s}");
  }).catchError((e) {
    print("catch ${e}");
  });
}
/**
 * 输出
 * onError callback: Exception: the first exception
 * catch Exception: the second exception:123
 */
```

从结果上看，`onError` 和 `catchError` 都可以接受到之前发生的错误，但是这两个处理的使用场景还是有细微的 差别。



## Stream

`Stream` 表示一系列数据或事件，比如点击时间和通知等。

这里直接看例子：

```dart
main(List<String> args) {
  Directory("/usr/local").list(recursive: false, followLinks: false).listen(
      (entity) {
    print(entity.path);
  }, onDone: () {
    print("onDone");
  }, onError: (e) {
    print("onError: ${e}");
  }, cancelOnError: false);
  print("main");
}
```

输出结果中，会先输出 "main"。



`Stream` 在调用 `listen` 方法之后会建立一个**订阅关系**，然后发送数据。

`Stream` 也分为两种："Single-subscription" 和 "broadcast"，前者表示只能有一个监听者，即只能调用 `listen` 调用一次；后者表示一种多播模式，可以调用多次 `listen` 与多个监听者建立订阅关系。



## async & await

前面 `Future` 在处理单次简单的异步任务时表现优异，但是当面对多次异步需求，比如两次网络请求，第二次请求依赖第一次请求的返回结果（当然这只是最简单的场景），就会出现类似**回调地狱**的问题。`async`  和 `await` 就是应对这样在问题语法层面的一种方式，它们使得**异步调用**变得像同步调用那样顺畅。

> 和 JS 一样，await 只能在 async 函数内部使用

### async 函数

async 函数和普通函数的声明方式基本没差别，你只需要在方法体之前加上 `async` 关键字就OK 了，比如：

```dart
[Future<int>] getInt() async{
    // ...
    return 2333;
}
```

除了增加了修饰符，也将返回值类型使用 `Future` 进行了包装，但是奇妙的是你并不需要自己将返回值进行包装，Dart 会帮你，如果你想自己手动包装也没问题。



### await 表达式

我们先看看怎么调用 async 函数：

```dart
main(List<String> args) {
  getInt().then(print);
  print("main");
}
/**
 * 输出
 * main
 * 2333
 */
```

假如想要 “main” 在 “2333” 之后输出，那么可以改成这样：

```dart
main(List<String> args) {
  getInt().then((i){
    print(i);
	print("main");
  });
}
```

问题得到了解决，但是面对更复杂的场景时，回调地狱还是会发生，这个时候再做做修改：

```dart
main(List<String> args) async {
  var i = await getInt();
  print(i);
  print("main");
}
```

可以看到 main 函数变成了 async 函数，同时第2行使用了 `await` 关键字。通过这样的改造，本来是异步的 `getInt()` 变成了同步的，整个调用流程看起来也更加流畅了。



### 实例代码

```dart
Future<String> _getUserInfo() async {
  print("_getUserInfo1");
  await new Future.delayed(new Duration(milliseconds: 3000), () {
    print("耗时操作");
    return "耗时操作完成";
  }).then((r) => print(r));
  return "我是用户";
}

void _loadUserInfo() async {
  print("_loadUserInfo1");
  var s = await "something";
  print(s);
  print(await _getUserInfo());
  print("_loadUserInfo2");
}

main(List<String> args) {
  print("main1");
  _loadUserInfo();
  print("main2");
}
/**
 * 输出结果
 * main1
 * _loadUserInfo1
 * main2
 * something
 * _getUserInfo1
 * 耗时操作
 * 耗时操作完成
 * 我是用户
 * _loadUserInfo2
 */
```

这里可以看到 `async ` 函数会一直执行直到 `await` 或 `return`，然后立即返回。





## sync* & async* & yield & yield*

在学习 Future、async、await 之后，接着聊聊 **Generator** （毕竟是想要取代 JS 的语言）。

关于 Generator，可以理解成一系列等待计算的序列。Dart 通过 sync*、async\* 等关键字帮助开发者快速实现自己的生成器。

> 这里我们可以将 async* 看作 async 的加强版，即你可以在 async* 函数里面使用 await



### 同步 Genrator

同步 generator 函数返回值是 `Iterable`：

```dart
Iterable naturalsTo(n) sync* {
  int k = 0;
  while (k < n) yield k++;
}
```

上面代码就实现了一个简单 Generator，调用 `naturalsTo` 后会得到一个 Iterable，但是**方法体**并不会立即执行。调用这个 Iterable 的 iterator 的 `moveNext()`，方法体会执行到 `yield` 语句（包含该语句）为止，并能通过 `iterator.current` 拿到 yield 表达式的返回值。



### 异步 Genrator

异步 generator 函数返回值是 `Stream`：

```dart
Stream asynchronousNaturalsTo(n) async* {
  int k = 0;
  while (k < n) yield k++;
}
```

同样，调用 `asynchronousNaturalsTo` 立即得到一个 `Stream` ，**方法体**也是直到调用 `listen` 之后才会执行。当执行到 `yield` 时，计算得到的结果会推给 listener，同时继续执行止步到下一句 `yield` 之前。



### 实例代码

上面的描述还是比较抽象，看起来同步异步 Generator 似乎并没有差别，我们看下下面代码的运行结果来具体感受一下：

```dart
main(List<String> args) async {
  n2Sync(3).first;
  n2Async(3).first;
  print("main");
}

Iterable n2Sync(n) sync* {
  int k = 0;
  while (k < n) {
    print("n2Sync before:${k}");
    yield k++;
    print("n2Sync after:${k}");
  }
}

Stream n2Async(n) async* {
  int k = 0;
  while (k < n) {
    print("n2async before:${k}");
    yield k++;
    print("n2async after:${k}");
  }
}
/**
 * 输出
 * n2Sync before:0
 * main
 * n2async before:0
 * n2async after:1
 * n2async before:1
 */
```

当调用变成这样时：

```dart
main(List<String> args) async {
  n2Sync(3).forEach(print);
  n2Async(3).forEach(print);
  print("main");
}
/**
 * 输出
 * n2Sync before:0
 * 0
 * n2Sync after:1
 * n2Sync before:1
 * 1
 * n2Sync after:2
 * n2Sync before:2
 * 2
 * n2Sync after:3
 * main
 * n2async before:0
 * 0
 * n2async after:1
 * n2async before:1
 * 1
 * n2async after:2
 * n2async before:2
 * 2
 * n2async after:3
 */
```



⚠️注意看 “main” 的输出位置，这样大概就能理解同步异步生成器的区别了。



### 递归调用

假如存在递归调用，则可以这样写：

```dart
Iterable naturalsDownFrom(n) sync* {
  if (n > 0) {
     yield n;
     for (int i in naturalsDownFrom(n-1)) { yield i; }
  }
}
// 3 2 1
```

不过我们可以通过 `yield*` 简化上述代码：

```dart
Iterable naturalsDownFrom(n) sync* {
  if ( n > 0) {
    yield n;
    yield* naturalsDownFrom(n-1);
 }
}
```

> 异步 Generator 同理


## Reference
https://www.dartlang.org/guides/language/language-tour#asynchrony-support

https://www.dartlang.org/articles/language/await-async

https://www.dartlang.org/articles/language/beyond-async