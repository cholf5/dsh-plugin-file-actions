<div align="center">

# dsh-plugin-file-actions

**Copy paths, open files in your editor, run them in a terminal — right from
every presented-file card in the DSH web GUI.**

English · [简体中文](README.md)

[![License: MIT](https://img.shields.io/github/license/cholf5/dsh-plugin-file-actions?style=flat-square)](./LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-black?logo=apple&logoColor=white&style=flat-square)](#-known-limitations)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek_Harness-web_plugin-blueviolet?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)

</div>

## ✨ Features

A dual-face DeepSeek Harness plugin that extends the dropdown menu of every
**presented-file card** (the file list a session delivers at the end of a turn)
in the DSH web GUI:

- 📋 **Copy relative path** / **Copy absolute path** — one click each.
- 🚀 **Open the file in a detected editor or IDE** — VS Code, Sublime Text,
  Rider, Cursor, Zed, the JetBrains family, and more, each shown with its real
  application icon.
- ▶️ **Run this file in a terminal** / **Open its containing folder in a
  terminal** — a submenu per detected terminal (Ghostty, Terminal.app).

> [!NOTE]
> The two official menu entries (open with the default application, show in the
> file manager) keep working unchanged.

## 🧩 How the application list is decided

The plugin aligns with the official `open-in-app` mechanism — a **fixed catalog
probed against the local machine**, no configuration:

- The plugin keeps a file-level launcher table keyed by the official
  `open-in-app` catalog ids (macOS bundle spellings mirror the official
  catalog).
- The browser half fetches the official probe result
  (`GET /open-in-app/apps`) and shows only the intersection: an application
  appears when the official host verified it on this machine **and** the plugin
  knows how to hand it a file. Installing an application makes it appear after
  the next `dsh web` restart, uninstalling makes it disappear immediately.
- Icons come from the official icon route (`GET /open-in-app/icon/<id>`), the
  same real bundle icons the session header uses; a missing icon falls back to
  a generic glyph.

Terminals get a hover submenu with two entries: **Run this file** (the command
comes from the extension map below; unmapped extensions are greyed out) and
**Open containing folder** (delegates to the official
`POST /open-in-app/open` route with the parent directory).

## 📦 Installation

### Prerequisites

- **dsh** reachable — `dsh --version`, or use `npx @deepseek-ai/dsh` everywhere below
- **pnpm** on PATH (the dsh plugin manager calls it): `npm install -g pnpm`

### 1. Add the plugin

```sh
# local checkout (link: — source edits apply directly)
npx @deepseek-ai/dsh plugin --profile web add link:/absolute/path/to/dsh-plugin-file-actions -w

# from GitHub
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/cholf5/dsh-plugin-file-actions.git -w
```

### 2. Restart and refresh

Restart `dsh web`, then refresh the browser page (hard refresh after updates).

### 3. Verify (optional, but recommended)

Verify the routes are live with a cookie — an unauthenticated 401 happens for
every `/api` path, so it proves nothing about registration:

```sh
curl -s -c /tmp/dsh-cookies.txt "http://127.0.0.1:3080/?token=<token-from-launch-url>" -o /dev/null   # mint session cookie (303)
curl -s -b /tmp/dsh-cookies.txt http://127.0.0.1:3080/api/file-actions/info   # JSON body = registered; 404 "not found" = not
```

<details>
<summary>No pnpm, and don't want it? Manual fallback</summary>

```sh
git clone https://github.com/cholf5/dsh-plugin-file-actions.git ~/.dsh/profiles/web/node_modules/dsh-plugin-file-actions
```

Then edit `~/.dsh/profiles/web/cordis.patch.yml` so the top-level list contains
(this is the file's final state — do not blindly append after a `[]` line):

```yaml
- insert:
    - id: file-actions
      name: dsh-plugin-file-actions
```

The running dsh hot-loads this row (patch file watch); refresh the browser afterwards.

</details>

<details>
<summary>Update / remove</summary>

```sh
npx @deepseek-ai/dsh plugin --profile web update dsh-plugin-file-actions -w    # or remove
```

Restart `dsh web` afterwards.

</details>

### 🩺 Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `dsh: command not found` | npx-only install — prefix `npx @deepseek-ai/dsh` |
| `pnpm was not found` (exit 127) | `npm install -g pnpm`, or use the manual fallback above |
| `ERR_PNPM_ADDING_TO_ROOT` | the `-w` flag was dropped |
| Installed but the UI is unchanged | restart `dsh web` (bundle layers don't hot-reload), then refresh the page |
| The extended menu never appears on a card | the fiber probe failed and the plugin fell back to the official chevron (see Known Limitations); check the DevTools console for errors first |

## ⚙️ Configuration

The host row accepts:

```yaml
- insert:
    - id: file-actions
      name: dsh-plugin-file-actions
      config:
        runCommands:            # extension (no dot) → command run before the quoted file path
          py: python3
          sh: bash
          js: node
          ts: tsx
        allowExecutableBit: true  # also offer "run" for unmapped extensions carrying an execute bit
        launchTimeoutMs: 10000    # deadline per launched host command
```

> [!WARNING]
> Override in the profile's own `cordis.patch.yml` — a patch row replaces the
> target row's whole `config` (no deep merge), so restate every key.

## 🔍 How it works

| Layer | File | Runs in |
| --- | --- | --- |
| Host | `lib/index.js` | Node — the Cordis loader |
| Client | `lib/client.js` | Browser — the dsh client module system |

### Host — `lib/index.js`

The Cordis row `file-actions` registers three exact routes on the shared
authenticated `/api` channel:

| Route | Behaviour |
| --- | --- |
| `GET /api/file-actions/info` | registration probe — a JSON body means the plugin is loaded |
| `POST /api/file-actions/launch` | verifies the bundle in the known application directories, then runs `open -a <bundle> <file>` |
| `POST /api/file-actions/run` | Terminal.app via AppleScript `do script`; Ghostty via `open -na Ghostty --args -e` |

Every route first asks the composition's `connection` service for a rejection —
the same trust fence as the official open-in-app host.

### Client — `lib/client.js`

A `MutationObserver` watches presented-file cards (`[data-presented-file]`),
reads the card's React fiber to obtain `file` / `cwd` / `onAction` / locale,
hides the official chevron, and mounts the plugin's own menu button with the
same styling.

> [!IMPORTANT]
> If the fiber cannot be read (an upstream DOM or React change), the official
> chevron stays untouched — the plugin degrades to invisible instead of
> breaking the card.

## 🚧 Known Limitations

- **macOS only for the native actions.** The launch/run routes use `open -a`,
  AppleScript, and macOS bundle probing; on Linux/Windows the host routes
  answer but the launcher table resolves nothing, so only the copy entries are
  useful. Platform parity is deferred until needed.
- **The catalog is fixed**, mirroring the official open-in-app philosophy:
  deployments cannot add their own editor from cordis.yml; extending the table
  means extending `EDITOR_BUNDLES` and the dictionaries together.
- **Run-command discovery is extension-based.** A file with an unmapped
  extension and an execute bit is greyed even though it could run (the client
  cannot see the execute bit); selecting it is still impossible by design —
  configure `runCommands` or rely on the executable-bit fallback only when the
  extension is absent.
- **The augmentation reads React fibers.** A dsh upgrade that changes the
  presented-file card internals can stop the menu from appearing (official
  chevron restored); updating the fiber probe and selectors restores it.

## 🛠️ Development

```sh
npm install
node --test test/host.test.mjs test/client.test.mjs
```

> [!TIP]
> With the plugin installed via `link:`, edits to `lib/client.js` hot-swap
> into a running `dsh web` without a restart; host-half changes need a restart.

## 📄 License

[MIT](./LICENSE) © cholf5
