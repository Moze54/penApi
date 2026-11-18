# PenApi 浏览器接口调试插件

全屏独立标签页运行的浏览器接口调试工具（Chrome / Edge，Manifest V3），功能对标 CrapApi / Postman，数据全部保存在本地，无任何后端依赖。

## 功能

- **HTTP 全类型调试**：GET / POST / PUT / DELETE / PATCH / HEAD / OPTIONS；Query 参数、请求头、请求体（form-data 含文件上传 / x-www-form-urlencoded / raw: JSON·Text·XML·HTML·JavaScript）、Bearer / Basic 认证
- **响应查看**：状态码着色、耗时、大小、格式化 JSON 树（可折叠、语法着色）、原始文本、图片预览、HTML 预览、响应头与实际发送头
- **项目分组**：项目 → 文件夹 → 接口 三级树，右键菜单（新建 / 重命名 / 副本 / 删除），拖拽排序与移动，关键字搜索（名称 / URL）
- **多标签工作区**：接口以标签页打开，未保存圆点标记，上下分屏可拖拽调节
- **环境变量**：多环境管理、顶栏一键切换，`{{变量名}}` 在 URL / 参数 / 请求头 / Body 中自动替换，URL 栏下方实时显示解析结果
- **历史记录**：自动记录完整请求 + 响应快照，按日期分组、关键字 / 方法筛选、点击回放、保留条数可配置
- **cURL**：粘贴 curl 命令解析导入（`-X / -H / -d / -F / -u`、引号与换行续行）；当前请求一键复制为 cURL
- **JSON 批量导入**：粘贴固定 JSON 格式，单条或数组批量导入接口（含参数 / 请求头 / 请求体 / 认证 / `folder` 字段自动归档子文件夹），导入前解析预览逐条校验
- **断言测试**：可视化断言规则（状态码 / 耗时 / JSON 字段 / 响应头 / 响应体 × 等于 / 不等于 / 包含 / 存在 / 大于 / 小于），发送后自动校验，响应区显示通过率与失败原因
- **后置变量提取**：按 JSON 路径从响应提取值写入当前环境变量（如登录 token 存入 `{{token}}`），后续接口直接引用，实现接口串联调试
- **代码生成**：一键生成 cURL / fetch / axios / Python requests / Go 请求代码，环境变量按实际值替换
- **Cookie 管理器**：查看 / 新增 / 编辑 / 删除指定域 Cookie，一键复制 Cookie 请求头；网页模式降级为当前域只读
- **Postman 导入**：粘贴 Postman Collection v2.1 JSON，文件夹层级完整导入为新项目
- **页面抓包**：开启捕获后实时收集页面 XHR / fetch 请求（含请求头与 body），勾选后一键转为接口
- **WebSocket 调试**：连接 / 断开、双向消息时间线（发送 / 接收 / 系统）、Enter 发送
- **备份**：一键导出 / 导入 JSON 全量备份（项目 + 接口 + 环境 + 历史 + 设置）

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Enter` | 发送请求 |
| `Ctrl + S` | 保存接口到项目树 |
| `Enter`（URL 栏） | 发送请求 |

## JSON 导入格式

侧栏「导入」按钮 → 粘贴 JSON → 解析预览 → 导入。顶层可以是**单个接口对象**，也可以是**接口对象数组**（批量）。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 否 | 接口名称，默认「未命名接口」 |
| `url` | string | **是** | 请求地址；缺失的条目会被跳过并在预览中标红 |
| `method` | string | 否 | HTTP 方法，默认 `GET`；无法识别时按 GET 并提示 |
| `kind` | string | 否 | `http`（默认）/ `ws`（WebSocket 接口） |
| `params` | array | 否 | Query 参数 `[{ "key": "page", "value": "1" }]`，可选 `enabled: false` 禁用 |
| `headers` | array | 否 | 请求头，格式同上（也可使用 `{ "名": "值" }` 对象映射） |
| `body` | object / string | 否 | `{ "type": "json", "raw": "..." }`；`type` 支持 `json / text / xml / html / javascript / raw / form-data / urlencoded / none`，表单类配 `form` 数组；直接写字符串视为 raw JSON |
| `auth` | object | 否 | `{ "type": "bearer", "token": "..." }` 或 `{ "type": "basic", "username": "...", "password": "..." }` |
| `folder` | string | 否 | 放入所选位置下该名称的子文件夹（不存在自动创建） |

示例（两个接口，第二个自动归入「用户模块」文件夹）：

```json
[
  {
    "name": "查询用户信息",
    "method": "GET",
    "url": "https://api.example.com/users",
    "params": [{ "key": "page", "value": "1" }],
    "headers": [{ "key": "Authorization", "value": "Bearer xxx" }]
  },
  {
    "name": "创建用户",
    "method": "POST",
    "url": "https://api.example.com/users",
    "body": { "type": "json", "raw": "{\"name\": \"张三\"}" },
    "folder": "用户模块"
  }
]
```

## 加载插件（验收 / 使用）

1. 打开 Chrome / Edge，地址栏输入 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 右上角开启「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」，选择本项目的 **`dist`** 目录
4. 工具栏出现 PenApi 图标（青色闪电），点击即在全屏标签页打开；再次点击聚焦已开标签，不重复开页

> 安装时会提示「读取和更改您在所有网站上的数据」——这是免 CORS 跨域调试的必要权限（`host_permissions: <all_urls>`），此类调试工具的标配，请求只在您主动发送时发出。

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 网页模式开发（http://localhost:5188，数据存 localStorage，跨域受 CORS 限制）
npm run build      # 构建插件到 dist/
npm run typecheck  # TypeScript 类型检查
```

