---
title: Redis Object
sticky: 0
cover: false
date: 2023-05-05 01:10:11
updated: 2023-05-14 08:47:07
categories:
tags:
  - Redis
  - Object
---

> Based on Redis 7.0.11.

Redis 对外支持的数据类型（String、List、Hash、Set、ZSet）并不是直接使用其定义的数据结构，而是基于另外的一套对象系统。对象系统除了可以根据不同场景选择不同底层数据结构外，还实现了基于引用计数的*对象共享*和*垃圾回收*以及*缓存淘汰*机制。

## Redis Object 定义

```C
typedef struct redisObject {
    unsigned type:4;
    unsigned encoding:4;
    unsigned lru:24;    /* LRU time (relative to global lru_clock) or
                         * LFU data (least significant 8 bits frequency
                         * and most significant 16 bits access time). */
    int refcount;
    void *ptr;
} robj;
```

- `type`：记录对象类型
  | 类型       | 取值 |
  | ---------- | ---- |
  | OBJ_STRING | 0    |
  | OBJ_LIST   | 1    |
  | OBJ_SET    | 2    |
  | OBJ_ZSET   | 3    |
  | OBJ_HASH   | 4    |
- `encoding`：记录对象的编码及底层实现
  | 编码                   | 取值 | 对应数据结构        |
  | ---------------------- | ---- | ------------------- |
  | OBJ_ENCODING_RAW       | 0    | SDS                 |
  | OBJ_ENCODING_INT       | 1    | long                |
  | OBJ_ENCODING_HT        | 2    | 字典                |
  | OBJ_ENCODING_INTSET    | 6    | 整数集合            |
  | OBJ_ENCODING_SKIPLIST  | 7    | 跳表和字典          |
  | OBJ_ENCODING_EMBSTR    | 8    | embedded 编码的 SDS |
  | OBJ_ENCODING_QUICKLIST | 9    |                     |
  | OBJ_ENCODING_STREAM    | 10   |                     |
  | OBJ_ENCODING_LISTPACK  | 11   |                     |
- `lru`：缓存淘汰策略相关
- `refcount`：引用计数
- `ptr`：底层数据指针

该结构采用了 `Bit Field` 来降低内存的占用。Redis 会根据实际情况（数据类型，数据大小）选择相对合适的 `encoding` 来提高性能与效率。

| type       | encoding               | 对象                                                                                                                                            |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| OBJ_STRING | OBJ_ENCODING_RAW       | `ptr` 指向 SDS                                                                                                                                  |
| OBJ_STRING | OBJ_ENCODING_INT       | `ptr` 值就是整数值，而非地址                                                                                                                    |
| OBJ_STRING | OBJ_ENCODING_EMBSTR    | 字符串较短时，一次分配一块内存连续存放 `redisObject` 和 `sdshdr` 对象                                                                           |
| OBJ_LIST   | OBJ_ENCODING_QUICKLIST | `ptr` 指向 `quicklist`                                                                                                                          |
| OBJ_SET    | OBJ_ENCODING_HT        | `ptr` 指向 `dict`，只使用 key，值设为 NULL                                                                                                      |
| OBJ_SET    | OBJ_ENCODING_INTSET    | `ptr` 指向 `intset`，所有元素都是整数，且数量不超过 512                                                                                         |
| OBJ_ZSET   | OBJ_ENCODING_LISTPACK  | `ptr` 指向 `listpack`，元素数量 < `server.zset_max_listpack_entries` 且元素大小 < `server.zset_max_listpack_value`                              |
| OBJ_ZSET   | OBJ_ENCODING_SKIPLIST  | `ptr` 指向 `zset{dict, skiplist}`,                                                                                                              |
| OBJ_HASH   | OBJ_ENCODING_LISTPACK  | `ptr` 指向 `listpack`，元素数量 < `server.zset_max_listpack_entries` 且元素大小 < `server.zset_max_listpack_value`。暂时不支持 HT 转成 LISTPACK |
| OBJ_HASH   | OBJ_ENCODING_HT        | `ptr` 指向 `dict`                                                                                                                               |

## 对象引用计数

Redis 通过追踪 `redisObject#refcount`，在适当的时候自动释放 `refcount == 0` 的对象。

引用计数除了用作垃圾回收外，还可用作对象共享。不过对象共享需要查找到一个具有相同值的对象，O(N<sup>2</sup>) 复杂度，CPU 开销大。

## Key takeaways

[server.h/redisObject](https://github.com/redis/redis/blob/7.0/src/server.h)

[t_string.h](https://github.com/redis/redis/blob/7.0/src/t_string.h)

[t_list.h](https://github.com/redis/redis/blob/7.0/src/t_list.h)

[t_hash.h](https://github.com/redis/redis/blob/7.0/src/t_hash.h)

[t_set.h](https://github.com/redis/redis/blob/7.0/src/t_set.h)

[t_zset.h](https://github.com/redis/redis/blob/7.0/src/t_zset.h)

[《Redis 设计与实现》](http://redisbook.com)
