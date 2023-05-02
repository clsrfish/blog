---
title: Redis Hash Tables
sticky: 0
cover: false
date: 2023-05-02 07:37:15
updated: 2023-05-02 07:37:15
categories:
tags:   
  - Redis
  - Hash Tables
---

> Based on Redis 7.0.11.

## Hash table 定义

```C
typedef struct dictEntry {
    void *key;
    union {
        void *val;
        uint64_t u64;
        int64_t s64;
        double d;
    } v;
    struct dictEntry *next;     /* Next entry in the same hash bucket. */
    void *metadata[];           /* An arbitrary number of bytes (starting at a
                                 * pointer-aligned address) of size as returned
                                 * by dictType's dictEntryMetadataBytes(). */
} dictEntry;

typedef struct dictType {
    uint64_t (*hashFunction)(const void *key);
    void *(*keyDup)(dict *d, const void *key);
    void *(*valDup)(dict *d, const void *obj);
    int (*keyCompare)(dict *d, const void *key1, const void *key2);
    void (*keyDestructor)(dict *d, void *key);
    void (*valDestructor)(dict *d, void *obj);
    int (*expandAllowed)(size_t moreMem, double usedRatio);
    /* Allow a dictEntry to carry extra caller-defined metadata.  The
     * extra memory is initialized to 0 when a dictEntry is allocated. */
    size_t (*dictEntryMetadataBytes)(dict *d);
} dictType;

struct dict {
    dictType *type;

    dictEntry **ht_table[2];
    unsigned long ht_used[2];

    long rehashidx; /* rehashing not in progress if rehashidx == -1 */

    /* Keep small vars at end for optimal (minimal) struct padding */
    int16_t pauserehash; /* If >0 rehashing is paused (<0 indicates coding error) */
    signed char ht_size_exp[2]; /* exponent of size. (size = 1<<exp) */
};
```

- `dictEntry.v`：使用 union 以支持更多具体类型，又共享 8 bytes空间。
- `dictEntry.metadata`：供使用方存放一些自定义数据，柔性数组，不使用时不额外占用空间。
- `dictType`：dict 多态能力，其中 `expandAllowed` 将是否扩容的控制权交给了使用方。
- `dict.ht_table`：一般只有 `ht_table[0]` 在使用，`ht_table[1]` 只在扩容时被启用。
- `dict.ht_used`：对应 `dict.ht_table` 存放的节点数。
- `dict.rehashidx`：渐进式 rehash 使用。
- `dict.pauserehash`：暂停 rehash，一般在开始遍历前设置，整数值表示有多少个暂停请求。
- `dict.ht_size_exp`：`dict.ht_table[N]` 的大小用 `2^dict.ht_size_exp[N]` 表示。

## 扩容与收缩

`load factor = ht_used[N] / 2^dict.ht_size_exp[N]`。

### 扩容

扩容条件：`load factor >= 1`

扩容大小：`dict.ht_size_exp[N] = X`, 其中 X 满足: `min(2^X) >= 2 * dict.ht_used[N]`。

**Note**: 在有子进程执行 `BGSAVE` 或者 `BGREWRITEAOF` 时，因为父子进程通过 **COW** 共享内存，为了避免内存写操作带来内存拷贝，扩容条件变为 `load factor >= 5`。

## 收缩

收缩条件：`load factor < 0.1`

```C
// server.c
int htNeedsResize(dict *dict) {
    long long size, used;

    size = dictSlots(dict);
    used = dictSize(dict);
    return (size > DICT_HT_INITIAL_SIZE &&
            (used*100/size < HASHTABLE_MIN_FILL));
}
```

收缩大小：`dict.ht_size_exp[N] = X`, 其中 X 满足: `min(2^X) > dict.ht_used[N]`。

**Note**：与扩容类似，只有在没有子进程时，收缩操作才能进行。

---

不管是扩容还是收缩，`dict` 都会进入 rehash 状态，rehash 结束后 `ht_table[0]` 被替换成 `ht_table[1]`。

## 渐进式 rehash

为了降低扩容或收缩对性能带来的影响，`ht_table[0]` 中节点会分多次 rehash 到 `ht_table[1]` 中。

在 rehash CURD：

| 操作   | 步骤                                                    |
| ------ | ------------------------------------------------------- |
| Add    | 直接写入 `ht_table[1]`。                                |
| Find   | 依次查找 `ht_table[0]` 和 `ht_table[1]`。               |
| Delete | 依次从 `ht_table[0]` 和 `ht_table[1]` 中删除。          |
| Update | 依次查找 `ht_table[0]` 和 `ht_table[1]`，然后更新 `v`。 |

## Key takeaways

[dict.h](https://github.com/redis/redis/blob/7.0/src/dict.h)

[《Redis 设计与实现》](http://redisbook.com)
