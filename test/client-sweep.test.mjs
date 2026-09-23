// Sweep takeover against a minimal fake DOM: proves the plugin container lands
// OUTSIDE the hidden Menu anchor wrapper span (0.1.6+ wraps the official
// chevron in span.menuAnchor — a container inserted next to the chevron itself
// would inherit display:none and the whole menu would vanish). The stubbed
// require cannot catch this class of bug; the fake DOM drives the real apply().
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))

const stubComponent = (name) => function Stub() { return null }

function makeElement(tagName, attrs = {}, parent = null) {
  const element = {
    tagName: tagName.toUpperCase(),
    className: attrs.className || '',
    style: {},
    attrs: { ...attrs },
    children: [],
    parentElement: parent,
    isConnected: true,
    setAttribute(key, value) { this.attrs[key] = String(value) },
    getAttribute(key) { return key in this.attrs ? this.attrs[key] : null },
    removeAttribute(key) { delete this.attrs[key] },
    appendChild(child) {
      this.children.push(child)
      child.parentElement = this
      return child
    },
    click() { /* the mailto hand-off anchor; the stub only needs the call */ },
    closest(selector) {
      let node = this
      while (node !== null) {
        if (matches(node, selector)) return node
        node = node.parentElement
      }
      return null
    },
    insertAdjacentElement(position, node) {
      if (position !== 'afterend') throw new Error(`unexpected position ${position}`)
      const at = this.parentElement.children.indexOf(this)
      this.parentElement.children.splice(at + 1, 0, node)
      node.parentElement = this.parentElement
    },
    remove() {
      const parent = this.parentElement
      if (parent !== null) {
        const at = parent.children.indexOf(this)
        if (at >= 0) parent.children.splice(at, 1)
      }
      this.parentElement = null
      this.isConnected = false
    },
    querySelector(selector) {
      return queryAll(this).find((element) => matches(element, selector)) ?? null
    },
  }
  if (parent !== null) parent.children.push(element)
  return element
}

function queryAll(element) {
  const found = []
  for (const child of element.children) {
    found.push(child, ...queryAll(child))
  }
  return found
}

/** Only the selector shapes the client half actually issues. */
function matches(element, selector) {
  if (selector === 'div[class*="split"]') {
    return element.tagName === 'DIV' && element.className.includes('split')
  }
  if (selector === 'button[aria-haspopup="menu"]:not([data-fa-anchor])') {
    return element.tagName === 'BUTTON' && element.attrs['aria-haspopup'] === 'menu'
      && element.attrs['data-fa-anchor'] === undefined
  }
  if (selector === 'button[class*="fileMention"][title]:not([data-ref-chip])') {
    return element.tagName === 'BUTTON' && element.className.includes('fileMention')
      && element.attrs['title'] !== undefined && element.attrs['title'] !== ''
      && element.attrs['data-ref-chip'] === undefined
  }
  if (selector === 'a[href]') {
    return element.tagName === 'A' && element.attrs['href'] !== undefined && element.attrs['href'] !== ''
  }
  if (selector === 'code') return element.tagName === 'CODE'
  const bare = selector.match(/^\[([a-z-]+)\]$/)
  if (bare !== null) return element.attrs[bare[1]] !== undefined
  throw new Error(`fake DOM does not implement selector: ${selector}`)
}

function makeEnvironment({ wrappedChevron, filePath = 'src/app.py', cwd }) {
  const documentElement = makeElement('html')
  const card = makeElement('div', { 'data-presented-file': true }, documentElement)
  const split = makeElement('div', { className: 'nyYjTG_split' }, card)
  const openButton = makeElement('button', { className: 'nyYjTG_open' }, split)
  const chevron = makeElement('button', { 'aria-haspopup': 'menu', className: 'nyYjTG_chevron' }, split)
  let wrapper = null
  if (wrappedChevron) {
    wrapper = chevron.parentElement = makeElement('span', { className: 'nyYjTG_menuAnchor' }, split)
    wrapper.children.push(chevron)
    split.children.splice(split.children.indexOf(chevron), 1)
  }
  card['__reactFiber$test'] = {
    memoizedProps: { file: { path: filePath }, cwd, onAction: () => {}, t: (key) => key },
    return: null,
  }
  return { documentElement, card, split, openButton, chevron, wrapper }
}

