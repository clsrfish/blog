---
title: Distributed Locks with Redis
sticky: 0
cover: false
date: 2023-06-12 01:21:42
updated: 2023-07-12 08:46:13
categories:
tags:
  - Redis
---

## 分布式锁原则

- 安全性：任意时刻，只有一个客户端能持有锁，保证临界资源的安全访问。
- 可用性：无死锁，锁总是能够在某一时刻被释放，即使持有锁的客户端未释放锁便意外结束。
- 容错性：只要集群中大多数节点存活，客户端就能正常加锁释放锁。

## Redis-based 分布式锁

> 到 Redlock 之前都基于单实例 redis 实现。

### SETNX + EXPIRE

```python
lock_key = "xxx"
if redis.setnx(lock_key, lock_value) == 1:
  redis.expire(lock_key, 1000)
  try:
    # process
  finally:
    redis.del(lock_key)
```

`setnx` 和 `expire` 不是原子操作，如果 `setnx` 后正要 `expire` 时客户端进程 crash 或者 Redis 重启，锁将无法得到释放。

### SETNX + value=datetime

```python
lock_key = "xxx"
expiration = datetime.now() + 1000
if redis.setnx(lock_key, expiration) == 1:
  return True
else:
  current_expiration = redis.get(lock_key)
  if current_expiration < datetime.now():
    old_expiration = redis.getset(lock_key, expiration)
    return current_expiration == old_expiration

return False
```

现在获取锁操作成为了一个原子操作，但是这种方式存在以下问题：

- 各个客户端时钟必须保持同步
- 锁过期时多个客户端同时请求锁，可能出现一个客户端获取成功，但是过期时间被其它客户端覆盖

### SET EX PX NX

```python
lock_key = "xxx"
if redis.set(lock_key, lock_value, "NX", "EX", "100s") == 1:
  try:
    # do somthing
  finally:
    redis.del(lock_key)
```

这种方式问题在于，锁可能被其它客户端释放。

### SET EX PX NX + unique value

```python
lock_key = "xxx"
if redis.set(lock_key, random_lock_value, "NX", "EX", "100s") == 1:
  try:
    # do somthing
  finally:
    if redis.get(lock_key) == random_lock_value:
      redis.del(lock_key)
```

锁的释放不是原子操作，在并发环境下还是可能被其它客户端释放锁。

### Lua script

```lua
if redis.call('get', KEYS[1]) == ARGV[1] then
   return redis.call('del', KEYS[1])
else
   return 0
end;
```

通过 Lua 脚本组合多个操作，实现原子化操作。

### Extending lock

当获取锁成功后，为锁持有线程开启一个守护线程，定时检测锁并延长锁的 TTL。

到这里基本上解决了安全性和可用性。

### Redlock

以上实现方式在单实例情况下够用了，如果想实现更高的容错性，就需要引入多实例的分布式实现。

N 个独立的实例（无 replica）。

客户端按照如下步骤获取锁：

1. 获取当前时间戳（initia timestamp）。
2. 使用相同的 key 和 random value 顺序地向 N 个 Redis 实例获取锁，获取锁的超时时间比锁的生存时间小很多，比如超时时间是 5~50ms，锁生存时间是 10s。
3. 只有当成功获取到 *N/2 + 1* 个锁，并且总 elapsed time 小于锁的生存时间才认为成功获取到了锁。
4. 成功获取到锁后，锁的有效时间 = initial validity time - elapsed time。
5. 如果客户端未能成功获取到锁，它需要释放已经获取到的部分锁。

## Key takeaways

[Distributed Locks with Redis](https://redis.io/docs/manual/patterns/distributed-locks/)
