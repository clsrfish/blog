---
title: 缓存之 DiskLruCache
date: 2017-12-26 11:15:05
categories:
  - Android
tags:
  - DiskLruCache

---

`DiskLruCache` 在 Glide 、 OkHttp 中都有使用，不过这些第三方库有可能根据自己的需求进行了一定的修改，不过总体上的还是一样的。[下载地址](https://developer.android.com/samples/DisplayingBitmaps/src/com.example.android.displayingbitmaps/util/DiskLruCache.html)

<!--more-->

## 特点
- 当缓存损坏的时候，它能够高效地进行处理。最明显的方法就是删除缓存，其他大多数缓存是没有这种机制的。不过一般来说，缓存损坏的情况还是比较少见的。
- 维护了一个缓存条目的内存LRU缓存，避免在每次访问缓存条目都需要查询数据库和磁盘，提高数据加载效率。
- 能够自己判断缓存是不是最新的，也就是说，每次使用 Editor 进行操作的时候都会做一个版本控制。
- 写入缓存发生错误时，可以调用 `Editor#abort()` 来放弃本次操作，并且产生的临时文件也将被删除。即使 app 在操作的时候意外停止运行，我们可以通过调用 `DiskLruCache#close()` 来删除所有的临时文件来保证缓存的状态连续性。
- 对同一份缓存的读写是线程安全的。


## 简单使用
```java
// 初始化并获取实例
DiskLruCache cache = DiskLruCache.open(directory, appVersion, valueCount, maxSize)

// 通过 key 拿到 Editor 对象
DiskLruCache.Editor editor = cache.edit(key);
// 拿到一个没有缓冲的输出流，通过它向磁盘写入需要缓存的数据
OutputStream os = editor.newOutputStream(0);
// 完成数据写入之后调用 commit() 提交
editor.commit();

// 通过 key 拿到 Snapshot 对象
DiskLruCache.Snapshot snapshot = cache.get(key);
// 拿到一个没有缓冲的 输入流，通过它读取磁盘缓存
InputStream in = snapshot.getInputStream(0);

// 不需要使用缓存的时候可以选择关闭，关闭后再不能执行读写操作
cache.close();
```
上面代码就是 DiskLruCache 提供的一些基本操作，还有另外一些 API，如：remove(key)、getDirectory() 等。至于调用这些方法所需要提供的参数的原因，再分析了其他部分之后就清楚了。

<br/>
## journal 文件
`DiskLruCache` 基于 journa 文件来进行缓存，在操作缓存的时候这个文件会有大量的读写操作。
先瞄一眼这些缓存在磁盘上的组织形式(这里以简书的缓存为例)：
```shell
...
ef41763bb5d73d8c0ed56342d192c470.1
f004340685af913064825e5e67dbbda9.0
f004340685af913064825e5e67dbbda9.1
f1e314bfd0834ddcc5decfa52d81f9f7.0
f1e314bfd0834ddcc5decfa52d81f9f7.1
fbaee0fc0b5d9aca24ab3937d55fbb28.0
fbaee0fc0b5d9aca24ab3937d55fbb28.1
journal
```
我们看到这里有很多有着 **不明觉厉的命名** 的文件和一个 **journal** 文件，再仔细看看发现有些文件只是后缀不一样，前面都一长串字符。其实这些命名很屌的文件就是缓存，可能是一张图片或者一篇文章，而 **journal** 就是一个文本文件，里面记录的就是这些缓存的信息：**状态** 、**key** 、**大小** ，打开后是这样的：
```shell
libcore.io.DiskLruCache        // 表示这是一个 DiskLruCache 的日志文件
1                              // 当前 DiskLruCache 的版本
201105                         // 应用的版本号
2                              // 一个 key 对应缓存的数量，即 valueCount
                               // 空行
CLEAN 3400330d1dfc7f3f7f4b8d4d803dfcf6 832 21054
DIRTY 335c4c6028171cfddfbaae1a9c313c52
CLEAN 335c4c6028171cfddfbaae1a9c313c52 3934 2342
REMOVE 335c4c6028171cfddfbaae1a9c313c52
DIRTY 1ab96a171faeeee38496d8b330771a7a
CLEAN 1ab96a171faeeee38496d8b330771a7a 1600 234
READ 335c4c6028171cfddfbaae1a9c313c52
READ 3400330d1dfc7f3f7f4b8d4d803dfcf6
...
```
前面的五行组成了日志文件的头信息（Headers），格式是固定的。头下面就是缓存操作记录了，我们的每一次存取都会在里面形成一条记录。当然，内部肯定会定期的做一个日志的清理以保证这个日志文件大小在可接受的范围之内。
每一行代表一个操作记录，一条记录由 state 空格 key [sizes] 组成。下面是四种操作状态的含义：
> - **DIRTY**：一条缓存条目正在创建或者更新。每一个 DIRTY 动作后面都跟着一个 CLEAN/REMOVE ，如果不是则表示需要删除临时文件。我们还能知道，每一个 key 在 journal 文件里面的 **第一条** 记录就是 DIRTY **打头** 的。
- **CLEAN**：表示一个缓存是可以读取的，这种类型的记录还会有 **缓存大小** 跟在尾部。
- **READ**：每一次对缓存的访问都会产生一条 READ 记录。
- **REMOVE**：表示 key 所对应的缓存已经被删除了。


这里可能有同学会感到疑惑：为什么不直接在每次写入缓存成功后写入 CLEAN 到 journal 文件，省去中间的步骤？
这里我们设想这样的场景：我们缓存图片缓存到一半，然后 app 突然崩溃，然后除了临时文件我们什么都没留下。如果我们使用 DIRTY ，至少能保证下次打开 app 的时候通过 DIRTY 来删除这个临时文件。


## 重要内部类
`DiskLruCache` 内部有三个重要的类，它们提供缓存的抽象、读和写。

### Entry
每一个 Entry 实例都是一条缓存记录的抽象，它包含了缓存的key、长度、状态等。下面是这个类的关键声明：
```java
private final class Entry {
    private final String key;
    private final long[] lengths;
    private boolean readable;
    private Editor currentEditor;
    private long sequenceNumber;

    public File getCleanFile(int i)；
    public File getDirtyFile(int i)；
}
```
- **key**：这个缓存的唯一身份标示
- **lengths**：初始化 DiskLruCache 时我们传入了一个 valueCount，这表示一个 key 可以又多个缓存，所以大小也用一个长整型数组表示。
- **readable**：表示改缓存可以读取。
- **currentEditor**：**NON-NULL** 表示该缓存目前正在进行一个写操作。
- **sequenceNumber**：这个和 `Snapshot` 里面的 sequenceNumber 进行配合，以此分辨 `Snapshot` 的数据是否过期。
- **getDirtyFile(index)**：获取该缓存与 index 对应的写入**成功之前**的临时文件。
- **getCleanFile(index)**：获取该缓存与 index 对应的写入**成功之后**的缓存文件。


### Snapshot
`Snapshot` 是 `DiskLruCache` 另一个非常重要的内部类，通过它可以读取缓存，下面是它的重要声明：
```java
public final class Snapshot implements Closeable {
    private final String key;
    private final long sequenceNumber;
    private final InputStream[] ins;
    public InputStream getInputStream(int index)；
}
```
- **key**：对应缓存的唯一身份标示
- **sequenceNumber**：正如在 `Entry` 中所说，这里也包含了一个 sequenceNumber。在 `Snapshot` 被实例化的时候，sequenceNumber 是直接从 `Entry` 里复制过来的。如果在此之后有人对缓存进行的了编辑或者更新操作，`Entry` 里面的 sequenceNumber 就会自增，这时两边的值就不相等了，也就意味着 `Snapshot` 里的数据过期了。
- **getInputStream(index)**：获取缓存与 index 对应的没有缓冲的输入流。


### Editor
`Editor` 是对缓存写入的一个封装，下面是它的一些重要声明：
```java
public final class Editor {
    private final Entry entry;
    private boolean hasErrors;

    public InputStream newInputStream(int index)；
    public OutputStream newOutputStream(int index)；
    public void commit()；
    public void abort()；
}
```
- **Entry**：editor 操作的对象。
- **hasError**：标示缓存写入是否发生异常。
- **newInputStream(index)**：获取与 index 对应的最近的缓存输入流。
- **newOutputStream(index)**：获取与 index 对应的缓存输出流，如果写入期间发生异常，写入将会被撤销。
- **commit()**：写入完成后进行提交。
- **abort()**：撤销本次对 Entry 的操作。

## journal 文件的管理
上面的三个内部类对 缓存条目、读、写进行了抽象，那么留给 `DiskLruCache` 的工作显然就是对日志的管理了。这里我们通过分析缓存的初始化、读写来分析日志的管理机制。

### DiskLruCache#open()
```java
public static DiskLruCache open(File directory, int appVersion,
                                int valueCount, long maxSize)throws IOException {
    DiskLruCache cache = new DiskLruCache(directory, appVersion, valueCount, maxSize);
    if (cache.journalFile.exists()) {
        try {
            cache.readJournal();
            cache.processJournal();
            cache.journalWriter = new BufferedWriter(new FileWriter(cache.journalFile, true),
                    IO_BUFFER_SIZE);
            return cache;
        } catch (IOException journalIsCorrupt) {
            cache.delete();
        }
    }

    // create a new empty cache
    directory.mkdirs();
    cache = new DiskLruCache(directory, appVersion, valueCount, maxSize);
    cache.rebuildJournal();
    return cache;
}
```
如果之前有使用过缓存，则尝试去读取。读取过程就是验证 journal 文件头信息的合法性并且逐行读取缓存条目。然后对缓存条目进行一些类似筛选的操作，这里会删除一些临时文件。这些操作过程中都有可能发生异常，异常发生就会删除所有缓存。

如果之前没有使用过缓存，就会尝试去重新建立一个缓存，这里没有对异常进行捕获，而是交给使用者处理，这表明如果重新建立缓存也失败，那么 `DiskLruCache` 将不可用。

### DiskLruCache#readJournalLine()
当 journal 文件的头信息合法之后，就是逐行读取缓存条目：
```java
private void readJournalLine(String line) throws IOException {
    String[] parts = line.split(" ");
    if (parts.length < 2) {
        throw new IOException("unexpected journal line: " + line);
    }

    String key = parts[1];
    if (parts[0].equals(REMOVE) && parts.length == 2) {
        lruEntries.remove(key);
        return;
    }

    Entry entry = lruEntries.get(key);
    if (entry == null) {
        entry = new Entry(key);
        lruEntries.put(key, entry);
    }

    if (parts[0].equals(CLEAN) && parts.length == 2 + valueCount) {
        entry.readable = true;
        entry.currentEditor = null;
        entry.setLengths(copyOfRange(parts, 2, parts.length));
    } else if (parts[0].equals(DIRTY) && parts.length == 2) {
        entry.currentEditor = new Editor(entry);
    } else if (parts[0].equals(READ) && parts.length == 2) {
        // this work was already done by calling lruEntries.get()
    } else {
        throw new IOException("unexpected journal line: " + line);
    }
}
```
很容易看到，这里主要对四种不同状态进行具体情况具体分析：
- REMOVE：表示这个 key 对应的缓存已经删除，相应的缓存条目也需要删除。
- CLEAN：表示 key 对应的缓存存在，并且可读。然后继续解析尾部的大小信息。
- DIRTY：表示 key 对应的缓存最近执行过一次写入操作，但是最后写入失败。
- READ：表示最近读取过该条缓存。

这里需要知道的是，每条缓存可能不止一条记录，所以一条缓存最终状态的是它所有操作记录的总和，不过最后一次记录会起到很关键的作用。
到这里我们就完成缓存记录的读取，不过读取出来的数据还没有经过筛选，其中还有一些坏缓存的记录，下一步操作需要剔除它们并删除与之对应的缓存文件。



### DiskLruCache#processJournal()
```java
private void processJournal() throws IOException {
    deleteIfExists(journalFileTmp);
    for (Iterator<Entry> i = lruEntries.values().iterator(); i.hasNext(); ) {
        Entry entry = i.next();
        if (entry.currentEditor == null) {
            for (int t = 0; t < valueCount; t++) {
                size += entry.lengths[t];
            }
        } else {
            entry.currentEditor = null;
            for (int t = 0; t < valueCount; t++) {
                deleteIfExists(entry.getCleanFile(t));
                deleteIfExists(entry.getDirtyFile(t));
            }
            i.remove();
        }
    }
}
```
经过上一步的筛选，这里处理的数据都是以 **DIRTY** 、 **CLEAN** 、 **READ** 开头的记录。
这里的筛选操作主要依据 `Entry.currentEditor` 是不是 **null** ，上一步中知道只有 **DIRTY** 打头的记录才满足这个条件。如果不为 null ，表明最近有失败的写入操作，需要删除临时文件和过期的缓存文件。如果不死的话，表明这是一条合法可用的缓存，读取缓存占用磁盘的空间大小。

### DiskLruCache#rebuildJournal()
如果是第一次使用的缓存，那么就会调用 `DiskLruCache#rebuildJournal` 来新建缓存。
```java
private synchronized void rebuildJournal() throws IOException {
    if (journalWriter != null) {
        journalWriter.close();
    }

    Writer writer = new BufferedWriter(new FileWriter(journalFileTmp), IO_BUFFER_SIZE);
    writer.write(MAGIC);
    writer.write("\n");
    writer.write(VERSION_1);
    writer.write("\n");
    writer.write(Integer.toString(appVersion));
    writer.write("\n");
    writer.write(Integer.toString(valueCount));
    writer.write("\n");
    writer.write("\n");

    for (Entry entry : lruEntries.values()) {
        if (entry.currentEditor != null) {
            writer.write(DIRTY + ' ' + entry.key + '\n');
        } else {
            writer.write(CLEAN + ' ' + entry.key + entry.getLengths() + '\n');
        }
    }

    writer.close();
    journalFileTmp.renameTo(journalFile);
    journalWriter = new BufferedWriter(new FileWriter(journalFile, true), IO_BUFFER_SIZE);
}
```
这个方法还是很好懂，先创建一临时的 journal 文件，然后向里面写入头信息，写入成功之后就重命名为 journal 文件。因为这个方法不止在新建journal 文件的时候调用，所以还需要将已有所有的 Entry 写入到 journal 里面，这里新建的情况下 lruEntries 是空的。

### DiskLruCache#edit()
调用 `DiskLruCache#edit(key)` 最终会调用 `DiskLruCache#edit(key,expectedSequenceNumber)` ，这里第二个参数可能会给大家另一个惊喜：
```java
public Editor edit(String key) throws IOException {
    return edit(key, ANY_SEQUENCE_NUMBER);
}

private synchronized Editor edit(String key,
                                long expectedSequenceNumber) throws IOException {
    Entry entry = lruEntries.get(key);
    if (expectedSequenceNumber != ANY_SEQUENCE_NUMBER
            && (entry == null || entry.sequenceNumber != expectedSequenceNumber)) {
        return null; // snapshot is stale
    }
    if (entry == null) {
        entry = new Entry(key);
        lruEntries.put(key, entry);
    } else if (entry.currentEditor != null) {
        return null; // another edit is in progress
    }

    Editor editor = new Editor(entry);
    entry.currentEditor = editor;

    // flush the journal before creating files to prevent file leaks
    journalWriter.write(DIRTY + ' ' + key + '\n');
    journalWriter.flush();
    return editor;
}
```
通过调用 `DiskLruCache#edit(key)` ，那么 `expectedSequenceNumber` == ANY_SEQUENCE_NUMBER 是恒成立的，所以第一个条件语句我们直接跳过。接下来的操作就是，如果不存在与 key 多对应的缓存，则新建一个 Entry；如果存在就判断 Entry 的 Editor 是不是为空，不为空表示有另一个线程正在进行写操作。判断操作合法性之后就给这个 Entry 分配一个 Editor，同时向 journal 文件里面写入一条 **DIRTY** 记录。


### DiskLruCache#completeEdit()
在使用 Editor 完成操作后，需要调用 `Editor#abort()` 或 `Editor#commit()` 最终向 `DiskLruCache` 提交，这两个方法最终都会调用 `DiskLruCache#completeEdit()` 方法：
```java
private synchronized void completeEdit(Editor editor, boolean success) throws IOException {
    Entry entry = editor.entry;
    if (entry.currentEditor != editor) {// 安全性检查
        throw new IllegalStateException();
    }

    // if this edit is creating the entry for the first time, every index must have a value
    if (success && !entry.readable) {
        for (int i = 0; i < valueCount; i++) {
            if (!entry.getDirtyFile(i).exists()) {
                editor.abort();
                throw new IllegalStateException("edit didn't create file " + i);
            }
        }
    }

    for (int i = 0; i < valueCount; i++) {// 将写入成功的临时文件重命名为正式的缓存文件
        File dirty = entry.getDirtyFile(i);
        if (success) {
            if (dirty.exists()) {
                File clean = entry.getCleanFile(i);
                dirty.renameTo(clean);
                long oldLength = entry.lengths[i];
                long newLength = clean.length();
                entry.lengths[i] = newLength;
                size = size - oldLength + newLength;
            }
        } else {
            deleteIfExists(dirty);
        }
    }

    redundantOpCount++;    // 多余的操作数量+1，用来判断是否需要重建 journal 文件用的
    entry.currentEditor = null;
    if (entry.readable | success) {
        entry.readable = true;
        journalWriter.write(CLEAN + ' ' + entry.key + entry.getLengths() + '\n');
        if (success) {
            entry.sequenceNumber = nextSequenceNumber++;    // 如果在此之前有获取过该 Entry 的 Snapshot ，这一步操作将使 Snapshot 过期
        }
    } else {    // 写入 REMOVE 记录，便于下次移除临时文件
        lruEntries.remove(entry.key);
        journalWriter.write(REMOVE + ' ' + entry.key + '\n');
    }

    if (size > maxSize || journalRebuildRequired()) {    // journal 文件清理
        executorService.submit(cleanupCallable);
    }
}
```
因为这个方法比较长，自己看代码的效果应该会好一点，里面的注释基本上也讲清楚了大概的操作。唯一要注意的就是，`Entry.readable` 这个成员变量，初始值为 `false` ，只有当完成一次读取或者成功的写入操作的时候才会被置为 `true` 。


### DiskLruCache#get()
写入缓存就是为了读取，下面看看 `DiskLruCache` 是怎么构建一个缓存快照 `Snapshot` 的：
```java
public synchronized Snapshot get(String key) throws IOException {
    Entry entry = lruEntries.get(key);
    if (entry == null) return null;
    if (!entry.readable) return null;

    /*
     * Open all streams eagerly to guarantee that we see a single published
     * snapshot. If we opened streams lazily then the streams could come
     * from different edits.
     */
    InputStream[] ins = new InputStream[valueCount];
    try {
        for (int i = 0; i < valueCount; i++) {
            ins[i] = new FileInputStream(entry.getCleanFile(i));
        }
    } catch (FileNotFoundException e) {
        // a file must have been deleted manually!
        return null;
    }

    redundantOpCount++;
    journalWriter.append(READ + ' ' + key + '\n');
    if (journalRebuildRequired()) {
        executorService.submit(cleanupCallable);
    }

    return new Snapshot(key, entry.sequenceNumber, ins);
}
```
这个方法也很简单，大概情况就是，拿到 key 所对应的缓存，然后打开所有的文件输入流，将操作记录写入 journal 文件，最后再判断是否需要重建 journal 文件。至于那个一大段文本注释中的解释，我也不是很清楚，大概就是说如果不马上打开的话，之后打开获取的缓存可能是被更新过的。然后我们又看到了 sequenceNumber ，就是直接从 Entry 里面复制过来的，所以可以根据两边的值来判断 Snapshot 过期与否。

### DIskLruCache#remove()

```java
public synchronized boolean remove(String key) throws IOException {
    Entry entry = lruEntries.get(key);
    if (entry == null || entry.currentEditor != null) {
        return false;
    }

    for (int i = 0; i < valueCount; i++) {
        File file = entry.getCleanFile(i);
        if (!file.delete()) {
            throw new IOException("failed to delete " + file);
        }
        size -= entry.lengths[i];
        entry.lengths[i] = 0;
    }

    redundantOpCount++;
    journalWriter.append(REMOVE + ' ' + key + '\n');
    lruEntries.remove(key);

    if (journalRebuildRequired()) {
        executorService.submit(cleanupCallable);
    }

    return true;
}
```

确保存在对应的缓存之后，判断是否有另一个操作正在进行，没有就会继续执行。然后就是删除缓存文件，写入操作记录，将 `Entry` 从 `lruEntries` 中移除，最后再判断是否需要对 journal 文件进行重建。

### LRU 算法的实现
最重要的 **LRU** 算法肯定要放在最后，看过 `DiskLruCache` 源码的同学可能会发现并没有找到有关 LRU 实现的一点蛛丝马迹。所见即所得，`DiskLruCache` 并没有自己去实现 LRU 算法，因为 LinkedHashMap 自带 LRU 属性。因为所有的 Entry 都存放在一个 LinkedHashMap 里，并且初始化的时候调用了 LinkedHashMap 三个参数的构造器：
```java
private final LinkedHashMap<String, Entry> lruEntries = new LinkedHashMap<>(0, 0.75f, true);
```
第三个参数的官方解释是：accessOrder - the ordering mode - true for access-order, false for insertion-order。这里是设为的 true ，所以表示是按照访问的时间来进行排序的，即 LRU 。如果还想知道 LRU 的具体实现，可以参考 LinkedHashMap 源码。

---
到这里，关键的源码基本就全部分析了一遍，一些细枝末节的东西一眼就能看懂。刚开始看的时候没有注意 **理清结构** 和 **类间关系** ，阅读进度很慢，后来从别人博客学到的方法才能顺利的阅读。

## 参考
[A deep dive into Jake Wharton’s DiskLruCache](https://blog.mindorks.com/this-post-is-about-the-implementation-details-of-jake-whartons-famous-disklrucache-9a87d90206fe)