---
title: ThreadLocal 源码分析
date: 2017-12-30 21:53:30
categories:
  - Java
tags:
  - ThreadLocal
---

在并发编程的时候，常常会遇到共享变量，通常为了保证数据的 **一致性** ，需要对变量加锁，这就导致了执行效率的降低。如果仅仅在线程内部访问，就不需要进行加锁，这时候就体现出了数据的 **独立性** （这两个名词是随手造的，知道意思就好了）。

<!--more-->

ThreadLocal 类能够帮助我们实现数据独立性，它保证了线程单独持有一个变量，并且对这个变量的操作不会影响其它线程的值。具体的情况可能和我讲的你所理解的有些出入，下面我们通过源代码来深入探究。

## 提供的API
正式开始之前，先看看 ThreadLocal 这个类给我提供了哪些API

- **set(T value)** <br/>
  给当前线程设置一个 ThreadLocal **值** 的拷贝
- **T get()** <br/>
   获取当前线程保存的 ThreadLocal **值** 的拷贝
- **remove()** <br/>
   移除当前线程保存的拷贝
- **T initialValue()** <br/>
   当当前线程通过 `get()` 来第一次访问 Threadlocal 的时候被调用，然后会返回一个 **T** ，默认返回是 `null` 。 如果调用了 `remove()`，下一次又调用 `get()` ，这个方法还会被调用

下面简单使用一下：
```kotlin
fun main(args: Array<String>) {
    val str = "init value"
    val tl = ThreadLocal<String>()
    tl.set(str)
    val thread = Thread{
        tl.set("child's value")
        println(tl.get())
    }
    thread.start()
    thread.join()//让子线程执行完
    println(tl.get())
}
```
然后我们的预期结果是：
```
child's value
init value
```
运行之后的结果和上面一样。


## 注意点
如果上面的代码没什么问题，我们接着写另一个例子。
为了演示方便，我们先定义一个 Foo 类：
```kotlin
data class Foo(var name:String)
```
然后再看我们的 main 函数：
```kotlin
fun main(args: Array<String>) {
    val foo = Foo("init value")
    val tl = ThreadLocal<Foo>()
    tl.set(foo)
    val thread = Thread {
        tl.get().name = "changed in child"
        println(tl.get())
    }
    thread.start()
    thread.join()//保证线程执行完毕

    println(tl.get())
    //预期结果：
    //changed in child
    //init value
}
```
运行一下，Oops，崩了！！！
对比一下之前的例子，会发现第二个例子在子线程中首先通过 `get()` 获取 foo 实例。这里就存在一个问题，回过头看 `initialValue()` 函数的注释，发现这个线程正好符合它被调用的条件，所以我们会得到一个 **NullPointException** 。

既然 `initialValue()` 返回了一个 null 值，那么我们重写这个方法，返回一个合法值。改造之后的代码：
```kotlin
fun main(args: Array<String>) {
    val tl = object:ThreadLocal<Foo>(){
        override fun initialValue(): Foo = Foo("init value")
    }
    val thread = Thread {
        tl.get().name = "changed in child"
        println(tl.get())
    }
    thread.start()
    thread.join()//保证线程执行完毕

    println(tl.get())
    //预期结果：
    //changed in child
    //init value
}
```
运行一下，打印结果也确实和预期结果一致。不过还有个问题，如果我们执行 `println(tl.get().hashCode())` ，会发现两个对象不一样，因为不同线程的初始值都是新创建的 Foo 对象。有同学可能就会想到这样改：
```kotlin
val tl = object:ThreadLocal<Foo>(){
val foo = Foo("init value")
override fun initialValue(): Foo = foo
}
```
这样就是实现了，不同线程的初始值是同一个实例了，不过这个初始值不是线程私有的，并发情况下还是会发生数据不同步的问题。到底怎么使用，根据具体情况吧。

## 源码分析
ThreadLocal 这个类还是比较简单，只有几个关键函数，我们一个个来分析：
### T get()
```java
public T get() {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    if (map != null) {
        ThreadLocalMap.Entry e = map.getEntry(this);
        if (e != null) {
            @SuppressWarnings("unchecked")
            T result = (T)e.value;
            return result;
        }
    }
    return setInitialValue();
}
```
大致意思为：
- 获取当前线程的 ThreadLocalMap 实例
- 如果 ThreadLocalMap 实例为 null，创建并设置初值；否则以 this 为 key 从 ThreadLocalMap 里取值
- 如果取值不为 null，强转返回，否则调用 `initialValue()` 并返回
  这里的 ThreadLocalMap 可以简单地看作一个散列表；然后 Entry 其实是 WeakReference 子类，这个弱引用保证在某些场景下不会发生 **内存泄漏**。

### set(T value)
```java
public void set(T value) {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    if (map != null)
        map.set(this, value);
    else
        createMap(t, value);
}
```
set() 所做的工作非常简单：
- 获取当前线程的 ThreadLocalMap 对象
- 如果ThreadLocalMap 不为 nul，从 ThreadLocalMap 中取值；如果为null，为当前线程创建ThreadLocalMap 实例并设置初始值

### remove()
```java
public void remove() {
     ThreadLocalMap m = getMap(Thread.currentThread());
     if (m != null)
         m.remove(this);
}
```
拿到当前线程的 ThreadLocalMap ，不为null 就清除值。调用这个方法之后，ThreadLocal 就重新进入刚创建时的状态了。


## 关于线程私有
Java 中对象都是存放在 heap（堆内存） 中，而堆内存是线程共享的，也就是说 ThreadLocal 保存的值还是线程共享的，只是代码逻辑给它提供了线程私有的属性。
