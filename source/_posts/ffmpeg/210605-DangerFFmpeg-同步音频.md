---
title: 《DangerFFmpeg》第六节、同步音频
cover: /img/audiovisual/dangerffmpeg_screencap.jpeg
date: 2021-06-05 20:12:56
updated: 2021-06-06 09:23:59
categories:
  - Audiovisual
tags:
  - FFmpeg
  - SDL2
---

本文是 《DangerFFmpeg》系列教程第六节，系列完整目录：
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

我们已经完成了一个能够称得上播放器的视频播放器，所以让我们看看我们实现了什么东西。上节教程中，我们稍微优化了同步，即将视频时钟同步到音频时钟，而不是其它方式。我们将做与视频类似的事：创建一个内部视频时钟以跟踪视频线程的时间并将音频同步到该时钟。后面我们也会看到如何进行抽象，将音频和视频同步到外部时钟。

---

## 实现视频时钟

现在我们想要实现一个类似上节教程中音频时钟的视频时钟：一个内部值，给出视频从播放到现在的时间偏移。起初，你可能认为视频时钟就是简单地用上一帧的 PTS 更新。然而，不要忘了视频帧中间的时间间隔在毫秒级别下会非常大。解决办法增加另一个变量，记录我们什么时候将视频时钟更新为上一帧的 PTS。视频时钟真实值是 `PTS_of_last_time + (current_time - time_elapsed_since_PTS_value_was_set)`。这个方案和 `getAudioClock` 类似。

所以，在 `VideoState` 中增加 `double videoCurrentPts` 和 `int64_t videoCurrentPtsTime`。时钟更新操作在 `videoRefreshTimer` 中进行：

```c++
/* ... */
VideoPicture* vp = &is->picQueue[is->pqRIndex];

// Update video clock
is->videoCurrentPts = vp->pts;
is->videoCurrentPtsTime = av_gettime();
```

不要忘了在 `streamComponentOpen` 中初始化：

```c++
is->videoCurrentPtsTime = av_gettime();
```

然后，剩下的就是提供获取视频时钟的方法 —— `getVideoClock`：

```c++
double getVideoClock(VideoState* is) {
  double delta = (av_gettime() - is->videoCurrentPtsTime) / 1000000.0;
  return is->videoCurrentPts + delta;
}
```

## 抽象时钟

不过为什么要限制使用视频时钟呢？我们需要调整一下视频同步的代码，避免音频和视频相互同步。想象一下如果我们提供类似 ffplay 命令行选项，这将是一个混乱的场景。所以让我们进行一些抽象：我们创建一个新的套娃函数，`getMasterClock` 判断 `avSyncType` 然后选择性调用 `getAudioClock` 、`getVideoClock` 或 其它任何我们想要使用的时钟。我们甚至可以使用系统的时钟，暂时叫做 `getExternalClock` ：

```c++
enum AvSyncMaster {
  AV_SYNC_AUDIO_MASTER,
  AV_SYNC_VIDEO_MASTER,
  AV_SYNC_EXTERNAL_MASTER,
};

const AvSyncMaster DEFAULT_AV_SYNC_TYPE = AV_SYNC_VIDEO_MASTER;

double getMasterClock(VideoState* is) {
  if (is->avSyncType == AV_SYNC_VIDEO_MASTER) {
    return getVideoClock(is);
  } else if (is->avSyncType == AV_SYNC_AUDIO_MASTER) {
    return getAudioClock(is);
  } else {
    return getExternalClock(is);
  }
}

int main() {
    is->avSyncType = DEFAULT_AV_SYNC_TYPE;
}
```

## 同步音频

接下来是最难的部分：将音频时钟同步到视频时钟。我们的策略是确定当前的音频时钟，与视频时钟做比较，然后计算出我们需要调整多少采样，即我们需要丢弃一些采样以加速还是增加一些来降低播放速度？

每次处理一组音频采样数据时，我们执行一个 `synchronizeAudio` 函数，以便对采样数据进行填充或压缩。然而，我们不想处理每一个采样数据时进行同步，因为音频解码的频率要比视频多得多。所以在开始做任何事情前，我们设置一个最小的连续调用 `synchronizeAudio` 且不同步的次数。当然，就像上次一样，“out of sync“ 指的时音频时钟和视频时钟的差值超过特定阈值。

假设我们已经拿到了 **N** 个不同步的音频采样。每个采样不同步的偏移量可能相差很大，所以我们计算这些采样数据的偏移的平均值。比如，第一次调用时 `synchronizeAudio` 时计算出偏移 *40ms*，第二次是 *50ms*，以此类推。但是我们不打算使用算数平均，因为最新的数据要比之前的数据重要，所以我们使用一个小数系数，叫做 `c`，然后将这些偏移按这样进行相加：`diff_sum = new_diff + diff_sum * c`。当我们计算平均偏移时，简单地计算 `avg_diff = diff_sum * (1 - c)` 作为平均偏移。

目前为止， `synchronizeAudio` 是这样的：

