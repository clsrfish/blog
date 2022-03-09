---
title: 【DangerFFmpeg】第三节、播放声音
cover: /img/2021/dangerffmpeg_screencap.jpeg
date: 2021-05-20 07:55:12
updated: 2021-05-20 07:55:12
categories:
  - Audiovisual
tags:
  - FFmpeg
  - SDL2
---

本文是 《DangerFFmpeg》系列教程第三节，系列完整目录：
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


> 第二节中我们使用 send/receive 模型对视频进行编码，但是实现上不利于拓展实现这一节的音频，所以我们把问题简化，只播放音频，在下一节中再将音频和视频组合起来。

---


## 音频

现在我们准备要播放声音了。SDL 也提供了播放音频对应的方法。`SDL_OpenAudio` 用来的打开音频设备，它接受 `SDL_AudioSpec` 结构体作为参数，`SDL_AudioSpec` 描述了我们将要播放的音频的特征。

在演示播放音频步骤之前，我们先学习下计算机是如何处理音频的。数字音频由大量 **采样（samples）** 组成，每个采样点表示音频[波形](http://en.wikipedia.org/wiki/Waveform)的取值。声音以固定的采样频率进行录制，并以每秒的采样数来衡量，换句话说就是我们以多快的速度播放音频。常见的采样频率由 22,050 和 44,100 Hz，它们分别是无线电广播和 CD 的采样频率。另外，大多数的音频可以有多个声道组成立体声和环绕声，比如，如果采样立体声，那么一次采样就会得到两个采样数据（sample）。当我们从视频文件中获取数据时，我们不知道能拿到多少个采样数据，但是 FFmpeg 不会返回不完整的采样，也就是说 FFmpeg 不会把一个立体声的采样拆分为多个采样数据并多次返回。

SDL 播放音频的方式是这样的：首先配置音频参数，这些参数有采样率（frequency），声道数，回调函数和 userdata。当我们开始播放音频，SDL 会不断地调用回调函数并要求我们将音频数据填充到它提供给我们的缓冲区中。在将音频配置写入 `SDL_AudioSpec` 之后，调用 `SDL_OpenAudio` 打开音频设备并拿到 **另一个** `SDL_AudioSpec` ，这个新拿到的 `SDL_AudioSpec` 就是实际需要使用的配置，也就是说无法保证一定能按照我们的期望配置播放音频，但是 SDL 会尽量满足我们的要求，找一个接近的配置。


## 准备音频

上面这些内容先暂时记在脑袋里，因为我们现在还没有拿到任何音频流相关信息。回到上一节的代码中，将查找视频流的代码替换成查找视频流的代码：

```c++
// Find the first audio stream
unsigned int audioStream = -1;
for (unsigned i = 0; i < pFormatCtx->nb_streams; i++) {
  if (pFormatCtx->streams[i]->codec->codec_type == AVMEDIA_TYPE_AUDIO) {
    audioStream = i;
    break;
  }
}
if (audioStream == -1) {
  return 1;  // Didn't find a video or audio stream
}
```

然后就可以从音频流里获取到 AVCodecContext 并拿到我们想要的信息了，就像处理视频流一样：

```c++
AVCodecContext *pACodecCtxOrig = nullptr, *pACodecCtx = nullptr;
// Get a pointer to the code context for the video stream
pACodecCtxOrig = pFormatCtx->streams[audioStream]->codec;
```

如果你还记得上一小节中的内容，我们还要打开音频解码器。这很简单：

```c++
AVCodec* pACodec = nullptr;
// Find the decoder for the video stream
pACodec = avcodec_find_decoder(pACodecCtxOrig->codec_id);
if (pACodec == nullptr) {
  spdlog::error("Unsupported codec!");
  return 1;  // Codec not found
}
// Copy context parameters
AVCodecParameters* pParams = avcodec_parameters_alloc();
avcodec_parameters_from_context(pParams, pACodecCtxOrig);
pACodecCtx = avcodec_alloc_context3(pACodec);
if (avcodec_parameters_to_context(pACodecCtx, pParams) < 0) {
  avcodec_parameters_free(&pParams);
  spdlog::error("Couldn't copy codec contxt!");
  return 1;  // Error copying codec context
}
avcodec_parameters_free(&pParams);

// Open codec
if (avcodec_open2(pACodecCtx, pACodec, nullptr) < 0) {
  spdlog::error("Couldn't open codec");
  return 1;  // Couldn't open codec
}
```

Codec context 中包含了配置音频的所有信息：

```c++
// setup SDL audio here
SDL_AudioSpec wantedSpec, spec;
wantedSpec.freq = pACodecCtx->sample_rate;
wantedSpec.format = AUDIO_F32;
wantedSpec.channels = pACodecCtx->channels;
wantedSpec.silence = 0;
wantedSpec.samples = pACodecCtx->channels * 2;
wantedSpec.callback = audioCallback;
wantedSpec.userdata = pACodecCtx;

if (SDL_OpenAudio(&wantedSpec, &spec) < 0) {
  spdlog::error("SDL_OpenAudio: {s}", SDL_GetError());
  return 1;
}
```

让我们看看这些参数：
- freq：采样率。
- format：告诉 SDL 将会播放什么格式的音频。“S16SYS” 中 “S” 表示 “有符号（signed）”， “16” 表示每个采样数据长度是 16 bits。然后 “SYS” 表示 “[字节序](https://en.wikipedia.org/wiki/Endianness)” 采用系统的顺序。这就是 `avcodec_receive_frame` 接收到的音频格式。
- channels：声道数。
- silence：静音时的音量参考值。一般情况下传 0 就可以了。
- samples：callback 回调时缓冲区的大小。比较合适的区间是 [512, 8192]，ffplay 用的 1024。
- callback：传入一个回调函数，并在回调函数里将解码好的音频数据写入缓冲。后面会再详细说明。
- userdata：callback 回调时的第一个 `void *` 参数。上面代码里传的是 *codec context*，后面会看到如何使用它。

> 这里我们把 foramt 写死成 `AUDIO_F32` ，因为示例音频格式是这个，待到后面我们再使用 `swr_scale` 对原始音频进行重采样以适配不同音频格式。

最后，我们使用 `SDL_OpenAudio` 打开音频设备。

## 缓冲队列

到这里就开始从 *stream* 里获取音频数据了。但是，我们该如何处理这些数据呢？我们会持续地从视频文件中读取数据包（packet），但是与此同时，SDL 也会调用回调函数（callback）！解决方案是创建一个全局的数据结构，将读取到的数据包放进去，SDL 调用回调函数的时候就能从队列获取音频数据（未解码）了。下面我们将创建一个存放数据包（packet）的队列。FFmpeg 内置的 `AVPacketList` 能够帮我们完成这个队列，`AVPacketList` 简单来说就是一个链表节点。下面看代码：

```c++
struct PacketQueue {
  AVPacketList *firstPkt, *lastPkt;
  int nbPackets;
  int size;
  std::mutex* aMutex;
  std::condition_variable* aCond;
};
PacketQueue audioQueue;
```

需要说明的是，`nbPackets` 和 `size` 不是一回事，`size` 指队列中 `packet->size` 相加后的字节数。同时注意到我们创建的一个 `std::mutext` 和 `std::condition_variable` ，这是因为 SDL 音频播放运行在一个独立的线程，如果不适当地给缓冲队列上锁，我们会把队列中的数据破坏。下面我们会看到如何实现一个队列，每个程序员都应该知道如何实现队列，这里我们已经提供好了，所以你可以全力去学习 SDL：

```c++
void packetQueueInit(PacketQueue* queue) {
  memset(queue, 0, sizeof(PacketQueue));
  queue->aMutex = new std::mutex;
  queue->aCond = new std::condition_variable;
}
```

然后我们添加一个函数用于向队列中添加数据：

```c++
int packetQueuePut(PacketQueue* queue, AVPacket* pkt) {
  AVPacketList* pktl;
  AVPacket* dst = av_packet_alloc();
  if (av_packet_ref(dst, pkt) < 0) {
    return -1;
  }
  pktl = reinterpret_cast<AVPacketList*>(av_malloc(sizeof(AVPacketList)));
  if (pktl == nullptr) {
    return -1;
  }

  pktl->pkt = *dst;
  pktl->next = nullptr;

  std::lock_guard<std::mutex> lk(*(queue->aMutex));

  if (queue->lastPkt == nullptr) {
    queue->firstPkt = pktl;
  } else {
    queue->lastPkt->next = pktl;
  }
  queue->lastPkt = pktl;
  queue->nbPackets++;
  queue->size += pktl->pkt.size;

  queue->aCond->notify_all();

  return 0;
}
```

`std::lock_guard` 对 `std::mutex` 上锁，就可以安全地把数据添加到队列中，然后使用 `std::condition_variable::notify_all` 发送信号给对应的 get 函数（如果它在 waiting 状态的话），告诉它队列中有新的数据可以消费了。函数退出时 `std::lock_guard` 的析构函数会自动释放 `std::mutex` 的锁。

下面是对应的 “get” 函数，注意下 `std::condition_variable` 是怎么使当前函数阻塞（直到有新数据）的。

```c++
bool quit = false;

int packetQueueGet(PacketQueue* queue, AVPacket* pkt, bool block) {
  AVPacketList* pktl;

  int ret;

  std::unique_lock<std::mutex> lk(*(queue->aMutex));
  while (true) {
    if (quit) {
      return -1;
    }

    pktl = queue->firstPkt;
    if (pktl != nullptr) {
      queue->firstPkt = pktl->next;
      if (queue->firstPkt == nullptr) {
        queue->lastPkt = nullptr;
      }
      queue->nbPackets--;
      queue->size -= pktl->pkt.size;
      *pkt = pktl->pkt;
      av_free(pktl);
      ret = 1;
      break;
    } else if (!block) {
      ret = 0;
    } else {
      queue->aCond->wait(lk);
    }
  }
  return ret;
}
```

正如你看到的，函数主体是一个死循环，这样就能保证一定能使函数被阻塞（当没有数据可以读取时）。我们使用 `std::condition_variable::wait` 避免无意义的空转，`std::condition_variable::wait` 所做其实就是让出 CPU 并等待 `std::condition_variable::notify_*` 的通知然后继续执行。但是，我们似乎在对 `std::mutex` 上锁后执行 `std::condition_variable::wait` —— 如果我们持有锁，那么 `packetQueuePut` 将无法往里添加数据！然而，`std::condition_variable::wait` 所做的另一件事就是释放 `std::mutex` 的锁，然后在被唤醒时再次尝试对 `std::mutex` 上锁。


## 退出条件

你应该也注意到了，我们声明了一个全局变量 `quit` ，并检查它以确保程序没有收到退出信号（SDL 会自动处理 *TERM（ternimate）* 信号）。否则，线程会一直执行导致程序无法退出，只能使用 `kill -9` 杀死进程。

```c++
SDL_Event ev;
while (SDL_PollEvent(&ev)) {
  if (ev.type == SDL_QUIT || (ev.type == SDL_KEYDOWN && ev.key.keysym.sym == SDLK_ESCAPE)) {
    quit = true;
  }
}
```

程序终止时将 `quit` 设置为 `true`。


## 发送 Packet

剩下的事情就是初始化队列：

```c++
PacketQueue audioQueue;

int main(int argc, char const *argv[]) {
  // ...
  avcodec_open2(pACodecCtx, pACodec, nullptr);

  packet_queue_init(&audioQueue);
  SDL_PauseAudio(0);
  //...
}
```

`SDL_PauseAudio` 最终启动音频设备，如果没有数据输入，音频设备将保持静音。

我们已经建初始化好缓冲队列，现在可以往里开始写入数据包（packet）了。我们进入读取数据包的循环中：

```c++
while (!quit) {
  ret = av_read_frame(pFormatCtx, &packet);
  if (ret == 0) {
    if (packet.stream_index == audioStream) {
      packetQueuePut(&audioQueue, &packet);
    }
    av_packet_unref(&packet);
  }
}
```

注意读取成功并写入队列后就对 `packet` 进行解引用。

## 获取 Packets

现在让我们实现 `audioCallback` 函数，从缓冲队列中获取数据包。回调函数必须符合 `void callback(void *userdata, uint8_t *stream, int len)` 的形式，`userdata` 是我们传递给 SDL 的自定义数据， `stream` 是需要我们填充的缓冲区域，`len` 是缓冲区的大小。下面是实现：

```c++
void audioCallback(void* userdata, uint8_t* stream, int len) {
  AVCodecContext* aCodecCtx = reinterpret_cast<AVCodecContext*>(userdata);
  unsigned int len1, audioSize;

  static uint8_t audioBuf[20 * 1024];
  static unsigned int audioBufSize = 0;
  static unsigned int audioBufIndex = 0;

  while (len > 0) {
    if (audioBufIndex >= audioBufSize) {
      audioSize = audioDecodeFrame(aCodecCtx, audioBuf, sizeof(audioBuf));
      if (audioSize < 0) {
        audioBufSize = 1024;
        memset(audioBuf, 0, audioBufSize);
      } else {
        audioBufSize = audioSize;
      }
      audioBufIndex = 0;
    }

    len1 = audioBufSize - audioBufIndex;
    if (len1 > len) {
      len1 = len;
    }
    memcpy(stream, audioBuf + audioBufIndex, len1);
    len -= len1;
    stream += len1;
    audioBufIndex += len1;
  }
}
```

这就是一个简单的循环，不断地从我们编写的另一个 `audioDecodeFrame` 函数中拉取数据，将数据保存一个中介中韩缓，然后尝试将 `len` 长度的数据写入 `stream`，如果可供写入的数据不足 `len` 则继续从 `audioDecodeFrame` 读取数据，如果 `stream` 空间无法完全写入，则将数据保存至下次回调。`audioBuf` 大小这里写死 20K，比较合理的是设置为最大音频帧大小的 1.5 倍，这个后面进行优化。

## 解码音频

现在开始真正完成编解码器相关部分，`audioDecodeFrame`：

```c++
int audioDecodeFrame(AVCodecContext* aCodecCtx, uint8_t* buf, int bufSize) {
  AVPacket pkt;

  int ret = packetQueueGet(&audioQueue, &pkt, true);
  if (ret <= 0) {
    return ret;
  }

  avcodec_send_packet(aCodecCtx, &pkt);

  int bufIndex = 0;
  AVFrame* frame = av_frame_alloc();
  while (avcodec_receive_frame(aCodecCtx, frame) == 0) {
    int dataSize =
        av_samples_get_buffer_size(nullptr, aCodecCtx->channels, frame->nb_samples, aCodecCtx->sample_fmt, 1);
    assert(dataSize <= bufSize - bufIndex);
    memcpy(buf + bufIndex, frame->data[0], dataSize);
    bufIndex += dataSize;
  }
  av_free(frame);
  av_packet_unref(&pkt);
  return bufIndex;
}
```

首先从 `packetQueueGet` 中取得一个数据包（packet），然后将其送入解码器。因为音频数据包中可能含有多个音频帧，所以接下来使用一个循环反复调用 `avcodec_send_packet` 直到没有数据可以读取。函数退出时对 `packet` 进行解引用，避免内存泄漏。

这就是全部的代码了，我们已经将音频从主读取循环传送到队列，然后在 `audioCallback` 中读取出来，该函数将数据传递给 SDL，SDL 接着将数据输出到声卡。现在可以编译了。

因为我们没有处理视频，所以没有画面。但是声音能按照正常速度播放。为什么音频不像视频那样走样呢？这是因为音频信息中有采样率 —— 音频信息能够在程序运行后就立马解出，但是音频只是根据采样率在闲暇时播放流中的数据。

## 结语

我们现在已经可以尝试同步音视频了，但是首先我们需要将程序重新组织一下。将音频数据存入队列然后在单独的线程中播放的方法工作得非常好：它使得代码更易于管理和模块化。在我们开始同步音视频前，我们需要让代码更容易阅读、修改。下一节：多线程。

源码已经上传 [GitHub](https://github.com/clsrfish/dangerffmpeg) 。

## 参考文章

[原文链接](http://dranger.com/ffmpeg/tutorial03.html)
