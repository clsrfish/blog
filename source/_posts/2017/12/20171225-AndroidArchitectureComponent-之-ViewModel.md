---
title: AndroidArchitectureComponent 之 ViewModel
date: 2017-12-25 15:54:54
categories:
  - Android
tags:
  - ViewModel
  - AAC
---

在学习 Android 稍微深入一点，就知道 `Activity/Fragment` 是受 Android 框架层控制的，具体表现在生命周期上面。系统会根据用户的操作或者设备状态来创建或销毁 `Activity/Fragment`，这个时候会带来数据的 **保存和恢复(包括视图状态)**  问题。一个典型场景就是表单页面，当用户旋转屏幕之后，系统会重建Activity/Fragment，如果什么数据的保存恢复工作都没有做，那么系统重建的 `Activity/Fragment` 将失去用户已经输入的数据，丢失数据越多，用户体验越差。

<!--more-->

上面的还只是最简单的场景，当存在异步操作，`Activity/Fragment` 有可能恰好在请求返回时恰好被系统回收了，如果重建的 `Activity/Fagment` 又重新请求一次，就会造成资源浪费，最理想的情况就是能够直接利用之前请求到的数据同时又不会有内存泄露的隐患。

虽然系统提供了 ` onSaveInstanceState()` 来保存数据，但是这只适用于 **少量的** 、支持 **序列化** 和 **反序列化** 的数据，局限性很明显。

所以我们需要自行提供一套数据保存与恢复的机制。

## ViewModel
Android Architecture Component 提供 ViewModel 来帮助我们为视图提供数据,同时，它还能在视图重建的过程中生存下来，也就保证了数据保存恢复的可行性。

要使用 ViewModel 也很简单，只需要继承 ViewModel 并通过规定的方式获取它的实例就可以了。下面是一个简单的例子：

首先继承 ViewModel：

```java
public class MyViewModel extends ViewModel{
    protected String content = "initial content"；
}

```

然后在我们的视图层请求一个 `MyViewModel` 实例：

```java
public class VMActivity extends AppCompatActivity{
    private static String TAG = "VMActivity";
    private MyViewModel mvm;

    public void onCreate(...){
        mvm = ViewModelProviders.of(this).get(MyViewModel.class);
        Log.d(TAG,mvm.toString());
        Log.d(TAG,mvm.content);
        mvm.content = "modified content";
        // ...
    }
}
```

这样就能使 `MyViewModel.content` 在 Activity 的重建中生存下来了。


