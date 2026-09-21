// Host-half route behavior, with seam-injected resolution/launchers (no dsh
// boot, no real spawns): the win32/linux/darwin adapters run deterministically
// on any development machine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, loadOfficialOpenInApp } from '../lib/index.js'

async function routesWith(seam = {}, config = {}) {
  const routes = new Map()
  const ctx = {
    connection: { requestRejection: () => undefined },
    webServer: { register: (route) => { routes.set(route.path, route.handler) } },
    subprocess: { resolveExecutable: async () => { throw new Error('unresolved') } },
    effect(fn) { fn() },
  }
  await apply(ctx, config, seam)
  return routes
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

/** A seam whose resolver knows one editor plus the two Windows terminals. */
function win32Seam(overrides = {}) {
  const launched = []
  const resolvedMap = new Map([
    ['vscode', { launch: { kind: 'argv', command: 'C:\\Tools\\Code.exe', args: [] } }],
    ['cursor', { launch: { kind: 'argv', command: 'C:\\Tools\\Cursor.exe', args: [] } }],
    ['windowsterminal', { launch: { kind: 'argv', command: 'C:\\Tools\\wt.exe', args: [] } }],
    ['gitbash', { launch: { kind: 'argv', command: 'C:\\Git\\git-bash.exe', args: ['--cd={path}'] } }],
  ])
  const seam = {
    platform: 'win32',
    catalog: [
      { id: 'vscode', platforms: {} },
      { id: 'cursor', platforms: {} },
      { id: 'finder', platforms: {} },
    ],
    resolver: {
      resolveOpenInAppApps: async () => resolvedMap,
      resolveLaunch: async () => null,
      launchResolved: async (resolved, launchPath) => {
        launched.push({ kind: 'launchResolved', command: resolved.launch.command, path: launchPath })
        return 'launched'
      },
      launchDetachedApp: async () => undefined,
    },
    launch: async (command, args, options) => {
      launched.push({ kind: 'spawn', command, args, options })
    },
    ...overrides,
  }
  return { seam, launched, resolvedMap }
}

test('registers the three exact /api routes', async () => {
  const routes = await routesWith(win32Seam().seam)
  assert.deepEqual(
    [...routes.keys()].sort(),
    ['/api/file-actions/info', '/api/file-actions/launch', '/api/file-actions/run'],
  )
})

test('info serves editors, the cross-platform terminal set, and run extensions', async () => {
  const routes = await routesWith(win32Seam().seam)
  const res = mockRes()
  await routes.get('/api/file-actions/info')(mockReq('GET'), res)
  const data = JSON.parse(res.body)
  assert.equal(res.statusCode, 200)
  assert.ok(data.editors.includes('vscode') && data.editors.includes('rider'))
  assert.deepEqual(
    data.terminals.sort(),
    ['ghostty', 'gitbash', 'gnometerminal', 'konsole', 'terminal', 'windowsterminal'],
  )
  assert.ok(data.runExtensions.includes('py') && data.runExtensions.includes('bat'))
})

test('launch (win32) starts the resolved editor executable with the file path', async () => {
  const { seam, launched } = win32Seam()
  const routes = await routesWith(seam)
  const file = join(tmpdir(), 'fa-launch.py')
  writeFileSync(file, 'print(1)')
  const res = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: file })), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(launched, [{ kind: 'launchResolved', command: 'C:\\Tools\\Code.exe', path: file }])
})

test('launch refuses non-editor catalog ids and unknown apps', async () => {
  const { seam } = win32Seam()
  const routes = await routesWith(seam)
  // finder resolves in the stubbed map but is not a whitelisted editor id.
  const finder = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'finder', path: '/tmp' })), finder)
  assert.equal(finder.statusCode, 400)

  const unknown = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'notanapp', path: '/tmp' })), unknown)
  assert.equal(unknown.statusCode, 400)
})

test('launch rejects relative paths, missing paths, and non-JSON media types', async () => {
  const { seam } = win32Seam()
  const routes = await routesWith(seam)
  const rel = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: 'rel/x.py' })), rel)
  assert.equal(rel.statusCode, 400)

  const missing = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/no/such/file.py' })), missing)
  assert.equal(missing.statusCode, 404)

  const wrongType = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/tmp' }), 'text/plain'), wrongType)
  assert.equal(wrongType.statusCode, 415)

  const oversized = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: 'x'.repeat(70 * 1024) })), oversized)
  assert.equal(oversized.statusCode, 413)
})

