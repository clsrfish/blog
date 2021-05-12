---
title: "TypeScript 实现 Java 匿名内部类"
date: 2018-08-18 10:56:52
categories:
  - Web
tags :
  - TypeScript
---

突然想对之前写的 JSBridge 用 TS 重构一下，顺便简化一下整体结构。TS 的强类型是有了，但是还是存在着不足，导致相比其他强类型语言，稍微显得有点蹩脚。
<!--more-->

比如创建一个抽象类的匿名内部类对象，就没法像 Java 那样，幸好基于 JS 本身的一些特点还是达到这个效果，看代码；

```typescript
abstract class SuperClazz {
    public constructor(readonly msg: string) { }
    public abstract hello(): void;
}
```
在调用的地方我们通过 **自执行函数** 来创建子类对象：
```typescript
let msg = 'asd';
((msgParam: string) => {
    return new class SubClazz extends SuperClazz {
        constructor(msg) {
            super(msg);
        }
        public hello(): string {
            return msg;
        }
    }(msgParam);
})(msg);
```

当时被这个问题卡了一小会，想到这个后马上就小本本记下来了。然后联想到其实 Java 也是可以在函数里面定义类的，只是因为一般都用匿名内部类的语法，所以一般也很难想到在函数体内定义一个类。
