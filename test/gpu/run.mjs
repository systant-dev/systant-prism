// npm run gpu [-- --against <ref>] [--tree <ref>] [--report-changes]
//
// Checks the backdrop on the real GPU, in a headless Chrome (or Edge): every scene and
// the glass are built, which compiles every shader, and rendered with this working tree
// (or src as it is at --tree <ref>) and with src as it is at --against <ref> (HEAD by
// default), then compared pixel by pixel. Any error from the GPU, a scene that won't
// build, a render that is black all over, or a byte that differs fails it, and where
// renders differ a picture of it is saved under .gpu-check/diffs.
//
// So a change that should look the same can be shown to: run it before committing. With
// `--against none` it only builds and renders, which still catches a shader the GPU
// refuses, as GlassBackdrop would only quietly show the scene's picture. With
// `--report-changes` a difference is reported and doesn't fail it, for a change that is
// meant to show: the pre-push hook (.githooks/pre-push) runs it that way.
//
// It exits 0 when all is well, 1 when something is broken (or differs, without
// --report-changes), and 2 when it couldn't run here at all: no Chrome or Edge, or no
// WebGPU in it.
//
// npm run gpu -- --pictures [--out <dir>]
//
// Makes DynamicBackground's fallback pictures afresh (src/components/dynamicBackground/pictures, or <dir>),
// for after a change to where a scene's camera looks or its sun, moon or stars are drawn.
// It says how far each is from the one it replaces, and where the moon has gone, before
// git does, and what to put in PAGE_IMAGES (pictures.ts) for the page's colours in it.
//
// No dependency beyond Vite: Chrome is driven over its DevTools protocol with Node's own
// WebSocket. Set CHROME_PATH to use a browser it doesn't find.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')
const WORK = path.join(ROOT, '.gpu-check')
const BASE = path.join(WORK, 'base')
const TREE = path.join(WORK, 'tree')
const DIFFS = path.join(WORK, 'diffs')

/** How long the whole check may take, in ms. Building the forest takes a few seconds, and there are several. */
const TIMEOUT = 10 * 60_000

const against = argument('--against') ?? 'HEAD'
const tree = argument('--tree')
const reportChanges = process.argv.includes('--report-changes')
const pictures = process.argv.includes('--pictures')
const out = path.resolve(ROOT, argument('--out') ?? 'src/components/dynamicBackground/pictures')

function argument(name) {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : undefined
}

/** The check couldn't run on this machine, which says nothing about the code. */
class Unavailable extends Error {}

/** Git in this repository, which is this script's own, so trusted whoever owns the folder. */
function git(args, options = {}) {
  return execFileSync('git', ['-c', `safe.directory=${ROOT.replaceAll('\\', '/')}`, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    ...options,
  })
}

/**
 * The commit `ref` names, as its hash, which is all the rest of this hands to git: a
 * name given on the command line could as well be an option ("--output=…" has git diff
 * write a file), whoever typed it or had a tool type it for them.
 */
function commitOf(ref) {
  try {
    return git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]).trim()
  } catch {
    throw new Error(`"${ref}" names no commit in this repository`)
  }
}

/** Whether src is the same at `ref` as at `other`, or as in the working tree, untracked files and all. */
function sameSrc(ref, other) {
  try {
    git(['diff', '--quiet', ref, ...(other ? [other] : []), '--', 'src'])
  } catch {
    return false
  }
  return other !== undefined || git(['ls-files', '--others', '--exclude-standard', '--', 'src']).trim() === ''
}

/** Writes the tree at `ref` into `folder` (in .gpu-check), through an index of its own, leaving the real one alone. */
function checkOut(ref, folder) {
  fs.rmSync(folder, { recursive: true, force: true })
  const index = path.join(WORK, 'index')
  const env = { ...process.env, GIT_INDEX_FILE: index }
  git(['read-tree', ref], { env })
  git(['checkout-index', '--all', '--force', `--prefix=${path.relative(ROOT, folder).replaceAll('\\', '/')}/`], { env })
  fs.rmSync(index, { force: true })
}

/** A commit, short, by the name it was asked for if that isn't its hash. */
function named(ref, commit) {
  const short = git(['rev-parse', '--short', commit]).trim()
  return /^[0-9a-f]{40,64}$/.test(ref) ? short : `${ref} (${short})`
}

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const { ProgramFiles, LOCALAPPDATA } = process.env
  const x86 = process.env['ProgramFiles(x86)']
  const candidates = [
    ...[ProgramFiles, x86, LOCALAPPDATA]
      .filter(Boolean)
      .map((dir) => path.join(dir, 'Google/Chrome/Application/chrome.exe')),
    ...[ProgramFiles, x86].filter(Boolean).map((dir) => path.join(dir, 'Microsoft/Edge/Application/msedge.exe')),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ]
  const found = candidates.find((file) => fs.existsSync(file))
  if (!found) throw new Unavailable('No Chrome or Edge found: set CHROME_PATH to one')
  return found
}

