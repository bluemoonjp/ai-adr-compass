import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { computeFreshness, renderMarkdown as renderFreshnessMarkdown } from '../checks/freshness-report.mjs'
import { evaluate as evaluateHealth } from '../patrol-health.mjs'
import { loadRepoFiles } from '../lib/runner.mjs'
import { measureAdrDir, renderMarkdown as renderVolumeMarkdown } from '../../starter/adr-volume-guard/index.mjs'
import { renderLinkSection, summarizeLycheeStats } from './link-report.mjs'
import { daysSince } from './state.mjs'

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const STATE_VALUES = new Set(['no-baseline', 'not-modified', 'unchanged', 'changed', 'failed'])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const URL_PATTERN = /^https:\/\/\S+$/

// Every value rendered into the issue body passes through one of these, so
// a field this repository doesn't control (an anchor's own state.json entry,
// written by a previous run) can only ever contribute an allowed shape — see
// format.mjs's identical reasoning. The issue body and CI logs are a public
// surface.
//
// The `## Volume` section below (renderVolumeMarkdown) does not go through
// a safe*() wrapper of its own: unlike state.json, which patrol.mjs fills
// from a live fetch of an external, potentially adversarial URL,
// measureAdrDir() reads only this repository's own git-tracked, PR-reviewed
// docs/adr/*.md files, and renders nothing but computed integers/floats
// (fmt() in starter/adr-volume-guard/index.mjs) — never a record's own
// prose. There is no untrusted text on that path to leak.
function safeId(v) {
  return typeof v === 'string' && ID_PATTERN.test(v) ? v : 'invalid-id'
}
function safeState(v) {
  return STATE_VALUES.has(v) ? v : 'unknown'
}
function safeHttp(v) {
  return v === null || v === undefined ? '-' : Number.isInteger(v) && v >= 100 && v < 600 ? String(v) : '-'
}
function safeBytes(v) {
  return Number.isInteger(v) && v >= 0 ? String(v) : '0'
}
function safeDate(v) {
  return typeof v === 'string' && DATE_PATTERN.test(v) ? v : '—'
}
function safeWeeks(v) {
  return Number.isInteger(v) && v >= 0 ? String(v) : '—'
}
function safeUrl(v) {
  return typeof v === 'string' && URL_PATTERN.test(v) ? v : ''
}

// Pure: sources/state.json's entries plus sources/baseline.json's
// acceptedOn, joined by id. Takes already-parsed objects so this is testable
// without touching disk.
export function buildSourceRows({ state, baseline, now = Date.now() }) {
  const rows = []
  for (const [id, entry] of Object.entries(state?.sources ?? {})) {
    const isSource = entry?.role === 'source'
    const baselineDate = isSource ? baseline?.[id]?.acceptedOn : undefined
    const weeks = entry?.state === 'changed' && entry?.firstChangedAt ? Math.floor(daysSince(entry.firstChangedAt, now) / 7) : undefined
    rows.push({
      id: safeId(id),
      state: safeState(entry?.state),
      http: safeHttp(entry?.http),
      bytes: safeBytes(entry?.bytes),
      baselineDate: safeDate(baselineDate),
      weeks: safeWeeks(weeks),
    })
  }
  rows.sort((a, b) => a.id.localeCompare(b.id))
  return rows
}

// Pure: id + registry url for every anchor in a given state, source-only
// when `sourceOnly` is set (the changed list excludes controls; the failed
// list does not).
export function listIdsByState(state, registry, targetState, { sourceOnly = false } = {}) {
  const urlById = new Map((registry?.sources ?? []).map((a) => [a.id, a.url]))
  return Object.entries(state?.sources ?? {})
    .filter(([, entry]) => entry?.state === targetState && (!sourceOnly || entry?.role === 'source'))
    .map(([id]) => ({ id: safeId(id), url: safeUrl(urlById.get(id)) }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function renderTable(rows) {
  const lines = ['| id | state | http | bytes | baseline date | unprocessed weeks |', '| --- | --- | --- | --- | --- | --- |']
  for (const r of rows) lines.push(`| ${r.id} | ${r.state} | ${r.http} | ${r.bytes} | ${r.baselineDate} | ${r.weeks} |`)
  return lines.join('\n')
}

function renderIdList(items) {
  if (items.length === 0) return '(none)'
  return items.map((i) => (i.url ? `- ${i.id} (${i.url})` : `- ${i.id}`)).join('\n')
}

// Pure: assembles the full weekly Issue body from already-computed pieces.
export function renderIssueBody({ health, sourceRows, changed, failed, freshnessMarkdown, volumeMarkdown, linksSection }) {
  return [
    '## Run status',
    '',
    ...health.lines,
    '',
    '## Sources',
    '',
    renderTable(sourceRows),
    '',
    '## Changed',
    '',
    renderIdList(changed),
    '',
    '## Failed',
    '',
    renderIdList(failed),
    '',
    '## Freshness',
    '',
    freshnessMarkdown,
    '',
    '## Volume',
    '',
    volumeMarkdown,
    '',
    '## External links',
    '',
    linksSection,
    '',
  ].join('\n')
}

function readJson(absPath, fallback) {
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'))
  } catch {
    return fallback
  }
}

function main() {
  const args = process.argv.slice(2)
  const stateFlag = args.indexOf('--state')
  const linksFlag = args.indexOf('--links-json')
  if (stateFlag === -1) {
    console.error('usage: issue-body.mjs --state <path> [--links-json <path>]')
    process.exit(1)
  }

  const root = process.cwd()
  const state = readJson(path.resolve(root, args[stateFlag + 1]), { sources: {} })
  const registry = readJson(path.join(root, 'sources', 'registry.json'), { sources: [] })
  const baseline = readJson(path.join(root, 'sources', 'baseline.json'), {})
  const linksStats = linksFlag !== -1 ? readJson(path.resolve(root, args[linksFlag + 1]), {}) : {}

  const health = evaluateHealth(state)
  const sourceRows = buildSourceRows({ state, baseline })
  const changed = listIdsByState(state, registry, 'changed', { sourceOnly: true })
  const failed = listIdsByState(state, registry, 'failed')
  const repoFiles = loadRepoFiles(root)
  const freshness = computeFreshness(repoFiles)
  const volume = measureAdrDir(repoFiles)
  const linksSection = renderLinkSection(summarizeLycheeStats(linksStats))

  console.log(
    renderIssueBody({
      health,
      sourceRows,
      changed,
      failed,
      freshnessMarkdown: renderFreshnessMarkdown(freshness),
      volumeMarkdown: renderVolumeMarkdown(volume),
      linksSection,
    }),
  )
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
