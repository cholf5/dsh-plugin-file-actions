/**
 * dsh-plugin-file-actions — Host half.
 *
 * File-level complements to the official `open-in-app` routes (which only
 * accept existing directories):
 *
 * - GET  /api/file-actions/info    → editor/terminal capability and the
 *   configurable run-command extension map, so the browser menu can grey the
 *   "run this file" item for unknown types.
 * - POST /api/file-actions/launch  → open one existing file (or directory) in a
 *   whitelisted editor/IDE via `open -a <bundle> <path>` (macOS).
 * - POST /api/file-actions/run     → run one file inside a whitelisted terminal
 *   (Terminal.app via AppleScript, Ghostty via `open … --args -e`).
 *
 * Security: every route asks the composition's `connection` service for a
 * rejection first (Host/Origin fence + browser authentication, the same model
 * as the official open-in-app host), bodies are bounded JSON, app ids are
 * whitelist-checked against bundles actually present in the known application
 * directories, and paths must be absolute and exist on disk. The run command
 * is built from the configured extension map plus a shell-quoted file path.
 */

import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import z from '@deepseek-ai/schemastery'

const execFileAsync = promisify(execFile)

/** Cordis function-plugin name. */
export const name = 'file-actions'

/** The route carrier, the trust fence guarding every route. */
export const inject = ['webServer', 'connection']

/** Default extension → command map for "run this file" (configurable). */
export const DEFAULT_RUN_COMMANDS = {
  py: 'python3',
  pyw: 'python3',
  sh: 'bash',
  bash: 'bash',
  zsh: 'zsh',
  js: 'node',
  mjs: 'node',
  cjs: 'node',
  ts: 'tsx',
  tsx: 'tsx',
  rb: 'ruby',
  pl: 'perl',
  php: 'php',
  lua: 'lua',
}

/** Host configuration. */
export const Config = z.object({
  /** Extension (lowercase, no dot) → command run before the quoted file path. */
  runCommands: z.dict(z.string(), z.string()).default(DEFAULT_RUN_COMMANDS),
  /** Permit running files whose extension is unmapped but that carry an execute bit. */
  allowExecutableBit: z.boolean().default(true),
  /** Deadline in milliseconds for each launched host command. */
  launchTimeoutMs: z.number().step(1).min(100).max(120_000).default(10_000),
})

/**
 * File-level launchers, keyed by the official open-in-app catalog ids so the
 * browser can intersect them with the official probe result. macOS bundle
 * spellings mirror the official `open-in-app` catalog. Terminals are handled
 * by the run route, not this table.
 */
const EDITOR_BUNDLES = {
  cursor: ['Cursor.app'],
  vscode: ['Visual Studio Code.app'],
  vscodeinsiders: ['Visual Studio Code - Insiders.app'],
  windsurf: ['Windsurf.app'],
  zed: ['Zed.app', 'Zed Preview.app'],
  sublimetext: ['Sublime Text.app'],
  androidstudio: ['Android Studio.app'],
  intellij: ['IntelliJ IDEA.app', 'IntelliJ IDEA Ultimate.app', 'IntelliJ IDEA CE.app'],
  pycharm: ['PyCharm.app', 'PyCharm Professional.app', 'PyCharm CE.app', 'PyCharm Community.app'],
  webstorm: ['WebStorm.app'],
  phpstorm: ['PhpStorm.app'],
  goland: ['GoLand.app'],
  rider: ['Rider.app', 'JetBrains Rider.app'],
  rustrover: ['RustRover.app'],
}

/** Terminals the run route knows, keyed by official catalog ids. */
const TERMINALS = ['ghostty', 'terminal']

/** macOS application directories scanned for bundles, in probe order. */
const APP_DIRS = ['/Applications', `${process.env.HOME ?? ''}/Applications`]

/** Resolve one catalog id to an existing .app bundle path, or null. */
async function resolveBundle(id) {
  if (!Object.hasOwn(EDITOR_BUNDLES, id)) return null
  for (const dir of APP_DIRS) {
    if (dir === '') continue
    for (const bundle of EDITOR_BUNDLES[id]) {
      const candidate = path.join(dir, bundle)
      try {
        if ((await stat(candidate)).isDirectory()) return candidate
      } catch {
        // Absent bundle in this directory: try the next spelling.
      }
    }
  }
  return null
}

/** Trust surface consumed here; the browser-side connection package owns the full type. */
/** Answer an untrusted/unauthenticated request; true when it was rejected. */
function rejected(connection, req, res) {
  const rejection = connection.requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.end()
  return true
}

