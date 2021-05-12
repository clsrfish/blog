---
title: Android 项目集成 React Native
date: 2018-04-07 16:28:41
categories:
  - [Android]
  - [React Native]
---

如果不是一个从零开始的项目，那么更多情况下是需要把 React Native 作为一个功能模块嵌入到现有应用中，这篇文章简单记录一下怎么集成 RN 到现有 Android 项目中，以及一些坑点。

<!--more-->

> OS：macOS 10.13.4
>
> node：v9.10.1
>
> npm：5.8.0
>
> AS：3.1.0



## 创建 npm 工程

按照传统 React Native 的代码使用 npm 进行“构建”，并且 Android 项目中一些依赖也来自于这个工程。

找一个你喜欢的位置，执行一下命令初始化一个 npm 项目：

```shell
$ mkdir rn && cd rn
$ npm init -y
```

然后需要安装 react 和 react-native ：

```shell
$ npm install --save react react-native
```

接着创建一个入口文件和一些必要目录：

```shell
$ touch index.android.js
$ mkdir app
```

完成以上操作后，会得到一个如下的目录结构：

```shell
├── app
├── index.android.js
├── node_modules
├── package-lock.json
└── package.json
```

再向 index.android.js 中填入如下内容：

```jsx
import React from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

class HelloWorld extends React.Component {
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.hello}>Hello    RN!!</Text>
      </View>
    )
  }
}
var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  hello: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});

AppRegistry.registerComponent('HelloRN', () => HelloWorld);
```

以上代码在屏幕正中央显示 “HelloRN” 。

最后修改一下 **package.json** 文件：

```json
{
  "name": "rn",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node node_modules/react-native/local-cli/cli.js start", // 启动开发服务器
    "bundle-android": "node node_modules/react-native/local-cli/cli.js bundle --platform android --dev false --entry-file index.android.js --bundle-output ../rndemo/src/release/assets/index.android.bundle --assets-dest ../rndemo/src/release/res/",	// 打包 JS
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "react": "^16.3.1",
    "react-native": "^0.55.1"
  }
}
```

具体的路径根据实际情况修改。



## 创建 Android 工程

在和 rn 同级目录创建一个工程，然后修改根目录的 build.gradle 如下：

```groovy
allprojects {
    repositories {
//		...
        maven{
            url "$rootDir/rn/node_modules/react-native/android"
        }
    }
}
```

这里很容易猜到，在 `$rootDir/rn/node_modules/react-native/android` 中肯定有一些 jar 包。

然后在 app module 的build.gradle 文件里添加：

```groovy
dependencies{
  //...
  implementation "com.facebook.react:react-native:+"
}
```



### 添加权网络权限

在 `AndroidManifest.xml` 文件里添加网络权限：

```xml
<uses-permission android:name="android.permission.INTERNET" />
```



### 添加开发者菜单

这个一般用于开发时，可以直接从本地服务器自动拉取最新 JavaScript 代码，还是建议加上。正式发版时，还是需要去掉这个，所以还需要简单配置下。

在 src 目录下创建一个 debug 目录，然后创建一个 `AndroidManifest.xml` 文件并填入以下内容：

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.dashmrl.rndemo">

    <application>
        <activity android:name="com.facebook.react.devsupport.DevSettingsActivity" />
    </application>

</manifest>
```

这样在正式打包的时候就可以去掉这个 DevSettingsActivity 了。



### 添加 DrawOverlays 权限

开发时，错误信息会显示在红底悬浮窗中，在 Android M 及以上的系统中需要用户授权才能显示，所以为了便于debug，需要开启这一权限。在 Activity 中添加如下代码：

```java
@Override
public void onCreate(Bunlde savedStateInstance){
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        if (!Settings.canDrawOverlays(this)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                       Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE);
        }
    }
}

