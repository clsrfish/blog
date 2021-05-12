---
title: 【Flutter】Dart 函数
date: 2018-09-24 18:36:10
categories:
  - [Flutter]
tags:
  - Dart
---

> 基于 Dart VM version: 2.1.0-dev.4.0.flutter-4eb879133a (Tue Sep 18 19:20:33 2018 +0000) on "macos_x64"

函数在 Dart 中有专门的 `Function` 对应，也就是说定义一个函数其实是定义了一个变量，而这个变量类型是 `Function` ，需要执行这个函数时就和普通的函数调用一样。

> 当然这个变量不可写


<!--more-->

## 函数定义

函数定义的一般形式是这样的：

```dart
[type] funname([type] p0, [[type] pn], [[type] pp0 [= 'default'] [, [type] pp1]]){
    [return expr]
}
```

或者这样的：

```dart
[type] funname([type] p0, [[type] pn], [{type] pp0 [= 'default'] [, [type] pp1}]){
    [return expr]
}
```

前者表示有 **可选位置参数** 的函数定义，后者表示有 **可选命名参数** 的函数定义。

同时，函数返回值和参数类型可以省略，省略时表示 `dynamic` 类型。

函数都有返回值，没有 `return` 语句是返回值为 `void`



另外，当函数体只有一条语句时，可以缩写为：

```dart
() => statement
```

比如：`var add = (int a, int b) => a + b;`



> 需要注意的是，**可选位置参数**和**可选命名参数**不可同时存在函数声明里



## 匿名函数

像上一节中的函数定义是定义的**命名函数**，但是也有很多情况下我们不需要为一个函数取一个名字，即匿名函数。

比如下面这种情况：

```dart
[1,2,3,4].forEach(([int ]a)=>print(a)); // 参数类型同样可以省略
```

## 闭包支持

Dart 完整支持闭包，而不是像 Java 那样需要被访问的外部变量使用 `final` 修饰，下面是一个例子：

```dart
void main(){
    var f = makeF();
    print(f().hashCode);
}

Function makeF(){
    var a = new Name();
    print(a.hashCode);
    return () => a;
}
class Name(){
    String name = "asd";
}
```

两次输出值是一样的。

## Reference

https://www.dartlang.org/guides/language/language-tour#functions