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
  assert.equal(exports.inject[0], 'locale')
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
})