@Override
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode == OVERLAY_PERMISSION_REQ_CODE) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                // SYSTEM_ALERT_WINDOW permission not granted...
            }
        }
    }
}
```

这里只是大概的流程，具体的看场景。



### 添加 RN 的宿主 Activity

```java
public class HelloActivity extends AppCompatActivity implements DefaultHardwareBackBtnHandler {
    private ReactRootView mReactRootView;
    private ReactInstanceManager mReactInstanceManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mReactRootView = new ReactRootView(this);
        mReactInstanceManager = ReactInstanceManager.builder()
                .setApplication(getApplication())
                .setUseDeveloperSupport(BuildConfig.DEBUG)
                .setJSMainModulePath("index.android")// 开发服务器 js bundle 所在目录
                .setBundleAssetName("index.android.bundle")
                .addPackage(new MainReactPackage())
                .setInitialLifecycleState(LifecycleState.RESUMED)
                .build();

        // 注意这里的 HelloRN 必须对应“index.android.js”中的
        // “AppRegistry.registerComponent()”的第一个参数
        mReactRootView.startReactApplication(mReactInstanceManager, "HelloRN", null);
        setContentView(mReactRootView);
    }
    @Override
    protected void onPause() {
        super.onPause();

        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostPause(this);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostResume(this, this);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostDestroy();
        }
    }
//	一般情况下，需要先将返回键事件交由 JS 处理
    @Override
    public void onBackPressed() {
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onBackPressed();
        } else {
            super.onBackPressed();
        }
    }
//	当 JS 不想处理返回键事件的时候，就会调用这个方法
    @Override
    public void invokeDefaultOnBackPressed() {
        super.onBackPressed();
    }
//  默认情况下，抖一抖手机显示配置对话框，但是模拟器无法抖一抖
    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU && mReactInstanceManager != null) {
            mReactInstanceManager.showDevOptionsDialog();
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }
}
```



然后把这个 Activity 注册就好了：

```xml
 <activity
   android:name=".HelloActivity"
   android:label="@string/app_name"
   android:theme="@style/Theme.AppCompat.Light.NoActionBar">
 </activity>
```

第4行避免出现工具栏，现在一般也都会使用这个主题。



## 开车

完成上面的配置就可以运行了。

### 启动开发服务器

进入 rn 目录，执行：

```shell
$ npm start
```

然后会看到如下输出：

```shell
> rn@1.0.0 start /Volumes/Files/Projects/Android/Android_Demos/rn
> node node_modules/react-native/local-cli/cli.js start

Scanning folders for symlinks in /Volumes/Files/Projects/Android/Android_Demos/rn/node_modules (14ms)
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Running Metro Bundler on port 8081.                                         │
│                                                                              │
│  Keep Metro running while developing on any JS projects. Feel free to        │
│  close this tab and run your own Metro instance if you prefer.               │
│                                                                              │
│  https://github.com/facebook/react-native                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

Looking for JS files in
   /Volumes/Files/Projects/Android/Android_Demos/rn


Metro Bundler ready.

Loading dependency graph, done.
```



### 运行 Android 应用

启动开发服务器后，就可以和正常开发 Android 应用时一样启动应用了。

运行后可以看到终端里有如下的输出：

```shell
 BUNDLE  [android, dev] ./index.android.js ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ 86.3% (446/480)
```

效果如下：

![](https://i.loli.net/2018/04/07/5ac8c2ed70558.png)



这时候使用 cmd + M 键呼出菜单，就可以进行一些调试的配置了。



###  坑点

当显示 Perf Monitor 时就会造成开发热更新失败，所以只能先关闭这个，只在真正性能调优的时候开启。



## 打包 App

最终还是要打包成一个 App，需要先将 JS 打包，然后再 build 应用。

进入 rn 目录，执行以下命令：

```shell
$ npm run bundle-android
```

assets、res 目录要提前创建好，然后文件就会输出到相应目录下去。

>  release 文件夹这里专门用来放 JS bundle ，不需要添加到版本控制系统里面去

然后走正常的 Android 打包流程就好了。



[Demo 地址](https://github.com/dashMrl/Android_Demos/tree/7dad68a388008cb3e1800532ac23b2dc9d88955b)



## 参考

https://reactnative.cn/docs/0.51/integration-with-existing-apps.html