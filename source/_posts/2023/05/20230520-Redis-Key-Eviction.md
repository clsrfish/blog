---
title: Redis Key eviction（缓存淘汰）
sticky: 0
cover: false
date: 2023-05-20 15:15:23
updated: 2023-05-23 15:42:49
categories:
tags:
  - Redis
  - Eviction
---

> Based on Redis 7.0.11.

## maxmemory 配置

```conf
maxmemory 100mb
```

64 bit 系统下默认行为没有内存上限，32 bit 系统则默认是 3GB。虽然 64 bit 系统能够提供近乎无穷大的地址空间，但是物理内存是有限的，如果 Redis 占用内存超过物理内存上限，访问键时可能导致频繁的缺页异常，吞吐量降低。

设置上限后的另一个问题：满了怎么办？

| maxmemory-policy | description                        |
| ---------------- | ---------------------------------- |
| noeviction       | 内存达到上限时，拒绝添加新键       |
| allkeys-lru      | 在键空间中根据 LRU 算法淘汰键      |
| allkeys-lfu      | 在键空间中根据 LFU 算法淘汰键      |
| volatile-lru     | 在 `expires` 中根据 LRU 算法淘汰键 |
| volatile-lfu     | 在 `expires` 中根据 LFU 算法淘汰键 |
| allkeys-random   | 在键空间中随机选择键淘汰           |
| volatile-random  | 在 `expires` 中随机选择键淘汰      |
| volatile-ttl     | 淘汰 `expires` 中 ttl 最小的键     |

经验法则（a rule of thumb）：

- `*-lru` 或 `*-lfu` 适用于键的访问频次符合幂律分布（power-law）分布的情况。
- `*-random` 适用于键拥有相同的被访问概率。
- `volatile-ttl` 适用于客户端想根据实际情况灵活调整建议 Redis 淘汰键，即自行配置过期时间。

## 典型 LRU / LFU 实现

### LRU

```plaintext
Latest                                              Oldest
+-----+      +-----+      +-----+      +-----+      +-----+
|  A  | ---> |  B  | ---> |  C  | ---> |  D  | ---> |  E  |
+-----+      +-----+      +-----+      +-----+      +-----+

# D accessed
Latest                                              Oldest
+-----+      +-----+      +-----+      +-----+      +-----+
|  D  | ---> |  A  | ---> |  B  | ---> |  C  | ---> |  E  |
+-----+      +-----+      +-----+      +-----+      +-----+
```

按照访问时间由近至远排序，处在队尾的即最长时间未被访问的数据，优先被淘汰。

时间开销：O(1)
空间开销：O(N)

### LFU

LRU 在淘汰缓存时只考虑了最近 1 访问，不能很好区分热点与非热点数据。

```plaintext
+-----+      +-----+      +-----+      +-----+      +-----+
|  1  | ---> |  2  | ---> |  3  | ---> |  4  | ---> |  5  |
+-----+      +-----+      +-----+      +-----+      +-----+
   |            |            |            |            |
+-----+      +-----+      +-----+      +-----+      +-----+
|     |      |     |      |     |      |     |      |     |
+-----+      +-----+      +-----+      +-----+      +-----+
   |            |                         |            |
+-----+      +-----+                   +-----+      +-----+
|     |      |     |                   |     |      |     |
+-----+      +-----+                   +-----+      +-----+
                |                                      |
             +-----+                                +-----+
             |     |                                |     |
             +-----+                                +-----+
```

按照最近一短时间访问频次排序，频次相同的再按照访问时间由近至远排序。

时间开销：O(N)
空间开销：O(N)

> 不同的实现方式可以带来不同的时空复杂度组合，这里只是为了说明相比比 LRU，LFU 解决的问题和实现方式都更复杂。

## Redis 实现

不论是 LRU 还是 LFU，都需要一个额外的结构记录键的访问信息，但是 Redis 通过近似实现规避了额外的记录，同时还保证了不错的效果。

LRU 和 LFU 简化后本质都是基于某种规则排序，然后淘汰对应的数据。同时 LRU 和 LFU 也是理想化的模型，并不能完全匹配现实情况，所以有可能使用一个接近 LRU/LFU，但是开销更小的方式做到相同的效果。事实上 Redis 变通的方式很简单————采样，默认配置 `maxmemory-samples 5` 就能达到很好的效果，具体可以参考 [Eviction][1]。

### redisObject

