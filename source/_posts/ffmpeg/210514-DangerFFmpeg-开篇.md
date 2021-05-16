---
title: 【DangerFFmpeg】开篇
sticky: 0
categories:
  - Audiovisual
tags:
  - FFmpeg
abbrlink: de61ff75
date: 2021-05-14 00:47:44
updated: 2021-05-14 00:47:44
---

前段时间学习 FFmpeg 的时候找到一个《How to Write a Video Player in Less Than 1000 Lines》系列文章，虽说 1000 行代码的以内的播放器，但是是基于 FFmpeg 2.x 和 SDL 实现的，而自己的电脑又是安装的 FFmpef 4.x 和 SDL2，所以有很多的 API 已经过时甚至是移除了，整个过程中的阻力比较大，最后也没有完全实现这个千行播放器。最近正好时间相对比较充裕，准备重整旗鼓，用新版 FFmpeg 和 SDL 重新挑战一波，然后也顺便把这个系列翻译成中文，加深理解。

因为这个原文章的网址是 http://dranger.com/ffmpeg ，所以称这次翻译系列就叫做 **DangerFFmpeg**。这个系列一共包含 9 个小结，第一节也就是本文正文部分即将翻译的开篇，最后一节是总结与展望，中间 7 小结才是本系列的重点。译文中会加入一些自己的理解，如有偏差，欢迎指出斧正。

> **本系列的开发环境**
>
> 操作系统：macOS BigSur
> 编程语言：C++ 14
> FFmpeg 版本：FFmpeg 4.4
> SDL 版本：SDL2

---

[FFmpeg](https://ffmpeg.org) 在视频应用或其它相关工具方面，是一款非常强大的工具库。FFmpeg 帮你解决视频处理过程中的各种麻烦问题，比如编解码与解封装等，这让多媒体应用开发变得更简单。FFmpeg 使用 C 进行开发，执行速度非常快，并且支持几乎所有编解码格式（通过集成不同的编解码器）。

FFmpeg 唯一的问题是文档聊胜于无（相关资料还是现在比较全了）。有一个 [教程](http://www.inb.uni-luebeck.de/~boehme/using_libavcodec.html) (作者是 [Martin Böhme](http://www.inb.uni-luebeck.de/staff/boehme-d.html)，现在已经无法访问了) 演示了 FFmpeg 基础用法和 doxygen 文档。情况就是这样，所以当我决定学习 FFmpeg 和 多媒体应用的工作原理时，我决定记录学习过程并且作为教程分享出来。

FFmpeg 附带有一个叫 ffplay 的示例程序，ffplay 是个简单的 C 程序，并且实现了一个完整的视频播放器。这个系列教程将从 *Martin Böhme* 教程的更新版本开始，基于 Fabrice Bellard 的 ffplay 开发一个可以正常工作的视频播放器。每个教程中，我都会介绍一两个新的设计思想，并解释如何实现它们。每篇教程都会有一个 Cpp 文件可供下载（当然是放 GitHub 啦），方便你在自己电脑上编译并学习。这些源代码会向你展示真实程序的工作方式，如何将学到的知识组装起来，并且会演示一些教程之外的技术细节。等我们学习完这个系列，我们将会得到一个 1000 行代码以内的视频播放器。

在编写播放器时，我们会使用 [SDL2](https://www.libsdl.org) 输出视频文件的音频和图像。 SDL2 是一个非常优秀的跨平台多媒体库，在 MPEG 播放软件，模拟器以及许多视频游戏中都有应用。所以你需要事先给系统安装 SDL 开发库（mac 下 `brew install SDL2` 就完事了），这样才能成功编译教程中的程序。

这个系列面向的有一定开发经验的朋友，至少你应该了解 C 并对诸如**队列**、**锁**等概念有一定的了解。你也应该了解一些多媒体的基础知识，比如 waveforms，不过并不需要了解非常多，因为我会在教程中向你介绍一些概念。

这些教程也提供老式 ASCII 格式的教程记录，你也可以下载[教程和源代码](http://dranger.com/ffmpeg/ffmpegtutorial.tar.gz)或只有[源码](http://dranger.com/ffmpeg/ffmpegsource.tar.gz)的压缩包。
> 上面这句话就不要当真了。

请随时通过 [clsrfish@gmail.com](mailto:clsrfish@gmail.com) 向我反馈 bug、疑问、评论、想法、功能或任何其它相关消息。


---

教程中代码上传至 https://github.com/clsrfish/dangerffmpeg


## 参考文章

[Danger FFmpeg](http://dranger.com/ffmpeg)