// Slot-cell sweep against a minimal fake DOM and a tiny hook runtime: proves
// the card menu occupies the official deliverables.file.actions seat (0.1.7
// contributed-actions architecture — the card no longer ships a chevron to
// take over), reads the file path through its mounted host, and degrades to
// nothing when the official DOM drifts. The stubbed require cannot catch this
// class of bug; the fake DOM drives the real apply() and cell component.
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
  if (selector === 'button[title]') {
    return element.tagName === 'BUTTON' && element.attrs['title'] !== undefined
      && element.attrs['title'] !== ''
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

/** The 0.1.7 presented-file card: preview button (title = workspace-resolved
 * path), body row, and the actions row the official slot cell renders into.
 * slotHost simulates the committed host element of the plugin's cell. */
function makeEnvironment({ filePath = 'src/app.py', titledPreview = true } = {}) {
  const documentElement = makeElement('html')
  const card = makeElement('div', { 'data-presented-file': true }, documentElement)
  const preview = makeElement('button', titledPreview ? { title: filePath } : {}, card)
  const fileBody = makeElement('div', { className: 'nyYjTG_fileBody' }, card)
  const actions = makeElement('div', { className: 'nyYjTG_actions' }, fileBody)
  const slotHost = makeElement('span', {}, actions)
  return { documentElement, card, preview, fileBody, actions, slotHost }
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

/**
 * A tiny React hook runtime, just enough for the plugin's cell components:
 * useRef (committed to the fake slot host before effects run, like React),
 * useState (synchronous re-render with persistent hook slots), and useEffect
 * with []-semantics (runs once after the mount commit). Bare component calls
 * outside mount() get a transient frame whose effects run inline — the cwd
 * recorder's publish-on-effect contract.
 */
function makeReactRuntime(slotHost) {
  const runtime = { active: null }
  function walk(element) {
    while (element !== null && typeof element === 'object' && typeof element.type === 'function') {
      element = element.type(element.props)
    }
    if (element !== null && typeof element === 'object') {
      const children = element.props?.children
      // React hands a single child through as the element itself, not a list.
      if (Array.isArray(children)) for (const child of children) walk(child)
      else if (children !== null && children !== undefined) walk(children)
    }
    return element
  }
  function commitRefs(element) {
    if (element === null || typeof element !== 'object') return
    if (element.props?.ref !== undefined && element.props.ref !== null) element.props.ref.current = slotHost
  }
  function useState(initial) {
    const frame = runtime.active
    const i = frame.cursor++
    if (frame.hooks[i] === undefined) frame.hooks[i] = { value: typeof initial === 'function' ? initial() : initial }
    const slot = frame.hooks[i]
    return [slot.value, (value) => {
      const next = typeof value === 'function' ? value(slot.value) : value
      if (next === slot.value) return
      slot.value = next
      if (frame.transient !== true) {
        // Re-activate this frame: state may land from outside the mount call
        // (the shared-state subscription firing after bootPlugin returned).
        const previous = runtime.active
        runtime.active = frame
        render()
        runtime.active = previous
      }
    }]
  }
  function useRef(initial) {
    const frame = runtime.active
    const i = frame.cursor++
    if (frame.hooks[i] === undefined) frame.hooks[i] = { value: initial }
    return frame.hooks[i]
  }
  function useEffect(fn) {
    const frame = runtime.active
    if (frame.transient === true) { fn(); return }
    const i = frame.cursor++
    if (frame.hooks[i] === undefined) frame.hooks[i] = { ran: false }
    const slot = frame.hooks[i]
    if (slot.ran !== true) { slot.ran = true; frame.effects.push(fn) }
  }
  function render() {
    const frame = runtime.active
    frame.invocations += 1
    frame.cursor = 0
    frame.output = walk(frame.component(frame.props))
    commitRefs(frame.output)
    const pending = frame.effects.splice(0)
    for (const effect of pending) {
      const cleanup = effect()
      if (typeof cleanup === 'function') frame.cleanups.push(cleanup)
    }
  }
  function mount(component, props) {
    const previous = runtime.active
    runtime.active = { component, props, hooks: [], cursor: 0, effects: [], cleanups: [], invocations: 0 }
    render()
    const frame = runtime.active
    runtime.active = previous
    return frame
  }
  function invoke(component, props) {
    const previous = runtime.active
    runtime.active = { component, props, hooks: [], cursor: 0, effects: [], cleanups: [], transient: true }
    const output = walk(component(props))
    runtime.active = previous
    return output
  }
  return { useState, useRef, useEffect, mount, invoke, walk, runtime }
}

async function bootPlugin({ filePath, titledPreview, fetch: fetchImpl, coarse = false } = {}) {
  const fake = makeEnvironment({ filePath, titledPreview })
  const menus = []
  const clipboard = []
  const listeners = {}
  const slots = []
  const services = {}
  const react = makeReactRuntime(fake.slotHost)
  let registered
  const sandbox = {
    document: {
      documentElement: fake.documentElement,
      body: makeElement('body', {}, fake.documentElement),
      createElement: (tag) => makeElement(tag),
      addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn) },
      removeEventListener: (type, fn) => {
        listeners[type] = (listeners[type] ?? []).filter((listener) => listener !== fn)
      },
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
          // React folds extra args into props.children; the plugin menu nests
          // its Menu element inside the cell host span, so the stub must too.
          createElement: (type, props, ...children) => ({
            type,
            props: children.length === 0 ? props : { ...props, children: children.length === 1 ? children[0] : children },
          }),
          useState: react.useState,
          useRef: react.useRef,
          useEffect: react.useEffect,
        }
      }
      if (specifier === 'react-dom/client') {
        return {
          // The context menu root: walk the element so LinkMenu's real body
          // runs and the Menu stub captures its props for the tests.
          createRoot: () => ({
            render: (element) => { react.walk(element) },
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
  const cardCell = slots.find((entry) => entry.options.name === 'deliverables.file.actions')
  return { fake, menus, clipboard, listeners, slots, services, cardCell, react }
}

/** Mount the card cell the way the slots runtime would: standard session
 * props from the owning session, the plugin-namespace t, the cell host inside
 * the card. Returns the hook frame (output, invocations). */
function mountCard({ cardCell, react, fake, cwd, sessionId = 's1' }) {
  assert.notEqual(cardCell, undefined, 'the card menu cell registered on the official deliverables seat')
  return react.mount(cardCell.component, {
    sessionId,
    useSessions: (selector) => selector({ byId: { [sessionId]: cwd === undefined ? undefined : { cwd } } }),
    t: (key) => key,
  }, fake.slotHost)
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

test('the card menu occupies the official deliverables seat beside the shipped open-in-app cell', async () => {
  const { slots, cardCell } = await bootPlugin()
  assert.notEqual(cardCell, undefined, 'the card menu registered on deliverables.file.actions')
  assert.equal(cardCell.options.id, 'file-actions',
    'a fresh id is added beside the shipped entries — the official cell keeps rendering')
  assert.equal(cardCell.options.priority, undefined, 'no shadowing: the official control stays alive')
  assert.equal(cardCell.options.order, 10, 'order 10 places the plugin cell after the official one')
  assert.equal(cardCell.options.locale, 'fileActions', 'the cell binds the plugin locale namespace')
  const recorder = slots.find((entry) => entry.options.name === 'conversation.session.header.utilities')
  assert.notEqual(recorder, undefined, 'the cwd recorder keeps its session-header utilities seat')
})

test('the cell reads the file path through its mounted host inside the card', async () => {
  const { menus, cardCell, react, fake } = await bootPlugin({ filePath: '/repo/src/app.py' })
  const frame = mountCard({ cardCell, react, fake, cwd: '/repo' })
  const menu = cardMenu(menus)
  assert.equal(menu.open, false, 'the menu mounts closed')
  const anchor = menu.anchor
  assert.equal(anchor.props['data-fa-trigger'], '1', 'the trigger carries the plugin marker')
  assert.equal(anchor.props['aria-haspopup'], 'menu', 'the trigger announces a menu')
  assert.equal(anchor.props['aria-label'], 'moreActions', 'the trigger names itself through the locale')
  anchor.props.onClick()
  const opened = cardMenu(menus)
  assert.equal(opened.open, true, 'clicking the trigger opens the menu')
  const ids = opened.items.map((item) => item.id)
  assert.ok(ids.includes('fa:copy-rel') && ids.includes('fa:copy-abs'), 'the copy entries render from the title-derived path')
  assert.notEqual(frame.output, null, 'the cell stays mounted')
})

test('the trigger opens upward with the official right-edge alignment and portal placement', async () => {
  const { menus, cardCell, react, fake } = await bootPlugin()
  mountCard({ cardCell, react, fake, cwd: '/repo' })
  const menu = cardMenu(menus)
  assert.equal(menu.side, 'top', 'the long plugin menu must grow upward so the viewport clamp never lands it on the trigger')
  assert.equal(menu.align, 'end', 'keeps the official right-edge anchor alignment')
  assert.equal(menu.portal, true, 'keeps the official portaled placement')
})

test('copy-relative strips the workspace root off absolute presented paths', async () => {
  const { menus, clipboard, cardCell, react, fake } = await bootPlugin({
    filePath: 'E:\\dev\\v4\\svn\\trunk\\src\\server\\AGENTS.md',
  })
  mountCard({ cardCell, react, fake, cwd: 'E:\\dev\\v4\\svn\\trunk' })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['src\\server\\AGENTS.md'])
})

test('copy-relative resolves a title that still carries a workspace-relative path', async () => {
  // A card whose session has no cwd leaves the raw path in the title; the
  // menu relativizes against the seat's session cwd once it is known.
  const { menus, clipboard, cardCell, react, fake } = await bootPlugin({ filePath: 'src/app.py' })
  mountCard({ cardCell, react, fake, cwd: '/repo' })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['src/app.py'])
})

test('copy-relative keeps the path when the workspace root is unknown', async () => {
  const { menus, clipboard, cardCell, react, fake } = await bootPlugin({
    filePath: 'E:\\dev\\elsewhere\\notes.md',
  })
  mountCard({ cardCell, react, fake, cwd: undefined })
  selectItem(menus, 'fa:copy-rel')
  assert.deepEqual(clipboard, ['E:\\dev\\elsewhere\\notes.md'])
})

test('copy-absolute keeps the full absolute path', async () => {
  const { menus, clipboard, cardCell, react, fake } = await bootPlugin({
    filePath: 'E:\\dev\\v4\\svn\\trunk\\src\\server\\AGENTS.md',
  })
  mountCard({ cardCell, react, fake, cwd: 'E:\\dev\\v4\\svn\\trunk' })
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

test('the card slot menu carries only terminal and copy sections — the official control owns the rest', async () => {
  const { menus, cardCell, react, fake } = await bootPlugin({
    filePath: 'src/app.py',
    fetch: makeFetch({ apps: ['finder', 'vscode', 'terminal'], info: fullInfo }),
  })
  mountCard({ cardCell, react, fake, cwd: '/repo' })
  const menu = cardMenu(menus)
  const ids = menu.items.map((item) => item.id)
  assert.ok(!ids.includes('fa:open'), 'the default-app entry stays gone (official main button owns it)')
  assert.ok(!ids.includes('fa:reveal'), 'the custom reveal entry stays gone (official reveal owns it)')
  assert.ok(!ids.some((id) => id.startsWith('fa:fm:')), 'no file-manager rows — the official reveal covers them')
  assert.ok(!ids.some((id) => id.startsWith('fa:app:')), 'no editor rows — the official association list covers them')
  assert.deepEqual(
    Array.from(ids),
    ['fa:term:terminal', 'fa:sep-copies', 'fa:copy-rel', 'fa:copy-abs'],
    'terminals lead, a separator, then the copy entries close the menu',
  )
})

test('the slot menu shows only copies until the plugin info lands, then terminal rows appear', async () => {
  const { menus, cardCell, react, fake } = await bootPlugin({
    filePath: 'src/app.py',
    // The apps probe answers immediately; the plugin info is deferred so the
    // cell is already mounted when the terminal rows can be derived.
    fetch: async (url) => {
      if (String(url).includes('/api/file-actions/info')) {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return { ok: true, status: 200, json: async () => fullInfo }
      }
      if (String(url).includes('/open-in-app/apps')) {
        return { ok: true, status: 200, json: async () => ({ apps: ['finder', 'vscode', 'terminal'] }) }
      }
      return { ok: false, status: 404, json: async () => null }
    },
  })
  mountCard({ cardCell, react, fake, cwd: '/repo' })
  const before = cardMenu(menus)
  assert.deepEqual(
    Array.from(before.items.map((item) => item.id)),
    ['fa:copy-rel', 'fa:copy-abs'],
    'no terminal rows while the plugin info is unanswered — and no empty sections either',
  )
  // The info lands after the cell mounted: the shared-state subscription
  // re-renders the mounted cell with the terminal rows.
  await new Promise((resolve) => setTimeout(resolve, 20))
  const after = cardMenu(menus)
  assert.ok(after.items.some((item) => item.id === 'fa:term:terminal'), 'the terminal rows in without remounting')
})

test('the message-link context menu keeps every section the card slot trims', async () => {
  const posts = []
  const { menus, listeners, slots, react } = await bootPlugin({
    filePath: 'src/app.py',
    fetch: makeFetch({ apps: ['finder', 'vscode', 'terminal'], info: fullInfo }, posts),
  })
  react.invoke(slots.find((entry) => entry.options.name === 'conversation.session.header.utilities').component, recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85', title: 'src/app.py' })
  rightClick(listeners, link)
  const menu = contextMenu(menus)
  const ids = menu.items.map((item) => item.id)
  assert.equal(ids[0], 'fa:fm:finder', 'the file manager leads — no official alternative on a message link')
  assert.ok(ids.includes('fa:app:vscode'), 'editors stay on the link menu')
  assert.ok(ids.includes('fa:term:terminal'), 'terminals stay on the link menu')
  assert.equal(ids.indexOf('fa:sep-copies'), ids.length - 3, 'a separator stands before the copy entries')
  assert.deepEqual(Array.from(ids.slice(-2)), ['fa:copy-rel', 'fa:copy-abs'], 'the copy entries close the menu')
  // The trimmed sections still dispatch: selecting the file manager on the
  // link menu opens the containing directory through the official route.
  menu.onSelect('fa:fm:finder')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(posts, [
    { url: '/open-in-app/open', body: { app: 'finder', path: '/repo/src' } },
  ], 'the official open route receives the file manager id and the file\'s directory')
})

test('the file manager appears once the official probe lands, before the plugin info (link menu)', async () => {
  const { menus, listeners, slots, react } = await bootPlugin({
    fetch: makeFetch({ apps: ['finder'] }),
  })
  react.invoke(slots.find((entry) => entry.options.name === 'conversation.session.header.utilities').component, recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85', title: 'src/app.py' })
  rightClick(listeners, link)
  const ids = contextMenu(menus).items.map((item) => item.id)
  assert.ok(ids.includes('fa:fm:finder'), 'the file manager is gated on the official probe alone')
  assert.ok(!ids.some((id) => id.startsWith('fa:app:') || id.startsWith('fa:term:')),
    'editors/terminals still wait for the plugin info')
})

test('the cell degrades to nothing when the official card DOM drifted', async () => {
  const { cardCell, react, fake } = await bootPlugin({ titledPreview: false })
  const frame = mountCard({ cardCell, react, fake, cwd: '/repo' })
  assert.equal(frame.output, null, 'no readable title, no dead trigger — the cell renders nothing')
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
  const { menus, listeners, slots, react } = await bootPlugin({
    fetch: makeFetch({ apps: ['finder', 'vscode'], info: fullInfo }),
  })
  const cell = slots.find((entry) => entry.options.name === 'conversation.session.header.utilities')
  assert.notEqual(cell, undefined, 'the cwd recorder occupies the session-header utilities slot')
  react.invoke(cell.component, recorderProps)
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
  const { menus, listeners, slots, react } = await bootPlugin({
    fetch: makeFetch({ apps: ['finder', 'vscode'], info: fullInfo }, posts),
  })
  react.invoke(slots.find((entry) => entry.options.name === 'conversation.session.header.utilities').component, recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85', title: 'src/app.py' })
  rightClick(listeners, link)
  contextMenu(menus).onSelect('fa:app:vscode')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(posts, [
    { url: '/api/file-actions/launch', body: { app: 'vscode', path: '/repo/src/app.py' } },
  ], 'the link title resolves through the viewed session\'s workspace directory')
})

test('copy-relative from the link context menu strips the workspace root', async () => {
  const { menus, clipboard, listeners, slots, react } = await bootPlugin({
    fetch: makeFetch({ apps: ['finder'] }),
  })
  react.invoke(slots.find((entry) => entry.options.name === 'conversation.session.header.utilities').component, recorderProps)
  const link = makeElement('button', { className: 'fileMention_uddqf_85', title: '/repo/src/app.py' })
  rightClick(listeners, link)
  contextMenu(menus).onSelect('fa:copy-rel')
  assert.deepEqual(clipboard, ['src/app.py'])
})

test('a right-click on a reference chip or a plain element keeps the native menu', async () => {
  const { listeners } = await bootPlugin()
  const chip = makeElement('button', { className: 'fileMention_uddqf_85', title: '/some-skill', 'data-ref-chip': 'file' })
  assert.equal(rightClick(listeners, chip), false, 'input-area reference chips are excluded')
  const plain = makeElement('button', { className: 'otherClass', title: 'src/app.py' })
  assert.equal(rightClick(listeners, plain), false, 'buttons without the fileMention class are excluded')
})

test('right-clicking a mailto link offers the copy and compose entries', async () => {
  const { menus, listeners } = await bootPlugin()
  const anchor = makeElement('a', { href: 'mailto:dev@example.com?subject=Hi' })
  assert.equal(rightClick(listeners, anchor), true, 'the native menu is suppressed for mailto links')
  const ids = contextMenu(menus).items.map((item) => item.id)
  assert.deepEqual(Array.from(ids), ['fa:link:copy-email', 'fa:link:compose'])
})

test('copy-email takes the address and compose hands the full mailto to the browser', async () => {
  const { menus, clipboard, listeners } = await bootPlugin()
  const anchor = makeElement('a', { href: 'mailto:dev@example.com?subject=Hi' })
  rightClick(listeners, anchor)
  const menu = contextMenu(menus)
  menu.onSelect('fa:link:copy-email')
  assert.deepEqual(clipboard, ['dev@example.com'], 'only the address is copied, never the query')
})

test('right-clicking an http link offers copy, the built-in browser, and the system browser', async () => {
  const { menus, listeners, services } = await bootPlugin()
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
  const { menus, listeners, services } = await bootPlugin()
  services.sidebarRight = { openTab: () => {} }
  services.sidebarRightTabs = { get: () => undefined }
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  rightClick(listeners, anchor)
  const ids = Array.from(contextMenu(menus).items.map((item) => item.id))
  assert.deepEqual(ids, ['fa:link:copy', 'fa:link:external'])
})

test('right-clicking a .git anchor or inline-code git URL offers the clone menu', async () => {
  const { menus, listeners } = await bootPlugin()
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
  const { menus, listeners, services } = await bootPlugin({
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
  const { menus, listeners, services } = await bootPlugin({
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
  const { menus, listeners } = await bootPlugin()
  const anchor = makeElement('a', { href: 'https://github.com/u/repo.git' })
  rightClick(listeners, anchor)
  const clone = contextMenu(menus).items.find((item) => item.id === 'fa:link:clone')
  assert.equal(clone.disabled, true, 'no picker seat, no live clone entry')
})

test('an svn URL in inline code offers the checkout menu', async () => {
  const { menus, listeners } = await bootPlugin()
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
  const { menus, cardCell, react, fake } = await bootPlugin({
    coarse: true,
    fetch: makeFetch({ apps: ['finder', 'terminal'], info: fullInfo }),
  })
  mountCard({ cardCell, react, fake, cwd: '/repo' })
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
  const { menus, cardCell, react, fake } = await bootPlugin({
    fetch: makeFetch({ apps: ['finder', 'terminal'], info: fullInfo }),
  })
  mountCard({ cardCell, react, fake, cwd: '/repo' })
  const ids = cardMenu(menus).items.map((item) => item.id)
  assert.ok(ids.includes('fa:term:terminal'), 'the desktop keeps the submenu parent row')
})

const hold = (listeners, type, build) => {
  const handler = (listeners[type] ?? [])[0]
  assert.notEqual(handler, undefined, `a ${type} delegation listener is registered`)
  handler(build())
}

test('a touch long-press over a link opens the same menu and swallows the release', async () => {
  const { menus, listeners } = await bootPlugin()
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
  const { menus, listeners } = await bootPlugin()
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  const touch = { target: anchor, clientX: 40, clientY: 60 }
  hold(listeners, 'touchstart', () => ({ touches: [touch] }))
  touch.clientX = 200
  hold(listeners, 'touchmove', () => ({ touches: [touch] }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  assert.equal(menus.filter((props) => props.side === 'bottom').length, 0, 'the drag cancelled the press')
})

test('a touch on an unclassified element never schedules a press', async () => {
  const { menus, listeners } = await bootPlugin()
  const plain = makeElement('button', { className: 'otherClass' })
  hold(listeners, 'touchstart', () => ({ touches: [{ target: plain, clientX: 1, clientY: 2 }] }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  assert.equal(menus.filter((props) => props.side === 'bottom').length, 0, 'plain text keeps the native long-press behavior')
})

test('the browser contextmenu after a long-press does not re-render the open menu', async () => {
  const { menus, listeners } = await bootPlugin()
  const anchor = makeElement('a', { href: 'https://example.com/docs' })
  hold(listeners, 'touchstart', () => ({ touches: [{ target: anchor, clientX: 40, clientY: 60 }] }))
  await new Promise((resolve) => setTimeout(resolve, 650))
  const renders = () => menus.filter((props) => props.side === 'bottom').length
  const afterHold = renders()
  rightClick(listeners, anchor, 40, 60)
  assert.equal(renders(), afterHold, 'the Android hold fires its own contextmenu; the guard keeps one menu')
})

test('the plugin stylesheet carries the trigger styling and the touch-callout suppression', async () => {
  const { fake } = await bootPlugin()
  const style = fake.documentElement.querySelector('[data-plugin]')
  assert.notEqual(style, undefined, 'the plugin stylesheet was appended')
  assert.equal(style.tagName, 'STYLE')
  assert.ok(style.textContent.includes('[data-fa-trigger]:hover'), 'the trigger hover rides the injected stylesheet (official classes are hashed)')
  assert.ok(style.textContent.includes('-webkit-touch-callout: none'), 'the iOS link-preview callout is suppressed on menu targets')
  assert.ok(style.textContent.includes('[data-chat-turn]'), 'the suppression scopes to the conversation flow')
})
