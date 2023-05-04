---
title: Redis Intset
sticky: 0
cover: false
date: 2023-05-04 00:41:15
updated: 2023-05-04 00:41:15
categories:
tags:
  - Redis
  - Intset
---

> Based on Redis 7.0.11.

## Intset 定义

```C
typedef struct intset {
    uint32_t encoding;
    uint32_t length;
    int8_t contents[];
} intset;
```

- `encoding`：整数的编码方式，实际上表示整数的取值范围（占用字节）。可选值有 `INSET_ENC_INT16`、`INSET_ENC_INT32` 和 `INSET_ENC_INT64`。
- `length`：整数个数，通过 `length` 和 `encoding` 可以计算出 `contents` 大小。
- `contents`：字节数组，每次 Add 或 Remove 都会引起 `contents` 长度变化（`realloc`）。

## 升级

升级指 `enocding` 由较少字节占用扩展到更多字节占用。升级由超过当前 `encoding` 所能表示的上下限的新元素引起，这个时候新元素要么在 `contents` 头部，要么在尾部插入。

## 降级

不支持降级。

## Key takeaways

[intset.h](https://github.com/redis/redis/blob/7.0/src/intset.h)

[《Redis 设计与实现》](http://redisbook.com)