test('launch re-resolves once after a missing executable, mirroring the official host', async () => {
  let launchCalls = 0
  let refreshCalls = 0
  const { seam } = win32Seam({
    resolver: {
      resolveOpenInAppApps: async () => new Map([['vscode', { launch: { kind: 'argv', command: 'C:\\Old.exe', args: [] } }]]),
      resolveLaunch: async () => {
        refreshCalls += 1
        return { launch: { kind: 'argv', command: 'C:\\New.exe', args: [] } }
      },
      launchResolved: async () => {
        launchCalls += 1
        return launchCalls === 1 ? 'missing' : 'launched'
      },
      launchDetachedApp: async () => undefined,
    },
  })
  const routes = await routesWith(seam)
  const res = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/tmp' })), res)
  assert.equal(res.statusCode, 200)
  assert.equal(refreshCalls, 1)
  assert.equal(launchCalls, 2)
})

test('launch answers 502 when the refresh also fails', async () => {
  const { seam } = win32Seam({
    resolver: {
      resolveOpenInAppApps: async () => new Map([['vscode', { launch: { kind: 'argv', command: 'C:\\Old.exe', args: [] } }]]),
      resolveLaunch: async () => null,
      launchResolved: async () => 'missing',
      launchDetachedApp: async () => undefined,
    },
  })
  const routes = await routesWith(seam)
  const res = mockRes()
  await routes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/tmp' })), res)
  assert.equal(res.statusCode, 502)
})

test('run (win32) hands the command to Windows Terminal through the env variable', async () => {
  const { seam, launched } = win32Seam()
  const routes = await routesWith(seam, { runCommands: { py: 'python' } })
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const file = join(dir, 'script.py')
  writeFileSync(file, 'print(1)')
  const res = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'windowsterminal', path: file })), res)
  assert.equal(res.statusCode, 200)
  const spawn = launched.find((entry) => entry.kind === 'spawn')
  assert.equal(spawn.command, 'C:\\Tools\\wt.exe')
  assert.deepEqual(spawn.args, ['-d', dir, 'cmd', '/k', '%FILE_ACTIONS_RUN_CMD%'])
  assert.equal(spawn.options.env.FILE_ACTIONS_RUN_CMD, `python ${file}`)
})

test('run (win32) double-quotes spaced paths inside the env-carried command', async () => {
  const { seam, launched } = win32Seam()
  const routes = await routesWith(seam, { runCommands: { py: 'python' } })
  const dir = mkdtempSync(join(tmpdir(), 'fa test-'))
  const file = join(dir, 'my file.py')
  writeFileSync(file, 'print(1)')
  const res = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'windowsterminal', path: file })), res)
  assert.equal(res.statusCode, 200)
  const spawn = launched.find((entry) => entry.kind === 'spawn')
  assert.equal(spawn.options.env.FILE_ACTIONS_RUN_CMD, `python "${file}"`)
})

test('run (win32) executes the file itself through the execute-bit fallback', async () => {
  const { seam, launched } = win32Seam()
  const routes = await routesWith(seam)
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const file = join(dir, 'tool.bin')
  writeFileSync(file, '\x7fELF')
  chmodSync(file, 0o755)
  const res = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'windowsterminal', path: file })), res)
  assert.equal(res.statusCode, 200)
  const spawn = launched.find((entry) => entry.kind === 'spawn')
  assert.equal(spawn.options.env.FILE_ACTIONS_RUN_CMD, file)
})

test('run (win32) opens Git Bash through its own mintty with the cd script', async () => {
  const { seam, launched } = win32Seam()
  const routes = await routesWith(seam, { runCommands: { py: 'python' } })
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const file = join(dir, 'script.py')
  writeFileSync(file, 'print(1)')
  const res = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'gitbash', path: file })), res)
  assert.equal(res.statusCode, 200)
  const spawn = launched.find((entry) => entry.kind === 'spawn')
  assert.ok(spawn.command.endsWith('mintty.exe'))
  assert.equal(spawn.args[0], '-e')
  assert.ok(spawn.args[1].endsWith('bash.exe'))
  assert.equal(spawn.args[2], '-c')
  assert.ok(spawn.args[3].startsWith(`cd '${dir}' && 'python' '${file}'`), spawn.args[3])
  assert.ok(spawn.args[3].endsWith('exec bash -l -i'), spawn.args[3])
  assert.equal(spawn.options.env.CHERE_INVOKING, '1')
})

