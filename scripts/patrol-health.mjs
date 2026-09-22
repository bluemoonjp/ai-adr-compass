import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STALE_CHECK_DAYS, assertValidSourceState, computeRunState, daysSince } from './patrol/state.mjs'

const DEFAULT_STATE_PATH = 'state.json'

function readState(absPath) {
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'))
  } catch {
    return null
  }
}

// Pure: takes an already-parsed state.json so the CLI entry and tests share
// one code path. Returns the lines to print and the exit code to use.
export function evaluate(raw, { now = Date.now() } = {}) {
  const entries = Object.entries(raw?.sources ?? {}).map(([id, entry]) => ({ id, ...entry }))
  if (entries.length === 0) {
    return { lines: ['no-state'], exitCode: 0 }
  }

  for (const e of entries) assertValidSourceState(e.state)

  const sourceEntries = entries.filter((e) => e.role === 'source')
  const controlEntries = entries.filter((e) => e.role !== 'source')

  const { status, reasons, failed } = computeRunState({
    sourceEntries,
    controlEntries,
    openWeeklyIssues: raw?.run?.openWeeklyIssues ?? 0,
    registryCheckPass: raw?.run?.registryCheck !== 'fail',
    now,
  })

  const lines = []
  for (const f of failed) lines.push(`failed: ${f.id} (${f.checkedAt ?? 'unknown date'})`)
  for (const r of reasons) lines.push(`${r.level}: ${r.reason}`)

  const latestCheckedAt = entries
    .map((e) => e.checkedAt)
    .filter((v) => typeof v === 'string')
    .sort()
    .at(-1)
  if (latestCheckedAt && daysSince(latestCheckedAt, now) > STALE_CHECK_DAYS) {
    lines.push(`stale: last checked ${latestCheckedAt}`)
  }

  lines.push(`${status}: ${entries.length} sources`)

  return { lines, exitCode: status === 'broken' ? 1 : 0 }
}

function main() {
  const args = process.argv.slice(2)
  const stateFlag = args.indexOf('--state')
  const statePath = stateFlag !== -1 ? args[stateFlag + 1] : DEFAULT_STATE_PATH
  const raw = readState(path.resolve(process.cwd(), statePath))
  const { lines, exitCode } = evaluate(raw)
  for (const line of lines) console.log(line)
  process.exit(exitCode)
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
