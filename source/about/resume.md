
<h1>刘鑫</h1>

<table style="cellpadding:0;">
    <tr>
        <td style="border:none;padding-left:0;">性别：男</td>
        <td style="border:none;padding-left:0;">年龄：24</td>
    </tr>
    <tr>
        <td style="border:none;padding-left:0;">电话：15200296920</td>
        <td style="border:none;padding-left:0;">邮箱：clsrfish@gmail.com</td>
    </tr>
    <tr>
        <td style="border:none;padding-left:0;">Blog：https://clsrfish.github.io</td>
    </tr>
</table>

## 教育经历

<ul style="padding-inline-start:0;list-style:none;display: flex;justify-content: space-between;">
    <li style="display:inline;width:100%;padding-left:0;"><span>华中科技大学，本科</span></li>
    <li style="display:inline;width:100%;padding-left:0;"><span>软件工程</span></li>
    <li style="display:inline;width:100%;padding-left:0;"><span>2015.9-2019.6</span></li>
</ul>
<br/>

## 工作经历

### 字节跳动-商业化｜Android 开发工程师（2019.7~至今）

#### 一、商业化 Lynx 容器-Rifle lite

**项目介绍**：Rifle lite 是一个基于 Lynx 全新商业化 UI 动态化容器，封装了资源加载与全部广告通用的 JSB。

**项目职责**：
- 负责容器的开发，将容器功能拆分出 JSB、Native 组件及性能监控三个子模块，子模块皆可独立接入业务方；
- 整理各端公共 JSB 并在 Rifle 内实现，使用鹊桥管理平台进行管理，为前端开发同学提供一致的运行环境；
- 推广并辅助业务方接入，目前已完成了在头条和西瓜视频的业务落地，其中 Lynx 落地页实现了至少 50% 的性能与 5% 的广告主价值提升；
- 使用单元测试辅助维护所有 JSB，保证迭代过程中功能稳定，提升人效。

#### 二、商业化落地页 SDK

**项目介绍**：落地页 SDK 是一个专注于广告落地页的业务 SDK，封装了广告落地页中常用的能力，比如安全拦截、应用下载、性能统计等，为一些新开始商业化的业务线短时间内提供了落地页能力。

**项目职责**：
- 对 SDK 进行整体重构与优化，解决了不同业务方单独维护分支的情况，大大降低了维护成本；
- 使用责任链模式将落地页中不同的功能拆分成不同的 Extension，降低不同模块之间的耦合，提高了可维护性；
- 使用 SPI 机制封装特定功能，比如应用下载，以支持业务在海外上架的需要，同时支持业务方按需接入部分能力，降低对宿主包体积的影响。

#### 三、Van Gogh 动态化框架

**项目介绍**：Van Gogh 是一个基于 JS（preact） 的动态化 UI 框架，输入数据和预先编译好的 JS 模板代码得到一份 UI 的 XML 描述，此前头条 Feed 上几乎所有广告卡片都基于该框架开发。

**项目职责**：
- 支持各类动态样式需求，提高广告的点击率；
- 对 JS 生成 XML 的过程进行异步任务优化，减少冷启动时因 JS 执行造成的 50ms 开销；
- 使用注解处理器生成静态代码优化 XML 渲染过程中反射绑定 View 属性的耗时，首次绑定耗时从 28ms 降低为 4ms，同时使用组合模式减少代码生成量，降低对包体积的影响；
- 负责底层渲染方案迁移另一动态框架 Lynx，上层使用接口完全兼容现有 VanGogh，解决自定义 UI 组件 OnClickListner 与 Lynx touch 事件的冲突。

#### 四、广告三方监测 SDK

**项目介绍**：三方监测是指在广告主与媒体之间引入三方监测公司对指定广告位的曝光、点击等指标，结算时根据投放管理平台和三方统计的数据计算费用。监测 SDK 的职责就是负责触发三方监测的统计，具体逻辑是发送一个 GET 请求并发送一个埋点，在所有支持商业化的业务上线。

**项目职责**：
- 负责 SDK 设计与开发，并推广至各个端；
- 处理线上广告主反馈 Gap（投放平台与三方统计数据的差异），确定造成 Gap 的原因，Gap 过大时会影响结算，最差的情况是投放补量与赔付；
- 搭建基于风神的线上 Gap 监控看板，将监控粒度细化到广告位、广告id以及版本，解决了 Gap 反馈的滞后性问题，增强 Gap 的主动处理能力；
- 参与设计优化需求开发流程，从需求提出、开发测试到上线几个阶段的把控，避免导致 Gap 的 bug 上线，预计可挽回损失 1700W/年。

<br/>

## 专业技能

- 熟练使用 Java/Kotlin，了解 C++、JavaScript；
- 熟悉常用 shell 命令，能够编写简单 shell 脚本辅助开发；
- 2 年的 Android 经验，参与过多个商业 APP 的开发；
- 熟悉 MVP、MVVM 等架构模式并运用进行开发；
- 熟悉常用的设计模式、重构技巧，注重代码质量，有一定的项目重构与设计经验；
- 熟练使用 Retrofit、OkHttp、Glide 等开源框架，熟悉相关实现；
- 熟悉 Jetpack 相关组件，LiveData、Room 等。
