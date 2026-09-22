import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const FIXTURES_PREFIX = 'scripts/checks/fixtures/'

export function normalizeText(buf) {
  return buf.toString('utf8').replace(/\r\n/g, '\n')
}

function isBinary(buf) {
  return buf.includes(0)
}

function toPosix(relPath) {
  return relPath.split(path.sep).join('/')
}

export function listTrackedFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer' })
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
}

export function walkDir(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(abs, base, out)
    } else if (entry.isFile()) {
      out.push(toPosix(path.relative(base, abs)))
    }
  }
  return out
}

export function loadFilesFromDisk(root, relPaths) {
  const files = []
  for (const rel of relPaths) {
    const abs = path.join(root, rel)
    let buf
    try {
      buf = readFileSync(abs)
    } catch {
      continue
    }
    if (isBinary(buf)) continue
    files.push({ path: toPosix(rel), text: normalizeText(buf) })
  }
  return files
}

export function loadRepoFiles(root) {
  const tracked = listTrackedFiles(root).filter((p) => !p.startsWith(FIXTURES_PREFIX))
  return loadFilesFromDisk(root, tracked)
}

export function loadCommitMessages(root) {
  const base = process.env.COMPASS_BASE_SHA
  const head = process.env.COMPASS_HEAD_SHA
  if (!base || !head) return []
  let out
  try {
    out = execFileSync('git', ['log', `--format=%B%x00`, `${base}..${head}`], {
      cwd: root,
      encoding: 'utf8',
    })
  } catch {
    return []
  }
  return out
    .split('\0')
    .map((m) => m.trim())
    .filter(Boolean)
}

export function loadChecksRegistry(root) {
  const raw = readFileSync(path.join(root, 'checks.json'), 'utf8')
  return JSON.parse(raw).checks
}

export async function loadCheckModule(root, scriptRelPath) {
  const abs = path.join(root, scriptRelPath)
  return import(pathToFileURL(abs).href)
}

// scriptRoot locates check.script on disk and is always the real repository
// root. root is what the check's own run() sees as its working root — for a
// fixture test this is a temporary directory standing in for the repository,
// so it defaults to scriptRoot but callers exercising a fixture override it.
export async function runCheck(scriptRoot, check, { root = scriptRoot, files, messages, strict = false }) {
  const mod = await loadCheckModule(scriptRoot, check.script)
  if (typeof mod.run !== 'function') {
    throw new Error(`${check.script} does not export a run() function`)
  }
  const result = mod.run({ root, files, messages, strict })
  return { findings: [], notices: [], ...result }
}
