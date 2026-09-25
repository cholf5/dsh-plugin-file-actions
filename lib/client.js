window.__ModuleLoader__.load({
  id: 'dsh-plugin-file-actions',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');
    var ReactDOMClient = require('react-dom/client');
    var ui = require('@deepseek-ai/dsh-client-ui-primitives');

    var Menu = ui.Menu;
    // dsh 0.1.7 renamed the primitives icon exports from size-suffixed names
    // (`…Outline16` / `…Outline14`) to stroke-weight variants (`…OutlineRegular`
    // / `…OutlineMedium`; per the upstream design note, Regular is the same
    // one-pixel artwork the numeric exports rendered and both accept `size`).
    // Resolve the current export with the legacy name as a fallback so one
    // bundle keeps working across dsh versions instead of rendering an
    // undefined component type (which abdicates the whole slot entry).
    var IconFolderOpen = ui.IconFolderOpenOutlineRegular ?? ui.IconFolderOpenOutline16;
    var IconCopy = ui.IconCopyOutlineRegular ?? ui.IconCopyOutline16;
    var IconCheck = ui.IconCheckOutlineRegular ?? ui.IconCheckOutline16;
    var IconCode = ui.IconCodeOutlineRegular ?? ui.IconCodeOutline16;
    // The menu affordance of the official open-in-app control. This cell
    // replaces that control, so its trigger must read as a dropdown the same
    // way the official chevron half did — the IconCode glyph this trigger
    // carried during the coexistence round is literally a `#` (four strokes:
    // two slanted verticals, two horizontals) and reads as neither a menu nor
    // an opener.
    var IconChevronDown = ui.IconChevronDownOutlineRegular ?? ui.IconChevronDownOutline14;
    var IconLink = ui.IconLinkOutlineRegular ?? ui.IconLinkOutline16;
    var IconBrowse = ui.IconBrowseOutlineRegular ?? ui.IconBrowseOutline16;
    var IconRightUp = ui.IconRightUpOutlineRegular ?? ui.IconRightUpOutline16;
    var IconSend = ui.IconSendOutlineRegular ?? ui.IconSendOutline14;
    var IconDownload = ui.IconDownloadOutlineRegular ?? ui.IconDownloadOutline16;
    var writeClipboard = ui.writeClipboard;

    var e = React.createElement;

    /** Locale namespace owned by this plugin. */
    var NS = 'fileActions';

    var zh = {
      'moreActions': '文件操作',
      'openWithDefault': '用默认应用打开',
      'openWithApp': '用 {app} 打开',
      'appDefault': '{app}（默认）',
      'revealFile': '显示文件位置',
      'copyRelativePath': '复制相对路径',
      'copyAbsolutePath': '复制绝对路径',
      'runFile': '在终端运行该文件',
      'openDirectory': '在终端打开所在目录',
      'runFileWith': '在 {app} 中运行该文件',
      'openDirectoryWith': '在 {app} 中打开所在目录',
      'copyEmailAddress': '复制邮箱地址',
      'composeEmail': '写邮件',
      'copyLink': '复制链接',
      'openInBuiltInBrowser': '在内置浏览器打开',
      'openInSystemBrowser': '在浏览器打开',
      'cloneTo': '克隆到…',
      'checkoutTo': '检出到…',
      'app.vscode': 'VS Code',
      'app.vscodeinsiders': 'VS Code Insiders',
      'app.cursor': 'Cursor',
      'app.windsurf': 'Windsurf',
      'app.zed': 'Zed',
      'app.sublimetext': 'Sublime Text',
      'app.androidstudio': 'Android Studio',
      'app.intellij': 'IntelliJ IDEA',
      'app.pycharm': 'PyCharm',
      'app.webstorm': 'WebStorm',
      'app.phpstorm': 'PhpStorm',
      'app.goland': 'GoLand',
      'app.rider': 'Rider',
      'app.rustrover': 'RustRover',
      'app.finder': '访达',
      'app.explorer': '文件资源管理器',
      'app.filemanager': '文件管理器',
      'app.ghostty': 'Ghostty',
      'app.terminal': '终端',
      'app.gitbash': 'Git Bash',
      'app.windowsterminal': 'Windows 终端',
      'app.gnometerminal': 'GNOME 终端',
      'app.konsole': 'Konsole',
      'error.noCommand': '无法确定该文件的运行命令',
      'error.unavailableApp': '该应用在本机不可用',
      'error.unavailableTerminal': '该终端在本机不可用',
      'error.appsUnavailable': '无法获取应用列表',
      'error.openFailed': '打开失败，请重试',
      'error.revealFailed': '无法显示文件位置，请重试',
      'error.launchFailed': '打开 {app} 失败',
      'error.badUrl': '无法识别的仓库地址',
      'error.targetExists': '目标目录已存在',
      'error.noPicker': '此主机没有可用的目录选择器',
      'error.cloneFailed': '克隆失败，请重试',
      'error.generic': '操作失败，请重试',
    };

    var en = {
      'moreActions': 'File actions',
      'openWithDefault': 'Open with the default app',
      'openWithApp': 'Open with {app}',
      'appDefault': '{app} (default)',
      'revealFile': 'Show file location',
      'copyRelativePath': 'Copy relative path',
      'copyAbsolutePath': 'Copy absolute path',
      'runFile': 'Run this file in terminal',
      'openDirectory': 'Open containing folder in terminal',
      'runFileWith': 'Run this file in {app}',
      'openDirectoryWith': 'Open containing folder in {app}',
      'copyEmailAddress': 'Copy email address',
      'composeEmail': 'Compose email',
      'copyLink': 'Copy link',
      'openInBuiltInBrowser': 'Open in the built-in browser',
      'openInSystemBrowser': 'Open in browser',
      'cloneTo': 'Clone to…',
      'checkoutTo': 'Check out to…',
      'app.vscode': 'VS Code',
      'app.vscodeinsiders': 'VS Code Insiders',
      'app.cursor': 'Cursor',
      'app.windsurf': 'Windsurf',
      'app.zed': 'Zed',
      'app.sublimetext': 'Sublime Text',
      'app.androidstudio': 'Android Studio',
      'app.intellij': 'IntelliJ IDEA',
      'app.pycharm': 'PyCharm',
      'app.webstorm': 'WebStorm',
      'app.phpstorm': 'PhpStorm',
      'app.goland': 'GoLand',
      'app.rider': 'Rider',
      'app.rustrover': 'RustRover',
      'app.finder': 'Finder',
      'app.explorer': 'File Explorer',
      'app.filemanager': 'Files',
      'app.ghostty': 'Ghostty',
      'app.terminal': 'Terminal',
      'app.gitbash': 'Git Bash',
      'app.windowsterminal': 'Windows Terminal',
      'app.gnometerminal': 'GNOME Terminal',
      'app.konsole': 'Konsole',
      'error.noCommand': 'No run command is known for this file type',
      'error.unavailableApp': 'This app is not available on this machine',
      'error.unavailableTerminal': 'This terminal is not available on this machine',
      'error.appsUnavailable': 'Could not load applications',
      'error.openFailed': 'Could not open. Try again.',
      'error.revealFailed': 'Could not show the file location. Try again.',
      'error.launchFailed': 'Could not open {app}',
      'error.badUrl': 'Unrecognized repository URL',
      'error.targetExists': 'The target directory already exists',
      'error.noPicker': 'No directory picker is available on this host',
      'error.cloneFailed': 'The clone failed. Try again.',
      'error.generic': 'The action failed. Try again.',
    };

    /** Official open-in-app catalog ids this plugin can launch at file level, with labels. */
    var EDITOR_IDS = [
      'cursor', 'vscode', 'vscodeinsiders', 'windsurf', 'zed', 'sublimetext',
      'androidstudio', 'intellij', 'pycharm', 'webstorm', 'phpstorm',
      'goland', 'rider', 'rustrover',
    ];
    // The official probe decides which of these exist on the host platform, so
    // the full catalog list is safe: macOS resolves ghostty/terminal, Windows
    // gitbash/windowsterminal, Linux ghostty/gnometerminal/konsole.
    var TERMINAL_IDS = ['ghostty', 'terminal', 'gitbash', 'windowsterminal', 'gnometerminal', 'konsole'];

    /**
     * Official file-manager catalog ids — first in the official catalog's menu
     * order. Unlike editors/terminals these ride the official probe alone:
     * their launch is the official POST /open-in-app/open with the file's
     * directory, the exact call the session-header split button makes, so the
     * official route itself guarantees "menu shows it, click works" and there
     * is nothing for the plugin's own resolution to confirm.
     */
    var FILE_MANAGER_IDS = ['finder', 'explorer', 'filemanager'];

    function isWindowsStylePath(value) {
      return /^[A-Za-z]:[/\\]/.test(value) || value.indexOf('\\\\') === 0;
    }

    /** Browser-safe workspace path resolution, mirroring @deepseek-ai/dsh-util-workspace-path. */
    function resolveWorkspacePath(cwd, path) {
      if (path.indexOf('/') === 0 || isWindowsStylePath(path)) return path;
      if (cwd === undefined || cwd === '') return path;
      var separator = isWindowsStylePath(cwd) && cwd.indexOf('\\') >= 0 ? '\\' : '/';
      var base = cwd.replace(/[/\\]+$/, '');
      var relative = path.replace(/^[/\\]+/, '');
      return base + separator + relative;
    }

    /** Strip the workspace root off an absolute path, mirroring the official
     * relativizeToCwd plus the separator normalization its own fileAddressFor
     * applies: newer hosts present presented-file paths absolutely, and old
     * sessions may record the root in the other separator spelling, so the
     * prefix check runs on slash-normalized forms while the slice keeps the
     * original spelling of the remainder. */
    function relativizeToCwd(text, cwd) {
      if (cwd === undefined || cwd === '') return text;
      var root = cwd.replace(/[/\\]+$/, '').replace(/\\/g, '/');
      var normalized = text.replace(/\\/g, '/');
      if (normalized.indexOf(root + '/') === 0) return text.slice(root.length + 1);
      return text;
    }

    /** Directory portion of an absolute POSIX (or Windows-style) path. */
    function dirnameOf(path) {
      var normalized = path.replace(/\\/g, '/');
      var index = normalized.lastIndexOf('/');
      if (index <= 0) return index === 0 ? '/' : normalized;
      if (index === 2 && normalized[1] === ':') return normalized.slice(0, 3);
      return normalized.slice(0, index);
    }

    /** Lowercase extension of a workspace path, '' when the basename has none. */
    function extensionOf(path) {
      var base = (path.split('/').pop() || '').split('\\').pop() || '';
      var index = base.lastIndexOf('.');
      return index <= 0 ? '' : base.slice(index + 1).toLowerCase();
    }

    /**
     * Touch-primary pointer (phones, tablets). The Menu primitive opens
     * submenus to the RIGHT of the parent row (`left: calc(100% + 10px)`,
     * Menu.module.css) with no viewport clamp, so beside a right-aligned
     * 218px card the ~163px submenu lands off-screen on a phone — the rows
     * look dead. Coarse pointers get the terminal actions flattened into the
     * top level instead (verified at 390px: the submenu rendered at
     * x 362..540 against a 390px viewport).
     */
    function coarsePointer() {
      try {
        if (typeof window === 'undefined' || window.matchMedia === null || window.matchMedia === undefined) return false;
        return window.matchMedia('(pointer: coarse)').matches === true;
      } catch (error) {
        return false;
      }
    }

    /** Fetch one JSON body with its status; never rejects. */
    function fetchJson(url, options) {
      return fetch(url, options).then(function (res) {
        return res.json().then(
          function (data) { return { ok: res.ok, status: res.status, data: data }; },
          function () { return { ok: false, status: res.status, data: null }; },
        );
      }, function () {
        return { ok: false, status: 0, data: null };
      });
    }

    function postJson(url, body) {
      return fetchJson(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    /** One application's real bundle icon with a generic-glyph fallback (official route). */
    function AppIcon(props) {
      var failedState = React.useState(false);
      var failed = failedState[0];
      var setFailed = failedState[1];
      if (failed) {
        return e('svg', { width: props.size, height: props.size, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true },
          e('rect', { x: 3, y: 3, width: 18, height: 18, rx: 5 }));
      }
      return e('img', {
        src: '/open-in-app/icon/' + props.id,
        width: props.size, height: props.size, alt: '', 'aria-hidden': true, draggable: false,
        onError: function () { setFailed(true); },
      });
    }

    /**
     * One OS-associated application's icon. Unlike the catalog ids above, the
     * per-file association query embeds the real bundle artwork in the
     * response itself (the official `NativeFileApplication` contract: a PNG or
     * SVG data URL, or null when the desktop supplies none), so the row shows
     * the OS image directly and falls back to the official generic glyph for a
     * null or broken icon.
     */
    function AssocIcon(props) {
      var failedState = React.useState(false);
      var failed = failedState[0];
      var setFailed = failedState[1];
      if (props.source === null || props.source === undefined || failed) {
        return IconRightUp === undefined ? null : e(IconRightUp, { size: 16 });
      }
      return e('img', {
        src: props.source,
        width: 16, height: 16, alt: '', 'aria-hidden': true, draggable: false,
        onError: function () { setFailed(true); },
      });
    }

    /** Association-list lifecycle markers; `null` would collide with a real value. */
    var ASSOC_LOADING = 'loading';
    var ASSOC_FAILED = 'failed';

    /** The embedded app-icon form the official native-file-application contract allows. */
    var APP_ICON_DATA_URL_RE = /^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

    /**
     * Validate one association response without trusting it. The official
     * browser-side validator throws on the first malformed entry (the whole
     * control then degrades); this mirror is deliberately forgiving instead —
     * a hostile or drifted Host loses only the rows it could not describe.
     * Icons must be the embedded base64 PNG/SVG data URLs the official
     * contract promises, anything else becomes the generic glyph.
     * @returns the usable entries, or null when the body is not a list at all.
     */
    function parseApplications(value) {
      if (!Array.isArray(value)) return null;
      var applications = [];
      for (var index = 0; index < value.length; index++) {
        var entry = value[index];
        if (entry === null || typeof entry !== 'object') continue;
        if (typeof entry.id !== 'string' || entry.id === '') continue;
        if (typeof entry.name !== 'string') continue;
        var icon = typeof entry.icon === 'string' && APP_ICON_DATA_URL_RE.test(entry.icon) ? entry.icon : null;
        applications.push({ id: entry.id, name: entry.name, 'default': entry['default'] === true, icon: icon });
      }
      return applications;
    }

    /**
     * The rows this cell absorbed from the official open-in-app control it
     * shadows: the OS default application, the per-file association list (with
     * the desktop's own icons), and reveal. Their launch goes through the
     * seat's `onAction`, never a plugin route — the owner's `actionUrl` is the
     * only authorized address for these coordinates.
     *
     * `available:false` means the serving Host has no desktop at all: the
     * official control rendered nothing in that state, so these rows vanish
     * too and the plugin's terminal/copy sections carry the card alone.
     * `pending` (the owner is already opening/revealing this file) and the
     * association read in flight both gray the rows out rather than removing
     * them, so the menu never changes height under the cursor.
     */
    function absorbedRows(native, t) {
      if (native === undefined || native === null || native.available !== true) return [];
      var busy = native.pending === true || native.loading === true;
      var applications = Array.isArray(native.applications) ? native.applications : [];
      var preferred = null;
      applications.forEach(function (app) {
        if (preferred === null && app['default'] === true) preferred = app;
      });
      var rows = [{
        id: 'fa:open',
        icon: e(AssocIcon, { source: preferred === null ? null : preferred.icon }),
        label: preferred === null ? t('openWithDefault') : t('openWithApp', { app: preferred.name }),
        disabled: busy,
      }];
      if (native.failed === true) {
        // The association read failed: the default still opens (the owner
        // resolves it), but there is no list to offer — the official
        // placeholder row, localized by this plugin's dictionary.
        rows.push({ id: 'fa:osapp-error', label: t('error.appsUnavailable'), disabled: true });
      }
      applications.forEach(function (app) {
        rows.push({
          id: 'fa:osapp:' + app.id,
          icon: e(AssocIcon, { source: app.icon }),
          label: app['default'] === true ? t('appDefault', { app: app.name }) : app.name,
          disabled: busy,
        });
      });
      rows.push({ id: 'fa:reveal', icon: e(IconFolderOpen, { size: 16 }), label: t('revealFile'), disabled: busy });
      return rows;
    }

    /**
     * Build one menu entry from the shared plugin state. `cardProps` is the
     * presented-file card's props, or a `{ file: { path }, cwd }` stand-in read
     * from a message file link. `mode` picks the surface:
     *
     * - `'slot'` — the deliverable card's `deliverables.file.actions` cell.
     *   This cell TAKES OVER the shipped `open-in-app` cell (same id, lower
     *   priority), so it owns the card's single dropdown end to end: the
     *   absorbed official rows (default application, per-file OS association
     *   list, reveal) lead, the plugin's own terminal rows follow, and the
     *   browser-side copy entries close. `native` carries the owner's seat
     *   contract (`available` / `pending` plus the association list read from
     *   the owner's own authorized `actionUrl`).
     * - full (anything else) — the message-link context menu. It keeps every
     *   section, the plugin's own editor/file-manager catalog included: a
     *   message link has no official control behind it.
     */
    function buildItems(cardProps, state, t, actions, mode, native) {
      var file = cardProps.file;
      var full = mode !== 'slot';
      var items = [];
      // The absorbed official rows only exist on the card: the link menu never
      // has an owner-provided actionUrl or desktop availability.
      var absorbed = full ? [] : absorbedRows(native, t);
      absorbed.forEach(function (item) { items.push(item); });
      // File managers ride the official probe alone (see FILE_MANAGER_IDS);
      // editors and terminals wait for the plugin info and then intersect the
      // official probe with it.
      var fileManagers = full
        ? (state.officialApps || []).filter(function (id) {
          return FILE_MANAGER_IDS.indexOf(id) >= 0;
        })
        : [];
      var editors = [];
      var terminals = [];
      var runnable = false;
      if (state.info !== null && state.info !== undefined) {
        var runExtensions = state.info.runExtensions;
        // Show an app only when BOTH the official probe and this plugin's own
        // resolution verified it: the two resolver copies (the host dsh's and
        // the plugin's pinned one) may differ in version, and this
        // intersection makes the "menu shows it, click 400s" failure
        // impossible. Older hosts without `available` keep the official
        // intersection only.
        var available = state.info.available;
        var pick = function (whitelist) {
          var matched = (state.officialApps || []).filter(function (id) {
            return whitelist.indexOf(id) >= 0;
          });
          if (available === null || available === undefined) return matched;
          return matched.filter(function (id) { return available.indexOf(id) >= 0; });
        };
        editors = full ? pick(EDITOR_IDS) : [];
        terminals = pick(TERMINAL_IDS);
        var extension = extensionOf(file.path);
        runnable = extension === '' || (runExtensions !== undefined && runExtensions.indexOf(extension) >= 0);
      }
      var hasLeads = absorbed.length > 0 || fileManagers.length > 0 || editors.length > 0;
      fileManagers.forEach(function (id) {
        items.push({
          id: 'fa:fm:' + id,
          icon: e(AppIcon, { id: id, size: 16 }),
          label: t('app.' + id),
        });
      });
      editors.forEach(function (id) {
        items.push({
          id: 'fa:app:' + id,
          icon: e(AppIcon, { id: id, size: 16 }),
          label: t('app.' + id),
        });
      });
      if (terminals.length > 0 && hasLeads) items.push({ type: 'separator', id: 'fa:sep-terms' });
      var flattenTerminals = coarsePointer();
      terminals.forEach(function (id) {
        if (flattenTerminals) {
          // Touch: no hover to open a side card, and the side card would be
          // clamped off the narrow viewport anyway — same dispatch ids, one
          // row per action, named by the terminal.
          var terminal = t('app.' + id);
          items.push({
            id: 'fa:run:' + id,
            icon: e(IconCode, { size: 16 }),
            label: t('runFileWith', { app: terminal }),
            disabled: !runnable,
          });
          items.push({
            id: 'fa:opendir:' + id,
            icon: e(IconFolderOpen, { size: 16 }),
            label: t('openDirectoryWith', { app: terminal }),
          });
          return;
        }
        items.push({
          id: 'fa:term:' + id,
          icon: e(AppIcon, { id: id, size: 16 }),
          label: t('app.' + id),
          submenu: [
            { id: 'fa:run:' + id, icon: e(IconCode, { size: 16 }), label: t('runFile'), disabled: !runnable },
            { id: 'fa:opendir:' + id, icon: e(IconFolderOpen, { size: 16 }), label: t('openDirectory') },
          ],
        });
      });
      if (hasLeads || terminals.length > 0) items.push({ type: 'separator', id: 'fa:sep-copies' });
      items.push(
        { id: 'fa:copy-rel', icon: e(IconCopy, { size: 16 }), label: t('copyRelativePath') },
        { id: 'fa:copy-abs', icon: e(IconCopy, { size: 16 }), label: t('copyAbsolutePath') },
      );
      if (actions.error !== null && actions.error !== undefined) {
        items.push({ type: 'separator', id: 'fa:sep-err' });
        items.push({ id: 'fa:error', label: actions.error, disabled: true, danger: true });
      }
      return items;
    }

    /**
     * One menu selection, shared by the card menu and the message-link context
     * menu. `cardProps` is the real card props or the link stand-in; `deps`
     * carries the surface's own close/error callbacks and the dictionary.
     */
    function dispatchSelection(id, cardProps, deps) {
      var absolute = resolveWorkspacePath(cardProps.cwd, cardProps.file.path);
      var t = deps.t;
      var fail = function (result, app) {
        var code = result.data !== null && result.data !== undefined && result.data.code !== undefined
          ? result.data.code : '';
        deps.setError(errorTextOf(code, t, app));
      };
      if (id === 'fa:copy-rel') {
        deps.close();
        writeClipboard(relativizeToCwd(cardProps.file.path, cardProps.cwd));
        return;
      }
      if (id === 'fa:copy-abs') {
        deps.close();
        writeClipboard(absolute);
        return;
      }
      if (id === 'fa:open' || id === 'fa:reveal' || id.indexOf('fa:osapp:') === 0) {
        // The absorbed official rows. These coordinates are addressed by the
        // owner's own authorized actionUrl, so the call must ride the seat's
        // onAction (which also publishes the card's open/reveal status) and
        // never a plugin route. The returned failure code lands in this
        // plugin's own error row instead of the official toast.
        if (typeof deps.onAction !== 'function') return;
        var reveal = id === 'fa:reveal';
        var application = id.indexOf('fa:osapp:') === 0 ? id.slice(9) : undefined;
        var announce = function (failure) {
          if (failure === null || failure === undefined) { deps.close(); return; }
          deps.setError(t(failure === 'revealError' ? 'error.revealFailed' : 'error.openFailed'));
        };
        deps.onAction(reveal ? 'reveal' : 'open', application).then(announce, function () {
          announce(reveal ? 'revealError' : 'openError');
        });
        return;
      }
      if (id.indexOf('fa:fm:') === 0) {
        // The official launch: the session-header split button's exact call,
        // with the file's directory standing in for the workspace directory.
        var manager = id.slice(6);
        postJson('/open-in-app/open', { app: manager, path: dirnameOf(absolute) }).then(function (result) {
          if (result.ok) deps.close(); else fail(result, t('app.' + manager));
        });
        return;
      }
      if (id.indexOf('fa:app:') === 0) {
        postJson('/api/file-actions/launch', { app: id.slice(7), path: absolute }).then(function (result) {
          if (result.ok) deps.close(); else fail(result, t('app.' + id.slice(7)));
        });
        return;
      }
      if (id.indexOf('fa:run:') === 0) {
        postJson('/api/file-actions/run', { app: id.slice(7), path: absolute }).then(function (result) {
          if (result.ok) deps.close(); else fail(result, t('app.' + id.slice(7)));
        });
        return;
      }
      if (id.indexOf('fa:opendir:') === 0) {
        var app = id.slice(11);
        postJson('/open-in-app/open', { app: app, path: dirnameOf(absolute) }).then(function (result) {
          if (result.ok) deps.close(); else fail(result, t('app.' + app));
        });
      }
    }

    /** The localized line for one route failure code; '' codes take the generic. */
    function errorTextOf(code, t, app) {
      if (code === 'no-command') return t('error.noCommand');
      if (code === 'unavailable-app') return t('error.unavailableApp');
      if (code === 'unavailable-terminal') return t('error.unavailableTerminal');
      if (code === 'launch-failed') return t('error.launchFailed', { app: app });
      if (code === 'bad-url') return t('error.badUrl');
      if (code === 'target-exists') return t('error.targetExists');
      if (code === 'no-picker') return t('error.noPicker');
      if (code === 'clone-failed') return t('error.cloneFailed');
      return t('error.generic');
    }

    // The official message sanitizer keeps only http/https/mailto hrefs, so
    // svn:// and git:// links never render as anchors — repository URLs in
    // those schemes surface as inline `code` text, which the classifier reads.
    var GIT_SSH_URL_RE = /^(?:git|ssh):\/\/\S+$/i;
    var GIT_SCP_RE = /^git@[A-Za-z0-9._-]+[:/]\S+$/i;
    var GIT_HTTPS_RE = /^https?:\/\/\S+\.git$/i;
    var SVN_URL_RE = /^(?:svn|svn\+ssh|svn\+https?):\/\/\S+$/i;
    var MAILTO_HREF_RE = /^mailto:\S+/i;
    var HTTP_HREF_RE = /^https?:\/\//i;
    /**
     * The message file links: the official markdown renders every file mention
     * and every markdown file link as a button carrying the path in its
     * `title` (shared hashed fileMention class; the input area's reference
     * chips share the class but mark themselves with `data-ref-chip`, so they
     * are excluded).
     */
    var FILE_LINK_SELECTOR = 'button[class*="fileMention"][title]:not([data-ref-chip])';

    /**
     * Classify one right-click target inside the message flow: file links keep
     * their existing menu, http(s) anchors and inline `code` elements whose
     * whole text is a repository URL gain the URL menus. Null means nothing
     * applies and the native menu stays. Plain (non-code) text is deliberately
     * out of scope — a text node has no boundary, so a bare git@host:path
     * sentence fragment is not a menu target.
     */
    function classifyContextTarget(target) {
      var fileButton = target.closest(FILE_LINK_SELECTOR);
      if (fileButton !== null) {
        var filePath = fileButton.getAttribute('title');
        return filePath !== null && filePath !== '' ? { kind: 'file', path: filePath } : null;
      }
      var anchor = target.closest('a[href]');
      if (anchor !== null) {
        var href = anchor.getAttribute('href');
        if (href === null || href === '') return null;
        if (MAILTO_HREF_RE.test(href)) {
          return { kind: 'email', value: href, address: href.slice(7).split('?')[0] };
        }
        if (HTTP_HREF_RE.test(href)) {
          return { kind: GIT_HTTPS_RE.test(href) ? 'git' : 'http', value: href };
        }
        return null;
      }
      var code = target.closest('code');
      if (code !== null) {
        var text = (code.textContent || '').trim();
        if (GIT_SSH_URL_RE.test(text) || GIT_SCP_RE.test(text) || GIT_HTTPS_RE.test(text)) {
          return { kind: 'git', value: text };
        }
        if (SVN_URL_RE.test(text)) return { kind: 'svn', value: text };
      }
      return null;
    }

    /**
     * One URL menu: entries per link kind. `capabilities` reports which
     * optional host seats exist (the built-in browser tab, the directory
     * picker) so an unavailable action never renders as a dead end.
     */
    function buildLinkItems(target, capabilities, t) {
      if (target.kind === 'email') {
        return [
          { id: 'fa:link:copy-email', icon: e(IconCopy, { size: 16 }), label: t('copyEmailAddress') },
          { id: 'fa:link:compose', icon: e(IconSend, { size: 16 }), label: t('composeEmail') },
        ];
      }
      if (target.kind === 'http') {
        var httpItems = [{ id: 'fa:link:copy', icon: e(IconLink, { size: 16 }), label: t('copyLink') }];
        if (capabilities.builtInBrowser) {
          httpItems.push({ id: 'fa:link:browse', icon: e(IconBrowse, { size: 16 }), label: t('openInBuiltInBrowser') });
        }
        httpItems.push({ id: 'fa:link:external', icon: e(IconRightUp, { size: 16 }), label: t('openInSystemBrowser') });
        return httpItems;
      }
      return [
        { id: 'fa:link:copy', icon: e(IconLink, { size: 16 }), label: t('copyLink') },
        {
          id: target.kind === 'git' ? 'fa:link:clone' : 'fa:link:checkout',
          icon: e(IconDownload, { size: 16 }),
          label: target.kind === 'git' ? t('cloneTo') : t('checkoutTo'),
          disabled: !capabilities.picker,
        },
      ];
    }

    /**
     * One URL-menu selection. Clone/checkout keep the menu open while the
     * directory chooser and the host's VCS run — the outcome lands where the
     * click happened (success closes, failure shows the error row). Cancelling
     * the chooser closes quietly.
     */
    function dispatchLinkSelection(id, target, deps) {
      if (id === 'fa:link:copy-email') {
        deps.close();
        writeClipboard(target.address);
        return;
      }
      if (id === 'fa:link:compose') {
        deps.close();
        openExternalScheme(target.value);
        return;
      }
      if (id === 'fa:link:copy') {
        deps.close();
        writeClipboard(target.value);
        return;
      }
      if (id === 'fa:link:browse') {
        deps.close();
        deps.openBuiltInBrowser(target.value);
        return;
      }
      if (id === 'fa:link:external') {
        deps.close();
        window.open(target.value, '_blank', 'noopener,noreferrer');
        return;
      }
      if (id === 'fa:link:clone' || id === 'fa:link:checkout') {
        var vcs = id === 'fa:link:clone' ? 'git' : 'svn';
        deps.pickDirectory().then(function (parent) {
          if (parent === null || parent === undefined || parent === '') {
            deps.close();
            return;
          }
          postJson('/api/file-actions/clone', { url: target.value, vcs: vcs, parent: parent }).then(function (result) {
            if (result.ok) deps.close(); else deps.fail(result);
          });
        }, function () {
          deps.fail({ data: { code: 'no-picker' } });
        });
      }
    }

    /** Hand one non-http URL (mailto) to the browser's external-protocol handler. */
    function openExternalScheme(href) {
      var anchor = document.createElement('a');
      anchor.href = href;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }

    /** Client half: own every presented-file card's single dropdown — the official rows it shadows plus the plugin's terminal and copy sections. */
    async function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, 'file-actions: dictionaries');
      var t = ctx.locale.bind(NS);

      /** Shared plugin state; read at render time, refreshed after the initial fetches. */
      var state = { officialApps: null, info: null };
      /** Slot cells and the context menu subscribe; fetches notify on landing. */
      var stateListeners = new Set();
      function subscribeState(listener) {
        stateListeners.add(listener);
        return function () { stateListeners.delete(listener); };
      }
      function notifyState() {
        stateListeners.forEach(function (listener) { listener(); });
      }

      /** The workspace-resolved path from one presented-file card: the preview
       * button's title carries it (0.1.7 no longer hands the path down through
       * the slot input). Null when the official DOM drifted. */
      function cardPathOf(card) {
        var preview = card.querySelector('button[title]');
        var title = preview === null ? null : preview.getAttribute('title');
        return title === null || title === '' ? null : title;
      }

      /**
       * One card's dropdown menu, rendered as the official
       * deliverables.file.actions slot cell (the 0.1.7 contributed-actions
       * architecture) — and registered under the SHIPPED cell's own id, so it
       * replaces that cell instead of stacking a second control beside it.
       * The card therefore carries exactly one dropdown, and this cell owns
       * the whole of it: the official default-application / OS association /
       * reveal rows are absorbed into `buildItems`' slot mode (they dispatch
       * through the seat's `onAction`, the owner's authorized route), the
       * plugin's terminal rows follow, and the browser-side copy entries
       * close the menu.
       *
       * The file path is read through the cell's own mounted host (the cell
       * renders inside the card's actions row) rather than a React fiber walk:
       * refs resolve before paint, so every open/re-render after mount sees
       * the card. A first paint without a readable path renders the trigger
       * with no items; the mount refresh then either fills the items or, when
       * the official DOM drifted, degrades the cell to nothing.
       */
      function CardMenu(props) {
        var hostRef = React.useRef(null);
        var openState = React.useState(false);
        var open = openState[0];
        var setOpen = openState[1];
        var errorState = React.useState(null);
        var error = errorState[0];
        var setError = errorState[1];
        var tickState = React.useState(0);
        var setTick = tickState[1];
        // The OS association list for THIS card, read from the owner's own
        // authorized actionUrl — the same GET the shipped open-in-app cell
        // issued, so a per-file query never bypasses the owning Session's
        // authorization. The answer is paired with the route that produced it:
        // while the pair is stale (the card moved to another file) the rows
        // fall back to the loading shape rather than showing a sibling file's
        // applications.
        var associationState = React.useState({ url: null, value: ASSOC_LOADING });
        var association = associationState[0];
        var setAssociation = associationState[1];

        // The owning session's workspace directory through the seat's standard
        // session props — the same hook the header cwd recorder consumes.
        var cwd = props.useSessions(function (sessionState) {
          var row = props.sessionId === undefined || props.sessionId === null
            ? undefined : sessionState.byId[props.sessionId];
          return row === null || row === undefined ? undefined : row.cwd;
        });

        // One refresh after mount (refs resolve) fills the items or degrades
        // the cell; the shared-state subscription re-renders when the official
        // probe or the plugin's own info lands after the cell mounted.
        React.useEffect(function () {
          setTick(function (value) { return value + 1; });
          return subscribeState(function () { setTick(function (value) { return value + 1; }); });
        }, []);

        // The association read. It starts only for a desktop that can answer
        // (an unavailable Host answers 409) and is cancelled on unmount or on
        // a route change, so a re-rendered card never publishes a stale list.
        React.useEffect(function () {
          if (props.available !== true) return undefined;
          var url = props.actionUrl;
          if (url === undefined || url === null || url === '') return undefined;
          var cancelled = false;
          fetchJson(url).then(function (result) {
            if (cancelled) return;
            var applications = result.ok ? parseApplications(result.data) : null;
            setAssociation({ url: url, value: applications === null ? ASSOC_FAILED : applications });
          });
          return function () { cancelled = true; };
        }, [props.actionUrl, props.available]);

        var host = hostRef.current;
        var card = host === null || host === undefined || typeof host.closest !== 'function'
          ? null : host.closest('[data-presented-file]');
        var path = card === null ? null : cardPathOf(card);
        if (path === null && host !== null && host !== undefined) {
          // Mounted and still unreadable — the official DOM drifted; render
          // nothing rather than a dead trigger (the degrade-invisible rule).
          return null;
        }

        var associated = association.url === props.actionUrl ? association.value : ASSOC_LOADING;
        // An owner that handed over no route at all can never be asked for the
        // association list; report it the way a failed read is reported instead
        // of leaving the rows gray forever.
        var addressed = typeof props.actionUrl === 'string' && props.actionUrl !== '';
        var items = path === null
          ? []
          : buildItems({ file: { path: path }, cwd: cwd }, state, props.t, { error: error }, 'slot', {
            available: props.available === true,
            pending: props.pending === true,
            loading: addressed && associated === ASSOC_LOADING,
            failed: !addressed || associated === ASSOC_FAILED,
            applications: Array.isArray(associated) ? associated : [],
          });

        // Open ABOVE the trigger. The official menu opens downward and fits
        // under the card, but this plugin's menu is far taller and deliverable
        // cards render at the end of a turn where the space below is small:
        // the official placement then hits the viewport clamp
        // (y = vh - listHeight - 12) and the panel lands on the trigger button.
        // side:'top' grows the panel upward from the trigger's top edge instead.
        return e('span', {
          ref: hostRef,
          'data-fa-slot': '1',
          style: { display: 'inline-flex', flex: 'none', alignItems: 'center', alignSelf: 'center' },
        }, e(Menu, {
          open: open,
          autoFocus: true,
          portal: true,
          align: 'end',
          side: 'top',
          items: items,
          onSelect: function (id) {
            dispatchSelection(id, { file: { path: path }, cwd: cwd }, {
              t: props.t,
              close: function () { setOpen(false); },
              setError: setError,
              onAction: props.onAction,
            });
          },
          onClose: function () { setOpen(false); },
          anchor: e('button', {
            type: 'button',
            'data-fa-trigger': '1',
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            'aria-label': props.t('moreActions'),
            title: props.t('moreActions'),
            onClick: function () { setOpen(function (value) { return !value; }); },
          }, e(IconChevronDown, { size: 11 })),
        }));
      }

      // The official deliverables card seat, TAKEN OVER: the plugin registers
      // under the shipped cell's own id 'open-in-app' at priority -10. The
      // slot ledger sorts each list slot by (priority, order) and keeps the
      // first live entry per id, and register() only rejects a same-id
      // collision at the SAME priority — naming the shadowing remedy itself
      // ("register at a different priority to shadow it (lowest renders)").
      // So the official FileRouteAction stops rendering and this cell is the
      // card's only control; it re-offers what the official control was good
      // at instead of leaving it to a second button. ctx.slots.inject runs the
      // callback per declaration lifetime and unwinds the registration when
      // this plugin's fiber unloads — the same lifecycle the session-header
      // cwd recorder below rides.
      ctx.slots.inject('deliverables.file.actions', function () {
        return ctx.slots.register({
          name: 'deliverables.file.actions',
          id: 'open-in-app',
          priority: -10,
          locale: NS,
        }, CardMenu);
      });

      /**
       * Shared state of the message-link context menu; `cwd` is published by
       * the recorder cell below, and `target` is the classified link under the
       * cursor. The whole object is replaced on every open, and the render
       * closures always read the variable, never a stale copy.
       */
      var contextState = { open: false, x: 0, y: 0, target: null, cwd: null, error: null };
      var contextContainer = document.createElement('div');
      contextContainer.setAttribute('data-fa-context', '1');
      document.body.appendChild(contextContainer);
      var contextRoot = ReactDOMClient.createRoot(contextContainer);

      /** Optional seats the URL menus use, re-read on every menu render. The
       * remote.namespace read rides the declared inject key; the try/catch
       * keeps a deployment without the picker namespace from crashing the
       * menu render — the entries degrade to disabled instead. */
      function contextCapabilities() {
        var right = ctx.get('sidebarRight');
        var tabs = ctx.get('sidebarRightTabs');
        var picker = undefined;
        try {
          var remote = ctx.get('remote');
          picker = remote === null || remote === undefined ? undefined : remote.directoryPicker;
        } catch (error) {
          picker = undefined;
        }
        return {
          builtInBrowser: right !== null && right !== undefined && tabs !== null && tabs !== undefined
            && tabs.get('browser') !== undefined,
          picker: picker !== null && picker !== undefined && typeof picker.pick === 'function',
        };
      }

      /**
       * The official directory picker's pick remote (the workspace flow's own
       * call): resolves the chosen absolute directory, or null on cancel.
       * Rejects when the deployment carries no picker capability.
       */
      function pickDirectory() {
        var picker;
        try {
          var remote = ctx.get('remote');
          picker = remote === null || remote === undefined ? undefined : remote.directoryPicker;
        } catch (error) {
          picker = undefined;
        }
        if (picker === null || picker === undefined || typeof picker.pick !== 'function') {
          return Promise.reject(new Error('file-actions: no directory picker on this deployment'));
        }
        return picker.pick().then(function (result) {
          if (result === null || result === undefined) return null;
          if (result.ok !== true) throw new Error('file-actions: directory picker failed');
          return result.value;
        });
      }

      /** The built-in browser tab when the deployment ships it — the official
       * openExternalLink behavior — else the system browser. */
      function openBuiltInBrowser(url) {
        var right = ctx.get('sidebarRight');
        if (right === null || right === undefined) {
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        right.openTab('browser', { params: { url: url } });
      }

      /** Publish the current context state into the context-menu root. */
      function renderContextMenu() {
        contextRoot.render(e(LinkMenu, {
          menu: contextState,
          state: state,
          t: t,
          capabilities: contextCapabilities,
          pickDirectory: pickDirectory,
          openBuiltInBrowser: openBuiltInBrowser,
          close: function () { contextState.open = false; renderContextMenu(); },
          setError: function (message) { contextState.error = message; if (contextState.open) renderContextMenu(); },
          onClose: function () { contextState.open = false; renderContextMenu(); },
        }));
      }

      /**
       * The right-click context menu over one message link — a presented-file
       * link (the full file menu) or a URL (email / http / git / svn menus) —
       * anchored at the cursor through Menu's getAnchorRect (portal mode; the
       * viewport clamp keeps the panel on screen).
       */
      function LinkMenu(props) {
        var menu = props.menu;
        var target = menu.target;
        var open = menu.open === true && target !== null && target !== undefined;
        var items = [];
        if (open) {
          items = target.kind === 'file'
            ? buildItems({ file: { path: target.path }, cwd: menu.cwd }, props.state, props.t, { error: menu.error })
            : buildLinkItems(target, props.capabilities(), props.t);
        }
        return e(Menu, {
          open: open,
          autoFocus: true,
          portal: true,
          align: 'start',
          side: 'bottom',
          items: items,
          onSelect: function (id) {
            if (target === null || target === undefined) return;
            if (target.kind === 'file') dispatchSelection(id, { file: { path: target.path }, cwd: menu.cwd }, props);
            else dispatchLinkSelection(id, target, props);
          },
          onClose: props.onClose,
          getAnchorRect: function () {
            return { left: menu.x, right: menu.x, top: menu.y, bottom: menu.y };
          },
          anchor: e('span', { 'data-fa-context-anchor': '1' }),
        });
      }

      /** Replace the context state with one open menu at x/y over `link`. */
      function openContextMenu(x, y, link) {
        if (contextState.open && sameContextLink(contextState.target, link)) {
          // Already showing this link's menu — a touch long-press may have
          // opened it just before the browser's own contextmenu event (the
          // Android hold fires one) arrived. Keep the open state.
          return;
        }
        contextState = {
          open: true,
          x: x,
          y: y,
          target: link,
          cwd: contextState.cwd,
          error: null,
        };
        renderContextMenu();
      }

      /** The two classifications match when they name the same link. */
      function sameContextLink(a, b) {
        if (a === null || a === undefined || b === null || b === undefined) return false;
        if (a.kind !== b.kind) return false;
        if (a.kind === 'file') return a.path === b.path;
        return a.value === b.value;
      }

      function onContextMenu(event) {
        var target = event.target;
        if (target === null || target === undefined || typeof target.closest !== 'function') return;
        var link = classifyContextTarget(target);
        if (link === null) return;
        event.preventDefault();
        openContextMenu(event.clientX, event.clientY, link);
      }

      document.addEventListener('contextmenu', onContextMenu);

      /**
       * Long-press opens the same menu on touch devices, where no right-click
       * exists: iOS never fires contextmenu for a hold (it shows the link
       * preview callout instead — suppressed by the plugin stylesheet below),
       * and Android fires its own contextmenu mid-hold, which the
       * openContextMenu guard deduplicates. A press that moves beyond the
       * slop is a scroll gesture and cancels; the release of a fired press is
       * preventDefault-ed so the browser does not synthesize a click that
       * would follow the link behind the just-opened menu.
       */
      var LONG_PRESS_MS = 500;
      var LONG_PRESS_SLOP = 10;
      var press = { timer: null, x: 0, y: 0, link: null, opened: false };

      function cancelPress() {
        if (press.timer !== null) {
          clearTimeout(press.timer);
          press.timer = null;
        }
        press.link = null;
        press.opened = false;
      }

      function onTouchStart(event) {
        cancelPress();
        if (event.touches.length !== 1) return;
        var touch = event.touches[0];
        var target = touch.target;
        if (target === null || target === undefined || typeof target.closest !== 'function') return;
        var link = classifyContextTarget(target);
        if (link === null) return;
        press.x = touch.clientX;
        press.y = touch.clientY;
        press.link = link;
        press.timer = setTimeout(function () {
          press.timer = null;
          press.opened = true;
          openContextMenu(press.x, press.y, press.link);
        }, LONG_PRESS_MS);
      }

      function onTouchMove(event) {
        if (press.timer === null) return;
        var touch = event.touches[0];
        if (touch === null || touch === undefined) {
          cancelPress();
          return;
        }
        if (Math.abs(touch.clientX - press.x) > LONG_PRESS_SLOP
          || Math.abs(touch.clientY - press.y) > LONG_PRESS_SLOP) {
          cancelPress();
        }
      }

      function onTouchEnd(event) {
        if (press.opened && event.cancelable !== false) event.preventDefault();
        cancelPress();
      }

      document.addEventListener('touchstart', onTouchStart, { passive: true });
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onTouchEnd, { passive: false });
      document.addEventListener('touchcancel', cancelPress, { passive: true });

      /**
       * The conversation-flow targets of the context menu must not summon the
       * iOS link-preview callout or the selection loupe on a hold — the
       * long-press is this plugin's menu gesture on touch. Inline code keeps
       * code blocks (pre) selectable; the plugin only menus inline code.
       */
      var styleTag = document.createElement('style');
      styleTag.setAttribute('data-plugin', 'dsh-plugin-file-actions');
      styleTag.textContent = [
        // The card menu trigger stands in for the official 0.1.7 compact
        // control, so it borrows that control's per-half geometry and colors
        // (24px tall, 9px radius, secondary label, hover fill) rather than a
        // bare icon box — the official classes are hashed, so the plugin
        // carries its own. The official pill's 0.5px `--dsw-alias-border-l4`
        // outline is deliberately not drawn: the plugin's trigger is the
        // card's single control, not one half of a split pair, and a border
        // around a lone chevron reads as an empty button.
        '[data-fa-trigger] {',
        'display: inline-flex; align-items: center; justify-content: center;',
        'height: 24px; padding: 0 6px; border: 0; border-radius: 9px;',
        'background: none; color: var(--dsw-alias-label-secondary); cursor: pointer;',
        '}',
        '[data-fa-trigger]:hover, [data-fa-trigger]:focus-visible {',
        'background: var(--dsw-alias-interactive-bg-hover);',
        '}',
        // The conversation-flow targets of the context menu must not summon
        // the iOS link-preview callout or the selection loupe on a hold —
        // the long-press is this plugin's menu gesture on touch. Inline code
        // keeps code blocks (pre) selectable; the plugin only menus inline
        // code.
        '[data-chat-turn] a[href],',
        '[data-chat-turn] :not(pre) > code {',
        '-webkit-touch-callout: none;',
        '-webkit-user-select: none;',
        'user-select: none;',
        '}',
      ].join('\n');
      (document.head || document.body).appendChild(styleTag);

      /**
       * Header utilities cell that publishes the viewed session's workspace
       * directory for the context menu. Renders nothing: the cell exists for
       * its standard props (sessionId + useSessions — the same seats the
       * official open-in-app button consumes). A subagent aside rendering its
       * own header last would win; aside sessions share the workspace in
       * practice.
       */
      function SessionCwdRecorder(props) {
        var cwd = props.useSessions(function (sessionState) {
          var row = props.sessionId === undefined || props.sessionId === null
            ? undefined : sessionState.byId[props.sessionId];
          return row === null || row === undefined ? undefined : row.cwd;
        });
        React.useEffect(function () {
          contextState.cwd = cwd === undefined || cwd === '' ? null : cwd;
          renderContextMenu();
        }, [cwd]);
        return null;
      }

      // The official session-header utilities seat: a null cell registered for
      // its props. ctx.slots.inject runs the callback per declaration lifetime
      // and unwinds the registration when this plugin's fiber unloads — no
      // manual disposer (the official open-in-app registers the same way).
      ctx.slots.inject('conversation.session.header.utilities', function () {
        return ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'file-actions',
          order: 100,
          locale: NS,
        }, SessionCwdRecorder);
      });

      var appsTask = fetchJson('/open-in-app/apps').then(function (result) {
        if (result.ok && result.data !== null && Array.isArray(result.data.apps)) {
          state.officialApps = result.data.apps;
          notifyState();
          renderContextMenu();
        }
      });
      var infoTask = fetchJson('/api/file-actions/info').then(function (result) {
        if (result.ok && result.data !== null && typeof result.data === 'object') {
          state.info = result.data;
          notifyState();
          renderContextMenu();
        }
      });
      void appsTask;
      void infoTask;

      return async function dispose() {
        document.removeEventListener('contextmenu', onContextMenu);
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', cancelPress);
        styleTag.remove();
        contextRoot.unmount();
        contextContainer.remove();
      };
    }

    exports.inject = ['locale', 'slots', 'remote', 'remote.directoryPicker'];
    exports.apply = apply;
    return module.exports;
  },
});
