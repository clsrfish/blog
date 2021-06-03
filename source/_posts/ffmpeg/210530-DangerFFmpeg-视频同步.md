---
title: 《DangerFFmpeg》第五节、视频同步
cover: /img/audiovisual/dangerffmpeg_screencap.jpeg
date: 2021-05-30 20:38:25
updated: 2021-05-30 20:38:25
categories:
  - Audiovisual
tags:
  - FFmpeg
  - SDL2
---

本文是 《DangerFFmpeg》系列教程第五节，系列完整目录：
《[开篇](/2021/05/14/8cf36b195b05.html)》
《[第一节、屏幕截图](/2021/05/15/1c458d50c524.html)》
《[第二节、输出到屏幕](/2021/05/16/aeb0b6c30d08.html)》
《[第三节、播放声音](/2021/05/20/d4b63d917433.html)》
《[第四节、多线程](/2021/05/22/71765970ad7e.html)》
《[第五节、视频同步](/2021/05/30/088658998748.html)》

系列所有代码托管在 [GitHub](https://github.com/clsrfish/dangerffmpeg) 。


上节教程中我们对代码进行了拆分，也正因如此，音视频同步实现也就比较简单了。

---

> **CAVEAT**
> 原文写作时，音视频同步的代码取自于 ffplay。现在，ffplay 发生非常大的变化，ffmpeg 也有了非常多的优化，相应地，音视频同步策略也更新了。虽然本文的代码可以工作，但是还不够优雅，还有许多地方可以优化。


## 视频同步原理

现在为止，我们开发了一个几乎没屌用的视频播放器，它能播放音频，也能播放视频，但是还不能叫做正常意义上的播放器。所以我们该怎么做呢？

### DTS & PTS

幸运的是，音频流和视频流里都含有应该以何种速度播放以及什么时候显示的信息。音频流有**采样率**，视频流有**帧率**。然而，如果我们简单地通过帧数和帧率相乘进行同步，有很大可能画面和音频会变得不同步。音频流中的数据包可能含有叫 DTS（decoding timestamp） 和 PTS（presentation timestamp）的信息。为了理解这两个值的含义，你需要了解视频编码存储的方式。一些视频格式，比如 MPEG，会使用到 **B（bidirectional）帧**，另外两种帧类型叫 **I（Intro）帧** 和 **P（Predicted）** 帧。 I 帧存储一张完整的图像；P 帧依赖于前面的 I 帧或 P 帧，存储了它们之间差量信息；B 帧与 P 帧类似，但是它同时依赖它前面与后面的帧！这就是为什么有时候`av_receive_frame` 既没有返回 `AVFrame` 又没有报错的原因。

让我们假设有一个视频，画面对应的帧序列排列：`I B B P`。在解码 B 帧之前，我们需要先解码 P。因此，编码后帧可能按照 `I P B B` 顺序存储。这就是为什么帧数据同时有 DTS 和 PTS 的原因。DTS 告诉解码器什么时候进行解码，PTS 告诉播放器什么时候渲染帧。对于这个例子，我们的视频流大概长这样：

```plaintext
   PTS: 1 4 2 3
   DTS: 1 2 3 4
Stream: I P B B
```

一般来讲，只有在使用了 B 帧的视频中 PTS 和 DTS 值是不相等的。

当我们从 `av_read_frame` 读取数据包（packet）时，包里就携带了 DTS 和 PTS。但是我们用到的是解码后的帧数据中的 PTS，并以此确定什么渲染。幸运的是，FFmpeg 提供了 `av_frame_get_best_effort_timestamp` 帮助我们获取 PTS。

> `av_frame_get_best_effort_timestamp` 在 FFmpeg 4.4 中已经被标记为 deprecated 了，在系列尾声中，我们会解决代码中的 warning，使用新的 API 替换这些废弃的接口。


### 同步策略

现在，我们知道了什么时候渲染帧，但是我们怎么编码实现呢？思路是这样的：在我们渲染完一帧后，计算出下一帧的渲染时间。然后启动一个定时器，在计算出的时间渲染下一帧，重复这个操作。和你猜想的一样，我们会用下一帧的 PTS 和当前系统时钟对比，计算出计时器定多久。这个方案可以工作，但是有两个问题需要特别处理。

首先，下一帧的 PTS 如何获取。你可能会想，我们可以直接通过帧率和当前帧的 PTS 计算出下一帧的 PTS。大多数情况下，这种方式是正确的。然而，一些视频的帧可能会重复显示，比如静止画面。这就意味着我们也需要持续显示当前帧特定时间。如果按照刚才的方式实现，很有可能视频播放速度就会变快。所以我们需要考虑这种情况。

第二个问题是，随着程序运行，音频和视频时钟之间差值越来越大，最后的结果就是音画不同步。理想情况下，我们不用担心这些问题。但是实际情况是，你的设备并不完美，很多视频文件也不完美。事实上，这种不完美才是计算机世界里的常态。

所以我们有三个选择：

- 将音频同步到视频
- 将视频同步到音频
- 将音频和视频同步到外部时钟，比如系统时钟

本次教程中，我们将会实现第二个策略。


## 编码：获取视频帧 PTS

现在让我们看下相关实现。我们将需要向 `VideoState` 添加更多的属性，但是我们会在使用到的时候再添加。首先看到之前的 video 线程，还记得之前的教程话，我们会在这里获取数据包并进行解码。我们要做的就是从 `avcodec_receive_frame` 返回的帧数据中获取 PTS。第一步我们先从数据包中拿到 DTS，很简单：

```c++
while (true) {
  int ret = packetQueueGet(&is->videoQueue, packet, true);
  if (ret < 0) {
    // means we quit getting packets
    break;
  }
  double pts = 0.0F;
  // Decode video frame
  ret = avcodec_send_packet(is->videoCtx, packet);
  while (avcodec_receive_frame(is->videoCtx, pFrame) == 0) {
    if (packet->dts != AV_NOPTS_VALUE) {
      pts = av_frame_get_best_effort_timestamp(pFrame);
    }
    pts *= av_q2d(is->videoSt->time_base);
    // ...
  }
}
```

如果 DTS 值等于 `AV_NOPTS_VALUE`，将 `pts` 设置为 0。

嗯，非常简单。

最后我们把 pts 转换成了时间戳。`time_base` 取值等于 `1/framerate`（固定帧率的话），所以转换成秒单位时，我们直接乘以 `time_base` 就可以了。

## 编码：使用 PTS 同步视频

现在我们已经拿到了 pts，现在可以开始处理上面提到的两个问题了。我们定义一个 `synchronizeVideo` ，它会更新 PTS 以保持同步到特定时钟（但其实只是处理的帧多次显示的问题）。这个函数也会处理刚才提到的数据帧没有 PTS 的情况。同时，我们需要的记录下一帧何时渲染，这样才能保持帧率正确。我们可以定一个**内部时钟**记录启播到当前帧的时间（注意不是简单的拿当前时间和启播时间做差）：

```c++
struct VideoState {
  double videoClock; // pts of last decoded frame / predicted pts of next decoded frame
}
```

下面是 `synchronizeVideo` 的实现，注释很详细了：

```c++
double synchronizeVideo(VideoState* is, AVFrame* srcFrame, double pts) {
  if (pts != 0) {
    /* if we have pts, set video clock to it */
    is->videoClock = pts;
  } else {
    /* if we aren't given a pts, set it to the clock */
    pts = is->videoClock;
  }
  /* udpate the video clock */
  double frameDelay = av_q2d(is->videoSt->codec->time_base);
  /* if we are repeating a frame, adjust clock accordingly */
  frameDelay += srcFrame->repeat_pict * (frameDelay / 2);

  is->videoClock += frameDelay;
  return pts;
}
```

注意这里考虑一帧多次展示的情况。将当前帧的

现在，拿到合适的 PTS 并且将数据帧入队：

```c++
// videoThread
pts = synchronizeVideo(is, pFrame, pts);
if (queuePicture(is, pFrame, pts) < 0) {
  break;
}
```

`queuePicture` 只做了将 pts 写入 `VideoPicture` 的改动，所以需要给 `VideoPicture` 添加一个属性：

```c++
struct VideoPicture {
  ...
  double pts;
}

int queuePicture(VideoState* is, AVFrame* pFrame, double pts) {
  /* ...sws_scale... */
  vp->pts = pts;
}
```

现在我们已经把带有 PTS 的 `VideoPicture` 写入了队列，让我们再来分析下视频刷新的函数 `videoRefreshTimer`。你应该还记得我们之前写死了 20ms 的刷新间隔，现在我们将看下如何计算出准确的刷新间隔。

我们的策略就是通过对比前一帧和当前帧的 PTS 来预测下一帧的 PTS。同时，我们需要将视频同步到音频时钟。我们将构造一个**音频时钟（audio clock）**：记录音频当前的播放到什么时间了，就像 MP3 上的数字时间一样。因为是视频同步到音频，所以 `videoRefreshTimer` 中会确认视频播放速度是快了还是慢了。

我们等会再看具体实现，现在假设我们有一个 `getAudioClock` 可以获取当前的音频时钟。拿到音频时钟后，如果发现音视频不同步，又要怎么做呢？直接快进到正确的帧会显得有点憨，我们需要更机智的方式。所以，我们对计算出的下帧刷新时间做适当调整：如果视频快了，就将刷新时间加倍；如果慢了就尽可能快地显示下一帧。调整完刷新时间或延时后，我们拿记录的内部时钟（`frameTimer`）和系统时钟做差。`frameTimer` 会累加每次视频刷新时计算的下一帧刷新时间/延迟，换句话说，`frameTimer` 就是预期的下一帧刷新时间。我们简单地将延时相加，然后与系统时钟做差，得到的差值就是下次刷新的实际时延。纯文字描述可能优点绕，直接看代码：

```c++
void videoRefreshTimer(void* userdata) {
  VideoState* is = reinterpret_cast<VideoState*>(userdata);
  if (is->videoSt == nullptr) {
    scheduleRefresh(is, 100);
    return;
  } else if (is->picQueueSize == 0) {
    scheduleRefresh(is, 1);
    return;
  }

  VideoPicture* vp = &is->picQueue[is->pqRIndex];
  double delay = vp->pts - is->frameLastPts;  // the pts from last time
  if (delay <= 0 || delay >= 1.0) {
    // if incorrect delay, use previous one
    delay = is->frameLastDelay;
  }
  // save for next time
  is->frameLastDelay = delay;
  is->frameLastPts = vp->pts;

  // udpate delay to sync to audio
  double audioClock = getAudioClock(is);
  double diff = vp->pts - audioClock;

  // skip or repeat the frame. Take delay into account.
  // FFplay still doesn't "know if this is the best guess."
  double syncThreshold = (delay > AV_SYNC_THRESHOLD) ? delay : AV_SYNC_THRESHOLD;
  if (std::abs(diff) < AV_NOSYNC_THRESHOLD) {
    if (diff <= -syncThreshold) {
      delay = 0;
    } else if (diff >= syncThreshold) {
      delay *= 2;
    }
  }
  is->frameTimer += delay;

  // compute the READ delay
  double actualDelay = is->frameTimer - (av_gettime() / 1000000.0);

  if (actualDelay < 0.010) {
    // Really it should skip the picture instead
    actualDelay = 0.010;
  }

  scheduleRefresh(is, static_cast<int>(actualDelay * 1000 + 0.5));

  std::lock_guard<std::mutex> lk(*(is->picQueueMutex));

  // show the picture
  videoDisplay(is);

  // update queeu for next picture
  if (++is->pqRIndex == VIDEO_PICTURE_QUEUE_SIZE) {
    is->pqRIndex = 0;
  }
  is->picQueueSize--;
  is->picQueueCond->notify_all();
}
```

这里做几个检查：确保前一帧 PTS 和当前帧 PTS 的差值是合法的。如果不合法则复用上次计算结果。然后，计算出一个同步阈值，因为不可能做到绝对同步，只要差值在可接受范围内，就认为是同步的（人无法感知），ffplay 使用 0.01，即 10ms。最后，确保同步阈值不会比两个 PTS 之差小。最后控制刷新间隔最小不小于 10ms。

> `std::abs(diff) < AV_NOSYNC_THRESHOLD` 这个判断条件原文没有进行解释，我也没有理解这个条件的含义。
> 另一个疑问是，计算延时不应该是用下一帧 PTS 与当前帧 PTS 做差么？但是这里居然是用当前帧与上一帧做差，对于一帧需要重复展示多次的case，不就出问题了吗？前面的 synchronizeVideo 方法里计算的 videoClock 也基本没有起作用。
> 网上搜到的文章，都是这么直接“抄”的代码，只讲原理，不讲实现。等这个系列翻译完了分析下 ffplay 再回来填坑。

我们向 `VideoState` 添加了一堆变量，记得别漏了。也别忘了在 `streamComponentOpen`初始化 `VideoState.frameTimer` 和 `VideoState.frameLastPts`：

```c++
is->frameTimer = av_gettime()/ 1000000.0;
is->frameLastPts = 40-e3;
```


## 同步：音频时钟

现在是时候实现音频时钟了。我们可以在完成音频解码的 `audioDecodeFrame` 中更新音频时钟。记住，因为通常一个音频数据包可以解出多个音频帧，所以需要在两个地方更新时钟。第一个地方是拿到数据包后：将音频时钟设置为为数据包的 PTS。然后如果一个数据包有多个帧，我们可以通过计算每一帧的大小来估算音频时钟。所以当我们拿到数据包时：

```c++
// if update, update the audio clock w/pts
if (pkt.pts != AV_NOPTS_VALUE) {
  is->audioClock = av_q2d(is->audioSt->time_base) * pkt.pts;
}
```
然后解码得到音频帧时：

```c++
// Keep audioClock update-to-date
double pts = is->audioClock;  // used next time
// *pts_ptr = pts;
int bytesPerSample = 4 * is->audioSt->codec->channels;
is->audioClock += dataSize / bytesPerSample * is->audioSt->codec->sample_rate;
```

一些细节：注释中有个 `pts_ptr` 变量，这个在下节将音频同步到视频时会用到（其实我也不知道会不会用到，可能因为实现不同而不会用到）。

现在我们终于可以实现 `getAudioClock` 函数了，然而它不是简单地返回 `is->audioClock`。注意我们在每次得到音频帧时更新音频时钟，但是如果你回顾一下 `audioCallback` 函数就会发现，将解码后的所有数据拷贝到音频缓冲区也是有时间开销的。这意味着 `is->audioClock` 可能比实际时钟要快。所以我们还要检查还剩有多少数据未被写入音频缓冲区。下面是完整代码：

```c++
/* Still not accurate */
double getAudioClock(VideoState* is) {
  double pts = is->audioClock;  // maintained in the audio thread
  int hwBufSize = is->audioBufSize - is->audioBufIndex;
  int bytesPerSample = is->audioSt->codec->channels * 4;
  int bytesPerSecond = is->audioSt->codec->sample_rate * bytesPerSample;

  if (bytesPerSecond > 0) {
    pts -= static_cast<double>(hwBufSize) / bytesPerSecond;
  }

  return pts;
}
```

你现在应该能够说出为什么这个函数起作用了;)

这就是所有内容了，编译运行：

```shell
$ ./main.sh assets/ohayo_oniityan.mp4
```

![Sync video to audio](../../img/audiovisual/dangerffmpeg_threads.gif)

> 这张图其实还是上节教程的，反正没有声音你们大概率也看不出来差别 hhhh

源码已经上传 [GitHub](https://github.com/clsrfish/dangerffmpeg)，请放心食用。

## 参考文章

[原文链接](http://dranger.com/ffmpeg/tutorial05.html)
