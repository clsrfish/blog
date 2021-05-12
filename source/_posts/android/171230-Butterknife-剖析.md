---
title: Butterknife 剖析
date: 2017-12-30 00:45:35
categories:
  - Android
tags:
  - ButterKnife
  - Annotation Processor
---

在初学 Android 的时候，写一个 Activity，就要写好几句 `findViewById` （现在 support 包使用泛型避免强转），慢地就变得厌倦这些模板代码，但是又不能不写。ButterKnife 使用注解的方式来避免这一类模板代码，比如事件监听器等。代码变得好看了，也就开始思考它内部的工作原理。

<!--more-->

> 学习源码最重要的是学习它的设计思想，然后帮助我们在以后学习中打开思路，多一种解决问题的可能。我觉得 ButterKnife 告诉我们要学会偷懒，能少写的代码绝不多写一句。
>
> 另外，Kotlin 可以直接使用 xml 里面的 id 来操作控件。


## 平台和工具

> OS：Ubuntu 17.04
> Android Studio：[Android Studio 2.4 Preview7](https://developer.android.com/studio/archive.html)
> ButterKnife：8.5.1

## ButterKnife 做了啥

这里我们创建一个简单的工程，布局文件里面就放一个 id 为 button 的按钮。MainActivity 里面的代码如下。

```java
public class MainActivity extends AppCompatActivity {
//    @BindView(R.id.button)
    protected Button mButton;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
//        ButterKnife.bind(this);
    }
}
```

然后我们 `Ctrl + F9` 对项目进行编译，然后我们进入 /app/build/intermediates/classes/debug/com/xiansenliu/test 目录，会有下面这些文件\(去掉了一些\):

```
├── BuildConfig.class
├── MainActivity.class
└── R.class
```

然后去掉 `@BindView(R.id.button)` 的注释，再次编译，这次我们发现这个目录有了变化:

```
├── BuildConfig.class
├── MainActivity.class
├── MainActivity_ViewBinding.class    //多的文件
└── R.class
```

明眼人都知道多了一个 `MainActivity_ViewBinding.class` 文件，我们接着看这里面又做了哪些小动作。

```java
//    这里删减了一点点代码
public class MainActivity_ViewBinding implements Unbinder {
    private MainActivity target;
    @UiThread
    public MainActivity_ViewBinding(MainActivity target) {
        this(target, target.getWindow().getDecorView());
    }
    @UiThread
    public MainActivity_ViewBinding(MainActivity target, View source) {
        this.target = target;
        target.mButton = (Button)Utils.findRequiredViewAsType(source, 2131427414, "field 'mButton'", Button.class);
    }
    @CallSuper
    public void unbind() {
        MainActivity target = this.target;
        this.target = null;
        target.mButton = null;
    }
}
```

我们看到这一句：`target.mButton = ...`，这里就完成了 View 的绑定工作。
我们接着看 `Utils.findRequiredViewAsType()` 方法：

```java
//    去掉了一些检查代码
public static <T> T findRequiredViewAsType(View source, @IdRes int id, String who,
      Class<T> cls) {
    View view = findRequiredView(source, id, who);
    return castView(view, id, who, cls);
}
public static View findRequiredView(View source, @IdRes int id, String who) {
    View view = source.findViewById(id);    //发现了
      return view;
}
public static <T> T castView(View view, @IdRes int id, String who, Class<T> cls) {
      return cls.cast(view);
}
```

这几个函数的作用就是 `(Button)findViewById(...)` , 还是蛮简单的。

## ButterKnife 绑定触发

辅助类生成了，绑定逻辑也清楚了，那么这些逻辑是怎么调用的呢？用过的朋友可能知道 `ButterKnife.bind(this);` 这句就是整个绑定逻辑起点，我们再看看触发过程的内部逻辑。

```java
//    已省略健壮性代码
public static Unbinder bind(@NonNull Activity target) {
    View sourceView = target.getWindow().getDecorView();
    return createBinding(target, sourceView);
}
private static Unbinder createBinding(@NonNull Object target, @NonNull View source) {
    Class<?> targetClass = target.getClass();
    Constructor<? extends Unbinder> constructor = findBindingConstructorForClass(targetClass);
    return constructor.newInstance(target, source);
}

private static Constructor<? extends Unbinder> findBindingConstructorForClass(Class<?> cls) {
    Constructor<? extends Unbinder> bindingCtor = BINDINGS.get(cls)；
    if (bindingCtor != null) {
      return bindingCtor;
    }
    String clsName = cls.getName();
    Class<?> bindingClass = Class.forName(clsName + "_ViewBinding");    //敲黑板
    bindingCtor = (Constructor<? extends Unbinder>) bindingClass.getConstructor(cls, View.class);
    BINDINGS.put(cls, bindingCtor);
    return bindingCtor;
}
```

核心代码就是 `Class<?> bindingClass = Class.forName(clsName + "_ViewBinding")` ，**通过类名** 找到对应的辅助类，然后通过 **反射** 得到构造器，并 **缓存** 到 BINDINGS 这个 Map 中去，最后通过这个构造器完成辅助类的实例化，同时完成View的注入工作。

> 至于其它的绑定，如监听器绑定等，

## 辅助类的生成

最后一个可能的疑问就是：辅助类是哪里来的？
我们知道要引入 ButterKnife 的依赖，我们除了需要像一般依赖添加之外，还要添加 `annotationProcessor 'com.jakewharton:butterknife-compiler:8.5.1'` ，谜底就在这一行脚本里面。这一行脚本告知 Gradle：我要使用 ButterKnife 的注解处理器，然后当我们按下 `Ctrl + F9` 的时候，这个注解器就会提取那些 BindView 之类的注解，然后解析并生成辅助类。
如果想具体了解辅助类的生成过程，请移步

看到这里，不知道你有没有豁然开朗的感觉，其实 ButterKnife 是一个非常轻量的注解库，因为核心代码就这么多，真正高大上的代码都在注解处理器里面，不需要编译进最终的 Android 工程。