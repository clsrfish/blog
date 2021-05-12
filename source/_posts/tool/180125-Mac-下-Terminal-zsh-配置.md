---
title: Mac 下 Terminal + zsh 配置
date: 2018-01-25 17:48:13
categories:
  - Tool
tags:
  - zsh
---

之前一直用 Ubuntu 自带的 Bash，没有去配置什么插件，感觉用着也还行，现在换到 MacOS 的 Terminal 下，发现它默认配置真的没有 Ubuntu 的好看，为了能更加快乐的使用终端，还是决定去捣鼓一番。

<!--more-->

MacOS 自带应用不像 Linux 那样，想删就能删除，又不喜欢安装两个功能相同的应用，就直接使用自带的 Terminal。

## 效果

![](https://i.loli.net/2018/01/25/5a69ac7d978af.png)

​

## 安装 zsh

MacOS 自带了 zsh，可能不是最新版本，不过没影响，其它平台使用各自的包管理器进行安装就👌了。

先看看系统都提供哪些 shell：

```shell
$ cat /etc/shells
# List of acceptable shells for chpass(1).
# Ftpd will not allow users to connect who are not using
# one of these shells.

/bin/bash
/bin/csh
/bin/ksh
/bin/sh
/bin/tcsh
/bin/zsh
```



这里看到 zsh 已经安装了，接着替换系统默认的 shell：

```shell
$ chsh -s /bin/zsh
```

可能会要求输入密码，输入就好了，重启终端就可以看到效果了。



## 安装 Oh my zsh

简单替换 zsh 虽然能用，但是还是有点丑，通过 [oh my zsh](http://ohmyz.sh/) 来配置。

安装也很简单（也叫不上安装）：

```shell
$ sh -c "$(curl -fsSL https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"
```

执行完后会在用户目录下创建一些默认配置文件，同时也会看到命令提示符发生了变化。



## 主题

通过 [主题](https://github.com/robbyrussell/oh-my-zsh/wiki/Themes) 让它再更好看点。

### 字体

这里选用 `agnoster` 主题的变种 [agnosterzak](https://github.com/zakaziko99/agnosterzak-ohmyzsh-theme) ，因为有一些特殊字符显示问题，需要先安装 `Powerline compatible` 字体：

```shell
$ curl https://github.com/powerline/fonts/raw/master/Meslo%20Slashed/Meslo%20LG%20M%20Regular%20for%20Powerline.ttf -o Meslo_LG_M_Regular_for_Powerline.ttf && open Meslo_LG_M_Regular_for_Powerline.ttf
```

这里只安装一个字体就行了。

### 配色

效果图中有色块，所以配色就显得尤为重要，没选好就可能极其辣眼睛，这个 [仓库](https://github.com/mbadolato/iTerm2-Color-Schemes) 有很多配色，根据自己的喜好选一种就好了。

```SHELL
$ curl https://github.com/mbadolato/iTerm2-Color-Schemes/raw/master/terminal/Solarized%20Dark%20Higher%20Contrast.terminal -o Solarized_Dark_Higher_Contrast.terminal
```

下载好后进入 Terminal 的 Preference（偏好设置）进行导入并设为默认就 👌 了。

![](https://i.loli.net/2018/01/25/5a69b2abb611d.png)

然后把字体改为之前安装好的。

### zsh 主题

执行命令：

```shell
$ mkdir -p ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/themes && curl http://raw.github.com/zakaziko99/agnosterzak-ohmyzsh-theme/master/agnosterzak.zsh-theme -o ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/themes/agnosterzak.zsh-theme
```

然后修改 .zshrc 文件，将变量 ZSH_THEME 设为 agnosterzak：

```shell
# Set name of the theme to load. Optionally, if you set this to "random"
# it'll load a random theme each time that oh-my-zsh is loaded.
# See https://github.com/robbyrussell/oh-my-zsh/wiki/Themes
ZSH_THEME="agnosterzak"
```

重启终端，就能看到和文章开头差不多的效果了。



## 其它定制

到现在效果已经挺棒的了，不过还是根据自己的情况作了一些定制化。主要还是改主题，因为我也不是很喜欢安装太多插件。



**隐藏电量**

这个是第一眼看上去就觉得没有太多价值的信息，所以应该要去掉。

修改 agnosterzak.zsh-theme 文件：

```shell
$ vim ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/themes/agnosterzak.zsh-theme
```

滑到底部然后把电池相关的配置注释掉：

```shell
## Main prompt
build_prompt() {
   RETVAL=$?
   echo -n "\n"
   prompt_status
#  prompt_battery
   prompt_time
   prompt_virtualenv
   prompt_dir
   prompt_git
   prompt_hg
   prompt_end
   CURRENT_BG='NONE'
   echo -n "\n"
   prompt_context
   prompt_end
}
```



**缩短当前工作空间路径**

很多情况下，完整路径是没有太多作用，所以只保留最具价值的部分——当前目录名，修改 agnosterzak.zsh-theme 文件，找到：

```shell
# Dir: current working directory
prompt_dir() {
  prompt_segment cyan white "%{$fg_bold[white]%}%~%{$fg_no_bold[white]%}"
}
```

把 `%~` 改成 `%c` ：

```shell
# Dir: current working directory
prompt_dir() {
  prompt_segment cyan white "%{$fg_bold[white]%}%c%{$fg_no_bold[white]%}"
}
```



**修改用户@设备名配色**

打开 agnosterzak.zsh-theme，找到 `prompt_context` ：然后修改成下面的样子：

```shell
# Context: user@hostname (who am I and where am I)
prompt_context() {
  if [[ -n "$SSH_CLIENT" ]]; then
    prompt_segment magenta white "%{$fg_bold[white]%(!.%{%F{white}%}.)%}$USER@%m%{$fg_no_bold[white]%}"
  else
    prompt_segment magenta white "%{$fg_bold[white]%(!.%{%F{white}%}.)%}@$USER%{$fg_no_bold[white]%}"
  fi
}
```

其实只是更改了第6行的配色。



改完后执行 `source ~/.zshrc` 就可以看到效果图中的终端了。