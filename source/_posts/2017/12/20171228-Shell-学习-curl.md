---
title: Shell 学习 curl
date: 2017-12-28 09:24:08
categories:
  - Linux
tags:
  - Shell
  - Curl
---

最近有个作业需要自己写个服务器，接口写完了还得测试，虽然使用 postman 等工具很便捷，但是感觉不够装逼（嗯，就是不够装逼），所以 curl 成了不二之选。

<!--more-->

当信用一个命令行工具的时候，习惯性动作都是在 Terminal 里面键入 ‘<tool> --help’ 来看看都有哪些功能和参数，基本上能大概知道学习成本了。不过本人比较怂，如果一下子输出了好几页的帮助文档，基本上就转投 Google ，毕竟可能就用这么一次（以后得改改）。

## 使用
```shell
curl [options...] <url>
```
它的学问全部在 [options...] 里，鉴于帮助文档实在太多了，这里就只挑选进行 Http 请求时用的比较多的参数项。

### 保存输出到文件

直接执行 `curl http://www.baidu.com` 会默认输出到标准输出，如果要保存至本地文件，有三种方式：
- 重定向
```shell
curl https://www.baidu.com > ./index.html
```
这样就能够输出到 index.html 了
- 使用 -o
```shell
curl -o ./index.html https://www.baidu.com
```
index.html 可以是任意有写权限的文件
- 使用 -O
```shell
curl -O http://www.baidu.com/index.html
```
这里和 -O 有两点不同，首先 url 精确到了具体的资源， -O 后面没有参数。输出文件名称和远程资源名称一样，局限性比较大

### 获取响应头信息

有时候可能需要根据响应头信息做一些判断，那么可以执行
```shell
curl -i http://www.baidu.com
```
控制台会输出完整的响应（response header + response body）
如果不需要响应体，可以使用 `-I`
```shell
curl -I https://www.baidu.com
```
> 如果这些信息还不够，还可以使用 -v、-V 选项

### 设置头信息
有些接口可能需要定制头信息，这时候就可以使用 `-H` 选项：
```shell
curl -H "User-Agent: custom UA" -H "Referer: https://xinsbackyard.tech" https://www.baidu.com
```

### 设置 UA
设置 User-Agent 可以使用 -H，也可以使用 `-A` ：
```shell
curl -A "custom UA" https://www.baidu.com
```

### 设置 Referer
同理 UA，可以使用 `-e`：
```shell
curl -e “http://xinsbackyard.tech” https://baidu.com
```

### cookie
在进行模拟登录的时候，需要保存 cookie 来保持登录状态。使用 `-c` 保存返回的 cookie，下次请求的时候就可以使用 `-b` 来读取 cookie ：
```shell
curl -c ./cookie-jar https://www.baidu.com
curl -b ./cookir-jar https://www.baidu.com
```

### 重定向
模拟登录成功后一般会进行一次重定向，如果想要获得重定向之后的输出，那么就使用 `-L` 选项：
```shell
curl -L http://www.xxxxx.com
```

### 指定请求方法
curl 默认请求方法是 GET，要更改默认行为可以使用 `-X` 选项：
```shell
curl -X POST http://www.xxx.com
```

### 发送数据
POST 请求需要发送数据时，使用 `-d` 选项：
```shell
curl -d "username=hahaha&password=23333" https://www.xxx.com/login
```
这样就可以发送一个表单。

如果要发送文件，使用 `@` ：
```shell
curl -X POST -d @filename.zip https://www.xxx.com
```