```c++
/**
 * Add or substract samples to get a better sync, return new audio buffer size.
 */
int synchronizeAudio(VideoState* is, uint8_t* samples, int samplesSize, double pts) {
  if (is->avSyncType == AV_SYNC_AUDIO_MASTER) {
    return samplesSize;
  }
  double refClock = getMasterClock(is);
  double diff = getAudioClock(is) - refClock;

  if (diff > AV_NOSYNC_THRESHOLD) {
    // difference is TOO big, reset diff stuff
    is->audioDiffAvgCount = 0;
    is->audioDiffCum = 0;
    return samplesSize;
  }

  // accumulate the diffs
  is->audioDiffCum = diff + is->audioDiffAvgCoef * is->audioDiffCum;
  if (is->audioDiffAvgCount < AUDIO_DIFF_AVG_NB) {
    is->audioDiffAvgCount++;
  } else {
    double avgDiff = is->audioDiffCum * (1.0 - is->audioDiffAvgCoef);

    // Shrinking/expanding buffer code ...

  }
  return samplesSize;
}

```

一切看起来都挺顺利，我们知道了音频时钟与视频时钟或其它我们使用的时钟之间的偏移估计值。所以让我们在 “Shrinking/expanding buffer code” 下方计算需要填充或丢弃多少采样：

```c++
double avgDiff = is->audioDiffCum * (1.0 - is->audioDiffAvgCoef);

// Shrinking/expanding buffer code ...
if (std::fabs(avgDiff) >= is->audioDiffThreshold) {
  int bytesPerSample = 4 * is->audioSt->codec->channels;
  int wantedSize = samplesSize + static_cast<int>(diff * is->audioSt->codec->sample_rate * bytesPerSample);
  int minSize = samplesSize * ((100 - SAMPLE_CORRECTION_PERCENT_MAX) / 100);
  int maxSize = samplesSize * ((100 + SAMPLE_CORRECTION_PERCENT_MAX) / 100);

  wantedSize = std::max(wantedSize, minSize);
  wantedSize = std::min(wantedSize, maxSize);
}
```

记住 `audio_length * (sample_rate * # of channels * 4)` 得到的结果是 `audio_length` 秒长度的音频的字节数。因此，我们想要的采样字节数量就是已有的采样字节数量加上或减去偏移量所对应的字节数量。我也会设置一个校正后数据大小的最大值和最小值，因为如果我对音频缓冲修改太多，到时用户听起来可能会有些刺耳。

> 原文里的公式使用的 4 和前面教程的中 `SDL_AudioSpec` 音频格式是对应的。


## 校正采样数

现在我们需要去校正音频了。你可能注意到 `synchronizeAudio` 返回采样大小，返回值会告诉我们需要发送多少字节到 SDL 音频缓冲区。所以我们只需要将返回值设置为 `wantedSize` 就可以了。这在需要减少采样数据时是奏效的，但是如果需要扩充采样数据，我们不能直接将采样大小调大，因为缓冲区对应区域没有对应的音频采样数据！所以我们需要自行填充。但是填充什么内容呢？尝试预测音频是不可行的，所以我们直接使用最后一个音频采样进行填充。

```c++
if (wantedSize < samplesSize) {
  // remove samples
  samplesSize = wantedSize;
} else if (wantedSize > samplesSize) {
  // add samples by copying final samples
  int nb = wantedSize - samplesSize;
  uint8_t* samplesEnd = samples + samplesSize - bytesPerSample;
  uint8_t* q = samplesEnd + bytesPerSample;
  while (nb > 0) {
    memcpy(q, samplesEnd, bytesPerSample);
    q += bytesPerSample;
    nb -= bytesPerSample;
  }
  samplesSize = wantedSize;
}
```

然后直接返回 sampleSize，这个函数就结束了。然后要做的就是在 `audioCallback` 中使用它：

```c++
void audioCallback(void* userdata, uint8_t* stream, int len) {
  /* ... */
  while (len > 0) {
    if (is->audioBufIndex >= is->audioBufSize) {
      audioSize = audioDecodeFrame(is, is->audioBuf, sizeof(is->audioBuf), &pts);
      if (audioSize < 0) {
        is->audioBufSize = 1024;
        memset(is->audioBuf, 0, is->audioBufSize);
      } else {
        is->audioBufSize = synchronizeAudio(is, is->audioBuf, audioSize, pts);
      }
      is->audioBufIndex = 0;
    }
    /* ... */
  }
}
```

我们做的就是将 `synchronizeAudio` 调用插入。（记得检查一下源码我们在哪里初始化那些变量，我懒得定义了。）

完成之前还有最后一件事：我们需要添加个 `if` 判断，确保音频时钟是主时钟时不会进行视频同步：

```c++
if (is->avSyncType != AV_SYNC_VIDEO_MASTER) {
  // udpate delay to sync to audio
  double refClock = getMasterClock(is);
  double diff = vp->pts - refClock;

  // skip or repeat the frame. Take delay into account
  // FFplay still doesn't "know if this is the best guess."
  double syncThreshold = (delay > AV_SYNC_THRESHOLD) ? delay : AV_SYNC_THRESHOLD;
  if (std::abs(diff) < AV_NOSYNC_THRESHOLD) {
    if (diff <= -syncThreshold) {
      delay = 0;
    } else if (diff >= syncThreshold) {
      delay *= 2;
    }
  }
}
```

就是这样！记得检查源码然后初始化那些我上面懒得定义和初始化的变量。然后编译运行：

```shell
$ ./main.sh assets/ohayo_oniityan.mp4
```

源码已经上传 [GitHub](https://github.com/clsrfish/dangerffmpeg)，用餐愉快。

下一节中我们将实现快进快退。


## 参考文章

[原文链接](http://dranger.com/ffmpeg/tutorial06.html)