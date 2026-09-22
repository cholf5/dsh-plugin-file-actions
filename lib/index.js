/**
 * dsh-plugin-file-actions — Host half.
 *
 * File-level complements to the official `open-in-app` routes (which only
 * accept existing directories), on every platform the official catalog covers:
 *
 * - GET  /api/file-actions/info    → editor/terminal capability and the
 *   configurable run-command extension map, so the browser menu can grey the
 *   "run this file" item for unknown types.
 * - POST /api/file-actions/launch  → open one existing file (or directory) in
 *   a whitelisted editor/IDE. The app is resolved by the official
 *   `@deepseek-ai/dsh-host-open-in-app` resolver — the same locators the
 *   official routes use (macOS `.app` bundles, Windows `App Paths` registry /
 *   Uninstall records / `%ProgramFiles%` scans, Linux PATH names and desktop
 *   entries) — and launched with the file path appended.
 * - POST /api/file-actions/run     → run one file inside a whitelisted
 *   terminal (Terminal.app via AppleScript, Ghostty, Windows Terminal, Git
 *   Bash via mintty, GNOME Terminal, Konsole).
 * - POST /api/file-actions/clone   → clone one git URL (or check out one svn
 *   URL) into a directory chosen in the browser through the official
 *   directory picker. The URL is re-validated against the strict VCS shapes
 *   and spawned as argv — never a shell — so chat-authored text cannot reach
 *   the command line as options.
 *
 * Security: every route asks the composition's `connection` service for a
 * rejection first (Host/Origin fence + browser authentication, the same model
 * as the official open-in-app host), bodies are bounded JSON, app ids are
 * whitelist-checked against the editor set, the resolver only resolves catalog
 * entries, and paths must be absolute and exist on disk. The run command is
 * built from the configured extension map plus the file path — a shell string
 * on POSIX, argv words on Windows, where the command line reaches the
 * terminal's shell through an environment variable, never through a re-quoted
 * argument, and executability for the fallback derives from the file
 * extension. Launches spawn detached through the official launcher with a
 * credential-scrubbed environment.
 */

import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { launchEnvironmentOf, launchedThroughSsh } from '@deepseek-ai/dsh-launch-environment'
import z from '@deepseek-ai/schemastery'

const execFileAsync = promisify(execFile)

/** Cordis function-plugin name. */
export const name = 'file-actions'

/**
 * The route carrier, the trust fence guarding every route, and the subprocess
 * capability the official resolver uses for PATH lookups (the same service the
 * official open-in-app host injects).
 */
export const inject = ['webServer', 'connection', 'subprocess']

