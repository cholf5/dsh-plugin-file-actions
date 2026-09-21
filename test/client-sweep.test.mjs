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

/** Only the three selector shapes the client half actually issues. */
function matches(element, selector) {
  if (selector === 'div[class*="split"]') {
    return element.tagName === 'DIV' && element.className.includes('split')
  }
  if (selector === 'button[aria-haspopup="menu"]:not([data-fa-anchor])') {
    return element.tagName === 'BUTTON' && element.attrs['aria-haspopup'] === 'menu'
      && element.attrs['data-fa-anchor'] === undefined
  }
  const bare = selector.match(/^\[([a-z-]+)\]$/)
  if (bare !== null) return element.attrs[bare[1]] !== undefined
  throw new Error(`fake DOM does not implement selector: ${selector}`)
}

function makeEnvironment({ wrappedChevron }) {
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
    memoizedProps: { file: { path: 'src/app.py' }, onAction: () => {}, t: (key) => key },
    return: null,
  }
  return { documentElement, card, split, openButton, chevron, wrapper }
}

async function runTakeover({ wrappedChevron }) {
  const fake = makeEnvironment({ wrappedChevron })
  let registered
  const sandbox = {
    document: {
      documentElement: fake.documentElement,
      querySelectorAll: (selector) => queryAll(fake.documentElement)
        .filter((element) => matches(element, selector)),
      createElement: (tag) => makeElement(tag),
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback }
      observe() { queueMicrotask(() => this.callback([], this)) }
      disconnect() { /* the test process exits before dispose matters */ }
    },
    fetch: async () => ({ ok: false, status: 0, json: async () => null }),
    window: { __ModuleLoader__: { load: (definition) => { registered = definition } } },
    require: (specifier) => {
      if (specifier === 'react') return { createElement: () => null, useState: () => [null, () => {}] }
      if (specifier === 'react-dom/client') return { createRoot: () => ({ render: () => {}, unmount: () => {} }) }
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
        return {
          Menu: stubComponent('Menu'), writeClipboard: () => Promise.resolve(true),
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
    effect(fn) { fn() },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return fake
}

test('the container lands outside the hidden Menu anchor wrapper span', async () => {
  const fake = await runTakeover({ wrappedChevron: true })
  const container = fake.card.querySelector('[data-fa-host]')
  assert.notEqual(container, null, 'the plugin container was inserted')
  assert.equal(container.parentElement, fake.split, 'container is a direct child of the split, not of the wrapper span')
  assert.equal(container.parentElement.tagName, 'DIV', 'container parent is the visible split div')
})

test('the container still sits next to an unwrapped official chevron', async () => {
  const fake = await runTakeover({ wrappedChevron: false })
  await runTakeover(fake)
  const container = fake.card.querySelector('[data-fa-host]')
  assert.notEqual(container, null, 'the plugin container was inserted')
  assert.equal(container.parentElement, fake.split, 'container is a sibling of the chevron inside the split')
  assert.equal(fake.split.children.indexOf(container), fake.split.children.indexOf(fake.chevron) + 1, 'container follows the chevron')
})
