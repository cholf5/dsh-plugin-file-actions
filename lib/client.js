window.__ModuleLoader__.load({
  id: 'dsh-plugin-file-actions',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');
    var ReactDOMClient = require('react-dom/client');
    var ui = require('@deepseek-ai/dsh-client-ui-primitives');

    var Menu = ui.Menu;
    var IconChevronDownOutline14 = ui.IconChevronDownOutline14;
    var IconFolderOpenOutline16 = ui.IconFolderOpenOutline16;
    var IconCopyOutline16 = ui.IconCopyOutline16;
    var IconCheckOutline16 = ui.IconCheckOutline16;
    var IconCodeOutline16 = ui.IconCodeOutline16;
    var IconLinkOutline16 = ui.IconLinkOutline16;
    var IconBrowseOutline16 = ui.IconBrowseOutline16;
    var IconRightUpOutline16 = ui.IconRightUpOutline16;
    var IconSendOutline14 = ui.IconSendOutline14;
    var IconDownloadOutline16 = ui.IconDownloadOutline16;
    var writeClipboard = ui.writeClipboard;

    var e = React.createElement;

    /** Locale namespace owned by this plugin. */
    var NS = 'fileActions';

    var zh = {
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
      'error.launchFailed': '打开 {app} 失败',
      'error.badUrl': '无法识别的仓库地址',
      'error.targetExists': '目标目录已存在',
      'error.noPicker': '此主机没有可用的目录选择器',
      'error.cloneFailed': '克隆失败，请重试',
      'error.generic': '操作失败，请重试',
    };

    var en = {
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

    /** Find the PresentedFileCard props by walking the React fiber above one card element. */
    function cardPropsOf(card) {
      var keys = Object.keys(card);
      for (var i = 0; i < keys.length; i += 1) {
        if (keys[i].indexOf('__reactFiber$') !== 0) continue;
        var current = card[keys[i]];
        while (current !== null && current !== undefined) {
          var props = current.memoizedProps;
          if (props !== null && typeof props === 'object'
            && props.file !== null && typeof props.file === 'object' && typeof props.file.path === 'string'
            && typeof props.onAction === 'function' && typeof props.t === 'function') {
            return props;
          }
          current = current.return;
        }
      }
      return null;
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
     * Build one menu entry from the shared plugin state. `cardProps` is the
     * presented-file card's props, or a `{ file: { path }, cwd }` stand-in read
     * from a message file link. The applications lead (official catalog menu
     * order: file managers, editors, terminals); the two copy entries close
     * the menu.
     */
    function buildItems(cardProps, state, t, actions) {
      var file = cardProps.file;
      var items = [];
      // File managers ride the official probe alone (see FILE_MANAGER_IDS);
      // editors and terminals wait for the plugin info and then intersect the
      // official probe with it.
      var fileManagers = (state.officialApps || []).filter(function (id) {
        return FILE_MANAGER_IDS.indexOf(id) >= 0;
      });
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
        editors = pick(EDITOR_IDS);
        terminals = pick(TERMINAL_IDS);
        var extension = extensionOf(file.path);
        runnable = extension === '' || (runExtensions !== undefined && runExtensions.indexOf(extension) >= 0);
      }
      var hasLeads = fileManagers.length > 0 || editors.length > 0;
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
            icon: e(IconCodeOutline16, { size: 16 }),
            label: t('runFileWith', { app: terminal }),
            disabled: !runnable,
          });
          items.push({
            id: 'fa:opendir:' + id,
            icon: e(IconFolderOpenOutline16, { size: 16 }),
            label: t('openDirectoryWith', { app: terminal }),
          });
          return;
        }
        items.push({
          id: 'fa:term:' + id,
          icon: e(AppIcon, { id: id, size: 16 }),
          label: t('app.' + id),
          submenu: [
            { id: 'fa:run:' + id, icon: e(IconCodeOutline16, { size: 16 }), label: t('runFile'), disabled: !runnable },
            { id: 'fa:opendir:' + id, icon: e(IconFolderOpenOutline16, { size: 16 }), label: t('openDirectory') },
          ],
        });
      });
      if (hasLeads || terminals.length > 0) items.push({ type: 'separator', id: 'fa:sep-copies' });
      items.push(
        { id: 'fa:copy-rel', icon: e(IconCopyOutline16, { size: 16 }), label: t('copyRelativePath') },
        { id: 'fa:copy-abs', icon: e(IconCopyOutline16, { size: 16 }), label: t('copyAbsolutePath') },
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
          { id: 'fa:link:copy-email', icon: e(IconCopyOutline16, { size: 16 }), label: t('copyEmailAddress') },
          { id: 'fa:link:compose', icon: e(IconSendOutline14, { size: 16 }), label: t('composeEmail') },
        ];
      }
      if (target.kind === 'http') {
        var httpItems = [{ id: 'fa:link:copy', icon: e(IconLinkOutline16, { size: 16 }), label: t('copyLink') }];
        if (capabilities.builtInBrowser) {
          httpItems.push({ id: 'fa:link:browse', icon: e(IconBrowseOutline16, { size: 16 }), label: t('openInBuiltInBrowser') });
        }
        httpItems.push({ id: 'fa:link:external', icon: e(IconRightUpOutline16, { size: 16 }), label: t('openInSystemBrowser') });
        return httpItems;
      }
      return [
        { id: 'fa:link:copy', icon: e(IconLinkOutline16, { size: 16 }), label: t('copyLink') },
        {
          id: target.kind === 'git' ? 'fa:link:clone' : 'fa:link:checkout',
          icon: e(IconDownloadOutline16, { size: 16 }),
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

    /**
     * One card's augmented chevron + dropdown menu, rendered into the plugin-owned
     * container inserted after the hidden official chevron.
     */
    function CardMenu(props) {
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var errorState = React.useState(null);
      var error = errorState[0];
      var setError = errorState[1];

      var cardProps = props.cardProps;
      var t = props.t;

      var items = buildItems(cardProps, props.state, t, { error: error });

      var select = function (id) {
        dispatchSelection(id, cardProps, {
          t: t,
          close: function () { setOpen(false); },
          setError: setError,
        });
      };

      // Open ABOVE the trigger. The official two-row menu opens downward and
      // fits under the card, but this plugin's menu is far taller and
      // deliverable cards render at the end of a turn where the space below is
      // small: the official placement then hits the viewport clamp
      // (y = vh - listHeight - 12) and the panel lands on the trigger button.
      // side:'top' grows the panel upward from the trigger's top edge instead.
      return e(Menu, {
        open: open,
        autoFocus: true,
        portal: true,
        align: 'end',
        side: 'top',
        items: items,
        onSelect: select,
        onClose: function () { setOpen(false); },
        anchor: e('button', {
          type: 'button',
          className: props.chevronClass,
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'data-fa-anchor': '1',
          onClick: function () { setOpen(function (value) { return !value; }); },
        }, e(IconChevronDownOutline14, { size: 11 })),
      });
    }

    /** Client half: augment every presented-file card's dropdown with the extended menu. */
    async function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, 'file-actions: dictionaries');
      var t = ctx.locale.bind(NS);

      /** Shared plugin state; read at render time, refreshed after the initial fetches. */
      var state = { officialApps: null, info: null };
      var entries = new Map();
      var scheduled = false;

      function renderEntry(entry) {
        entry.root.render(e(CardMenu, {
          cardProps: entry.cardProps,
          chevronClass: entry.chevronClass,
          state: state,
          t: t,
        }));
      }

      /** The official chevron: the menu-anchor button inside the card, excluding the plugin's own. */
      function officialChevronOf(card) {
        var split = card.querySelector('div[class*="split"]');
        return split === null
          ? null
          : split.querySelector('button[aria-haspopup="menu"]:not([data-fa-anchor])');
      }

      /** Hide the chevron and its Menu anchor wrapper so no empty slot stays in the split layout. */
      function hideOfficial(chevron) {
        chevron.style.display = 'none';
        chevron.setAttribute('data-fa-hidden', '1');
        var wrapper = chevron.parentElement;
        if (wrapper !== null && wrapper !== undefined && wrapper.tagName === 'SPAN') {
          wrapper.style.display = 'none';
          wrapper.setAttribute('data-fa-hidden-wrapper', '1');
        }
      }

      /** Restore one hidden official chevron (and its wrapper) to the official rendering. */
      function restoreOfficial(chevron) {
        chevron.style.display = '';
        chevron.removeAttribute('data-fa-hidden');
        var wrapper = chevron.parentElement;
        if (wrapper !== null && wrapper !== undefined && wrapper.getAttribute('data-fa-hidden-wrapper') !== null) {
          wrapper.style.display = '';
          wrapper.removeAttribute('data-fa-hidden-wrapper');
        }
      }

      /** Where the plugin container may be inserted: next to the hidden Menu
       * anchor wrapper when one exists (0.1.6+ wraps the chevron in a
       * span.menuAnchor), else next to the chevron itself. Inserting next to
       * the chevron would land inside that display:none wrapper and hide the
       * whole plugin menu with it. */
      function containerAnchorOf(chevron) {
        var wrapper = chevron.parentElement;
        return wrapper !== null && wrapper !== undefined && wrapper.tagName === 'SPAN'
          && wrapper.getAttribute('data-fa-hidden-wrapper') !== null
          ? wrapper : chevron;
      }

      function sweep() {
        entries.forEach(function (entry, card) {
          if (!card.isConnected || !entry.container.isConnected) {
            entry.root.unmount();
            entry.container.remove();
            entries.delete(card);
            return;
          }
          // Re-assert the takeover when React re-created the card internals.
          var official = officialChevronOf(card);
          if (official !== null) {
            if (official !== entry.chevron) {
              hideOfficial(official);
              entry.chevron = official;
            } else if (official.style.display !== 'none') {
              hideOfficial(official);
            }
          }
        });
        // No readiness gate: the menu mounts immediately (the copy entries are
        // browser-side), and the app sections enrich in place as the official
        // probe and the plugin's own info land — a cold resolution pass on
        // either side never delays the takeover by seconds.
        Array.prototype.forEach.call(document.querySelectorAll('[data-presented-file]'), function (card) {
          if (entries.has(card) || card.querySelector('[data-fa-host]') !== null) return;
          var chevron = officialChevronOf(card);
          if (chevron === null) return;
          var cardProps = cardPropsOf(card);
          if (cardProps === null) return;
          // Replace the official chevron with the plugin-owned menu button.
          hideOfficial(chevron);
          var container = document.createElement('div');
          container.setAttribute('data-fa-host', '1');
          // Keep the official trigger geometry: the split is a 28px
          // inline-flex with align-items:stretch and the official chevron's
          // Menu root span is a stretched flex child of it (the official
          // menuAnchor class, align-self:stretch — a hashed deliverables
          // class this plugin cannot reference). In a plain block container
          // the primitives .root span (display:inline-flex) drops to content
          // height on the text baseline and the chevron rides off-center in
          // the row. A flex container stretches the root span, the button,
          // and centers the glyph like the official split.
          container.style.display = 'flex';
          containerAnchorOf(chevron).insertAdjacentElement('afterend', container);
          var entry = {
            root: ReactDOMClient.createRoot(container),
            container: container,
            chevron: chevron,
            chevronClass: chevron.className,
            cardProps: cardProps,
          };
          entries.set(card, entry);
          renderEntry(entry);
        });
      }

      function schedule() {
        if (scheduled) return;
        scheduled = true;
        Promise.resolve().then(function () {
          scheduled = false;
          sweep();
        });
      }

      var observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, { childList: true, subtree: true });

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
          entries.forEach(renderEntry);
          renderContextMenu();
          schedule();
        }
      });
      var infoTask = fetchJson('/api/file-actions/info').then(function (result) {
        if (result.ok && result.data !== null && typeof result.data === 'object') {
          state.info = result.data;
          entries.forEach(renderEntry);
          renderContextMenu();
          schedule();
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
        observer.disconnect();
        entries.forEach(function (entry) {
          entry.root.unmount();
          entry.container.remove();
          restoreOfficial(entry.chevron);
        });
        entries.clear();
      };
    }

    exports.inject = ['locale', 'slots', 'remote', 'remote.directoryPicker'];
    exports.apply = apply;
    return module.exports;
  },
});