/** A headless browser, and a session on a page in it, over the DevTools protocol. */
async function openBrowser(url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-gpu-'))
  const child = spawn(
    findBrowser(),
    [
      `--user-data-dir=${profile}`,
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-webgpu',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  const endpoint = await new Promise((resolve, reject) => {
    let said = ''
    const timer = setTimeout(() => reject(new Unavailable(`The browser didn't start:\n${said}`)), 30_000)
    child.stderr.on('data', (data) => {
      said += data
      const found = said.match(/DevTools listening on (ws:\S+)/)
      if (found) {
        clearTimeout(timer)
        resolve(found[1])
      }
    })
    child.on('error', (error) => reject(new Unavailable(`The browser didn't start: ${error.message}`)))
  })
  const socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let next = 0
  const waiting = new Map()
  const problems = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id !== undefined) {
      const { resolve, reject } = waiting.get(message.id)
      waiting.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') {
      const { exception, text } = message.params.exceptionDetails
      problems.push(exception?.description ?? text)
    } else if (message.method === 'Runtime.consoleAPICalled') {
      const text = message.params.args.map((arg) => arg.value ?? arg.description).join(' ')
      if (message.params.type === 'error') problems.push(text)
      // How far it has got, for a run that takes a while.
      else if (message.params.type === 'info') console.log(`  ...   ${text}`)
    }
  })
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++next
      waiting.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Runtime.enable', {}, sessionId)
  await send('Page.enable', {}, sessionId)
  await send('Page.navigate', { url }, sessionId)

  return {
    problems,
    /** The value of `expression`, awaited, in the page. */
    async evaluate(expression) {
      const { result, exceptionDetails } = await send(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      )
      if (exceptionDetails) {
        const message = exceptionDetails.exception?.description ?? exceptionDetails.text
        throw message.includes('no WebGPU adapter')
          ? new Unavailable('This browser has no WebGPU here')
          : new Error(message)
      }
      return result.value
    },
    async close() {
      await send('Browser.close').catch(() => {})
      socket.close()
      child.kill()
      // The browser may hold its profile for a moment after it has gone.
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    },
  }
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  fs.mkdirSync(WORK, { recursive: true })
  fs.rmSync(DIFFS, { recursive: true, force: true })

  // What is rendered: the working tree, or src at a commit.
  let ours = '/src'
  let rendering = 'the working tree'
  const treeCommit = tree && !pictures ? commitOf(tree) : undefined
  if (treeCommit) {
    checkOut(treeCommit, TREE)
    ours = '/.gpu-check/tree/src'
    rendering = `src at ${named(tree, treeCommit)}`
  }
  let base = null
  let comparing = 'nothing: it is only built and rendered'
  if (against !== 'none' && !pictures) {
    const againstCommit = commitOf(against)
    if (sameSrc(againstCommit, treeCommit)) {
      comparing = `nothing: src is as it is at ${named(against, againstCommit)}, so it is only built and rendered`
    } else {
      checkOut(againstCommit, BASE)
      base = '/.gpu-check/base/src'
      comparing = `src at ${named(against, againstCommit)}`
    }
  }

  const server = await createServer({
    root: ROOT,
    logLevel: 'warn',
    clearScreen: false,
    // Its own port and cache, so it can run alongside the demo.
    server: { port: 5181, strictPort: false, hmr: false },
    cacheDir: path.join(WORK, 'vite'),
    optimizeDeps: { entries: ['test/gpu/index.html'] },
  })
  await server.listen()
  let browser = null
  try {
    browser = await openBrowser(new URL('test/gpu/index.html', server.resolvedUrls.local[0]).href)
    const started = Date.now()
    while (!(await browser.evaluate('typeof window.gpuCheck === "function"'))) {
      if (Date.now() - started > 60_000) {
        throw new Error(`The check page never loaded:\n${browser.problems.join('\n') || 'no error was reported'}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    let timer
    const result = await Promise.race([
      browser.evaluate(pictures ? 'window.gpuPictures()' : `window.gpuCheck(${JSON.stringify({ ours, base })})`),
      new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('The check took too long')), TIMEOUT))),
    ]).finally(() => clearTimeout(timer))
    return pictures ? writePictures(result) : report(result, rendering, comparing)
  } finally {
    await browser?.close()
    await server.close()
    fs.rmSync(BASE, { recursive: true, force: true })
    fs.rmSync(TREE, { recursive: true, force: true })
  }
}

/** Prints how each case went, saves the pictures of any differences, and says whether all is well. */
function report({ adapter, cases }, rendering, comparing) {
  console.log(`GPU: ${adapter}`)
  console.log(`Rendering ${rendering}, compared with ${comparing}\n`)
  let failed = 0
  let changed = 0
  // One broken shader breaks every pipeline made from it, in every case: each error is told once.
  const told = new Set()
  for (const c of cases) {
    const errors = [...new Set(c.errors.map((error) => error.trim()))]
    const lines = errors.filter((error) => !told.has(error))
    if (lines.length < errors.length) lines.push('and errors as above')
    for (const error of errors) told.add(error)
    // A render with nothing in it is as broken as one that failed.
    if (!c.errors.length && c.brightness < 1) lines.push('drew nothing: it is black all over')
    const broken = lines.length > 0
    if (c.differing) {
      fs.mkdirSync(DIFFS, { recursive: true })
      const file = path.join(DIFFS, `${slug(c.name)}.png`)
      fs.writeFileSync(file, Buffer.from(c.diff.split(',')[1], 'base64'))
      lines.push(`${c.differing} bytes differ, by up to ${c.largest}/255: ${path.relative(ROOT, file)}`)
      changed++
    }
    const fails = broken || (c.differing > 0 && !reportChanges)
    if (fails) failed++
    const verdict = fails ? 'FAIL' : c.differing ? 'diff' : c.differing === 0 ? 'same' : 'ok'
    console.log(`  ${verdict.padEnd(5)} ${c.name.padEnd(36)} brightness ${c.brightness.toFixed(1)}`)
    for (const line of lines) console.log(`        ${line}`)
  }
  if (failed) console.log(`\n${failed} of ${cases.length} failed.`)
  else if (changed) {
    console.log(
      `\nAll ${cases.length} built and rendered with no GPU errors. ${changed} look different: if that isn't meant, see the pictures above.`,
    )
  } else {
    const matched = comparing.startsWith('src at') ? ', and match pixel for pixel' : ''
    console.log(`\nAll ${cases.length} built and rendered with no GPU errors${matched}.`)
  }
  return failed === 0
}

const at = (point) => (point ? `(${point[0].toFixed(1)}, ${point[1].toFixed(1)})` : 'nowhere')

/** Saves the pictures that were made, says how each compares with the one it replaced, and whether all were made. */
function writePictures(made) {
  fs.mkdirSync(out, { recursive: true })
  console.log(`Pictures, into ${path.relative(ROOT, out) || '.'}:\n`)
  let failed = 0
  for (const picture of made) {
    if (!picture.webp) {
      failed++
      console.log(`  FAIL  ${picture.name}`)
      for (const error of picture.errors) console.log(`        ${error}`)
      continue
    }
    const bytes = Buffer.from(picture.webp.split(',')[1], 'base64')
    // Its name is the page's word for it: as a file's, it keeps to letters, digits and hyphens.
    fs.writeFileSync(path.join(out, `${slug(picture.name)}.webp`), bytes)
    console.log(`  made  ${picture.name.padEnd(14)} ${Math.round(bytes.length / 1024)} kB`)
    console.log(`        page colours (PAGE_IMAGES): ${JSON.stringify(picture.pageImage)}`)
    for (const error of picture.errors) console.log(`        ${error}`)
    if (picture.change === null) {
      console.log('        nothing of the same size to compare it with')
      continue
    }
    console.log(
      `        from the old one, on average: ${picture.skyChange.toFixed(2)}/255 over the sky, ${picture.change.toFixed(2)}/255 over all (WebP alone accounts for about 0.7)`,
    )
    if (picture.moon) {
      const moved = Math.hypot(picture.moon[0] - picture.oldMoon[0], picture.moon[1] - picture.oldMoon[1])
      console.log(`        moon at ${at(picture.moon)}, was ${at(picture.oldMoon)}: ${moved.toFixed(2)} px apart`)
    }
  }
  if (failed) console.log(`\n${failed} of ${made.length} could not be made.`)
  return failed === 0
}

main().then(
  (passed) => {
    process.exitCode = passed ? 0 : 1
  },
  (error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = error instanceof Unavailable ? 2 : 1
  },
)
