---
title: Redis Persistence
sticky: 0
cover: false
date: 2023-05-15 23:20:25
updated: 2023-05-15 23:20:25
categories:
tags:
  - Redis
  - RDB
  - AOF
---

> Based on Redis 7.0.11.

Redis 提供了四种持久化的方式：

- No persistence：不做持久化处理，用得较少。
- RDB：对缓存做全量 point-in-time 快照，生成的 *.rdb 文件非常紧凑，加载性能高，非 human readable。
- AOF：对每个 write operation 进行记录，通过 replay 重新生成当前缓存状态，记录按照 RESP 格式存储，human readable。
- RDB + AOF：结合 RDB 与 AOF。

## RDB

### 命令&配置

`SAVE` 在当前进程生成快照，会阻塞服务；`BGSAVE` 在子进程中生成快照，不会阻塞服务。

除手动执行 `SAVE` 和 `BGSAVE`，Redis 允许配置 `BGSAVE` 自动执行的条件：

```conf
save M N # At lease N changes in the last M seconds
save ...
```

满足多个条件中任意一条即可自动执行 `BGSAVE`。

### BGSAVE 执行过程

1. Fork 子进程
2. 子进程将数据写入临时 RDB 文件
3. 子进程将临时 RDB 文件重命名替换当前 RDB 文件
4. 子进程退出
5. 父进程处理子进程 exitcode

```python
if server.child_type == CHILD_TYPE_RDB:
  # err: RDB already in progress 
  return

if server.has_active_transaction:
  # schedule RDB
  return

if hasActiveChildProcess:
  if [SCHEDULE] :
    # schedule RDB
  else:
    # err: refuse, maybe AOF
  return

if fork() == 0:
  rdbSave()
```

### Pros

- RDB 文件紧凑
- RDB 文件可以传输到其它机器上恢复
- 高性能，子进程 fork 出来后父进程照常处理请求，不会 disk I/O

### Cons

- RDB 是整个数据库的快照，这决定了其无法做到非常高频地备份出快照。在 Redis 意外退出时，至少丢失数分钟的数据。
- 当数据库很大时，fork 子进程也将会比较耗时
- 执行快照过程中，如果父进程接收大量写请求，将导致大量的内存页拷贝。

## AOF(Append-only file)

```conf
appendonly yes
appendfsync always # 每次 AOF 写就同步
appendfsync everysec # 每秒同步一次
appendfsync no # 由 OS 决定同步时机
```

开启 AOF 后，Redis 每收到一条写命令就会将该命令写入 AOF，Redis 重启时就可以重放 AOF 文件恢复数据。当 AOF 增长到一定大小时就需要进行重写，减小文件大小。

### rewrite 过程

`BGREWRITEAOF`。

1. flush `aof_buf`，调用 `fsync`
2. 创建新的 incremental AOF 文件记录后续写命令
3. Fork 子进程
4. 子进程将当前数据库以 AOF 格式写入 temp BASE file
5. 父进程 rename(temp BASE file, BASE file) 并与 incremental AOF 构建一个新的 manifest 文件

### Pros

- 相比 RDB 有更优 durability，可做到秒级的数据备份
- AOF 使用 RESP 协议记录，易于直接阅读

### Cons

- AOF 文件通常比 RDB 文件大
- `appendfsync everysec` 对性能有轻微影响，实际并不明显

## RDB + AOF

> Redis 5 中默认开启

RDB + AOF 结合了 RDB 和 AOF 的优点，此时整体格式变为：[RDB] + [AOF]，在 AOF 重写子进程中，不再是以 RESP 协议导出数据库到 BASE file，而是 RDB，即 BASE AOF file 中保存了 RDB 格式的数据。

## Key takeaways

[Redis persistence](https://redis.io/docs/management/persistence/)