```C
typedef struct redisObject {
   ...
   unsigned lru:LRU_BITS; /* LRU time (relative to global lru_clock) or
                           * LFU data (least significant 8 bits frequency
                           * and most significant 16 bits access time). */
} robj;
```

> 把 [Redis Object](./20230505-Redis-Object.md) 的坑填上。

每次访问键前都会调用 `lookupKey`，里面会更新 `redisObject.lru`。

```C
robj *lookupKey(redisDb *db, robj *key, int flags) {
   ...
   if (server.maxmemory_policy & MAXMEMORY_FLAG_LFU) {
         updateLFU(val);
   } else {
         val->lru = LRU_CLOCK();
   }
   ...
}
```

#### LRU_CLOCK 实现

```C
#define LRU_CLOCK_MAX ((1<<LRU_BITS)-1)
#define LRU_CLOCK_RESOLUTION 1000

/* Return the LRU clock, based on the clock resolution. This is a time
 * in a reduced-bits format that can be used to set and check the
 * object->lru field of redisObject structures. */
unsigned int getLRUClock(void) {
    return (mstime()/LRU_CLOCK_RESOLUTION) & LRU_CLOCK_MAX;
}

/* This function is used to obtain the current LRU clock.
 * If the current resolution is lower than the frequency we refresh the
 * LRU clock (as it should be in production servers) we return the
 * precomputed value, otherwise we need to resort to a system call. */
unsigned int LRU_CLOCK(void) {
    unsigned int lruclock;
    if (1000/server.hz <= LRU_CLOCK_RESOLUTION) {
        atomicGet(server.lruclock,lruclock);
    } else {
        lruclock = getLRUClock();
    }
    return lruclock;
}
```

为了减少系统调用，`lruclock` 会使用缓存好的 `server.lruclock`，最终都是调用 `getLRUClock`。`lruclock` 的单位是秒，最大可记录 `2^24-1` 秒 ~= 194 天。

#### updateLFU 实现

```C
// redis.conf
// # lfu-log-factor 10
// # lfu-decay-time 1

/* If the object decrement time is reached decrement the LFU counter but
 * do not update LFU fields of the object, we update the access time
 * and counter in an explicit way when the object is really accessed.
 * And we will times halve the counter according to the times of
 * elapsed time than server.lfu_decay_time.
 * Return the object frequency counter.
 *
 * This function is used in order to scan the dataset for the best object
 * to fit: as we check for the candidate, we incrementally decrement the
 * counter of the scanned objects if needed. */
unsigned long LFUDecrAndReturn(robj *o) {
    unsigned long ldt = o->lru >> 8;
    unsigned long counter = o->lru & 255;
    unsigned long num_periods = server.lfu_decay_time ? LFUTimeElapsed(ldt) / server.lfu_decay_time : 0;
    if (num_periods)
        counter = (num_periods > counter) ? 0 : counter - num_periods;
    return counter;
}

/* Logarithmically increment a counter. The greater is the current counter value
 * the less likely is that it gets really incremented. Saturate it at 255. */
uint8_t LFULogIncr(uint8_t counter) {
    if (counter == 255) return 255;
    double r = (double)rand()/RAND_MAX;
    double baseval = counter - LFU_INIT_VAL;
    if (baseval < 0) baseval = 0;
    double p = 1.0/(baseval*server.lfu_log_factor+1);
    if (r < p) counter++;
    return counter;
}

/* Return the current time in minutes, just taking the least significant
 * 16 bits. The returned time is suitable to be stored as LDT (last decrement
 * time) for the LFU implementation. */
unsigned long LFUGetTimeInMinutes(void) {
    return (server.unixtime/60) & 65535;
}

/* Update LFU when an object is accessed.
 * Firstly, decrement the counter if the decrement time is reached.
 * Then logarithmically increment the counter, and update the access time. */
void updateLFU(robj *val) {
    unsigned long counter = LFUDecrAndReturn(val);
    counter = LFULogIncr(counter);
    val->lru = (LFUGetTimeInMinutes()<<8) | counter;
}
```

`updateLFU` 做了三件事：

1. 根据最近一次访问时间及旧 `counter` 计算当前 `counter`。
2. 根据当前 `counter` 计算其自增的概率，`((counter - 5) * lfu_log_factor + 1)`<sup>-1</sup>，得到新 `counter`。
3. 将当前时间（最新访问时间）和 `counter` 写入 `redisObject.lru`。