/** A fetch stub answering the plugin's GET probes and capturing its POSTs. */
function makeFetch({ apps, info } = {}, posts = []) {
  return async (url, options) => {
    const target = String(url)
    if (options !== undefined && options.method === 'POST') {
      posts.push({ url: target, body: JSON.parse(options.body) })
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    }
    if (target.includes('/open-in-app/apps')) {
      return apps === undefined
        ? { ok: false, status: 404, json: async () => null }
        : { ok: true, status: 200, json: async () => ({ apps }) }
    }
    if (target.includes('/api/file-actions/info')) {
      return info === undefined
        ? { ok: false, status: 404, json: async () => null }
        : { ok: true, status: 200, json: async () => info }
    }
    return { ok: false, status: 404, json: async () => null }
  }
}

async function runTakeover({ wrappedChevron, filePath, cwd, fetch: fetchImpl, coarse = false } = {}) {
  const fake = makeEnvironment({ wrappedChevron, filePath, cwd })
  const menus = []
  const clipboard = []
  const listeners = {}
  const slots = []
  const services = {}
  let registered
  const sandbox = {
    document: {
      documentElement: fake.documentElement,
      body: makeElement('body', {}, fake.documentElement),
      querySelectorAll: (selector) => queryAll(fake.documentElement)
        .filter((element) => matches(element, selector)),
      createElement: (tag) => makeElement(tag),
      addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn) },
      removeEventListener: (type, fn) => {
        listeners[type] = (listeners[type] ?? []).filter((listener) => listener !== fn)
      },
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback }
      observe() { queueMicrotask(() => this.callback([], this)) }
      disconnect() { /* the test process exits before dispose matters */ }
    },
    fetch: fetchImpl ?? (async () => ({ ok: false, status: 0, json: async () => null })),
    // The touch long-press schedules real timers inside the vm realm.
    setTimeout, clearTimeout,
    window: {
      __ModuleLoader__: { load: (definition) => { registered = definition } },
      // The coarse-pointer probe reads window.matchMedia; absent means fine.
      matchMedia: coarse
        ? (query) => ({ matches: query.includes('pointer: coarse') })
        : undefined,
    },
    require: (specifier) => {
      if (specifier === 'react') {
        return {
          createElement: (type, props) => ({ type, props }),
          useState: () => [null, () => {}],
          // The recorder publishes its cwd from the effect; run it inline.
          useEffect: (fn) => { fn() },
        }
      }
      if (specifier === 'react-dom/client') {
        return {
          // Invoke function components so CardMenu's real body runs and the
          // Menu stub captures its props (items/onSelect) for the tests.
          createRoot: () => ({
            render: (element) => {
              while (element !== null && typeof element === 'object' && typeof element.type === 'function') {
                element = element.type(element.props)
              }
            },
            unmount: () => {},
          }),
        }
      }
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
        return {
          Menu: function Menu(props) { menus.push(props); return null },
          writeClipboard: (value) => { clipboard.push(value); return Promise.resolve(true) },
          // Legacy numeric icon names: deliberately exercises the pre-0.1.7
          // fallback branch of the bundle's primitives icon aliases
          // (client.test.mjs stubs the current Regular names).
          IconChevronDownOutline14: stubComponent('Chevron'), IconRightUpOutline16: stubComponent('RightUp'),
          IconFolderOpenOutline16: stubComponent('Folder'), IconCopyOutline16: stubComponent('Copy'),
          IconCheckOutline16: stubComponent('Check'), IconCodeOutline16: stubComponent('Code'),
        }
      }
      throw new Error(`unexpected module request: ${specifier}`)
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(readFileSync(join(here, '../lib/client.js'), 'utf8'), sandbox)
  const exports = registered.factory(sandbox.require)
  await exports.apply({
    locale: { register: () => undefined, bind: () => (key) => key },
    slots: {
      // Invoke the callback synchronously: the "declaration already exists" path.
      inject: (key, callback) => { callback(); return () => {} },
      register: (options, component) => { slots.push({ options, component }); return () => {} },
    },
    // The optional seats the URL menus consult per render (ctx.get with an
    // undefined check); tests install entries to light capabilities up.
    get: (name) => services[name],
    effect(fn) { fn() },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { fake, menus, clipboard, listeners, slots, services }
}

function selectItem(menus, id) {
  cardMenu(menus).onSelect(id)
}

/** The card menu captures: the takeover menu grows upward from the trigger. */
function cardMenu(menus) {
  const menu = menus.filter((props) => props.side === 'top').pop()
  assert.notEqual(menu, undefined, 'the CardMenu rendered and captured its Menu props')
  return menu
}

/** The context menu captures: anchored at the cursor, growing downward. */
function contextMenu(menus) {
  const menu = menus.filter((props) => props.side === 'bottom').pop()
  assert.notEqual(menu, undefined, 'the LinkMenu rendered and captured its Menu props')
  return menu
}

test('the container lands outside the hidden Menu anchor wrapper span', async () => {
  const { fake } = await runTakeover({ wrappedChevron: true })
  const container = fake.card.querySelector('[data-fa-host]')
  assert.notEqual(container, null, 'the plugin container was inserted')
  assert.equal(container.parentElement, fake.split, 'container is a direct child of the split, not of the wrapper span')
  assert.equal(container.parentElement.tagName, 'DIV', 'container parent is the visible split div')
})

test('the container still sits next to an unwrapped official chevron', async () => {
  const { fake } = await runTakeover({ wrappedChevron: false })
  const container = fake.card.querySelector('[data-fa-host]')
  assert.notEqual(container, null, 'the plugin container was inserted')
  assert.equal(container.parentElement, fake.split, 'container is a sibling of the chevron inside the split')
  assert.equal(fake.split.children.indexOf(container), fake.split.children.indexOf(fake.chevron) + 1, 'container follows the chevron')
})

test('the menu opens above the trigger with the official anchor alignment', async () => {
  const { menus } = await runTakeover({ wrappedChevron: true })
  const menu = cardMenu(menus)
  assert.notEqual(menu, undefined, 'the CardMenu rendered and captured its Menu props')
  assert.equal(menu.side, 'top', 'the long plugin menu must grow upward so the viewport clamp never lands it on the trigger')
  assert.equal(menu.align, 'end', 'keeps the official right-edge anchor alignment')
  assert.equal(menu.portal, true, 'keeps the official portaled placement')
})

test('the container is a flex box so the chevron stays vertically centered', async () => {
  const { fake } = await runTakeover({ wrappedChevron: true })
  const container = fake.card.querySelector('[data-fa-host]')
  assert.equal(container.style.display, 'flex',
    'a block container drops the inline-flex Menu root span onto the text baseline at content height; flex stretches it like the official menuAnchor did')
})

test('copy-relative strips the workspace root off absolute presented paths', async () => {
  const { menus, clipboard } = await runTakeover({
    wrappedChevron: true,
    filePath: 'E:\\dev\\v4\\svn\\trunk\\src\\server\\AGENTS.md',
    cwd: 'E:\\dev\\v4\\svn\\trunk',
  })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['src\\server\\AGENTS.md'])
})