## ViewModel 的生命周期
我们先看官方文档提供的一张示意图：
![](https://developer.android.com/images/topic/libraries/architecture/viewmodel-lifecycle.png)


这里 ViewModel 的生存期会和 Activity 的生命周期关联，ViewModel 只有在确定 Activity 不会再重建后才会销毁（`this.finish()` 调用），这里需要的表述可能有问题，需要结合 Activity 的启动模式来理解。

> Fragment 情况差不多，ViewModel 在被 **detached** 之后销毁。

## 共享数据
刚刚知道了 ViewModel 的生存期与创建它时传递进去的参数有关（Activity/Fragment），那么当我们传递进去的是 Activity 时，就能获取和 Activity 的生命周期对应的 ViewModel，大概的情况就是：

```java
public AFrag extends Fragment{
    private MyViewModel vma;
    public View onCreateView(...){
        vma  = ViewModelProviders.of(getActivity()).get(MyViewModel.class);
    }
}

public BFrag extends Fragment{
    private MyViewModel vmb;
    public View onCreateView(...){
        vmb  = ViewModelProviders.of(getActivity()).get(MyViewModel.class);
    }
}
```

如果这两个 Fragment 被添加到了同一个宿主 Activity 中，那么 `vma` 和 `vmb` 就是同一个实例。
> 添加到 Fragment 中同理。

## ViewModel 带参构造器

到现在还有一个问题，那就是 ViewModel 的创建。通过传递 ViewModel  的字节码信息就可以获取一个实例，第一反应应该是 **反射** ，内部通过反射调用 ViewModel 的 **无参构造器** 来创建实例。如果需要使用带参构造器，需要借助于另一个接口—— `ViewModelProvider.Factory ` ，ViewModelProvider 有一个它的默认实现实例，我们要做的就是替换这个默认实现：

```java
public class MyViewModelFactory implements ViewModeProvider.Factory{
  	private Params params;
  	public MyViewModelFactory(Params params){
   		this.params = params;
  	}
  	public <T extends ViewModel> T create(Class<T> modelClass){
    	return modelClass.getConstructor(Params.class).newInstance(params);
  	}
}
```

然后在获取的时候，传递它的实例进去就可以了：

```java
MyViewModelFactry f =  new MyViewModelFactory(params);
mvm = ViewModelProviders.of(this,f).get(MyViewModel.class);
```

这样就能够通过构造器向 VIewModel 传递参数了。

>   注意：不建以让 ViewModel 持有Android 框架层的实例，如果需要 Context 的话，可以通过继承 `AndroidViewModel` 来实现



## 改造MVP

刚刚通过 `ViewModelProvider.Factory` 向 ViewModel 的构造器传递参数，结合 MVP ，可以让 ViewModel 承担 P 层的职责，而不仅仅是做一个数据的容器。我们接着[上一篇文章](/posts/61434b2a.html) 中的 MVP 继续改造：

我们让 `AbsPresenter` 继承 `ViewModel` 并实现它的 `onClear()` 方法：

```java
public abstract class AbsPresenter<V extends AbsView> extends ViewModel implements LifecycleObserver {
  	private static final String TAG = "AbsPresenter";
    private CompositeDisposable compositeDisposable = new CompositeDisposable();
    private WeakReference<V> view = new WeakReference(null);

    public void setView(V v) {
        view = new WeakReference<>(v);
        if (v instanceof LifecycleOwner) {
            ((LifecycleOwner) v).getLifecycle().addObserver(this);
        }
    }
    public V getView() {
        V v = view.get();
        if (v != null) {
            if (v instanceof Fragment && ((Fragment) v).isDetached() ||
                    v instanceof android.app.Fragment && ((android.app.Fragment) v).isDetached()) {
              	view.clear();
                return null;
            }
        }
        return v;
    }

    protected void addDisposable(Disposable d) {
        compositeDisposable.add(d);
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
    protected void onDestroy() {
        Log.d(TAG, "onDestroy called");
        view.clear();
    }

    @Override
    protected void onCleared() {
        Log.d(TAG, "onClear called");
        compositeDisposable.clear();
    }
```

根据 ViewModel 的生命周期，我们将 `compositeDisposable.clear()` 移动到了 `onClear()` 方法中，同时提供了一个 `getView()` 方法提供 V 层实例。

## 实例演示

定义一个 Contract 接口：

```java
public interface VMContract {
    interface VMView extends BaseView {
        void onLoadMsg(String msg);
    }

    abstract class BaseVMPresenter extends BasePresenter<VMView> {
        public abstract void loadMsg();
    }
}
```

继承 `BaseVMPresenter` ：

```java
public VMPresenter extends BaseVMPresenter{
    private Repo local;
    private Repo remote;
    String msg;

    public VMPresenter(Repo local, Repo remote) {
        this.local = local;
        this.remote = remote;
    }

    @Override
    public void loadMsg() {
        if (msg != null) {
            getView().onLoadMsg("restored msg");
            return;
        }
        Disposable disposable = Observable
                .fromCallable(() -> {
                    Thread.sleep(5000);
                    return remote.loadMsg();
                })
                .subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe(
                        msg -> {
                            this.msg = msg;
                            VMContract.VMView view = getView();
                            if (view != null) {
                                view.onLoadMsg(msg);
                            }
                        },
                        Throwable::printStackTrace,
                        () -> Log.i(TAG, "onComplete")
                );
        addDisposable(disposable);
    }

    public static class Factory extends ViewModelProvider.NewInstanceFactory {
        private Repo local;
        private Repo remote;

        public Factory(Repo local, Repo remote) {
            this.local = local;
            this.remote = remote;
        }

        @NonNull
        @Override
        public <T extends ViewModel> T create(@NonNull Class<T> modelClass) {
            if (modelClass.isAssignableFrom(VMPresenter.class)) {
                try {
                    return modelClass.getConstructor(Repo.class, Repo.class)
                            .newInstance(local, remote);
                } catch (InstantiationException | IllegalAccessException | NoSuchMethodException | InvocationTargetException e) {
                    e.printStackTrace();
                }
            }
            return super.create(modelClass);
        }
    }
}
```
这里 `VMPresenter` 有两个 Repo 依赖，所以还需要创建一个 `Factory`。

最后就是让 Activity 实现接口并使用 VMPresenter：

```java
public VMActivity extends AppCompatActivity implements VMView{
  	private BaseVMPresenter p;

  	public void onCreate(...){
        VMPresenter.Factory factory = new VMPresenter.Factory(new LocalRepo(), new RemoteRepo());
        VMPresenter presenter = ViewModelProviders.of(this, factory).get(VMPresenter.class);
        presenter.setView(this);
        presenter.loadMsg();
  	}

  	public void showMsg(String msg){
    	Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
  	}
}
```
运行后我们先等第一次弹出 Toast ，然后再旋转屏幕，看看是不是会有另一个 toast 弹出。可以看出，这里没有对 `savedInstanceState` 进行判断，直接获取 presenter 实例，逻辑也很清晰，如果你对屏幕旋转前后的 presenter 是不是同一个实例持怀疑态度的话，可以打印 log 来进行验证。


## 小问题
虽然 Presenter 结合 ViewModel 的特性能够使它在屏幕旋转中生存下来，但是我们发现，一旦 Presenter 需要依赖其他模块来完成功能（这非常常见），为了兼顾单元测试和代码优雅性，就要给它添加有参构造器，继而需要为它创建 `Factory` 。我们都知道，MVP 为人所诟病的一点就是要定义接口，现在又要多定义一个 `Factory` 。再一个，我们可以发现这个 Factory 啊，它是有套路的，进一步可以得到这样的公式 ： `Factory  = f( params of presetner'constructor )` 。每次都写这样的类并不会提高我们的技术，只能凑凑代码量，所以我们需要把这个锅丢给编译器，让这个 Factory 能够自动生成。
这里安利一下我自己造的轮子—— [AutoVM](https://github.com/dashMrl/AutoVM) ，只需要在构造器上添加一个注解，就可以生成 Factory 了。
欢迎 star hhh！！！



## 总结

刚接触这一套框架的时候，觉得应该围绕这一套框架为核心来构思架构，但是后来发现，相对于 MVP ，并没有太多优势。现在换个角度，将它们作为 MVP 的辅助，为现有 MVP 提供更加有趣的特性，所以，官方文档上的演示可能只是为了展示这一套框架能够发挥出什么样的威力。


完整代码在 [这里](https://github.com/dashMrl/Android_Demos/tree/8f9e0472f97ad669945d84b4bc7c8723759045c6)
