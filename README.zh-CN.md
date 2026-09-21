# dsh-plugin-file-actions

[English](README.md) | 简体中文

一个双面 DeepSeek Harness 插件，扩展 Web 界面里**交付文件卡片**（会话收尾列出的文件列表）的下拉菜单：

- **复制相对路径** / **复制绝对路径**；
- **用探测到的编辑器/IDE 打开该文件** —— VS Code、Sublime Text、Rider、Cursor、Zed、JetBrains 全家桶等，每项带真实应用图标；
- **在终端运行该文件** / **在终端打开所在目录** —— 每个探测到的终端（Ghostty、终端.app）一个二级菜单。

官方的两项（用默认应用打开、在 Finder 中显示）保持不变。

## 应用列表如何决定

与官方 `open-in-app` 机制对齐 —— **固定目录表 + 本机探测过滤**，零配置：

- 插件维护一张以官方 catalog id 为键的文件级启动器表（macOS bundle 拼写与官方 catalog 一致）。
- 浏览器半边读取官方探测结果（`GET /open-in-app/apps`），只显示交集：官方在本机验证过 **且** 插件知道如何交付文件的应用才会出现。新装应用在下次 `dsh web` 重启后出现，卸载后立即消失。
- 图标来自官方图标路由（`GET /open-in-app/icon/<id>`），与会话右上角同一份真实 bundle 图标；缺失时退回通用占位图形。

终端项有悬停二级菜单：**在终端运行该文件**（命令来自下文的扩展名映射，映射不到的扩展名会置灰）与**在终端打开所在目录**（转发给官方 `POST /open-in-app/open` 路由，传父目录）。

## 安装

前置条件：

- **dsh** 可用 —— `dsh --version`，或下面所有命令前缀 `npx @deepseek-ai/dsh`
- PATH 中有 **pnpm**（dsh 插件管理器会调用它）：`npm install -g pnpm`

```sh
# 本地目录安装（link: —— 源码改动直接生效）
npx @deepseek-ai/dsh plugin --profile web add link:/absolute/path/to/dsh-plugin-file-actions -w

# 从 GitHub 安装
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/cholf5/dsh-plugin-file-actions.git -w
```

重启 `dsh web`，然后刷新浏览器页面（更新后硬刷新）。

## 配置

Host 行接受：

```yaml
- insert:
    - id: file-actions
      name: dsh-plugin-file-actions
      config:
        runCommands:              # 扩展名（无点）→ 在带引号的文件路径前运行的命令
          py: python3
          sh: bash
          js: node
          ts: tsx
        allowExecutableBit: true  # 未映射扩展名但带可执行位的文件也提供「运行」
        launchTimeoutMs: 10000    # 每条 Host 启动命令的截止时间
```

在 profile 自己的 `cordis.patch.yml` 里覆盖 —— 注意 patch 行会整行替换目标的 `config`（无深合并），需要把每个键都重写一遍。

## 工作原理

| 层 | 文件 | 职责 |
| --- | --- | --- |
| Host | `lib/index.js` | Cordis 行 `file-actions`；注册 `GET /api/file-actions/info`、`POST /api/file-actions/launch`（先在已知应用目录验证 bundle，再 `open -a <bundle> <文件>`）、`POST /api/file-actions/run`（终端.app 走 AppleScript `do script`，Ghostty 走 `open -na Ghostty --args -e`）。每条路由先请求 composition 的 `connection` 服务做拒绝判定 —— 与官方 open-in-app 相同的信任围栏。 |
| Client | `lib/client.js` | MutationObserver 监视交付文件卡片（`[data-presented-file]`），读取卡片的 React fiber 拿到 `file` / `cwd` / `onAction` / locale，隐藏官方 chevron，挂载样式一致的插件菜单按钮。若 fiber 无法读取（上游 DOM 或 React 变更），官方 chevron 原样保留 —— 插件退化为不可见而不是弄坏卡片。 |

## 已知限制

- **原生动作仅限 macOS。** launch/run 路由使用 `open -a`、AppleScript 与 macOS bundle 探测；Linux/Windows 上路由可用但启动器表解析不到任何 bundle，只有复制项有用。平台补齐推迟到有真实需要时。
- **目录表固定**，对齐官方 open-in-app 哲学：部署方无法从 cordis.yml 添加自己的编辑器；扩展表意味着同时扩展 `EDITOR_BUNDLES` 与字典。
- **运行命令按扩展名识别。** 扩展名未映射但带可执行位的文件会被置灰（客户端看不到可执行位）；这是设计取舍 —— 需要时配置 `runCommands`，或依赖无扩展名文件的可执行位回退。
- **增强读取 React fiber。** dsh 升级若改变了交付卡片内部结构，菜单可能不再出现（官方 chevron 自动恢复）；更新 fiber 探测与选择器即可恢复。

## 开发

```sh
npm install
node --test test/host.test.mjs test/client.test.mjs
```

## 许可

[MIT](./LICENSE)