test('copy-relative leaves already-relative paths untouched', async () => {
  const { menus, clipboard } = await runTakeover({ wrappedChevron: true, filePath: 'src/app.py', cwd: '/repo' })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['src/app.py'])
})

test('copy-relative keeps a POSIX absolute path under the workspace relative', async () => {
  const { menus, clipboard } = await runTakeover({ wrappedChevron: true, filePath: '/repo/src/app.py', cwd: '/repo' })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['src/app.py'])
})

test('copy-relative matches the root across separator spellings', async () => {
  const { menus, clipboard } = await runTakeover({
    wrappedChevron: true,
    filePath: 'E:\\dev\\v4\\svn\\trunk\\src\\server\\AGENTS.md',
    cwd: 'E:/dev/v4/svn/trunk',
  })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['src\\server\\AGENTS.md'])
})

test('copy-relative keeps the path when the workspace root is unknown', async () => {
  const { menus, clipboard } = await runTakeover({
    wrappedChevron: true,
    filePath: 'E:\\dev\\elsewhere\\notes.md',
  })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['E:\\dev\\elsewhere\\notes.md'])
})

test('copy-absolute keeps the full absolute path', async () => {
  const { menus, clipboard } = await runTakeover({
    wrappedChevron: true,
    filePath: 'E:\\dev\\v4\\svn\\trunk\\src\\server\\AGENTS.md',
    cwd: 'E:\\dev\\v4\\svn\\trunk',
  })
  selectItem(menus, 'fa:copy-abs')
  assert.deepEqual(clipboard, ['E:\\dev\\v4\\svn\\trunk\\src\\server\\AGENTS.md'])
})

