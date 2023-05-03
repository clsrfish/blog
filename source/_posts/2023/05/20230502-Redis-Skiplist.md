---
title: Redis Skiplist
sticky: 0
cover: false
date: 2023-05-02 13:32:07
updated: 2023-05-02 13:32:07
categories:
tags:
  - Redis
  - Skiplist
---

> Based on Redis 7.0.11.

## Skiplist 定义

```C
typedef struct zskiplistNode {
    sds ele;
    double score;
    struct zskiplistNode *backward;
    struct zskiplistLevel {
        struct zskiplistNode *forward;
        unsigned long span;
    } level[];
} zskiplistNode;

typedef struct zskiplist {
    struct zskiplistNode *header, *tail;
    unsigned long length;
    int level;
} zskiplist;
```

- `zskiplistNode.score`：节点的权重，它决定了节点在列表中的位置（从小到大）；分值相同的节点则按照 `ele` 的字典顺序排序。
- `zskiplistNode.level`：level 数组包含指向后续节点的指针，`nodes[a].level[N]` 指向 `nodes[b].level[N]` 或 NULL， 其中 `a < b`。**新节点会随机创建一个介于 `[1, 32]` 大小的 level 数组**。
- `zskiplistNode.zskiplistLevel.span`：步长或跨度，`nodes[a].level[N]` 指向 `nodes[b].level[N]` 跨越的节点数（包含结尾）。

示意图：

```plaintext
+--+
|L32 --0-> NULL
+--+
....
+--+                             +--+
|L5| -------------3------------> |L5| --0-> NULL
+--+       +--+                  +--+
|L4| --1-> |L4| -------2-------> |L4| --0-> NULL
+--+       +--+                  +--+
|L3| --1-> |L3| -------2-------> |L3| --0-> NULL
+--+       +--+       +--+       +--+
|L2| --1-> |L2| --1-> |L2| --1-> |L2| --0-> NULL
+--+       +--+       +--+       +--+
|L1| --1-> |L1| --1-> |L1| --1-> |L1| --0-> NULL
+--+       +--+       +--+       +--+
      +--- |BW| <---- |BW| <---- |BW|
      |    +--+       +--+       +--+
    NULL   |1.|       |2.|       |3.|
           +--+       +--+       +--+
           |o1|       |o2|       |o3|
           +--+       +--+       +--+
head                             tail
```

> 换个角度，跳表非常像某一链接及其子序列链表的加总。

## 搜索节点

从 `head` 最高层开始，往下逐层缩小查找范围，有点类似二分查找。

## 插入新节点

1. 找到新节点将要插入的位置。
2. 找到新节点在每层链表中的前驱节点，即往前距新节点最近的 `level[N]`。例如 `o2.L1`、`o2.L2` 和 `o1.L4`。
3. 修改前驱节点的 `level[L].forward` 及 `span`。
4. 对于位于新节点之前且 `nodes[N].level[L] && L > new.level.length` 的节点，`span++`。例如 `o1.L4` 和 `head.L5`。
5. 更新 `backward` 指针。例如 `o3.BW`。

```plaintext
+--+
|L32 --0-> NULL
+--+
....
+--+                                        +--+
{L5} ------------------4------------------> |L5| --0-> NULL
+--+       +--+                             +--+
|L4| --1-> {L4} -------------3------------> |L4| --0-> NULL
+--+       +--+                  +--+       +--+
|L3| --1-> {L3} -------2-------> |L3| --1-> |L3| --0-> NULL
+--+       +--+       +--+       +--+       +--+
|L2| --1-> |L2| --1-> {L2} --1-> |L2| --1-> |L2| --0-> NULL
+--+       +--+       +--+       +--+       +--+
|L1| --1-> |L1| --1-> {L1} --1-> |L1| --1-> |L1| --0-> NULL
+--+       +--+       +--+       +--+       +--+
      +--- |BW| <---- |BW| <---- |BW| <---- {BW}
      |    +--+       +--+       +--+       +--+
    NULL   |1.|       |2.|       |2.|       |3.|
           +--+       +--+       +--+       +--+
           |o1|       |o2|       |on|       |o3|
           +--+       +--+       +--+       +--+
head                             new        tail
```

## Key takeaways

[server.h/zskiplist](https://github.com/redis/redis/blob/7.0/src/server.h)

[《Redis 设计与实现》](http://redisbook.com)
