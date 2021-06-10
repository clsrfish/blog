---
title: 《DangerFFmpeg》第七节、快进快退
cover: /img/audiovisual/dangerffmpeg_screencap.jpeg
date: 2021-06-09 22:52:02
updated: 2021-06-09 22:52:02
categories:
  - Audiovisual
tags:
  - FFmpeg
  - SDL2
---

本文是 《DangerFFmpeg》系列教程第七节，系列完整目录：
《[开篇](/2021/05/14/8cf36b195b05.html)》
《[第一节、屏幕截图](/2021/05/15/1c458d50c524.html)》
《[第二节、输出到屏幕](/2021/05/16/aeb0b6c30d08.html)》
《[第三节、播放声音](/2021/05/20/d4b63d917433.html)》
《[第四节、多线程](/2021/05/22/71765970ad7e.html)》
《[第五节、视频同步](/2021/05/30/088658998748.html)》
《[第六节、同步音频](/2021/06/05/d8b51b0cff00.html)》
《[第七节、快进快退](/2021/06/09/2f01ccb59968.html)》
《[结语](/2021/06/19/7ddfef63d330.html)》

系列所有代码托管在 [GitHub](https://github.com/clsrfish/dangerffmpeg) 。

---

## 响应快进快退操作

我们现在准备给播放器添加快进快退功能，因为当你不能快退视频时确实很令人烦躁。另外，这篇教程也会让你看到 `av_seek_frame` 的使用非常简单。

我们让左方向键和右方向键快退或快进一点，比如10s，同时上方向键和下方向键快进或快退稍多一点，比如 60s。所以我们需要再修改下主事件循环以响应键盘事件。然而，当我们收到按键事件时，我们不能直接调用 `av_seek_frame`，需要在解封装循环里完成，即 `decodeThread`。所以，我们再往 `VideoState` 添加一些变量，用来表示快进快退的位置和标识位：

```c++
bool seekReq;
int seekFlags;
int64_t seekPos;
```

现在我们需要修改事件循环，响应按键事件：

```c++
while(!is->quit) {
  switch (event.type) {
    case SDL_KEYDOWN:
      incr = 0.0;
      switch (event.key.keysym.sym) {
        case SDLK_LEFT:
          incr = -3.0;
          break;
        case SDLK_RIGHT:
          incr = 3.0;
          break;
        case SDLK_UP:
          incr = 5.0;
          break;
        case SDLK_DOWN:
          incr = -5.0;
          break;
      }
      if (incr != 0.0) {
        pos = getMasterClock(is);
        pos += incr;
        spdlog::info("seek: {0} - {1}", incr, pos);
        streamSeek(is, static_cast<int64_t>(pos * AV_TIME_BASE), incr);
      }
      break;
  }
}
```

要检测是否有按键事件，首先看是否收到 `SDL_KEYDOWN` 事件，然后通过 `event.key.keysym.sym` 检测哪个按键被按下。知道快进快退的具体方式（上下左右）后，通过将对应的偏移与 `getMasterClock` 返回的时钟相加计算出要快进快退到的位置。然后调用 `streamSeek` 移动到对应的位置。我们将快进快退位置的时间戳转换为解码器内部时间单位。回想一下，数据流的时间戳是以帧为单位而不是秒，计算公式是：`seconds = frames * time_base (fps)`。FFmpeg 编解码器默认 fps 是 1,000,000（所以 2s 会被转换成 2,000,000）。后面会看到我们为什么要进行这一层转换。

下面是 `streamSeek` 函数。注意我们在快退的时候才设置 flag：

```c++
void streamSeek(VideoState* is, int64_t pos, int rel) {
  if (is->seekReq) {
    return;
  }
  is->seekReq = true;
  is->seekFlags = rel < 0 ? AVSEEK_FLAG_BACKWARD : 0;
  is->seekPos = pos;
}
```

现在让我们回到 `decodeThread`，在这里我们会执行实际的快进快退操作。你会发现源代码中我们用 "seek stuff goes here" 标记了一个代码区域，我们会在那里实现快进快退的代码。

快进快退围绕 `av_seek_frame` 实现，这个函数接收一个 `AVFormatContext`，`AVStream` 的索引，时间戳以及一个标识位作为参数，它会快进快退到时间戳指定的位置，时间戳的单位是 `AVStream.time_base`，不过 `AVStream` 索引参数不是必选的（不指定时传 -1）。如果不传索引，那么 `time_base` 就是编解码器内部时间戳单位，或者说 1,000,000。这就是为什么我们要使用 `AV_TIME_BASE` 乘以 `seekPos`。

然而，有时候流索引传入 -1 在某些文件格式上会出现问题（极少情况），所以为了兼容性，我们将文件中第一个流传递给 `av_seek_frame` 。别忘了将时间戳转换成对应流的 `time_base` 单位。

```c++
if (is->seekReq) {
  int streamIndex = -1;
  int64_t seekTarget = is->seekPos;
  if (is->videoStream >= 0) {
    streamIndex = is->videoStream;
  } else if (is->audioStream >= 0) {
    streamIndex = is->audioStream;
  }
  if (streamIndex >= 0) {
    seekTarget = av_rescale_q(seekTarget, AV_TIME_BASE_Q, pFormatCtx->streams[streamIndex]->time_base);
  }
  spdlog::info("seek to {0}", seekTarget);
  int ret = av_seek_frame(is->formatCtx, streamIndex, seekTarget, is->seekFlags);
  if (ret < 0) {
    spdlog::error("{0}:{1} error while seeking!", is->filename, ret);
  } else {
    /* handle packet queues... more later... */
  }
  is->seekReq = false;
}
```

`av_rescale_q`(a,b,c) 函数将时间戳从一个 `time_base` 转换成另一个 `time_base` 表示，计算可以简单理解成 `a*b/c`，虽然计算很简单，但是还是需要使用这个函数，因为计算可能发生溢出。`AV_TIME_BASE_Q` 是 `AV_TIME_BASE` 的分数表示，它们的区别体现在：`AV_TIME_BASE * time_in_seconds = avcodec_timestamp` 以及 `AV_TIME_BASE_Q * avcodec_timestamp = time_in_seconds` （注意 `AV_TIME_BASE_Q` 实际上是 `AVRational` 对象，所以你需要使用特殊的 q 函数进行处理）。

## 清理缓冲

我们通过 `av_seek_frame` 移动到了正确的位置，但是事情还没有结束，因为我们还有一个数据包队列的缓冲需要处理。在 `decodeThread` 中，我们需要清理队列，否则快进快退不能正常工作。除了我们定义的缓冲，编解码器内部也有缓冲需要清理。

为了清理缓冲，我们首先要定义一个清理队列的函数。然后我们需要告诉解码器清理内部缓冲。我们可以在清理队列后再放入一个特殊的数据包，然后当读取到这个数据包时，对应的 `videoThread` 和 `audioThread` 就会清理解码器中的缓冲。

让我们开始编写队列清理函数。实现非常简单，所以我就只贴代码了：

```c++
void packetQueueFlush(PacketQueue* q) {
  AVPacketList *pkt, *pkt1;

  std::lock_guard<std::mutex>(*(q->mtx));
  if (q->size == 0) {
    return;
  }
  for (pkt = q->firstPkt; pkt != nullptr; pkt = pkt1) {
    pkt1 = pkt->next;
    av_packet_unref(&(pkt->pkt));
    av_freep(&pkt);
  }
  q->lastPkt = nullptr;
  q->firstPkt = nullptr;
  q->nbPackets = 0;
  q->size = 0;
}
```

现在队列清理干净了，让我们再将一个特殊数据包（flush packet）放入队列。不过我们要先声明并初始化这个包：

```c++
struct PacketQueue {
  // ...
  AVPacket flushPkt;
}

void packetQueueInit(PacketQueue* queue) {
  // ...
  queue->flushPkt.data = reinterpret_cast<uint8_t*>(const_cast<char*>("FLUSH"));
}
```

现在我们把这个包放入队列：

```c++
/* handle packet queues... more later... */
if (is->audioStream >= 0) {
  packetQueueFlush(&is->audioQueue);
  packetQueuePut(&is->audioQueue, &is->audioQueue.flushPkt);
}
if (is->videoStream >= 0) {
  packetQueueFlush(&is->videoQueue);
  packetQueuePut(&is->videoQueue, &is->videoQueue.flushPkt);
}
```

我们也需要调整 `packetQueuePut` 函数避免多次引用 `flushPkt`：

```c++
int packetQueuePut(PacketQueue* queue, AVPacket* pkt) {
  AVPacketList* pktl;
  AVPacket* dst = av_packet_alloc();
  if (pkt != &queue->flushPkt && av_packet_ref(dst, pkt) < 0) {
    av_packet_free(&dst);
    return -1;
  }
  // ...
}
```

然后在音频解码函数和视频解码函数中，我们在 `packetQueueGet` 后调用 `avcodec_flush_buffers`：

```c++
int audioDecodeFrame(VideoState* is, uint8_t* buf, int bufSize, double* ptsPtr) {
  AVPacket pkt;

  int ret = packetQueueGet(&is->audioQueue, &pkt, true);
  if (ret <= 0) {
    return ret;
  }
  if (pkt.data == is->audioQueue.flushPkt.data) {
    avcodec_flush_buffers(is->audioCtx);
    return 0;
  }
  // ...
```

视频的处理和上面一样。



这就是全部内容了，编译运行：

```shell
$ ./main.sh assets/ohayo_oniityan.mp4
```

尽情把玩你的不到 1000 行 C++ 语言制作的电影播放器​​吧！

当然，有很多我们使用过的功能可以添加。

## 参考文章

[原文链接](http://dranger.com/ffmpeg/tutorial07.html)
