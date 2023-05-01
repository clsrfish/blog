---
title: Redis doubly linked list
sticky: 0
cover: false
date: 2023-05-01 13:24:43
updated: 2023-05-01 13:24:43
categories:
tags:
  - Redis
  - doubly linked list
---

> Based on Redis 7.0.11.

## Doubly linked list 定义

```C
typedef struct listNode {
    struct listNode *prev;
    struct listNode *next;
    void *value;
} listNode;

typedef struct list {
    listNode *head;
    listNode *tail;
    void *(*dup)(void *ptr);
    void (*free)(void *ptr);
    int (*match)(void *ptr, void *key);
    unsigned long len;
} list;
```

- `value`: 链表节点使用 `void *` 保存值，结合 `dup`、`free` 和 `match` 实现了对多态支持。
- `dup`: 拷贝 `value` 用，如果没有设置则默认浅拷贝。
- `free`: 回收 `value` 用，如果没有设置就不对 `value` 进行额外回收处理。
- `match`: 比较 `value` 和 `key` 是否相等，未设置则直接比较指针。

`list` 只提供双端链表的功能，具体节点值及对应的行为完全由使用方负责。

## Key takeaways

[sds.h](https://github.com/redis/redis/blob/7.0/src/adlist.h)

[《Redis 设计与实现》](http://redisbook.com)
