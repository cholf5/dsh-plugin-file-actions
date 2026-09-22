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
          IconChevronDownOutline14: stubComponent('Chevron'),
          IconRightUpOutline16: stubComponent('RightUp'),
          IconFolderOpenOutline16: stubComponent('Folder'),
          IconCopyOutline16: stubComponent('Copy'),
          IconCheckOutline16: stubComponent('Check'),
          IconCodeOutline16: stubComponent('Code'),
        }
      }
      throw new Error(`unexpected module request: ${specifier}`)
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(readFileSync(join(here, '../lib/client.js'), 'utf8'), sandbox)
  assert.equal(registered.id, 'dsh-plugin-file-actions')
  const exports = registered.factory(sandbox.require)
  assert.deepEqual(Array.from(exports.inject).sort(), ['locale', 'slots'],
    'the client half needs the locale and slots services (the recorder cell reads the viewed session)')
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
  // The two replaced official card entries must not come back.
  assert.ok(!source.includes("'fa:open'"), 'the default-app entry is removed')
  assert.ok(!source.includes("'fa:reveal'"), 'the custom reveal entry is removed')
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
