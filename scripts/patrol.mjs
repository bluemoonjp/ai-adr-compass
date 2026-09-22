import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { run as registryCheckRun } from './checks/registry-check.mjs'
import { loadRepoFiles } from './lib/runner.mjs'
import { fetchAnchor } from './patrol/fetch.mjs'
import { formatLines } from './patrol/format.mjs'
import { probeUrl } from './patrol/probe.mjs'
import { nextFirstChangedAt } from './patrol/state.mjs'

const REGISTRY_PATH = 'sources/registry.json'
const BASELINE_PATH = 'sources/baseline.json'
const DEFAULT_STATE_PATH = 'state.json'

function readJson(absPath, fallback) {
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'))
  } catch {
    return fallback
  }
}

async function runProbe(urls) {
  let exitCode = 0
  for (const url of urls) {
    try {
      const result = await probeUrl(url)
      const suffix = result.patterns.length > 0 ? ` patterns=${result.patterns.join(',')}` : ''
      console.log(`${url} volatile=${result.volatile} recommendedMethod=${result.recommendedMethod}${suffix}`)
    } catch {
      console.log(`${url} volatile=unknown recommendedMethod=none`)
      exitCode = 1
    }
  }
  return exitCode
}

// Pure-ish: takes already-loaded registry/baseline/previousState so this can
// be tested with mocked fetch/files instead of real disk and network I/O.
export async function runPatrol({ registry, baseline, previousState, repoFiles, openWeeklyIssues = 0, fetchOpts = {} }) {
  const today = new Date().toISOString().slice(0, 10)
  const hostState = new Map()
  const nextSources = {}
  const records = []

  for (const anchor of registry.sources ?? []) {
    const isControl = anchor.role !== 'source'
    const baselineEntry = isControl ? previousState.sources?.[anchor.id] : baseline[anchor.id]
    const result = await fetchAnchor(anchor, baselineEntry, { ...fetchOpts, hostState })

    const previousEntry = previousState.sources?.[anchor.id]
    const firstChangedAt =
      anchor.role === 'source'
        ? nextFirstChangedAt({ state: result.state, previousFirstChangedAt: previousEntry?.firstChangedAt, today })
        : undefined

    nextSources[anchor.id] = {
      role: anchor.role,
      state: result.state,
      checkedAt: result.checkedAt,
      http: result.http ?? null,
      ...(result.etag !== undefined ? { etag: result.etag } : {}),
      ...(result.md5 !== undefined ? { md5: result.md5 } : {}),
      bytes: result.bytes ?? 0,
      ...(firstChangedAt ? { firstChangedAt } : {}),
    }

    records.push({
      id: anchor.id,
      state: result.state,
      http: result.http ?? null,
      bytes: result.bytes ?? 0,
      hash: (result.hash ?? '').slice(0, 8),
      date: result.checkedAt.slice(0, 10),
      url: anchor.url,
    })
  }

  const registryCheckResult = registryCheckRun({ files: repoFiles })
  const registryCheckPass = registryCheckResult.findings.length === 0

  const nextState = {
    sources: nextSources,
    run: { openWeeklyIssues, registryCheck: registryCheckPass ? 'pass' : 'fail' },
  }

  return { nextState, records, registryCheckPass }
}

async function runMain({ root, statePath, openWeeklyIssues }) {
  const registry = readJson(path.join(root, REGISTRY_PATH), { sources: [] })
  const baseline = readJson(path.join(root, BASELINE_PATH), {})
  const previousState = readJson(statePath, { sources: {} })
  const repoFiles = loadRepoFiles(root)

  const { nextState, records } = await runPatrol({ registry, baseline, previousState, repoFiles, openWeeklyIssues })

  writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`)

  for (const line of formatLines(records)) console.log(line)
  const fetchedOrNotModified = records.filter((r) => r.state !== 'failed').length
  console.log(`fetched-or-not-modified: ${fetchedOrNotModified} / ${records.length}`)
  console.log(`registry-check: ${nextState.run.registryCheck}`)
}

function parseArgs(args) {
  const stateFlag = args.indexOf('--state')
  const statePath = stateFlag !== -1 ? args[stateFlag + 1] : DEFAULT_STATE_PATH
  const issuesFlag = args.indexOf('--open-weekly-issues')
  const openWeeklyIssues = issuesFlag !== -1 ? Number(args[issuesFlag + 1]) : 0
  return { statePath, openWeeklyIssues }
}

async function main() {
  const args = process.argv.slice(2)
  const probeIndex = args.indexOf('--probe')

  if (probeIndex !== -1) {
    const urls = args.slice(probeIndex + 1)
    if (urls.length === 0) {
      console.error('usage: patrol.mjs --probe <url> [<url> ...]')
      process.exit(1)
    }
    process.exit(await runProbe(urls))
    return
  }

  const root = process.cwd()
  const { statePath, openWeeklyIssues } = parseArgs(args)
  await runMain({ root, statePath: path.resolve(root, statePath), openWeeklyIssues })
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
