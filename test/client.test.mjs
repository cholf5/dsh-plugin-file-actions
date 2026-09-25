// Client bundle registration: the factory runs in a vm with stubbed platform
// modules, proving the bundle registers under its package id with an apply export.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))

test('bundle registers under the package id with an apply export', () => {
  let registered
  const stubComponent = (name) => function Stub() { return null }
  const sandbox = {
    window: { __ModuleLoader__: { load: (definition) => { registered = definition } } },
    require: (specifier) => {
      if (specifier === 'react') {
        return { createElement: () => null, useState: () => [null, () => {}] }
      }
      if (specifier === 'react-dom/client') return { createRoot: () => ({ render: () => {}, unmount: () => {} }) }
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
        return {
          Menu: stubComponent('Menu'),
          writeClipboard: () => Promise.resolve(true),
          // Current dsh (0.1.7+) stroke-weight export names; the bundle's icon
          // aliases resolve these first and fall back to the legacy numeric
          // names — client-sweep.test.mjs stubs those to cover that branch.
          IconChevronDownOutlineRegular: stubComponent('Chevron'),
          IconRightUpOutlineRegular: stubComponent('RightUp'),
          IconFolderOpenOutlineRegular: stubComponent('Folder'),
          IconCopyOutlineRegular: stubComponent('Copy'),
          IconCheckOutlineRegular: stubComponent('Check'),
          IconCodeOutlineRegular: stubComponent('Code'),
          IconLinkOutlineRegular: stubComponent('Link'),
          IconBrowseOutlineRegular: stubComponent('Browse'),
          IconSendOutlineRegular: stubComponent('Send'),
          IconDownloadOutlineRegular: stubComponent('Download'),
        }
      }
      throw new Error(`unexpected module request: ${specifier}`)
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(readFileSync(join(here, '../lib/client.js'), 'utf8'), sandbox)
  assert.equal(registered.id, 'dsh-plugin-file-actions')
  const exports = registered.factory(sandbox.require)
  assert.deepEqual(Array.from(exports.inject).sort(), ['locale', 'remote', 'remote.directoryPicker', 'slots'],
    'the client half needs locale/slots plus the remote picker namespace (the URL menus read it per render)')
  assert.equal(typeof exports.apply, 'function')
})

test('client menu carries the cross-platform terminal ids and labels', () => {
  const source = readFileSync(join(here, '../lib/client.js'), 'utf8')
  assert.ok(
    source.includes("'ghostty', 'terminal', 'gitbash', 'windowsterminal', 'gnometerminal', 'konsole'"),
    'terminal id list covers every official terminal catalog id',
  )
  for (const id of ['gitbash', 'windowsterminal', 'gnometerminal', 'konsole']) {
    assert.ok(source.includes(`'app.${id}':`), `missing a locale label for ${id}`)
  }
  // The menu intersects the official probe with the plugin's own availability
  // list so resolver version skew can never show a dead menu entry.
  assert.ok(source.includes('state.info.available'), 'menu intersects info.available')
  for (const key of ['error.unavailableApp', 'error.unavailableTerminal']) {
    assert.ok(source.includes(`'${key}':`), `missing locale label ${key}`)
  }
})

test('client menu carries the official file-manager ids and labels', () => {
  const source = readFileSync(join(here, '../lib/client.js'), 'utf8')
  assert.ok(
    source.includes("'finder', 'explorer', 'filemanager'"),
    'file-manager id list covers every official file-manager catalog id',
  )
  for (const id of ['finder', 'explorer', 'filemanager']) {
    assert.ok(source.includes(`'app.${id}':`), `missing a locale label for ${id}`)
  }
  // The file manager launches through the official open route — the
  // session-header split button's exact call — never the plugin launch route.
  assert.ok(source.includes("'/open-in-app/open'"), 'file manager forwards to the official open route')
  // The link context menu leads with the plugin's own file-manager catalog: it
  // has no official control behind it, unlike the card.
  assert.ok(source.includes("'fa:fm:'"), 'the link menu keeps its own file-manager rows')
})

test('the card menu shadows the shipped open-in-app cell and absorbs its rows', () => {
  const source = readFileSync(join(here, '../lib/client.js'), 'utf8')
  // dsh 0.1.7 removed the in-card chevron the plugin used to take over; the
  // card now renders the deliverables.file.actions slot, and the official
  // open-in-app cell occupies it. The plugin registers under that SAME id at a
  // lower priority — the register guard's own shadowing remedy ("lowest
  // renders") — so the ledger keeps this cell and the official FileRouteAction
  // stops rendering: one dropdown per card, not two.
  assert.ok(source.includes("'deliverables.file.actions'"), 'the plugin registers on the official deliverables card seat')
  assert.ok(source.includes("id: 'open-in-app'"), 'the plugin takes the shipped cell id, so only one cell survives')
  assert.ok(source.includes('priority: -10'), 'a lower priority shadows the official priority-0 cell')
  assert.ok(source.includes('order: 10,') === false, 'no order: the priority decides the cell, not the position')
  // What the official cell did is absorbed rather than merely deleted.
  assert.ok(source.includes("'fa:open'"), 'the default-application row is absorbed into the plugin menu')
  assert.ok(source.includes("'fa:reveal'"), 'the reveal row is absorbed into the plugin menu')
  assert.ok(source.includes("'fa:osapp:'"), 'the per-file OS association rows are absorbed into the plugin menu')
  assert.ok(source.includes('APP_ICON_DATA_URL_RE'), 'the embedded association icons are validated before rendering')
  assert.ok(source.includes("present.open") === false || source.includes('props.actionUrl'),
    'the association list is read from the owner-provided authorized route, never a hard-coded path')
  assert.ok(source.includes('deps.onAction'), 'the absorbed rows dispatch through the seat contract')
  assert.ok(
    source.includes("__reactFiber$") === false,
    'no fiber probing: the path is read through the mounted cell host, not React internals',
  )
  assert.ok(source.includes("'button[title]'"), 'the workspace-resolved path is read from the card preview title')
  assert.ok(source.includes('[data-fa-trigger]'), 'the trigger styling rides the injected stylesheet')
  // The trigger stands in for the official control, so it advertises the menu
  // with the official chevron — and keeps the pre-0.1.7 numeric icon fallback.
  assert.ok(source.includes('e(IconChevronDown, { size: 11 })'),
    'the trigger renders the official chevron, not the coexistence-era code glyph')
  assert.ok(source.includes('ui.IconChevronDownOutlineRegular ?? ui.IconChevronDownOutline14'),
    'the chevron alias keeps both the 0.1.7 stroke-weight name and the legacy numeric name')
  // The slot menu now spans the absorbed official rows plus the plugin's own
  // terminal and copy sections; the message-link context menu keeps every
  // section including the plugin's editor catalog.
  assert.ok(source.includes("'slot', {"), 'the card slot passes the seat contract into buildItems')
  assert.ok(source.includes('function absorbedRows('), 'the absorbed official rows are built in one place')
})

test('the association icon guard mirrors the official native-file-application contract', () => {
  const source = readFileSync(join(here, '../lib/client.js'), 'utf8')
  // Byte-for-byte the guard the running @deepseek-ai/dsh-native-command
  // ships in parseNativeFileApplications (verified against the installed
  // 0.1.7-alpha.2 copy): the association route embeds each app icon inline, so
  // the client half is the only thing standing between that payload and an
  // <img src>. A future official change to the accepted form must be mirrored
  // here rather than silently widening what this menu will render.
  assert.ok(
    source.includes('/^data:image\\/(?:png|svg\\+xml);base64,[A-Za-z0-9+/=]+$/'),
    'the embedded-icon guard matches the official parseNativeFileApplications contract exactly',
  )
  for (const key of ['openWithDefault', 'openWithApp', 'appDefault', 'revealFile']) {
    assert.ok(source.includes(`'${key}':`), `missing the absorbed-row locale label ${key}`)
  }
  for (const key of ['error.appsUnavailable', 'error.openFailed', 'error.revealFailed']) {
    assert.ok(source.includes(`'${key}':`), `missing the absorbed-row failure label ${key}`)
  }
})

test('client context menu targets the official message file links', () => {
  const source = readFileSync(join(here, '../lib/client.js'), 'utf8')
  assert.ok(
    source.includes("'conversation.session.header.utilities'"),
    'the cwd recorder occupies the official session-header utilities slot',
  )
  assert.ok(
    source.includes('button[class*="fileMention"][title]:not([data-ref-chip])'),
    'the right-click delegation matches the official file-link buttons and excludes the input-area reference chips',
  )
  assert.ok(source.includes('contextmenu'), 'a contextmenu delegation listener is registered')
})
