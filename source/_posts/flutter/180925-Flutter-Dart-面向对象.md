---
title: 【Flutter】 Dart 面向对象
date: 2018-09-25 18:29:15
categories:
  - [Flutter]
tags:
  - Dart
---
 Dart 是一门纯粹的面向对象的语言，即任何变量或实例都是 `Object` 的实例。同时 Dart 不支持多继承，但是支持 **Mixin** 特性，即一个类的定义在 **不被继承** 的情况被其它类复用。

<!--more-->

> 在 Dart 2.X 中，`new` 关键字可以省略

## 运行时类型
很多时候都需要获取某个实例的类型，可以通过访问实例的 `runtimeType` 变量获取变量类型（`Type`）:
```dart
main(List<String> args) {
  var str = "this is a String";
  print(str.runtimeType);
  print(str.runtimeType.runtimeType);
}
/**
 * String
 * _Type
 */
```
> `Type` 是一个抽象类， `_Type` 应该是它的具体实现了

## 实例变量
下面是实例变量的声明方式：
```dart
class Point{
    [final] var value [ = 233];
}
```
实例变量可以手动设置默认值，如果没有设置则默认为 `null`。一般情况下会为每个实例变量添加 `setter` 和 `getter`；当有 `final` 修饰时，则没有 `setter`；当变量是私有的时候，则 `setter`、`getter` 都没有。

通过 `static` 修饰的变量属于这个类，方法也是如此

## 构造器
和其它面向对象语言一样，Dart 也是通过声明一个以类名作为方法名，不设置返回值的方法作为一个构造器：
```dart
class Point{
    var x;
    var y;
    Point(int x, int y){

    }
}
```
如果构造器参数用来对实例变量初始化，则可以直接使用构造器参数为实例变量赋值：
```dart
class Point{
    var x;
    var y;
    Point(this.x, this.y){
        // ...
    }
}
```
或者使用 **初始化列表** ：
```dart
class Point{
    var x;
    var y;
    Point(List<int> coordinates)
        : x = coordinates[0],
          y = coordinates[1] {
        // ...
    }
}
```
像在 C++ 中，实例变量的初始化是推荐在初始化列表中进行而不是在构造器方法体内进行赋值，列表初始化始终存在，没有显式声明则会赋值默认值，也即会多出一次赋值操作。不过 Dart 这边的情况怎么样，暂时还没做探索

像 Java 一样，如果没有声明任何构造器，那么编译器会提供一个 **无参构造器**

这里要注意的是：
- 普通构造器不能定义多个



### 命名构造器
命名构造器的声明形式如下：
```dart
class Point{
    num x, y;
    Point.orgin(){
        x = 0;
        y = 0;
    }
    Point.fromMap(Map<String,num> map){
        x = map["x"];
        y = map["y"];
    }
}

var  p = new Point.origin();
```
命名构造器和普通构造器只是在类名后面加上了 “.name”。命名构造器主要作用有：
- 让调用方更清楚这个构造器的作用/适用场景
- 提供多构造器能力




### 重定向
和 Java 一样，有些构造器有时只是单纯的调用其他构造器，所以可以在初始化列表里面调用其他构造器：
```dart
class Point{
    num x, y;
    Point():this.origin();
    Point.orgin(){
        x = 0;
        y = 0;
    }
}
```
有两点需要注意：
- 重定向不能使用初始化列表进行参数初始化
- 使用了重定向的构造器不能有方法体




### 常量构造器
有时候希望创建不可修改的实例，Dart 提供常量构造器来创建编译期不可修改的实例:
```dart
class Point{
    final num a;
    const Point(this.a);
}
```

如果在使用常量构造器的时候使用 `const` 修饰同时参数也一样，得到的实例会是一样的：
```dart
var a = const ConstPoint(1);
// const a = ConstPoint(1);
var b = const ConstPoint(1);
// const a = ConstPoint(1);
print(identical(a, b));// true
```

这里需要注意几点：
- 声明常量构造器的类，所有实例变量都必须适用 `final` 修饰
- 常量构造器和普通构造器不能同时存在
- 常量构造器不能重定向到非常量构造器（VSCode 没有错误提示，但是编译期报错）
- 常量构造器不能有方法体




### 工厂构造器
可以通过对象池来理解工厂构造器，也即工厂构造器不一定会创建新实例：
```dart
class Point{
    static final _cache = Cache<Point>();

    var _using = true;
    factory Point(){
        var  p = _cache.get();
        if (p == null) {
            p = Point.origin();
            _cache.add(p);
        }
        return p;
    }
    Point.origin(){
        // ...
    }
    void recycle(){
        _using = false;
    }
}
```
注意两点：
- 工厂构造器不能和普通构造器同时存在
- 工厂构造器无法访问 `this`



通过工厂构造器，我们可以实现 Dart 中的单例模式：
```dart
class Singleton{
    static final _instance = Singleton._internal();
    Singleton._internal();
    factory Singleton(){
        return _instance;
    }
}
```

## 抽象类
```dart
abstract class SuperClass {
  var a;
  final b;
  var _a;
  SuperClass(this.b);
  void method();
}
```
通过 `abstract` 关键字声明一个抽象类，没有具体实现的方法都是抽象方法。
子类中通过 `extends` 声明父类：
```dart
class SubClass extends SuperClass {
  SubClass(b) : super(b) {}

  @override
  void method() {
    this.a = 12;
  }
}
```
通过 `extends` 可以继承父类中的实现，同时要求实现抽象方法。
这里在初始化列表中调用了父类构造器，如果不显式调用父类构造器，则会尝试隐式调用父类空构造器，但是这里的例子中父类并没有空构造器，编译期会报错。

## 接口
Dart 没有将 `interface` 作为一个关键字使用，而是将接口含义隐藏在类里面：每个类都会隐式声明一个接口，这个接口包含该类和该类的父类、实现的接口的所有实例成员。
```dart
class SubClass implements SuperClass {
  SubClass(b) {}
  @override
  var a;
  @override
  get b => null;
  @override
  var _a2;
  @override
  void method() {}
  @override
  void method2() {}
}
```

## 枚举类型
和其它语言一样，Dart 也原生提供枚举类型的支持：
```dart
enum Color{ red, green, blue }
```
同时枚举类型会为枚举值提供一个 **基于0** 的索引。

## Mixins（找不到一个好的翻译
在文章的开头提到 Dart 提供在 **不被继承** 的情况下进行类定义的复用，也即 **Mixins**。还是具体看代码吧：
```dart
class Pilot {
  void fly() {
    print("fly");
  }
  void play() {
    print("I can not play");
  }
}

class Musician {
  void fly() {
    print("I can not fly");
  }
  void play() {
    print("play");
  }
}

class NiuBeePerson with Musician, Pilot {
}

main(List<String> args) {
  NiuBeePerson().play();
  NiuBeePerson().fly();
  print(NiuBeePerson is Pilot);
  print(NiuBeePerson is Musician);
}
```
执行上述代码后可以得出一下结论：
- 后声明的类可以覆盖前面的类的实例变量、函数
- 被 mixin 的类中有命名相同、类型不同的实例变量/方法会导致编译错误
- mixins 的类实际上被当成了被 mixin 的子类



> 在写这篇文章的时候，对 Dart 访问控制理解不是很OK，如果看到有类似“私有”对字眼，可以忽略，不会影响

## Reference

https://www.dartlang.org/guides/language/language-tour#classes