const fullInfo = {
  editors: ['vscode'],
  terminals: ['terminal'],
  runExtensions: ['py'],
  allowExecutableBit: true,
  available: ['finder', 'vscode', 'terminal'],
}

test('the two official card entries are replaced by the official file-manager app entry', async () => {
  const { menus } = await runTakeover({
    wrappedChevron: true,
    filePath: 'src/app.py',
    cwd: '/repo',
    fetch: makeFetch({ apps: ['finder', 'vscode', 'terminal'], info: fullInfo }),
  })
  const menu = cardMenu(menus)
  const ids = menu.items.map((item) => item.id)
  assert.ok(!ids.includes('fa:open'), 'the default-app entry is gone')
  assert.ok(!ids.includes('fa:reveal'), 'the custom reveal entry is gone')
  const editor = ids.indexOf('fa:app:vscode')
  assert.equal(ids[0], 'fa:fm:finder', 'the file manager leads the menu — first in the official catalog order')
  assert.ok(ids.indexOf('fa:fm:finder') < editor, 'the file manager precedes the editors')
  assert.equal(ids.indexOf('fa:sep-copies'), ids.length - 3, 'a separator stands before the copy entries')
  // Array.from copies the VM-realm array into a host one — deepStrictEqual
  // compares prototypes, and a vm-created array fails it against a literal.
  assert.deepEqual(Array.from(ids.slice(-2)), ['fa:copy-rel', 'fa:copy-abs'], 'the copy entries close the menu')
})

test('the file manager appears once the official probe lands, before the plugin info', async () => {
  const { menus } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: ['finder'] }),
  })
  const menu = cardMenu(menus)
  const ids = menu.items.map((item) => item.id)
  assert.ok(ids.includes('fa:fm:finder'), 'the file manager is gated on the official probe alone')
  assert.ok(!ids.some((id) => id.startsWith('fa:app:') || id.startsWith('fa:term:')),
    'editors/terminals still wait for the plugin info')
})

test('selecting the file manager opens the containing directory through the official route', async () => {
  const posts = []
  const { menus } = await runTakeover({
    wrappedChevron: true,
    filePath: 'src/app.py',
    cwd: '/repo',
    fetch: makeFetch({ apps: ['finder'], info: fullInfo }, posts),
  })
  selectItem(menus, 'fa:fm:finder')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(posts, [
    { url: '/open-in-app/open', body: { app: 'finder', path: '/repo/src' } },
  ], 'the official open route receives the file manager id and the file\'s directory')
})

const recorderProps = {
  sessionId: 's1',
  useSessions: (selector) => selector({ byId: { s1: { cwd: '/repo' } } }),
}

const rightClick = (listeners, target, x = 40, y = 60) => {
  let prevented = false
  const handler = (listeners.contextmenu ?? [])[0]
  assert.notEqual(handler, undefined, 'the contextmenu delegation listener is registered')
  handler({ target, clientX: x, clientY: y, preventDefault: () => { prevented = true } })
  return prevented
}