/** Open-route request bodies are tiny JSON objects; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024

/** JSON response (no-store: outcomes are live facts). */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** 405 with the route's one supported method. */
function sendMethodNotAllowed(res, allow) {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

/** Collect a bounded request body as UTF-8 text; null past the ceiling (stream drained). */
async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

/** Validate one POST body at the wire: JSON object with string app/path. */
function parseBody(text) {
  let body
  try {
    body = JSON.parse(text)
  } catch {
    // Swallows the parse error: a non-JSON body is exactly the null case.
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const { app, path: bodyPath } = body
  return typeof app === 'string' && typeof bodyPath === 'string' ? { app, path: bodyPath } : null
}

/** Whether the path names an existing file or directory on disk. */
async function pathExists(absolute) {
  try {
    await stat(absolute)
    return true
  } catch {
    return false
  }
}

/** Quote one string as a POSIX single-quoted shell word. */
function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * Build the shell command that runs one file: `<command> '<file>'` for mapped
 * extensions, or the file itself when it carries an execute bit.
 * @returns the command string, or null when no run spelling applies.
 */
function runCommandFor(file, config, fileStat) {
  const extension = path.extname(file).slice(1).toLowerCase()
  const command = config.runCommands[extension]
  if (command !== undefined) return `${command} ${shellQuote(file)}`
  if (config.allowExecutableBit && (fileStat.mode & 0o111) !== 0) return shellQuote(file)
  return null
}

/**
 * Run one command string inside a whitelisted terminal, opened at the file's directory.
 * Terminal.app receives an AppleScript `do script`; Ghostty receives the command
 * through `open -na Ghostty --args -e`.
 */
async function runInTerminal(app, file, command, timeout) {
  const directory = path.dirname(file)
  const script = `cd ${shellQuote(directory)} && ${command}`
  if (app === 'terminal') {
    // AppleScript string literal: escape backslashes first, then double quotes.
    const doScript = script.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
    await execFileAsync('osascript', ['-e', `tell application "Terminal" to do script "${doScript}"`], { timeout })
    return
  }
  await execFileAsync('open', ['-na', 'Ghostty', '--args', '-e', script], { timeout })
}

/**
 * Register the info, launch, and run routes behind the connection trust fence.
 * @param ctx - Cordis context; `webServer` and `connection` are injected.
 * @param config - validated Config values.
 */
export function apply(ctx, config) {
  const runCommands = { ...DEFAULT_RUN_COMMANDS, ...config.runCommands }
  const effective = { ...config, runCommands }

  /** Read + validate one JSON POST body, answering failures; null when invalid. */
  const readPost = async (req, res) => {
    const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
    if (essence !== 'application/json') {
      sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
      return null
    }
    let text
    try {
      text = await readBoundedBody(req)
    } catch {
      sendJson(res, 400, { code: 'bad-request', message: 'request body unreadable' })
      return null
    }
    if (text === null) {
      sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
      return null
    }
    const parsed = parseBody(text)
    if (parsed === null) {
      sendJson(res, 400, { code: 'bad-request', message: 'request body must be JSON with string "app" and "path"' })
      return null
    }
    return parsed
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/file-actions/info',
    handler: async (req, res) => {
      if (rejected(ctx.connection, req, res)) return
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, 'GET')
        return
      }
      sendJson(res, 200, {
        editors: Object.keys(EDITOR_BUNDLES),
        terminals: [...TERMINALS],
        runExtensions: Object.keys(effective.runCommands),
        allowExecutableBit: effective.allowExecutableBit,
      })
    },
  }), 'file-actions: GET /api/file-actions/info')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/file-actions/launch',
    handler: async (req, res) => {
      if (rejected(ctx.connection, req, res)) return
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, 'POST')
        return
      }
      const parsed = await readPost(req, res)
      if (parsed === null) return
      if (!path.isAbsolute(parsed.path)) {
        sendJson(res, 400, { code: 'bad-request', message: 'path must be absolute' })
        return
      }
      if (!await pathExists(parsed.path)) {
        sendJson(res, 404, { code: 'not-found', message: `path does not exist: ${parsed.path}` })
        return
      }
      const bundle = await resolveBundle(parsed.app)
      if (bundle === null) {
        sendJson(res, 400, { code: 'bad-request', message: `unknown or unavailable app: ${parsed.app}` })
        return
      }
      try {
        await execFileAsync('open', ['-a', bundle, parsed.path], { timeout: effective.launchTimeoutMs })
        sendJson(res, 200, { ok: true })
      } catch {
        sendJson(res, 502, { code: 'launch-failed', message: `failed to launch ${parsed.app}` })
      }
    },
  }), 'file-actions: POST /api/file-actions/launch')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/file-actions/run',
    handler: async (req, res) => {
      if (rejected(ctx.connection, req, res)) return
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, 'POST')
        return
      }
      const parsed = await readPost(req, res)
      if (parsed === null) return
      if (!TERMINALS.includes(parsed.app)) {
        sendJson(res, 400, { code: 'bad-request', message: `unsupported terminal: ${parsed.app}` })
        return
      }
      if (!path.isAbsolute(parsed.path)) {
        sendJson(res, 400, { code: 'bad-request', message: 'path must be absolute' })
        return
      }
      let fileStat
      try {
        fileStat = await stat(parsed.path)
      } catch {
        sendJson(res, 404, { code: 'not-found', message: `path does not exist: ${parsed.path}` })
        return
      }
      if (!fileStat.isFile()) {
        sendJson(res, 422, { code: 'not-a-file', message: `not a regular file: ${parsed.path}` })
        return
      }
      const command = runCommandFor(parsed.path, effective, fileStat)
      if (command === null) {
        sendJson(res, 422, { code: 'no-command', message: `no run command for extension: ${path.extname(parsed.path)}` })
        return
      }
      try {
        await runInTerminal(parsed.app, parsed.path, command, effective.launchTimeoutMs)
        sendJson(res, 200, { ok: true })
      } catch {
        sendJson(res, 502, { code: 'launch-failed', message: `failed to run in ${parsed.app}` })
      }
    },
  }), 'file-actions: POST /api/file-actions/run')
}
