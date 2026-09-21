<div align="center">

# dsh-plugin-file-actions

**在 DSH Web 界面的每张交付文件卡片上：复制路径、用编辑器打开、在终端里运行 —— macOS / Windows / Linux 全平台。**

简体中文 · [English](README.en-US.md)

[![License: MIT](https://img.shields.io/github/license/cholf5/dsh-plugin-file-actions?style=flat-square)](./LICENSE)
[![Platform: macOS | Windows | Linux](https://img.shields.io/badge/platform-macOS_%7C_Windows_%7C_Linux-black?style=flat-square)](#-已知限制)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek_Harness-web_plugin-blueviolet?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)

</div>

## ✨ 功能

一个双面 DeepSeek Harness 插件，扩展 Web 界面里**交付文件卡片**（会话收尾列出的文件列表）的下拉菜单：

- 📋 **复制相对路径** / **复制绝对路径** —— 一次点击（纯浏览器侧，全平台）。
- 🚀 **用探测到的编辑器/IDE 打开该文件** —— VS Code、Cursor、Sublime Text、JetBrains 全家桶等，每项带真实应用图标。应用探测与启动复用官方 `open-in-app` 的解析器：macOS 查 `.app` bundle，Windows 查注册表（App Paths / 卸载记录 / `%ProgramFiles%` 扫描），Linux 查 PATH 与 desktop entry。
- ▶️ **在终端运行该文件** / **在终端打开所在目录** —— 跟随本机探测到的终端：macOS 的终端.app / Ghostty，Windows 的 Windows Terminal / Git Bash，Linux 的 GNOME Terminal / Konsole / Ghostty。

> [!NOTE]
> 官方的两项（用默认应用打开、在文件管理器中显示）保持不变。

## 🧩 应用列表如何决定

与官方 `open-in-app` 机制对齐 —— **官方解析器 + 本机探测过滤**，零配置：

- Host 半边直接加载官方 `@deepseek-ai/dsh-host-open-in-app` 包的解析库（精确锁版本），用与官方完全相同的定位链在本机解析每个应用，再以文件路径为参数启动解析到的可执行文件（macOS `open -a <bundle> <文件>`，Windows/Linux 直接 spawn 解析到的 exe）。官方 catalog 新增应用或调整定位拼写时，随插件发版升级。
- 浏览器半边把官方探测结果（`GET /open-in-app/apps`）与插件 info 路由返回的**本机解析结果**（`available` 字段）做交集：只有官方验证过 **且** 插件自己解析成功 **且** 在白名单内的应用才会出现 —— 即使插件随附的解析库与宿主 dsh 的版本有差异，也不可能再现「菜单里有、点了 400」。新装应用在下次 `dsh web` 重启后出现，卸载后立即消失。
- 图标来自官方图标路由（`GET /open-in-app/icon/<id>`），与会话右上角同一份真实应用图标（Windows 上从可执行文件提取）；缺失时退回通用占位图形。

终端项有悬停二级菜单：**在终端运行该文件**（命令来自下文的扩展名映射，映射不到的扩展名会置灰）与**在终端打开所在目录**（转发给官方 `POST /open-in-app/open` 路由，传父目录）。

## 📦 安装

### 前置条件

- **dsh** 可用 —— `dsh --version`，或下面所有命令前缀 `npx @deepseek-ai/dsh`
- PATH 中有 **pnpm**（dsh 插件管理器会调用它）：`npm install -g pnpm`

### 1. 添加插件

```sh
# 本地目录安装（link: —— 源码改动直接生效）
# ⚠️ link: 安装前先在 checkout 里跑一次 npm install：
#    插件依赖从 checkout 自己的 node_modules 解析，缺了它们 dsh web 会启动报错
npm install    # 在 checkout 里执行（npm / git 安装可跳过，pnpm 会自带依赖）
npx @deepseek-ai/dsh plugin --profile web add link:/absolute/path/to/dsh-plugin-file-actions -w

# 从 GitHub 安装
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/cholf5/dsh-plugin-file-actions.git -w
```

### 2. 重启并刷新

重启 `dsh web`，然后刷新浏览器页面（更新后硬刷新）。

### 3. 验证（可选，但推荐）

验证路由已注册要用 cookie —— 未认证的 401 对所有 `/api` 路径都会发生，不构成注册证据：

```sh
curl -s -c /tmp/dsh-cookies.txt "http://127.0.0.1:3080/?token=<启动 URL 里的 token>" -o /dev/null   # 铸造会话 cookie（303）
curl -s -b /tmp/dsh-cookies.txt http://127.0.0.1:3080/api/file-actions/info   # 返回 JSON = 已注册；404 "not found" = 未注册
```

<details>
<summary>没有 pnpm 也不想装？手动回退</summary>

```sh
git clone https://github.com/cholf5/dsh-plugin-file-actions.git ~/.dsh/profiles/web/node_modules/dsh-plugin-file-actions
```

然后编辑 `~/.dsh/profiles/web/cordis.patch.yml`，使顶层列表包含（这是文件的最终状态 —— 不要盲目在 `[]` 行后追加）：

```yaml
- insert:
    - id: file-actions
      name: dsh-plugin-file-actions
```

运行中的 dsh 会热加载这一行（patch 文件监视）；之后刷新浏览器。

</details>

<details>
<summary>更新 / 卸载</summary>

```sh
npx @deepseek-ai/dsh plugin --profile web update dsh-plugin-file-actions -w    # 或 remove
```

之后重启 `dsh web`。

</details>

### 🩺 故障排查

| 症状 | 原因与修复 |
|---|---|
| `dsh: command not found` | npx-only 安装 —— 命令前缀 `npx @deepseek-ai/dsh` |
| `pnpm was not found`（exit 127） | `npm install -g pnpm`，或用上面的手动回退 |
| `ERR_PNPM_ADDING_TO_ROOT` | 丢了 `-w` 标志 |
| 装了但界面没变化 | 重启 `dsh web`（bundle 层不热加载），再刷新页面 |
| 扩展菜单一直不出现在卡片上 | fiber 探测失败，插件已回退到官方 chevron（见已知限制）；先看 DevTools Console 有无报错 |
| `dsh web` 启动日志报 `file-actions:` 开头的错误，或 `Cannot find package '@deepseek-ai/dsh-host-open-in-app'` | 官方依赖没装或解析不到 —— `link:` 安装先在 checkout 里 `npm install`；npm/git 安装用 `dsh plugin --profile web update dsh-plugin-file-actions -w` 重装 |
| 菜单里没有某个编辑器/终端 | 该应用未被「官方探测 + 插件解析」双重验证（检查官方 split 按钮菜单里有没有它）—— 两个交集都通过才会出现 |

## ⚙️ 配置

Host 行接受：

```yaml
- insert:
    - id: file-actions
      name: dsh-plugin-file-actions
      config:
        runCommands:              # 扩展名（无点）→ 在带引号的文件路径前运行的命令
          py: python3             # 默认值随平台不同：Windows 默认 python / cmd /c / powershell -File 等
          sh: bash
          js: node
          ts: tsx
        allowExecutableBit: true  # 未映射扩展名但带可执行位的文件也提供「运行」
        launchTimeoutMs: 10000    # 有界命令的截止时间，也是分离启动的观察窗口
```

> [!WARNING]
> 在 profile 自己的 `cordis.patch.yml` 里覆盖 —— patch 行会整行替换目标的
> `config`（无深合并），需要把每个键都重写一遍。

## 🔍 工作原理

| 层 | 文件 | 运行环境 |
| --- | --- | --- |
| Host | `lib/index.js` | Node —— Cordis Loader |
| Client | `lib/client.js` | 浏览器 —— dsh 客户端模块系统 |

### Host —— `lib/index.js`

Cordis 行 `file-actions` 在共享的已认证 `/api` 通道上注册三个精确路由：

| 路由 | 行为 |
| --- | --- |
| `GET /api/file-actions/info` | 注册探测 —— 返回 JSON body 即插件已加载 |
| `POST /api/file-actions/launch` | 用官方解析器解析应用 → `launchResolved` 以文件为参数启动（missing-executable 时按官方语义重解析一次） |
| `POST /api/file-actions/run` | 按下表构建终端命令并分离启动 |

终端适配（全部走官方 launcher 分离启动，凭据清洗过的环境变量，终端窗口比 dsh 活得久）：

| 终端 | 平台 | 运行方式 |
| --- | --- | --- |
| Terminal.app | macOS | AppleScript `do script "cd <目录> && <命令>"` |
| Ghostty | macOS / Linux | macOS `open -na Ghostty --args -e`；Linux `ghostty --working-directory=<目录> -e bash -c` |
| Windows Terminal | Windows | `wt -d <目录> cmd /k`，命令行经环境变量 `%FILE_ACTIONS_RUN_CMD%` 传入 —— token 无空白，不受 wt 命令行重排影响，cmd 执行时才展开 |
| Git Bash | Windows | `<Git>/usr/bin/mintty.exe -e <Git>/usr/bin/bash.exe -l -c "cd <目录> && <命令>; exec '<Git>/usr/bin/bash.exe' -l -i"`（shell 一律走绝对路径 —— 裸 `exec bash` 会经 Windows PATH 命中 WSL 的 `system32\bash.exe`；`CHERE_INVOKING=1` 防止登录 shell 跳回 HOME） |
| GNOME Terminal / Konsole | Linux | `--working-directory` / `--workdir` + `bash -c "<命令>; exec bash -i"` |

POSIX 终端在命令结束后保留交互 shell（对齐 Terminal.app 行为）；每条路由先请求 composition 的 `connection` 服务做拒绝判定 —— 与官方 open-in-app 相同的信任围栏。

### Client —— `lib/client.js`

MutationObserver 监视交付文件卡片（`[data-presented-file]`），读取卡片的 React fiber 拿到 `file` / `cwd` / `onAction` / locale，隐藏官方 chevron，挂载样式一致的插件菜单按钮。

> [!IMPORTANT]
> 若 fiber 无法读取（上游 DOM 或 React 变更），官方 chevron 原样保留 —— 插件退化为不可见而不是弄坏卡片。

## 🚧 已知限制

- **应用目录表固定**，对齐官方 open-in-app 哲学：部署方无法从 cordis.yml 添加自己的编辑器；扩展表意味着同时扩展 Host 的 `EDITOR_IDS`/`TERMINALS` 与客户端字典。哪些应用出现完全由官方探测决定（例如官方 catalog 未给 Zed 声明 win32 定位，Windows 上就不会出现 Zed）。
- **运行命令按扩展名识别。** 扩展名未映射的文件按可执行性提供「运行」：POSIX 看可执行位（客户端看不到它），Windows 按扩展名推导（`.exe`/`.bat`/`.cmd`/`.com`，chmod 在 Windows 上无效果；`.bat`/`.cmd` 默认已映射到 `cmd /c`）。无扩展名文件在 Windows 上不提供「运行」。需要时配置 `runCommands`。
- **Windows Terminal 的运行命令经 cmd 解释。** 命令字符串由 `cmd /k` 执行，配置值里的 cmd 元字符会被展开；`.sh` 等脚本建议在 Git Bash 终端里运行（其命令在 MSYS bash 上下文中执行）。Git Bash 的「运行」依赖完整 Git for Windows 安装自带的 mintty。
- **官方依赖精确锁版本。** Host 通过包清单定位 `@deepseek-ai/dsh-host-open-in-app` 的 `lib/types/resolver.js`（已发布 tarball 内含，并按版本尝试多种布局），依赖精确锁定在 `0.1.6-alpha.2`、不随 `dsh plugin update` 漂移；宿主 dsh 自带另一份解析库，两份可能的差异由客户端的双交集（官方探测 ∩ 插件解析）兜底。若未来版本改动布局，插件在启动时以 `file-actions:` 开头的明确错误失败，不会静默退化。
- **增强读取 React fiber。** dsh 升级若改变了交付卡片内部结构，菜单可能不再出现（官方 chevron 自动恢复）；更新 fiber 探测与选择器即可恢复。

## 🛠️ 开发

```sh
npm install
node --test test/host.test.mjs test/client.test.mjs
```

测试通过 seam 注入（resolver / launcher / runCommand / stat / platform），在任意开发机上确定性覆盖 win32 / linux / darwin 三套适配器 —— 包括只读 POSIX mode 的 execute-bit 回退（stat seam 伪造 mode，不依赖 chmod），另有一条真实加载官方解析库的集成测试。

> [!TIP]
> 通过 `link:` 安装时，改动 `lib/client.js` 会热替换进运行中的 `dsh web`，无需重启；Host 半边的改动需要重启 —— 且 checkout 必须先 `npm install`（依赖从 checkout 的 `node_modules` 解析）。

## 📄 许可

[MIT](./LICENSE) © cholf5