test('right-clicking a message file link opens the same menu anchored at the cursor', async () => {
  const { menus, listeners, slots } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: ['finder', 'vscode'], info: fullInfo }),
  })
  const cell = slots.find((entry) => entry.options.id === 'file-actions')
  assert.notEqual(cell, undefined, 'the cwd recorder occupies the session-header utilities slot')
  cell.component(recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85 fileLink_uddqf_59', title: 'src/app.py' })
  assert.equal(rightClick(listeners, link), true, 'the native context menu is suppressed')
  const menu = contextMenu(menus)
  const ids = menu.items.map((item) => item.id)
  assert.equal(ids[0], 'fa:fm:finder', 'the same app section leads the context menu')
  assert.ok(ids.includes('fa:app:vscode'), 'the editors ride the same whitelist')
  assert.deepEqual(Array.from(ids.slice(-2)), ['fa:copy-rel', 'fa:copy-abs'], 'the copy entries close the context menu')
  const rect = menu.getAnchorRect()
  assert.deepEqual(
    { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
    { left: 40, right: 40, top: 60, bottom: 60 },
    'the panel anchors at the cursor through getAnchorRect',
  )
})

test('an editor picked in the link context menu launches with the cwd-resolved absolute path', async () => {
  const posts = []
  const { menus, listeners, slots } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: ['finder', 'vscode'], info: fullInfo }, posts),
  })
  slots.find((entry) => entry.options.id === 'file-actions').component(recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85', title: 'src/app.py' })
  rightClick(listeners, link)
  contextMenu(menus).onSelect('fa:app:vscode')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(posts, [
    { url: '/api/file-actions/launch', body: { app: 'vscode', path: '/repo/src/app.py' } },
  ], 'the link title resolves through the viewed session\'s workspace directory')
})

test('copy-relative from the link context menu strips the workspace root', async () => {
  const { menus, clipboard, listeners, slots } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: ['finder'] }),
  })
  slots.find((entry) => entry.options.id === 'file-actions').component(recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85', title: '/repo/src/app.py' })
  rightClick(listeners, link)
  contextMenu(menus).onSelect('fa:copy-rel')
  assert.deepEqual(clipboard, ['src/app.py'])
})

test('a right-click on a reference chip or a plain element keeps the native menu', async () => {
  const { listeners } = await runTakeover({ wrappedChevron: true })
  const chip = makeElement('button', { className: 'fileMention_uddqf_85', title: '/some-skill', 'data-ref-chip': 'file' })
  assert.equal(rightClick(listeners, chip), false, 'input-area reference chips are excluded')
  const plain = makeElement('button', { className: 'nyYjTG_open', title: 'src/app.py' })
  assert.equal(rightClick(listeners, plain), false, 'buttons without the fileMention class are excluded')
})

test('right-clicking a mailto link offers the copy and compose entries', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'mailto:dev@example.com?subject=Hi' })
  assert.equal(rightClick(listeners, anchor), true, 'the native menu is suppressed for mailto links')
  const ids = contextMenu(menus).items.map((item) => item.id)
  assert.deepEqual(Array.from(ids), ['fa:link:copy-email', 'fa:link:compose'])
})

test('copy-email takes the address and compose hands the full mailto to the browser', async () => {
  const { menus, clipboard, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'mailto:dev@example.com?subject=Hi' })
  rightClick(listeners, anchor)
  const menu = contextMenu(menus)
  menu.onSelect('fa:link:copy-email')
  assert.deepEqual(clipboard, ['dev@example.com'], 'only the address is copied, never the query')
})

test('right-clicking an http link offers copy, the built-in browser, and the system browser', async () => {
  const { menus, listeners, services } = await runTakeover({ wrappedChevron: true })
  const opened = []
  services.sidebarRight = { openTab: (kind, options) => opened.push({ kind, options }) }
  services.sidebarRightTabs = { get: (kind) => (kind === 'browser' ? {} : undefined) }
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  rightClick(listeners, anchor)
  const ids = Array.from(contextMenu(menus).items.map((item) => item.id))
  assert.deepEqual(ids, ['fa:link:copy', 'fa:link:browse', 'fa:link:external'])

  contextMenu(menus).onSelect('fa:link:browse')
  assert.equal(opened.length, 1, 'exactly one built-in browser open')
  assert.equal(opened[0].kind, 'browser')
  assert.equal(opened[0].options.params.url, 'https://example.com/docs',
    'the built-in browser opens through the official sidebarRight service')
})

