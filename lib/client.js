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
    var IconRightUpOutline16 = ui.IconRightUpOutline16;
    var IconFolderOpenOutline16 = ui.IconFolderOpenOutline16;
    var IconCopyOutline16 = ui.IconCopyOutline16;
    var IconCheckOutline16 = ui.IconCheckOutline16;
    var IconCodeOutline16 = ui.IconCodeOutline16;
    var writeClipboard = ui.writeClipboard;

    var e = React.createElement;

    /** Locale namespace owned by this plugin. */
    var NS = 'fileActions';

    var zh = {
      'copyRelativePath': '复制相对路径',
      'copyAbsolutePath': '复制绝对路径',
      'runFile': '在终端运行该文件',
      'openDirectory': '在终端打开所在目录',
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
      'app.ghostty': 'Ghostty',
      'app.terminal': '终端',
      'app.gitbash': 'Git Bash',
      'app.windowsterminal': 'Windows 终端',
      'app.gnometerminal': 'GNOME 终端',
      'app.konsole': 'Konsole',
      'error.noCommand': '无法确定该文件的运行命令',
      'error.launchFailed': '打开 {app} 失败',
      'error.generic': '操作失败，请重试',
    };

    var en = {
      'copyRelativePath': 'Copy relative path',
      'copyAbsolutePath': 'Copy absolute path',
      'runFile': 'Run this file in terminal',
      'openDirectory': 'Open containing folder in terminal',
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
      'app.ghostty': 'Ghostty',
      'app.terminal': 'Terminal',
      'app.gitbash': 'Git Bash',
      'app.windowsterminal': 'Windows Terminal',
      'app.gnometerminal': 'GNOME Terminal',
      'app.konsole': 'Konsole',
      'error.noCommand': 'No run command is known for this file type',
      'error.launchFailed': 'Could not open {app}',
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

    /** Build one menu entry from the shared plugin state. */
    function buildItems(cardProps, state, t, actions) {
      var file = cardProps.file;
      var cwd = cardProps.cwd;
      var absolute = resolveWorkspacePath(cwd, file.path);
      var reveal = cardProps.host !== null && cardProps.host !== undefined && cardProps.host.fileManager !== undefined
        ? cardProps.host.fileManager : 'directory';
      var items = [
        { id: 'fa:open', icon: e(IconRightUpOutline16, { size: 16 }), label: cardProps.t('presented.defaultApp') },
        { id: 'fa:reveal', icon: e(IconFolderOpenOutline16, { size: 16 }), label: cardProps.t('presented.' + reveal) },
        { type: 'separator', id: 'fa:sep1' },
        { id: 'fa:copy-rel', icon: e(IconCopyOutline16, { size: 16 }), label: t('copyRelativePath') },
        { id: 'fa:copy-abs', icon: e(IconCopyOutline16, { size: 16 }), label: t('copyAbsolutePath') },
      ];
      if (state.info !== null && state.info !== undefined) {
        var runExtensions = state.info.runExtensions;
        var editors = (state.officialApps || []).filter(function (id) {
          return EDITOR_IDS.indexOf(id) >= 0;
        });
        var terminals = (state.officialApps || []).filter(function (id) {
          return TERMINAL_IDS.indexOf(id) >= 0;
        });
        var extension = extensionOf(file.path);
        var runnable = extension === '' || (runExtensions !== undefined && runExtensions.indexOf(extension) >= 0);
        if (editors.length > 0) items.push({ type: 'separator', id: 'fa:sep2' });
        editors.forEach(function (id) {
          items.push({
            id: 'fa:app:' + id,
            icon: e(AppIcon, { id: id, size: 16 }),
            label: t('app.' + id),
          });
        });
        if (terminals.length > 0) items.push({ type: 'separator', id: 'fa:sep3' });
        terminals.forEach(function (id) {
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
      }
      if (actions.error !== null && actions.error !== undefined) {
        items.push({ type: 'separator', id: 'fa:sep-err' });
        items.push({ id: 'fa:error', label: actions.error, disabled: true, danger: true });
      }
      return items;
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
        var absolute = resolveWorkspacePath(cardProps.cwd, cardProps.file.path);
        var fail = function (result, app) {
          var code = result.data !== null && result.data !== undefined && result.data.code !== undefined
            ? result.data.code : '';
          if (code === 'no-command') setError(t('error.noCommand'));
          else if (code === 'launch-failed') setError(t('error.launchFailed', { app: app }));
          else setError(t('error.generic'));
        };
        if (id === 'fa:open') { setOpen(false); cardProps.onAction('open'); return; }
        if (id === 'fa:reveal') { setOpen(false); cardProps.onAction('reveal'); return; }
        if (id === 'fa:copy-rel') {
          setOpen(false);
          writeClipboard(cardProps.file.path);
          return;
        }
        if (id === 'fa:copy-abs') {
          setOpen(false);
          writeClipboard(absolute);
          return;
        }
        if (id.indexOf('fa:app:') === 0) {
          postJson('/api/file-actions/launch', { app: id.slice(7), path: absolute }).then(function (result) {
            if (result.ok) setOpen(false); else fail(result, t('app.' + id.slice(7)));
          });
          return;
        }
        if (id.indexOf('fa:run:') === 0) {
          postJson('/api/file-actions/run', { app: id.slice(7), path: absolute }).then(function (result) {
            if (result.ok) setOpen(false); else fail(result, t('app.' + id.slice(7)));
          });
          return;
        }
        if (id.indexOf('fa:opendir:') === 0) {
          var app = id.slice(11);
          postJson('/open-in-app/open', { app: app, path: dirnameOf(absolute) }).then(function (result) {
            if (result.ok) setOpen(false); else fail(result, t('app.' + app));
          });
        }
      };

      return e(Menu, {
        open: open,
        autoFocus: true,
        portal: true,
        align: 'end',
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
      var state = { officialApps: null, info: null, ready: false };
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

      function sweep() {
        entries.forEach(function (entry, card) {
          if (!card.isConnected) {
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
        if (!state.ready) return;
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
          chevron.insertAdjacentElement('afterend', container);
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

      var appsTask = fetchJson('/open-in-app/apps').then(function (result) {
        if (result.ok && result.data !== null && Array.isArray(result.data.apps)) {
          state.officialApps = result.data.apps;
        }
      });
      var infoTask = fetchJson('/api/file-actions/info').then(function (result) {
        if (result.ok && result.data !== null && typeof result.data === 'object') {
          state.info = result.data;
        }
      });
      Promise.all([appsTask, infoTask]).then(function () {
        state.ready = true;
        entries.forEach(renderEntry);
        schedule();
      });

      return async function dispose() {
        observer.disconnect();
        entries.forEach(function (entry) {
          entry.root.unmount();
          entry.container.remove();
          restoreOfficial(entry.chevron);
        });
        entries.clear();
      };
    }

    exports.inject = ['locale'];
    exports.apply = apply;
    return module.exports;
  },
});
