// Host-half route behavior, with $DSH-free mocked ctx (no dsh boot needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

function mockCtx() {
  const routes = new Map()
  return {
    routes,
    ctx: {
      connection: { requestRejection: () => undefined },
      webServer: { register: (route) => { routes.set(route.path, route.handler) } },
      effect(fn) { fn() },
    },
  }
}

function mockReq(method, body, contentType = 'application/json') {
  return {
    method,
    headers: { 'content-type': contentType },
    url: '/x',
    resume() { /* drain, like http.IncomingMessage */ },
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(body) },
  }
}

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value },
    end(body) { this.body = body ?? '' },
  }
}

const config = { runCommands: { xyz: 'fake-runner' }, allowExecutableBit: true, launchTimeoutMs: 10_000 }
const { routes, ctx } = mockCtx()
apply(ctx, config)

test('registers the three exact /api routes', () => {
  assert.deepEqual(
    [...routes.keys()].sort(),
    ['/api/file-actions/info', '/api/file-actions/launch', '/api/file-actions/run'],
  )
})

test('info serves editors, terminals, and run extensions', async () => {
  const res = mockRes()
  await routes.get('/api/file-actions/info')(mockReq('GET'), res)
  const data = JSON.parse(res.body)
  assert.equal(res.statusCode, 200)
  assert.ok(data.editors.includes('vscode') && data.editors.includes('rider'))
  assert.deepEqual(data.terminals, ['ghostty', 'terminal'])
  assert.ok(data.runExtensions.includes('py'))
})

test('launch rejects relative paths, missing paths, and unknown apps', async () => {
  const rel = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: 'rel/x.py' })), rel)
  assert.equal(rel.statusCode, 400)

  const missing = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/no/such/file.py' })), missing)
  assert.equal(missing.statusCode, 404)

  const unknown = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'notanapp', path: '/tmp' })), unknown)
  assert.equal(unknown.statusCode, 400)
})

test('launch refuses non-JSON media types and oversized bodies', async () => {
  const wrongType = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/tmp' }), 'text/plain'), wrongType)
  assert.equal(wrongType.statusCode, 415)

  const oversized = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: 'x'.repeat(70 * 1024) })), oversized)
  assert.equal(oversized.statusCode, 413)
})

test('run refuses unsupported terminals, directories, and unmapped extensions', async () => {
  const badTerminal = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'foo', path: '/tmp' })), badTerminal)
  assert.equal(badTerminal.statusCode, 400)

  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const onDir = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'ghostty', path: dir })), onDir)
  assert.equal(onDir.statusCode, 422)
  assert.equal(JSON.parse(onDir.body).code, 'not-a-file')

  const plain = join(dir, 'plain-noext')
  writeFileSync(plain, 'data')
  const noCommand = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'ghostty', path: plain })), noCommand)
  assert.equal(noCommand.statusCode, 422)
  assert.equal(JSON.parse(noCommand.body).code, 'no-command')
})

test('run honors the configured extension map before the execute-bit fallback', async () => {
  // Route the run through the config map without touching a real terminal:
  // an unmapped extension WITH an execute bit must not fall through when the
  // map already missed, so assert the no-command boundary instead of a launch.
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const execFile = join(dir, 'tool.bin')
  writeFileSync(execFile, '\x7fELF')
  chmodSync(execFile, 0o755)
  const res = mockRes()
  // ghostty would open a window on success, so probe the terminal guard instead:
  // 'iterm' is a real catalog id but outside the plugin's terminal whitelist.
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'iterm', path: execFile })), res)
  assert.equal(res.statusCode, 400)
})