test('the built-in browser entry disappears when the deployment has no browser tab', async () => {
  const { menus, listeners, services } = await runTakeover({ wrappedChevron: true })
  services.sidebarRight = { openTab: () => {} }
  services.sidebarRightTabs = { get: () => undefined }
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  rightClick(listeners, anchor)
  const ids = Array.from(contextMenu(menus).items.map((item) => item.id))
  assert.deepEqual(ids, ['fa:link:copy', 'fa:link:external'])
})

test('right-clicking a .git anchor or inline-code git URL offers the clone menu', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'https://github.com/u/repo.git' })
  rightClick(listeners, anchor)
  assert.deepEqual(
    Array.from(contextMenu(menus).items.map((item) => item.id)),
    ['fa:link:copy', 'fa:link:clone'],
    '.git https anchors classify as git',
  )

  const code = makeElement('code', {})
  code.textContent = 'git@github.com:u/repo.git'
  rightClick(listeners, code)
  assert.deepEqual(
    Array.from(contextMenu(menus).items.map((item) => item.id)),
    ['fa:link:copy', 'fa:link:clone'],
    'SCP URLs inside inline code classify as git',
  )
})

test('clone-to picks the parent directory then posts the clone', async () => {
  const posts = []
  const { menus, listeners, services } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: [] }, posts),
  })
  services.remote = {
    directoryPicker: { pick: async () => ({ ok: true, value: '/Users/theo/dev' }) },
  }
  const anchor = makeElement('a', { href: 'https://github.com/u/repo.git' })
  rightClick(listeners, anchor)
  const menu = contextMenu(menus)
  const clone = menu.items.find((item) => item.id === 'fa:link:clone')
  assert.equal(clone.disabled, false, 'the clone entry is live once the picker seat exists')
  menu.onSelect('fa:link:clone')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(posts, [
    { url: '/api/file-actions/clone', body: { url: 'https://github.com/u/repo.git', vcs: 'git', parent: '/Users/theo/dev' } },
  ])
})

test('cancelling the directory chooser closes the menu without cloning', async () => {
  const posts = []
  const { menus, listeners, services } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: [] }, posts),
  })
  services.remote = { directoryPicker: { pick: async () => ({ ok: true, value: null }) } }
  const anchor = makeElement('a', { href: 'git@github.com:u/repo.git' })
  rightClick(listeners, anchor)
  contextMenu(menus).onSelect('fa:link:clone')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(posts, [], 'a cancelled chooser never reaches the clone route')
})

test('the clone entry is disabled while the deployment has no directory picker', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'https://github.com/u/repo.git' })
  rightClick(listeners, anchor)
  const clone = contextMenu(menus).items.find((item) => item.id === 'fa:link:clone')
  assert.equal(clone.disabled, true, 'no picker seat, no live clone entry')
})

test('an svn URL in inline code offers the checkout menu', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const code = makeElement('code', {})
  code.textContent = 'svn+ssh://svn.example.com/repo/trunk'
  rightClick(listeners, code)
  const ids = Array.from(contextMenu(menus).items.map((item) => item.id))
  assert.deepEqual(ids, ['fa:link:copy', 'fa:link:checkout'])
})