LFU 的访问时间以分钟为单位，最大可记录 `2^16-1` 分钟 ~= 45 天。每 `lfu_decay_time` 分钟 `counter` 减 1，随着访问频率增加，`counter` 自增概率下降，不同 `lfu_log_factor` 下不同 `counter` 值所需要的访问次数（连续访问间隔小于一分钟）：

```plaintext
+--------+------------+------------+------------+------------+------------+
| factor | 100 hits   | 1000 hits  | 100K hits  | 1M hits    | 10M hits   |
+--------+------------+------------+------------+------------+------------+
| 0      | 104        | 255        | 255        | 255        | 255        |
+--------+------------+------------+------------+------------+------------+
| 1      | 18         | 49         | 255        | 255        | 255        |
+--------+------------+------------+------------+------------+------------+
| 10     | 10         | 18         | 142        | 255        | 255        |
+--------+------------+------------+------------+------------+------------+
| 100    | 8          | 11         | 49         | 143        | 255        |
+--------+------------+------------+------------+------------+------------+
```

### Eviction 流程

```C
int performEvictions(void) {
    ...
    while (mem_freed < mem_tofree) {
        if (MAXMEMORY_FLAG_LRU || MAXMEMORY_FLAG_LFU || MAXMEMORY_VOLATILE_TTL){
            struct evictionPoolEntry *pool = EvictionPoolLRU;
            for (i = 0; i < server.dbnum; i++) {
                evictionPoolPopulate(i, db->dict /*or db->expires */, db->dict, pool);
            }
            bestkey = /*last one in pool*/;
        } else if (MAXMEMORY_ALLKEYS_RANDOM || MAXMEMORY_VOLATILE_RANDOM) {
            bestkey = dictGetRandomKey(dict)
        }
        ...
        if (server.lazyfree_lazy_eviction)
            dbAsyncDelete(db,keyobj);
        else
            dbSyncDelete(db,keyobj);
    }
}
```

根据 `maxmemory_policy` 使用不同策略从目标键空间找到需要淘汰的键，再根据 `lazyfree_lazy_eviction` 决定立即释放还是异步释放缓存。重点关注 `evictionPoolPopulate`，通过扫描所有 db 填满 `pool`，为了降低对正常请求的影响，对`pool` 中键的回收也是点到即止（`mem_freed < mem_tofree`）。

#### evictionPoolPopulate

```C
void evictionPoolPopulate(int dbid, dict *sampledict, dict *keydict, struct evictionPoolEntry *pool) {
    count = dictGetSomeKeys(sampledict,samples,server.maxmemory_samples);
    for (j = 0; j < count; j++) {
        if (MAXMEMORY_FLAG_LRU) {
            idle = estimateObjectIdleTime(o);
        } else if (MAXMEMORY_FLAG_LFU) {
            idle = 255-LFUDecrAndReturn(o);
        } else if (MAXMEMORY_VOLATILE_TTL) {
            idle = ULLONG_MAX - expire_at;
        }

        k = 0;
        while (k < EVPOOL_SIZE &&
               pool[k].key &&
               pool[k].idle < idle) k++;
        if (k == 0 && pool[EVPOOL_SIZE-1].key != NULL) {
            // idle < min(pool[N].idle)
            continue;
        }
        ...
    }
}
```

`dictGetSomeKeys` 会随机挑选最多 `maxmemory_samples(5)` 个键，但是不保证重复。然后根据不同的 `maxmemory_policy` 计算出 `idle`，从小到大填入 `pool`。当 `pool` 已经填充满时，只有比 `pool[0].idle` 大的键才能进入 `pool`，这种策略进一步提高了内存淘汰的效果。

#### 释放缓存

同步释放和异步释放最终都会调用 `dbGenericDelete`：

```C
static int dbGenericDelete(redisDb *db, robj *key, int async) {
    dictDelete(db->expires,key->ptr);
    dictEntry *de = dictUnlink(db->dict,key->ptr);
    if (async) {
        freeObjAsync(key, val, db->id);
        // dictFreeUnlinkedEntry 不会一起释放 val
        dictSetVal(db->dict, de, NULL);
    }
    dictFreeUnlinkedEntry(db->dict,de);
}
```

`freeObjAsync` 会直接释放小对象，效果和同步释放一样；如果是大对象则提交异步任务。

## Key takeaways

[Eviction][1]

[1]: <https://redis.io/docs/reference/eviction/> "Eviction"