test('run (linux) passes the workdir and a keep-open bash script to GNOME Terminal', async () => {
  const launched = []
  const seam = {
    platform: 'linux',
    catalog: [{ id: 'gnometerminal', platforms: {} }],
    resolver: {
      resolveOpenInAppApps: async () => new Map([
        ['gnometerminal', { launch: { kind: 'argv', command: '/usr/bin/gnome-terminal', args: ['--working-directory={path}'] } }],
      ]),
      resolveLaunch: async () => null,
      launchResolved: async () => 'launched',
      launchDetachedApp: async () => undefined,
    },
    launch: async (command, args, options) => { launched.push({ command, args, options }) },
  }
  const routes = await routesWith(seam, { runCommands: { sh: 'bash' } })
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const file = join(dir, 'tool.sh')
  writeFileSync(file, 'echo hi')
  const res = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'gnometerminal', path: file })), res)
  assert.equal(res.statusCode, 200)
  const spawn = launched[0]
  assert.equal(spawn.command, '/usr/bin/gnome-terminal')
  assert.deepEqual(spawn.args.slice(0, 3), [`--working-directory=${dir}`, '--', 'bash'])
  assert.equal(spawn.args[3], '-c')
  assert.ok(spawn.args[4].startsWith(`bash '${file}'`), spawn.args[4])
  assert.ok(spawn.args[4].endsWith('exec bash -i'), spawn.args[4])
})

test('run (darwin) keeps the historical Terminal.app and Ghostty spellings', async () => {
  const commands = []
  const { seam } = win32Seam({
    platform: 'darwin',
    runCommand: async (command, args) => { commands.push({ command, args }) },
  })
  const routes = await routesWith(seam, { runCommands: { py: 'python3' } })
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const file = join(dir, 'script.py')
  writeFileSync(file, 'print(1)')

  const terminalRes = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'terminal', path: file })), terminalRes)
  assert.equal(terminalRes.statusCode, 200)
  assert.equal(commands[0].command, 'osascript')
  assert.ok(commands[0].args[1].includes(`do script "cd '${dir}' && python3 '${file}'"`))

  const ghosttyRes = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'ghostty', path: file })), ghosttyRes)
  assert.equal(ghosttyRes.statusCode, 200)
  assert.deepEqual(commands[1].command, 'open')
  assert.deepEqual(commands[1].args.slice(0, 4), ['-na', 'Ghostty', '--args', '-e'])
  assert.ok(commands[1].args[4].startsWith(`cd '${dir}' && python3`))
})

test('run refuses unsupported terminals, directories, and unmapped extensions', async () => {
  const { seam } = win32Seam()
  const routes = await routesWith(seam)
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

test('run routes refuse platform-mismatched and SSH contexts', async () => {
  const { seam } = win32Seam()
  const routes = await routesWith(seam)
  // 'terminal' exists only in the darwin adapter; the win32 seam answers 400.
  const dir = mkdtempSync(join(tmpdir(), 'fa-test-'))
  const file = join(dir, 'x.py')
  writeFileSync(file, 'x')
  const mismatch = mockRes()
  await routes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'terminal', path: file })), mismatch)
  assert.equal(mismatch.statusCode, 400)

  const sshSeam = { ...win32Seam().seam, ssh: true }
  const sshRoutes = await routesWith(sshSeam)
  const sshRun = mockRes()
  await sshRoutes.get('/api/file-actions/run')(mockReq('POST', JSON.stringify({ app: 'windowsterminal', path: '/tmp' })), sshRun)
  assert.equal(sshRun.statusCode, 400)
  const sshLaunch = mockRes()
  await sshRoutes.get('/api/file-actions/launch')(mockReq('POST', JSON.stringify({ app: 'vscode', path: '/tmp' })), sshLaunch)
  assert.equal(sshLaunch.statusCode, 400)
})

test('loads the official resolver bundle from the installed dependency', async () => {
  const { resolver, catalog } = await loadOfficialOpenInApp()
  assert.equal(typeof resolver.resolveOpenInAppApps, 'function')
  assert.equal(typeof resolver.resolveLaunch, 'function')
  assert.equal(typeof resolver.launchResolved, 'function')
  const vscode = catalog.find((entry) => entry.id === 'vscode')
  assert.ok(vscode, 'catalog has vscode')
  assert.ok(vscode.platforms.darwin, 'vscode declares a darwin spec')
  assert.ok(vscode.platforms.win32, 'vscode declares a win32 spec')
  assert.ok(vscode.platforms.linux, 'vscode declares a linux spec')
})

test('a real resolution pass yields catalog launches on this host', async () => {
  const { resolver, catalog } = await loadOfficialOpenInApp()
  const ids = new Set(catalog.map((entry) => entry.id))
  const map = await resolver.resolveOpenInAppApps(3000, { resolveExecutable: async () => null })
  for (const [id, resolved] of map) {
    assert.ok(ids.has(id), `resolved id ${id} is a catalog id`)
    assert.ok(resolved.launch, `${id} carries a launch`)
  }
})
