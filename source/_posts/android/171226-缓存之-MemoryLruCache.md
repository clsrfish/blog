---
title: 缓存之 MemoryLruCache
date: 2017-12-26 11:15:25
categories:
  - Android
tags:
  - LruCache
---

在开发图片加载功能时，既要保证加载速度，又要避免 OOM，特别是在类似于图库这样的场景中，如何处理好这两者关系显得尤为重要。所以最简单的想法就是一共缓存，将那些暂时 “食之无味，弃之可惜”  的对象暂时缓存起来，以备不适之需。

<!--more-->

## LruCache 简单使用
这里我们以缓存 `Bitmap` 为例：
```kotlin
val cacheSize = (Runtime.getRuntime().maxMemory() / 1024 / 8).toInt()
val cache = object : LruCache<String, Bitmap>(cacheSize) {
    override fun sizeOf(key: String?, value: Bitmap?): Int {
        return value?.byteCount ?: 0 / 1024
    }

    override fun create(key: String?): Bitmap {
        return super.create(key)
    }

    override fun entryRemoved(evicted: Boolean, key: String?, oldValue: Bitmap?, newValue: Bitmap?) {
        super.entryRemoved(evicted, key, oldValue, newValue)
    }

}
```
这里使用该进程最大可用内存的 **八分之一** 来缓存 bitmap，单位为 KB 。
然后重写用于 **计算 value 大小** 的 `sizeOf()`，如果不重写，每个 value 的大小会被记为 1。
至于 `entryRemoved()`，当有相应的 value 被移除的时候会调用，默认是个空方法。
`create()` 函数在缓存没有命中的时候会调用，可以重写该函数来返回一个缺省值。


```kotlin
val previous = cache.put("bitmap",bitmap)
val removed = cache.remove("bitmap")
```
调用 `put()` 函数，传入键值就完成了缓存的写入，如果这个 key 之前有对应的 value ，则会返回旧值，否则返回 null；移除/更新缓存就调用 `remove()` 并传入 key 就行了，如果有与 key 对应的 value，则返回 value，否则返回 null。

## 源码分析
看完了简单使用，我们接着看看它的内部是怎么实现的。

### 概览

首先看看它的成员变量和构造函数：

```java
public class LruCache<K, V> {
    private final LinkedHashMap<K, V> map;

    private int size;
    private int maxSize;

    private int putCount;
    private int createCount;
    private int evictionCount;
    private int hitCount;
    private int missCount;

    public LruCache(int maxSize) {
        this.maxSize = maxSize;
        this.map = new LinkedHashMap<K, V>(0, 0.75f, true);
    }
    //...
}
```
- size：表示已缓存的大小
- maxSize：表示最大缓存大小，这个值由构造器的参数决定，也可以通过函数更改
- putCount：放入缓存的次数
- createCount：创建缺省值的次数
- evictionCount：缓存剔除次数
- hitCount：缓存命中次数
- missCount：缓存未命中次数

这些值都可以通过函数获取，可以通过这些值的分析来确定最适合的缓存的大小。

然后我们看到构造函数里初始化了一个大小为零，负载因子为 0.75 并且按 **访问顺序** 排序的 LinkedHashMap，最后一个 true 就是实现 LruCache 的关键所在，它表示 LinkedHashMap 里面的值是以 **最后一次** 被访问/缓存的时间来排序。

<br/>

### LruCache#put()

再来看 `LruCache#put()` 函数的实现：

```java
public final V put(K key, V value) {
    V previous;
    synchronized (this) {
        putCount++;
        size += safeSizeOf(key, value);
        previous = map.put(key, value);
        if (previous != null) {
            size -= safeSizeOf(key, previous);
        }
    }

    if (previous != null) {
        entryRemoved(false, key, previous, value);
    }

    trimToSize(maxSize);
    return previous;
}
```
这里的工作非常简单，将键值放入 map ，调整相应的成员变量，如果有被替换出来的值，调用 `entryRemoved()`，最后看看是不是要移除一些“很久“没访问过的缓存。

<br/>

### LruCache#get()

接着看 `LruCache#get()` 函数的实现：

```java
public final V get(K key) {
    V mapValue;
    synchronized (this) {
        mapValue = map.get(key);
        if (mapValue != null) {
            hitCount++;
            return mapValue;
        }
        missCount++;
    }

    V createdValue = create(key);
    if (createdValue == null) {
        return null;
    }

    synchronized (this) {
        createCount++;
        mapValue = map.put(key, createdValue);

        if (mapValue != null) {
            map.put(key, mapValue);
        } else {
            size += safeSizeOf(key, createdValue);
        }
    }

    if (mapValue != null) {
        entryRemoved(false, key, createdValue, mapValue);
        return mapValue;
    } else {
        trimToSize(maxSize);
        return createdValue;
    }
}
```
首先查找 map，如果找到缓存就立马返回；如果没有相应的缓存，则尝试调用 `create(key)` 来创建一个缺省值，这里要注意的是，并发情况下， map 有可能在 `create()` 还没有返回时被其他的线程更新了，也即有可能这个 key 对应的缓存被添加到了 map。如果没有缺省值，立即返回 null，如果有，放入 map 进行缓存，然后根据返回值是否为 null 来判断 map 在此前有没有被放入 key 的缓存，如果有的话，取消缺省值的放入。最后就是返回缺省值或者缓存。

<br/>

### trimToSize()

最后，我们再来看看 `trimToSize()` 函数是怎么保证缓存大小不超过最大大小的：

```java
public void trimToSize(int maxSize) {
    while (true) {
        K key;
        V value;
        synchronized (this) {
            if (size < 0 || (map.isEmpty() && size != 0)) {
                throw new IllegalStateException(getClass().getName()
                        + ".sizeOf() is reporting inconsistent results!");
            }

            if (size <= maxSize) {
                break;
            }

            Map.Entry<K, V> toEvict = map.eldest();
            if (toEvict == null) {
                break;
            }

            key = toEvict.getKey();
            value = toEvict.getValue();
            map.remove(key);
            size -= safeSizeOf(key, value);
            evictionCount++;
        }

        entryRemoved(true, key, value, null);
    }
}
```
二话不说，先来个死循环，循环里面首先判断当前大小有没有超出最大大小，如果超出则从 map 里面移除最老的缓存，调用 `entryRemoved()` 函数，进入下一轮。

## 总结

总体上讲，并没有什么太难的地方，整体的逻辑弄清楚就差不多知道内部是怎么工作的了。