/** Default extension → command map for "run this file" on POSIX hosts. */
const DEFAULT_RUN_COMMANDS_POSIX = {
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

/** Default extension → command map for "run this file" on Windows. */
const DEFAULT_RUN_COMMANDS_WIN32 = {
  py: 'python',
  pyw: 'python',
  bat: 'cmd /c',
  cmd: 'cmd /c',
  ps1: 'powershell -File',
  sh: 'bash',
  bash: 'bash',
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

/**
 * The platform's default extension → command map.
 * @param platform - host platform; defaults to the running one.
 */
export function defaultRunCommands(platform = process.platform) {
  return { ...(platform === 'win32' ? DEFAULT_RUN_COMMANDS_WIN32 : DEFAULT_RUN_COMMANDS_POSIX) }
}

/** POSIX default table, kept as a named export for existing consumers. */
export const DEFAULT_RUN_COMMANDS = DEFAULT_RUN_COMMANDS_POSIX

/** Host configuration. */
export const Config = z.object({
  /** Extension (lowercase, no dot) → command run before the quoted file path. Defaults are platform-aware. */
  runCommands: z.dict(z.string(), z.string()).default(defaultRunCommands()),
  /** Permit running files whose extension is unmapped but that carry an execute bit; Windows derives executability from the extension (exe/bat/cmd/com). */
  allowExecutableBit: z.boolean().default(true),
  /** Deadline in milliseconds: bounded host commands, and the detached-launch watch window. */
  launchTimeoutMs: z.number().step(1).min(100).max(120_000).default(10_000),
  /** Deadline in milliseconds for one git clone / svn checkout (network-bound, so the ceiling is far above the launch watch). */
  cloneTimeoutMs: z.number().step(1).min(1000).max(600_000).default(120_000),
})

/**
 * Official open-in-app catalog ids this plugin launches at file level, with
 * labels on the browser side. File managers (finder/explorer/filemanager) are
 * excluded: the client half offers them from the official probe alone and
 * launches them through the official POST /open-in-app/open route with the
 * file's directory — the exact call the session-header menu makes — because a
 * file-manager shell-open with the file path would open the file in its
 * default app instead. Terminals are handled by the run route, not this set.
 */
const EDITOR_IDS = [
  'cursor', 'vscode', 'vscodeinsiders', 'windsurf', 'zed', 'sublimetext',
  'androidstudio', 'intellij', 'pycharm', 'webstorm', 'phpstorm',
  'goland', 'rider', 'rustrover',
]

/** Terminals the run route knows, keyed by official catalog ids. */
const TERMINALS = ['ghostty', 'terminal', 'gitbash', 'windowsterminal', 'gnometerminal', 'konsole']

/** Module layouts of the official resolver/catalog across published versions. */
const RESOLVER_LAYOUTS = ['lib/types/resolver.js', 'lib/resolver.js']
const CATALOG_LAYOUTS = ['lib/types/catalog.js', 'lib/catalog.js']

/**
 * The installed official package's root, reached through its exported
 * `./package.json` subpath (the exports map blocks deep specifier imports,
 * but a resolved file URL inside the package is a plain module import).
 */
function officialPackageRoot() {
  const require = createRequire(import.meta.url)
  try {
    return path.dirname(require.resolve('@deepseek-ai/dsh-host-open-in-app/package.json'))
  } catch (error) {
    throw new Error(
      'file-actions: the official dependency @deepseek-ai/dsh-host-open-in-app is not resolvable from this plugin'
      + ' (for link: installs run `npm install` inside the plugin checkout; for npm/git installs reinstall with'
      + ' `dsh plugin --profile web update dsh-plugin-file-actions -w`)',
      { cause: error },
    )
  }
}

/** Import the first module layout that exists among the candidates. */
async function importFirstLayout(root, candidates) {
  let lastError
  for (const candidate of candidates) {
    try {
      return await import(pathToFileURL(path.join(root, candidate)).href)
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(
    `file-actions: none of the official module layouts exist under ${root}: ${candidates.join(', ')}`,
    { cause: lastError },
  )
}

/**
 * Load the official open-in-app resolver and catalog from the installed
 * dependency — the exact detection and launch layer the official host routes
 * run, tried against every layout the published versions shipped.
 */
export async function loadOfficialOpenInApp() {
  const root = officialPackageRoot()
  const [resolver, catalog] = await Promise.all([
    importFirstLayout(root, RESOLVER_LAYOUTS),
    importFirstLayout(root, CATALOG_LAYOUTS),
  ])
  if (
    typeof resolver.resolveOpenInAppApps !== 'function'
    || typeof resolver.resolveLaunch !== 'function'
    || typeof resolver.launchResolved !== 'function'
    || typeof resolver.launchDetachedApp !== 'function'
    || !Array.isArray(catalog.OPEN_IN_APP_CATALOG)
  ) {
    throw new Error('file-actions: the official open-in-app package loaded but does not expose the expected resolver API')
  }
  return { resolver, catalog: catalog.OPEN_IN_APP_CATALOG }
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

/** Open/run-route request bodies are tiny JSON objects; anything larger is hostile. */
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

/** Validate one clone body at the wire: JSON object with string url/parent and the vcs literal. */
function parseCloneBody(text) {
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const { url, vcs, parent } = body
  return typeof url === 'string' && (vcs === 'git' || vcs === 'svn') && typeof parent === 'string'
    ? { url, vcs, parent }
    : null
}

/**
 * Repository URL classes the clone route accepts, mirroring the client
 * classifier: git over the https/git/ssh schemes or the SCP spelling, and svn
 * over its scheme family. The official message sanitizer strips every other
 * scheme, so nothing else can arrive as a rendered link.
 */
const GIT_URL_RES = [
  /^(?:git|ssh):\/\/\S+$/i,
  /^git@[A-Za-z0-9._-]+[:/]\S+$/i,
  /^https?:\/\/\S+\.git$/i,
]
const SVN_URL_RE = /^(?:svn|svn\+ssh|svn\+https?):\/\/\S+$/i

/**
 * The VCS behind one repository URL, or null. The URL comes from chat text the
 * agent authored, and argv spawning leaves the URL as the one injection
 * surface: anything that could parse as a command-line option (a leading
 * dash), holds whitespace, or exceeds a sane length is refused before git/svn
 * ever sees it.
 */
function vcsKindOf(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return null
  if (url.startsWith('-') || /\s/.test(url)) return null
  if (GIT_URL_RES.some((pattern) => pattern.test(url))) return 'git'
  if (SVN_URL_RE.test(url)) return 'svn'
  return null
}

/**
 * The directory name one repository URL clones into, or null when the URL
 * yields no safe single segment: the name is always the last path segment
 * (with the .git suffix and any SCP host part stripped), it must be one clean
 * path component, and it must never start with a dash — the target rides the
 * argv after the URL, and a dash-leading argument would parse as an option.
 */
function repoNameOf(url) {
  const withoutScheme = url.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '')
  const tail = withoutScheme.split(/[\\/]/).pop() ?? ''
  const segment = tail.includes(':') ? (tail.split(':').pop() ?? '') : tail
  const name = segment.replace(/\.git$/i, '')
  return /^[A-Za-z0-9._][A-Za-z0-9._-]*$/.test(name) && name !== '.' && name !== '..' ? name : null
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

/** Quote one word for a cmd.exe command line: double-quote only when it holds whitespace. */
function cmdQuote(word) {
  return /\s/.test(word) ? `"${word}"` : word
}

/**
 * The environment variable carrying the run command line to the cmd instance
 * inside Windows Terminal. The token holds no whitespace, so it survives
 * wt.exe's command-line reconstruction untouched and cmd.exe expands it into
 * the full command at execution time.
 */
const RUN_COMMAND_ENV = 'FILE_ACTIONS_RUN_CMD'
const RUN_COMMAND_TOKEN = '%FILE_ACTIONS_RUN_CMD%'

/** File extensions Windows runs directly through CreateProcess. */
const WIN32_EXECUTABLE_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'com'])

/**
 * Build the run invocation for one file: the configured command words ahead of
 * the file path. POSIX hosts get a shell string (`{ script }`) handed to a
 * shell; Windows hosts get argv words (`{ tokens }`) handed to the terminal's
 * shell opener, so the file path never crosses a second quoting layer.
 * POSIX executability comes from the execute bit; on Windows, where chmod has
 * no effect, it is derived from the file extension instead.
 * @returns null when no run spelling applies (unmapped extension, not executable).
 */
function runInvocationFor(file, config, fileStat, platform) {
  const extension = path.extname(file).slice(1).toLowerCase()
  const command = config.runCommands[extension]
  if (command !== undefined) {
    if (platform === 'win32') {
      const words = command.trim().split(/\s+/).filter((word) => word !== '')
      return words.length === 0 ? null : { tokens: [...words, file] }
    }
    return { script: `${command} ${shellQuote(file)}` }
  }
  const executable = platform === 'win32'
    ? WIN32_EXECUTABLE_EXTENSIONS.has(extension)
    : (fileStat.mode & 0o111) !== 0
  if (config.allowExecutableBit && executable) {
    return platform === 'win32' ? { tokens: [file] } : { script: shellQuote(file) }
  }
  return null
}

/**
 * Run one command inside a whitelisted terminal, opened at the file's
 * directory. macOS keeps the historical spellings (Terminal.app AppleScript,
 * Ghostty via `open … --args -e`); every other adapter spawns detached through
 * the official launcher, so the terminal outlives dsh and never inherits the
 * harness's credential variables. On POSIX the terminal keeps an interactive
 * shell after the command ends (`exec bash …`), matching Terminal.app's
 * behavior.
 * @returns true when an adapter ran; false when the terminal has no adapter on
 *   this platform (the route answers 400 unsupported-terminal).
 */
async function runInTerminal(app, file, invocation, context) {
  const { platform, resolved, timeoutMs, launch, runCommand } = context
  // The route guarantees a resolution; the kind guard is defensive (a terminal
  // resolved through a non-argv launch would have no command to spawn).
  const launcher = resolved === undefined ? undefined : resolved.launch
  if (launcher === undefined || launcher.kind !== 'argv') return false
  const executable = launcher.command
  const directory = path.dirname(file)
  const windowsCommand = invocation.tokens === undefined
    ? null
    : invocation.tokens.map(cmdQuote).join(' ')
  const posixCommand = invocation.tokens === undefined
    ? invocation.script
    : invocation.tokens.map(shellQuote).join(' ')

  if (platform === 'darwin') {
    const script = `cd ${shellQuote(directory)} && ${posixCommand}`
    if (app === 'terminal') {
      // AppleScript string literal: escape backslashes first, then double quotes.
      const doScript = script.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
      await runCommand('osascript', ['-e', `tell application "Terminal" to do script "${doScript}"`], { timeout: timeoutMs })
      return true
    }
    if (app === 'ghostty') {
      await runCommand('open', ['-na', 'Ghostty', '--args', '-e', script], { timeout: timeoutMs })
      return true
    }
    return false
  }

  if (platform === 'win32') {
    if (app === 'windowsterminal') {
      await launch(executable, ['-d', directory, 'cmd', '/k', RUN_COMMAND_TOKEN], {
        watchMs: timeoutMs,
        env: { [RUN_COMMAND_ENV]: windowsCommand },
      })
      return true
    }
    if (app === 'gitbash') {
      // The gitbash resolution proves …/Git/git-bash.exe; the full Git for
      // Windows layout ships mintty and bash beside it. Both shells run as
      // absolute paths: a bare `exec bash` would hit WSL's
      // C:\Windows\system32\bash.exe, because the inherited Windows PATH does
      // not contain Git's /usr/bin. CHERE_INVOKING keeps the login shell from
      // cd-ing home after our cd.
      const gitRoot = path.dirname(executable)
      const bash = path.join(gitRoot, 'usr', 'bin', 'bash.exe')
      await launch(path.join(gitRoot, 'usr', 'bin', 'mintty.exe'), [
        '-e', bash, '-l', '-c',
        `cd ${shellQuote(directory)} && ${posixCommand}; exec ${shellQuote(bash)} -l -i`,
      ], { watchMs: timeoutMs, env: { CHERE_INVOKING: '1' } })
      return true
    }
    return false
  }

  const script = `${posixCommand}; exec bash -i`
  if (app === 'ghostty') {
    await launch(executable, [`--working-directory=${directory}`, '-e', 'bash', '-c', script], { watchMs: timeoutMs })
    return true
  }
  if (app === 'gnometerminal') {
    await launch(executable, [`--working-directory=${directory}`, '--', 'bash', '-c', script], { watchMs: timeoutMs })
    return true
  }
  if (app === 'konsole') {
    await launch(executable, ['--workdir', directory, '-e', 'bash', '-c', script], { watchMs: timeoutMs })
    return true
  }
  return false
}

/**
 * Register the info, launch, and run routes behind the connection trust fence.
 * @param ctx - Cordis context; `webServer`, `connection`, and `subprocess` are injected.
 * @param config - validated Config values.
 * @param seam - test seams: resolver/catalog/launch/runCommand/stat/platform/env/home/ssh/resolveExecutable.
 */
export async function apply(ctx, config, seam = {}) {
  const platform = seam.platform ?? process.platform
  const statOf = seam.stat ?? stat
  const effective = {
    runCommands: { ...defaultRunCommands(platform), ...(config.runCommands ?? {}) },
    allowExecutableBit: config.allowExecutableBit ?? true,
    launchTimeoutMs: config.launchTimeoutMs ?? 10_000,
    cloneTimeoutMs: config.cloneTimeoutMs ?? 120_000,
  }
  // SSH detection asks the Cordis context getter; a host without one simply
  // is not SSH (the official /apps probe stays the real visibility gate).
  const ssh = seam.ssh ?? (() => {
    try {
      return launchedThroughSsh(launchEnvironmentOf(ctx))
    } catch {
      return false
    }
  })()

  /** The composition's PATH resolver, completed like the official host's. */
  const resolveExecutableOf = seam.resolveExecutable ?? (async (command) => {
    try {
      return await ctx.subprocess.resolveExecutable(command)
    } catch {
      return null
    }
  })

  /** Platform facts per route call; the resolver fills its own launcher default. */
  const internalsOf = () => ({
    ssh,
    platform: seam.platform,
    env: seam.env,
    home: seam.home,
    launch: seam.launch,
    resolveExecutable: resolveExecutableOf,
  })

  /** The official resolver bundle: seam-injected, or loaded from the installed package. */
  let bundleTask
  const loadBundle = () => bundleTask ??= (seam.resolver !== undefined
    ? Promise.resolve({ resolver: seam.resolver, catalog: seam.catalog ?? [] })
    : loadOfficialOpenInApp())
  // Fail loud at activation: a broken official dependency must not become a zombie menu.
  await loadBundle()

  /** Lazy once-per-plugin-life resolution; the map is the mutable authority. */
  let resolutionsTask
  const availability = () => resolutionsTask ??= loadBundle().then((bundle) =>
    bundle.resolver.resolveOpenInAppApps(effective.launchTimeoutMs, internalsOf()))

  /**
   * Replace one stale resolution after a missing-executable launch, exactly
   * like the official host: re-resolve the entry once, or drop it from the map.
   */
  const refreshResolution = async (app) => {
    const bundle = await loadBundle()
    const map = await availability()
    const fresh = await bundle.resolver.resolveLaunch(app, effective.launchTimeoutMs, internalsOf())
    if (fresh === null) {
      map.delete(app.id)
      return undefined
    }
    map.set(app.id, fresh)
    return fresh
  }

  // Warm the detection pass at activation so the first info/launch after a
  // dsh web restart answers from the memoized map instead of a cold registry
  // sweep (fire-and-forget: every locator failure is swallowed inside the
  // resolver as "unavailable").
  availability().catch(() => {})

  /** Read + validate one JSON POST body, answering failures; null when invalid. */
  const readPost = async (req, res, parse = parseBody) => {
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
    const parsed = parse(text)
    if (parsed === null) {
      sendJson(res, 400, { code: 'bad-request', message: 'request body does not match the route schema' })
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
      // The ids this plugin's own resolver pass verified. The browser
      // intersects them with the official probe result, so a version skew
      // between the two resolver copies can never show an item that would
      // answer 400.
      const available = await availability()
        .then((map) => [...map.keys()])
        .catch(() => [])
      sendJson(res, 200, {
        editors: [...EDITOR_IDS],
        terminals: [...TERMINALS],
        runExtensions: Object.keys(effective.runCommands),
        allowExecutableBit: effective.allowExecutableBit,
        available,
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
      if (ssh || !EDITOR_IDS.includes(parsed.app)) {
        sendJson(res, 400, { code: 'unavailable-app', message: `unknown or unavailable app: ${parsed.app}` })
        return
      }
      const bundle = await loadBundle()
      const app = bundle.catalog.find((entry) => entry.id === parsed.app)
      const resolved = app === undefined ? undefined : (await availability()).get(app.id)
      if (app === undefined || resolved === undefined) {
        sendJson(res, 400, { code: 'unavailable-app', message: `unknown or unavailable app: ${parsed.app}` })
        return
      }
      let outcome = await bundle.resolver.launchResolved(resolved, parsed.path, effective.launchTimeoutMs, internalsOf())
      if (outcome === 'missing') {
        const fresh = await refreshResolution(app)
        outcome = fresh === undefined
          ? 'failed'
          : await bundle.resolver.launchResolved(fresh, parsed.path, effective.launchTimeoutMs, internalsOf())
      }
      if (outcome === 'launched') sendJson(res, 200, { ok: true })
      else sendJson(res, 502, { code: 'launch-failed', message: `failed to launch ${parsed.app}` })
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
      if (ssh || !TERMINALS.includes(parsed.app)) {
        sendJson(res, 400, { code: 'unsupported-terminal', message: `unsupported terminal: ${parsed.app}` })
        return
      }
      if (!path.isAbsolute(parsed.path)) {
        sendJson(res, 400, { code: 'bad-request', message: 'path must be absolute' })
        return
      }
      let fileStat
      try {
        fileStat = await statOf(parsed.path)
      } catch {
        sendJson(res, 404, { code: 'not-found', message: `path does not exist: ${parsed.path}` })
        return
      }
      if (!fileStat.isFile()) {
        sendJson(res, 422, { code: 'not-a-file', message: `not a regular file: ${parsed.path}` })
        return
      }
      const invocation = runInvocationFor(parsed.path, effective, fileStat, platform)
      if (invocation === null) {
        sendJson(res, 422, { code: 'no-command', message: `no run command for extension: ${path.extname(parsed.path)}` })
        return
      }
      const bundle = await loadBundle()
      const resolved = (await availability()).get(parsed.app)
      if (resolved === undefined) {
        // The browser's triple intersection makes this unreachable from the
        // menu; a direct POST names a terminal this host never resolved —
        // distinct from "unsupported", which the client cannot act on.
        sendJson(res, 400, { code: 'unavailable-terminal', message: `terminal is not available on this host: ${parsed.app}` })
        return
      }
      let launched
      try {
        launched = await runInTerminal(parsed.app, parsed.path, invocation, {
          platform,
          resolved,
          timeoutMs: effective.launchTimeoutMs,
          launch: seam.launch ?? bundle.resolver.launchDetachedApp,
          runCommand: seam.runCommand ?? execFileAsync,
        })
      } catch {
        sendJson(res, 502, { code: 'launch-failed', message: `failed to run in ${parsed.app}` })
        return
      }
      if (launched) sendJson(res, 200, { ok: true })
      else sendJson(res, 400, { code: 'unsupported-terminal', message: `unsupported terminal: ${parsed.app}` })
    },
  }), 'file-actions: POST /api/file-actions/run')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/file-actions/clone',
    handler: async (req, res) => {
      if (rejected(ctx.connection, req, res)) return
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, 'POST')
        return
      }
      const parsed = await readPost(req, res, parseCloneBody)
      if (parsed === null) return
      if (vcsKindOf(parsed.url) !== parsed.vcs) {
        sendJson(res, 400, { code: 'bad-url', message: `not a ${parsed.vcs} repository URL: ${parsed.url}` })
        return
      }
      if (!path.isAbsolute(parsed.parent)) {
        sendJson(res, 400, { code: 'bad-request', message: 'parent must be absolute' })
        return
      }
      let parentStat
      try {
        parentStat = await statOf(parsed.parent)
      } catch {
        sendJson(res, 404, { code: 'not-found', message: `parent does not exist: ${parsed.parent}` })
        return
      }
      if (!parentStat.isDirectory()) {
        sendJson(res, 400, { code: 'bad-request', message: `parent is not a directory: ${parsed.parent}` })
        return
      }
      const name = repoNameOf(parsed.url)
      if (name === null) {
        sendJson(res, 400, { code: 'bad-url', message: `the URL yields no safe directory name: ${parsed.url}` })
        return
      }
      const target = path.join(parsed.parent, name)
      if (await pathExists(target)) {
        sendJson(res, 409, { code: 'target-exists', message: `target already exists: ${target}` })
        return
      }
      const args = parsed.vcs === 'git'
        ? ['clone', parsed.url, target]
        : ['checkout', parsed.url, target, '--non-interactive']
      try {
        // argv straight to the VCS — no shell — with the URL already
        // option-injection screened, and interactive credential prompts off so
        // a private repo fails fast instead of hanging the bounded command
        // (cached credential helpers and agent keys keep working).
        await (seam.runCommand ?? execFileAsync)(parsed.vcs === 'git' ? 'git' : 'svn', args, {
          timeout: effective.cloneTimeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        })
      } catch {
        sendJson(res, 502, { code: 'clone-failed', message: `failed to ${parsed.vcs === 'git' ? 'clone' : 'check out'} ${parsed.url}` })
        return
      }
      sendJson(res, 200, { ok: true })
    },
  }), 'file-actions: POST /api/file-actions/clone')
}
