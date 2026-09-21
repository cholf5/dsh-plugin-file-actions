<div align="center">

# dsh-plugin-file-actions

**Copy paths, open files in your editor, run them in a terminal — right from
every presented-file card in the DSH web GUI. macOS / Windows / Linux.**

English · [简体中文](README.md)

[![License: MIT](https://img.shields.io/github/license/cholf5/dsh-plugin-file-actions?style=flat-square)](./LICENSE)
[![Platform: macOS | Windows | Linux](https://img.shields.io/badge/platform-macOS_%7C_Windows_%7C_Linux-black?style=flat-square)](#-known-limitations)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek_Harness-web_plugin-blueviolet?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)

</div>

## ✨ Features

A dual-face DeepSeek Harness plugin that extends the dropdown menu of every
**presented-file card** (the file list a session delivers at the end of a turn)
in the DSH web GUI:

- 📋 **Copy relative path** / **Copy absolute path** — one click each
  (browser-side, every platform).
- 🚀 **Open the file in a detected editor or IDE** — VS Code, Cursor, Sublime
  Text, the JetBrains family, and more, each shown with its real application
  icon. Detection and launching reuse the official `open-in-app` resolver:
  macOS checks `.app` bundles, Windows checks the registry (`App Paths`,
  Uninstall records, `%ProgramFiles%` scans), Linux checks PATH names and
  desktop entries.
- ▶️ **Run this file in a terminal** / **Open its containing folder in a
  terminal** — a submenu per detected terminal: Terminal.app / Ghostty on
  macOS, Windows Terminal / Git Bash on Windows, GNOME Terminal / Konsole /
  Ghostty on Linux.

> [!NOTE]
> The two official menu entries (open with the default application, show in the
> file manager) keep working unchanged.

## 🧩 How the application list is decided

The plugin aligns with the official `open-in-app` mechanism — the **official
resolver probed against the local machine**, no configuration:

- The host half loads the resolver library straight out of the official
  `@deepseek-ai/dsh-host-open-in-app` package, resolves every application
  through the exact locator chains the official routes use, and launches the
  resolved executable with the file path appended (`open -a <bundle> <file>` on
  macOS, a direct spawn of the resolved exe on Windows/Linux). When the
  official catalog gains an app or revises a locator spelling, the plugin
  follows with a dependency upgrade.
- The browser half reads the official probe result (`GET /open-in-app/apps`)
  and shows only the intersection: apps the official probe verified on this
  machine **and** the plugin whitelists. Newly installed apps appear after the
  next `dsh web` restart; uninstalled apps disappear immediately.
- Icons come from the official icon route (`GET /open-in-app/icon/<id>`) — the
  same real application icons as the session header (extracted from the
  executable on Windows); a generic glyph stands in when missing.

Terminal entries carry a hover submenu: **Run this file in a terminal** (the
command comes from the extension map below; unmapped extensions grey the item
out) and **Open its containing folder in a terminal** (forwarded to the
official `POST /open-in-app/open` route with the parent directory).

## 📦 Install

### Prerequisites

- **dsh** reachable — `dsh --version`, or prefix every command below with
  `npx @deepseek-ai/dsh`
- **pnpm** on PATH (the dsh plugin manager calls it): `npm install -g pnpm`

### 1. Add the plugin

```sh
# local directory (link: — source edits apply directly)
npx @deepseek-ai/dsh plugin --profile web add link:/absolute/path/to/dsh-plugin-file-actions -w

# from GitHub
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/cholf5/dsh-plugin-file-actions.git -w
```

### 2. Restart and refresh

Restart `dsh web`, then refresh the browser page (hard refresh after updates).

### 3. Verify (optional, but recommended)

Verify the route with a cookie — an unauthenticated 401 happens for every
`/api` path and proves nothing about registration:

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

The running dsh hot-loads this row (patch file watch); refresh the browser
afterwards.

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
| `pnpm was not found` (exit 127) | `npm install -g pnpm`, or use the manual fallback |
| `ERR_PNPM_ADDING_TO_ROOT` | the `-w` flag was dropped |
| Installed but the UI is unchanged | restart `dsh web` (bundle layers don't hot-reload), then refresh the page |
| The extended menu never appears on cards | fiber probing failed and the plugin fell back to the official chevron (see known limitations); check the DevTools console first |
| `dsh web` boot log says `file-actions: cannot load the official open-in-app resolver` | the official dependency did not install with the plugin — reinstall with `dsh plugin --profile web update dsh-plugin-file-actions -w`; if it persists, check the `@deepseek-ai/dsh-host-open-in-app` version against the known limitations |
| An editor/terminal is missing from the menu | the official probe did not resolve it (does it appear in the official split-button menu?) — the plugin only shows the intersection |

## ⚙️ Configuration

The host row accepts:

```yaml
- insert:
    - id: file-actions
      name: dsh-plugin-file-actions
      config:
        runCommands:              # extension (no dot) → command run ahead of the quoted file path
          py: python3             # defaults are platform-aware: Windows defaults to python / cmd /c / powershell -File, etc.
          sh: bash
          js: node
          ts: tsx
        allowExecutableBit: true  # also offer "run" for unmapped extensions that carry an execute bit
        launchTimeoutMs: 10000    # deadline for bounded host commands, and the detached-launch watch window
```

> [!WARNING]
> Override in the profile's own `cordis.patch.yml` — a patch row replaces the
> target row's whole `config` (no deep merge), so restate every key you need.

## 🔍 How it works

| Layer | File | Runs in |
| --- | --- | --- |
| Host | `lib/index.js` | Node — the Cordis Loader |
| Client | `lib/client.js` | Browser — the dsh client module system |

### Host — `lib/index.js`

The `file-actions` Cordis row registers three exact routes on the shared
authenticated `/api` channel:

| Route | Behavior |
| --- | --- |
| `GET /api/file-actions/info` | registration probe — a JSON body proves the plugin is loaded |
| `POST /api/file-actions/launch` | resolve the app through the official resolver → `launchResolved` with the file path appended (one re-resolution on a missing executable, official semantics) |
| `POST /api/file-actions/run` | build the terminal command per the table below and launch detached |

Terminal adapters (all spawned detached through the official launcher with a
credential-scrubbed environment; the terminal outlives dsh):

| Terminal | Platform | Mechanism |
| --- | --- | --- |
| Terminal.app | macOS | AppleScript `do script "cd <dir> && <command>"` |
| Ghostty | macOS / Linux | macOS `open -na Ghostty --args -e`; Linux `ghostty --working-directory=<dir> -e bash -c` |
| Windows Terminal | Windows | `wt -d <dir> cmd /k` with the command line passed through the `%FILE_ACTIONS_RUN_CMD%` environment variable — the token holds no whitespace, so wt's command-line reconstruction cannot mangle it, and cmd expands it at execution time |
| Git Bash | Windows | `<Git>/usr/bin/mintty.exe -e <Git>/usr/bin/bash.exe -c "cd <dir> && <command>; exec bash -l -i"` (`CHERE_INVOKING=1` keeps the login shell from cd-ing home) |
| GNOME Terminal / Konsole | Linux | `--working-directory` / `--workdir` + `bash -c "<command>; exec bash -i"` |

POSIX terminals keep an interactive shell after the command ends (matching
Terminal.app's behavior); every route asks the composition's `connection`
service for a rejection first — the same trust fence as the official
open-in-app host.

### Client — `lib/client.js`

A MutationObserver watches presented-file cards (`[data-presented-file]`),
reads the card's React fiber for `file` / `cwd` / `onAction` / locale, hides
the official chevron, and mounts a style-consistent plugin menu button.

> [!IMPORTANT]
> If the fiber cannot be read (upstream DOM or React changes), the official
> chevron stays in place — the plugin degrades to invisible instead of breaking
> the card.

## 🚧 Known limitations

- **The application catalog is fixed**, aligned with the official open-in-app
  philosophy: deployers cannot add their own editors from cordis.yml; extending
  the table means extending the host's `EDITOR_IDS`/`TERMINALS` and the client
  dictionaries. What appears is decided entirely by the official probe (the
  official catalog declares no win32 locators for Zed, so Zed never shows on
  Windows, for example).
- **Run commands are recognized by extension.** Files with an unmapped
  extension are greyed out (the client cannot see the execute bit); on Windows
  "execute bit" is derived from the extension (`.exe`/`.bat`/`.cmd`, etc.).
  Configure `runCommands` when needed.
- **Windows Terminal run commands go through cmd.** The command string is
  executed by `cmd /k`, so cmd metacharacters in configured values are
  expanded; run `.sh` scripts in the Git Bash terminal instead (its command
  executes in an MSYS bash context). Git Bash "run" relies on the mintty that
  ships with a full Git for Windows install.
- **The official dependency's internal module layout.** The host locates
  `@deepseek-ai/dsh-host-open-in-app`'s `lib/types/resolver.js` through its
  package manifest (shipped in the published tarball, with multiple layouts
  tried per version); if a future version changes the layout, the plugin fails
  loudly at activation instead of silently degrading.
- **Fiber-based augmentation.** If a dsh upgrade changes the presented-file
  card internals, the menu may stop appearing (the official chevron is restored
  automatically); updating the fiber probe and selectors restores it.

## 🛠️ Development

```sh
npm install
node --test test/host.test.mjs test/client.test.mjs
```

Tests inject seams (resolver / launcher / runCommand / platform) to cover the
win32, linux, and darwin adapters deterministically on any development machine,
plus one integration test that loads the real official resolver library.

> [!TIP]
> With a `link:` install, edits to `lib/client.js` hot-swap into the running
> `dsh web` without a restart; host-half changes need a restart.

## 📄 License

[MIT](./LICENSE) © cholf5
