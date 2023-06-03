---
title: I/O Multiplexing
sticky: 0
cover: false
date: 2023-06-03 02:38:21
updated: 2023-06-03 02:38:21
categories:
tags:
  - I/O
---

## Select

`select` 允许程序同时监听多个文件描述符，直到一个或多个文件描述符变为**ready**状态（可读、可写、异常），最多支持同时监听 `FD_SETSIZE(default 1024 on Linux)` 个文件描述符。当 `select` 返回时，传入的三个 `fd_set` 将被（in-place）修改，用于标识那些**ready**的文件描述符，也就是说，每次调用 `select` 都需要重新初始化 `fd_set` 并拷贝至 Kernel space，当监听文件描述符数量多时，拷贝开销也是相当可观的。`FD_SETSIZE` 的限制是由于文件描述符在 `fd_set` 中以数组形式保存。

### select 使用示例

```C
#include <stdio.h>
#include <stdlib.h>
#include <sys/select.h>

int main(void) {
  // initialize fd_set
  fd_set rfds;
  FD_ZERO(&rfds);
  FD_SET(0, &rfds); // stdin
  // timeout
  struct timeval tv;
  tv.tv_sec = 5;
  tv.tv_usec = 0;

  int nfds = 1;
  int retval = select(nfds, &rfds, NULL, NULL, &tv);
  if (retval == -1) {
    // error
  } else if (retval) {
    // retval fds ready
    for(int n = 0; n < nfds; n++) {
      if (FD_ISSET(fds[n], &rfds)) {
        // perform I/O operation
      }
    }
  } else {
    // no fd ready
  }
}
```

## Poll

`poll` 与 `select` 类似，只是针对 `select` 文件描述符数量限制和每次都需要 reinitialize `fd_set` 进行了改进，不过每次调用 `poll` 还是需要拷贝文件描述符至内核空间。在 `poll` 实现中，文件描述符在以链表形式管理，所以没有了数量限制。

`pollfd` 则解决了 `select` 每次调用都需要初始化 `fd_set` 的问题：

```C
struct pollfd {
  int   fd;         /* file descriptor */
  short events;     /* requested events */
  short revents;    /* returned events */
};
```

### poll 使用示例

```C
/* poll_input.c
Licensed under GNU General Public License v2 or later.
*/
#include <poll.h>
#include <fcntl.h>
#include <sys/types.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char *argv[])
{
  int nfds = argc - 1;
  int num_open_fds = nfds;
  struct pollfd *pfds = calloc(nfds, sizeof(struct pollfd));
  for (int j = 0; j < nfds; j++)
  {
    pfds[j].fd = open(argv[j + 1], O_RDONLY);
    pfds[j].events = POLLIN; // set requested events to be monitored
  }
  while (num_open_fds > 0)
  {
    int ready = poll(pfds, nfds, -1); // block until an event occurs 
    if (ready == -1)
      errExit("poll");
    for (int j = 0; j < nfds; j++)
    {
      if (pfds[j].revents == 0)
        continue;

      if (pfds[j].revents & POLLIN) {
        // perform I/O operation
      } else {
        close(pfds[j].fd);
        num_open_fds--;
      }
    }
  }
}
```

## Epoll

从 `select` 到 `poll`，已经解决了数量限制、参数重新初始化的问题，但是还有两个问题没有解决，一是需要每次都要拷贝完整文件描述符到内核空间，二是需要遍历所有文件描述符执行 I/O 操作。
`epoll` 通过在内核空间维护一个 epoll instance 解决这两个问题，可以理解为一个包含 `interest` 和 `ready` 两个集合的数据结构，前者表示需要监听的文件描述符，后者则记录了进入 `ready` 状态的文件描述符。这样用户程序就可以通过 epoll instance 修改 `interest` 动态调整需要监听的文件描述符了。

### epoll 使用示例

```C
#include <sys/epoll.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/socket.h>

int main(void)
{
  int listen_sock = socket(AF_INET, SOCK_STREAM, 0);
  int epollfd = epoll_create(0);
  // monitor socket fd
  struct epoll_event ev;
  ev.events = EPOLLIN;
  ev.data.fd = listen_sock;
  epoll_ctl(epollfd, EPOLL_CTL_ADD, listen_sock, &ev)

  struct epoll_event events[MAX_EVENTS];
  while (true) {
    int nfds = epoll_wait(epollfd, events, MAX_EVENTS, -1);
    for (int n = 0; n < nfds; ++n) {
      if (events[n].data.fd == listen_sock) {
        // register connection to the epoll instance
        int conn_sock = accept(listen_sock, (struct sockaddr *)&addr, &addrlen);
        ev.events = EPOLLIN;
        ev.data.fd = conn_sock;
        epoll_ctl(epollfd, EPOLL_CTL_ADD, conn_sock, &ev)
      } else {
        // connection ready
      }
    }
  }
}
```

### Edge-triggered & Level-triggered

这两个其实是数字电路里面的术语，可以参考[Key takeaways](#key-takeaways)。

```plaintext
1          +----------+          +----------+          +----------+
           |          |          |          |          |          |
           |          |          |          |          |          |
           |          |          |          |          |          |
0----------+          +----------+          +----------+          +----------
```

Edge-triggered 监听的是竖线表示的状态变化，Level-triggered 监听的是水平线表示的状态。

举例来说，当一个文件描述符从 not read ready（0） 变为 read ready（1） 时，不论 Edge-triggered 还是 Level-triggered，都会通知可读事件；如果应用程序只读了一半数据，或者压根没读取，那该文件描述符的状态还是 read ready；下一次调用 `epoll_wait` 时，Edge-triggered 因为没有状态变化不会再次通知，Level-triggered 则检测到仍是可读状态，还会继续通知。

默认以 Level-triggered 方式监听文件描述符，可使用 `ev.events = EPOLLIN | EPOLLET` 调整为 Edge-triggered 模式。由于 Edge-triggered 不会再次通知可读文件描述符，所以需要用户程序自行维护好文件描述符的可读状态（EGAIN）。

## Key takeaways

[](https://mp.weixin.qq.com/s/YdIdoZ_yusVWza1PU7lWaw)

[edge-triggering and level-triggering](https://www.geeksforgeeks.org/edge-triggering-and-level-triggering)