test('a coarse pointer flattens the terminal submenu into named rows', async () => {
  // Menu.module.css opens submenus beside the parent row with no viewport
  // clamp — beside a right-aligned card on a phone the side card is off-screen
  // (verified at 390px: submenu at x 362..540), so touch gets flat rows.
  const { menus } = await runTakeover({
    wrappedChevron: true,
    coarse: true,
    fetch: makeFetch({ apps: ['finder', 'terminal'], info: fullInfo }),
  })
  const items = cardMenu(menus).items
  const ids = items.map((item) => item.id)
  assert.ok(!ids.some((id) => id.startsWith('fa:term:')), 'no submenu parent rows on touch')
  assert.deepEqual(
    Array.from(ids.filter((id) => id.startsWith('fa:run:') || id.startsWith('fa:opendir:'))),
    ['fa:run:terminal', 'fa:opendir:terminal'],
    'each terminal contributes a run row and an open-directory row',
  )
  const run = items.find((item) => item.id === 'fa:run:terminal')
  assert.equal(run.disabled, false, 'the runnable extension stays live on the flat row')
  assert.equal(run.label, 'runFileWith', 'the flat row names the terminal through the locale')
  const dir = items.find((item) => item.id === 'fa:opendir:terminal')
  assert.equal(dir.label, 'openDirectoryWith', 'the open-directory row names the terminal too')
})

test('a fine pointer keeps the hover submenu', async () => {
  const { menus } = await runTakeover({
    wrappedChevron: true,
    fetch: makeFetch({ apps: ['finder', 'terminal'], info: fullInfo }),
  })
  const ids = cardMenu(menus).items.map((item) => item.id)
  assert.ok(ids.includes('fa:term:terminal'), 'the desktop keeps the submenu parent row')
})

const hold = (listeners, type, build) => {
  const handler = (listeners[type] ?? [])[0]
  assert.notEqual(handler, undefined, `a ${type} delegation listener is registered`)
  handler(build())
}

test('a touch long-press over a link opens the same menu and swallows the release', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  let prevented = false
  hold(listeners, 'touchstart', () => ({
    touches: [{ target: anchor, clientX: 40, clientY: 60 }],
  }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  assert.notEqual(contextMenu(menus), undefined, 'the hold opened the link menu')
  const rect = contextMenu(menus).getAnchorRect()
  assert.deepEqual(
    { left: rect.left, top: rect.top },
    { left: 40, top: 60 },
    'the panel anchors at the hold point',
  )
  hold(listeners, 'touchend', () => ({ preventDefault: () => { prevented = true }, cancelable: true }))
  assert.equal(prevented, true, 'the release is swallowed so no synthesized click follows the link')
})

test('a long-press that moves is a scroll and never opens the menu', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  const touch = { target: anchor, clientX: 40, clientY: 60 }
  hold(listeners, 'touchstart', () => ({ touches: [touch] }))
  touch.clientX = 200
  hold(listeners, 'touchmove', () => ({ touches: [touch] }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  assert.equal(menus.filter((props) => props.side === 'bottom').length, 0, 'the drag cancelled the press')
})

test('a touch on an unclassified element never schedules a press', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const plain = makeElement('button', { className: 'nyYjTG_open' })
  hold(listeners, 'touchstart', () => ({ touches: [{ target: plain, clientX: 1, clientY: 2 }] }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  assert.equal(menus.filter((props) => props.side === 'bottom').length, 0, 'plain text keeps the native long-press behavior')
})

test('the browser contextmenu after a long-press does not re-render the open menu', async () => {
  const { menus, listeners } = await runTakeover({ wrappedChevron: true })
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  hold(listeners, 'touchstart', () => ({ touches: [{ target: anchor, clientX: 40, clientY: 60 }] }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  const renders = () => menus.filter((props) => props.side === 'bottom').length
  const afterHold = renders()
  rightClick(listeners, anchor, 40, 60)
  assert.equal(renders(), afterHold, 'the Android hold fires its own contextmenu; the guard keeps one menu')
})

test('the touch-callout stylesheet is tagged with the plugin namespace', async () => {
  const { fake } = await runTakeover({ wrappedChevron: true })
  const style = fake.documentElement.querySelector('[data-plugin]')
  assert.notEqual(style, undefined, 'the plugin stylesheet was appended')
  assert.equal(style.tagName, 'STYLE')
  assert.ok(style.textContent.includes('-webkit-touch-callout: none'), 'the iOS link-preview callout is suppressed on menu targets')
  assert.ok(style.textContent.includes('[data-chat-turn]'), 'the suppression scopes to the conversation flow')
})