修改源码后：`npm run build`，然后在扩展管理页点击插件卡片上的「刷新」按钮即可生效。

**网页开发模式说明**：`npm run dev` 以普通网页运行，数据层自动降级为 localStorage，便于热更新调试 UI；跨域请求此时受 CORS 限制（页面顶部有「开发模式」徽标提示）。插件专属能力（免 CORS 跨域请求、工具栏图标点击全屏打开）仅在 `dist` 加载的扩展环境生效。

**应用图标**：`public/icons/icon-source.png` 为设计原图（深藏青窗口 + API 卡片 + 蓝色代码徽标），16/48/128 三档由其高质量缩放生成；界面配色（藏青底色阶 + 图标蓝主色）与图标同源。

## 目录结构

```
penApi/
├── public/
│   ├── manifest.json        # MV3 清单（storage + unlimitedStorage + cookies + webRequest + host_permissions）
│   ├── background.js        # service worker：图标点击开页 / 聚焦 + 页面请求抓包监听
│   └── icons/               # 扩展图标（icon-source.png 为设计原图）
├── src/
│   ├── core/                # 请求引擎 / ws / 变量替换 / cURL 解析 / JSON·Postman 导入 / 断言引擎 / 代码生成 / Cookie / 抓包 / 右键菜单
│   ├── storage/db.ts        # chrome.storage.local 适配 + 网页模式 localStorage 降级
│   ├── stores/              # Pinia：library(项目树) env history settings workspace ui
│   ├── components/
│   │   ├── layout/          # 顶栏（环境切换 / 设置）
│   │   ├── sidebar/         # 项目分组树 / 历史列表
│   │   ├── request/         # URL 栏 / 参数·体·头·认证编辑器 / HTTP 面板
│   │   ├── response/        # 响应查看器 / JSON 树
│   │   ├── ws/              # WebSocket 面板
│   │   ├── modal/           # 环境 / 设置备份 / 保存接口 / cURL 导入 / JSON 导入 / Postman 导入 / 代码生成 / Cookie 管理 / 页面抓包
│   │   ├── workspace/       # 多标签工作区
│   │   └── common/          # 弹窗 / 确认 / 输入 / 右键菜单 / KV 编辑器 / 图标 / Toast
│   ├── types.ts             # 全部数据模型
│   └── styles/global.css    # 设计系统（藏青 + 图标蓝）与基线样式
└── dist/                    # 构建产物（加载插件选这个目录）
```

## 已知边界（平台限制）

- 浏览器 WS API 不支持自定义连接头，WebSocket 调试不含请求头编辑
- fetch 无法读取 `Set-Cookie` 响应头；请求默认携带浏览器 Cookie（`credentials: include`），调试登录态接口可直接复用浏览器会话
- Host / User-Agent / Cookie 等受限请求头由浏览器控制，自定义值可能被忽略
- 带 File 的表单项在持久化后仅保留文件名提示，重新发送前需重新选择文件（浏览器安全限制）
- 历史记录响应体超过 1 MB 时不保留正文（节省存储），重新发送即可查看
- 页面抓包仅在扩展环境可用，为只读监听（webRequest），不修改、不阻断页面请求，记录上限 300 条
- Cookie 管理在网页开发模式下仅能读取当前页面同域的非 HttpOnly Cookie；完整能力需加载扩展
