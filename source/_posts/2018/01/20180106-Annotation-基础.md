---
title: Annotation 基础
date: 2017-12-30 22:32:32
categories:
  - Java
tags:
  - Annotation
  - Annotation Processor
---

注解是一种元数据（metadata），它在虽然能提供关于程序的一些信息，但并不是程序本身的一部分。注解对被其标注的对象没有任何副作用。

<!--more-->

关于注解的作用，主要有以下三点：
- 为编译器提供信息：比如语法检查等
- 在编译或部署时进行一些处理：比如生成一些报表信息
- 运行时：主要通过反射来操作

> 这里假设读者对注解有一定的了解

## 表现形似
`@Override` 应该最常见的注解之一，比如一些注解可能还会有参数，那么就有点像 Java 的构造函数，不过参数位置没有固定，所以也就需要显示指定参数的名称和值。

## 分类
- 元注解（meta-annotation）： 用来自定义注解时使用
- 标注注解： 即 JDK 自带的，有 `Override`，`Deprecated` 等
- 自定义注解： 即我们为满足某种需求而自定义的注解

## 自定义注解
最快学习 Annotation 的方式还是自定义注解，下面我们就来定义一个 `Message` 注解：
```java
@Documented
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.CLASS)
public @interface Message{
  String content default "hello";
}
```

这里可以划分为 5 个部分，我们都过一遍：
### Documented
根据名字可以判断，它和代码文档有关。我们的 `Message` 被它标注了，那么当对一个 `A` 类使用 `Message` 注解时，文档生成工具（如 javadoc）会将 `Message` 的信息也输出；反之，当 `Message` 没有被 `@Documented` 标记的时候，那么文档生成工具的输出中将不会保留 `Message` 相关的信息


### Inherited
表示这个注解可以被继承，具体表现是：父类 `A` 被 `Message` 标注，通过 `A` 的子类 `B` 也能直接拿到 `Message` 相关信息。内部的逻辑是：当在子类 `B` 上查询 `Message` 的时候，如果 `B` 没有被标注，那么就接着查询父类 `A`，如此直到找到或者查询到 Object。


### Retention
表明注解信息将会被保留到什么时候，这里的例子表明会保存到运行时，如果不使用这个元注解或者不指定保存时期，默认是留到字节码中（即  RetentionPolicy.CLASS）。
关于 RetentionPolicy，可以简单的记一张表格：

| RetentionPolicy | Effects                                                      |
| :-------------- | :----------------------------------------------------------- |
| SOURCE          | 注解只会存在于源码中，编译时将会被编译器去除                 |
| CLASS           | 存在于源码和字节码中，但是不会被 VM 载入到运行时             |
| RUNTIME         | 存在于源码和字节码中，并且会被 VM 载入，这时可以通过反射读取 |


### Target
表示哪些元素可以被这个注解标记，这里的例子中表示只能使用在 **类** 上面。我们还是用一张表格来说明：

| ElementType     | Effects                                         |
| :-------------- | :---------------------------------------------- |
| ANNOTATION_TYPE | 用于注解，类似元注解                            |
| TYPE_USE        | 用在泛型上，比如 <@Message T>                   |
| PACKAGE         | 用在包上                                        |
| TYPE            | 用在类、接口、枚举类以及注解上                  |
| FIELD           | 用在成员变量上                                  |
| CONSTRUCTOR     | 用在构造器上                                    |
| METHOD          | 用在方法上                                      |
| PARAMETER       | 用在构造器、方法的参数上                        |
| TYPE_PARAMETER  | 用在构造器、方法的泛型参数上，比如 @Message T t |
| LOCAL_VARIABLE  | 用在本地变量上                                  |

> 当没有指定 Target 的时候，可以用在任何元素上

### 参数
最后，我们看到 `Message` 内部还声明了一个类似成员变量的属性—— content，它的一般格式为： `<Type> <name>() [ default value ]` ，它的作用就是携带信息。
它支持如下的数据类型：
- 基本类型（Primary Type）：byte、char、short、int、long、float、double
- String
- Class
- Enum
- Annotation
- 以上的数组形式

> 当参数名为 `value` 的时候，使用的时候可以不指定参数名，像这样：@Message("2333")


## 使用
使用注解进行标注并携带信息，如果没有读取注解及携带信息的方法，那么注解就完全没有意义了。
我们前面提过，注解一般在编译时或运行时起作用，这里就看看怎么在运行时使用。
首先定义一个 `Messenger`，表示信使：
```java
@Message(content="hello world!!")
public class Messenger{
  // ...
}
```
信使携带了一份消息，我们现在的问题就是怎么从他身上获取这消息。一开始也提到过，我们主要通过反射来进行操作，看我们的 main 函数：
```java
public class Hello{
  public static void main(String[] args){
    Messenger messenger = new Messenger();
    Class<? extends Messenger> clazz = messenger.getClass();
//    Class<Messenger> clazz = Messenger.class;
    Message message = clazz.getAnnotation(Message.class);
    System.out.println(message.content());//输出: hello world!!
  }
}
```
这样就能在运行获取到数据了，据此，我们也可以把一些配置信息写到注解里来减少编码。
不过需要注意的是，反射调用时会在虚拟机内存里遍历查找这个类的信息，这样的是比较低效的，所以这种方式不能滥用，而且有必要做好缓存。所以这种方式就不太适合性能敏感的场景，比如手机。

## 注解处理器（Annotation Processor）
我们现在已经能够在运行时获取到注解里面的信息，但是性能上的问题还是不能够忽视。文章开头也说过注解能够为编译器提供信息，所以我们可以在编译的时候做些手脚，以避免反射的开销。Java 提供了注解处理器来帮助开发者来在编译时期完成某些操作，关于它更多的信息，请看 [下一篇文章](/posts/ec0bc8d.html)。


## Reference

https://docs.oracle.com/javase/8/docs/api/
