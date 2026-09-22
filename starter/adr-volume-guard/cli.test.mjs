import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'

import { formatNotices } from './index.mjs'
import { loadChecksRegistry, loadRepoFiles, runCheck } from '../../scripts/lib/runner.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.join(here, 'cli.mjs')
const root = path.resolve(here, '..', '..')

// This is the PR #21 acceptance criterion, made literal: `cli.mjs docs/adr
// --json`'s output and the volume-report check's own notices must describe
// exactly the same measurement, because scripts/checks/volume-report.mjs
// re-exports starter/adr-volume-guard/index.mjs's run() directly — the
// distributed instrument and the CI check are the same code, run two ways.
test('cli.mjs docs/adr --json matches the volume-report check exactly', async () => {
  const stdout = execFileSync('node', [cliPath, 'docs/adr', '--json'], { cwd: root, encoding: 'utf8' })
  const cliResult = JSON.parse(stdout)

  const checks = loadChecksRegistry(root)
  const volumeReport = checks.find((c) => c.id === 'volume-report')
  assert.ok(volumeReport, 'volume-report must be registered in checks.json')
  const files = loadRepoFiles(root)
  const { notices } = await runCheck(root, volumeReport, { files, messages: [] })

  assert.deepEqual(formatNotices(cliResult), notices)
})

let tmpDir
before(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'adr-volume-guard-cli-'))
})
after(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

test('cli.mjs --dates overrides an unparseable Date: line for a foreign corpus', () => {
  const corpusDir = path.join(tmpDir, 'corpus')
  mkdirSync(corpusDir)
  // A Nygard/adr-tools-style date, DD/MM/YYYY — this instrument's own
  // Date: parser only accepts YYYY-MM-DD, so without --dates this record
  // would report no resolvable date at all.
  writeFileSync(
    path.join(corpusDir, '0001-sample.md'),
    '# 1. Sample\n\nDate: 26/03/2018\n\n## Status\n\nAccepted\n',
  )
  const datesPath = path.join(tmpDir, 'dates.json')
  writeFileSync(datesPath, JSON.stringify({ '0001': '2018-03-26' }))

  const stdout = execFileSync('node', [cliPath, corpusDir, '--json', '--dates', datesPath], { encoding: 'utf8' })
  const result = JSON.parse(stdout)
  assert.equal(result.datesResolved, 1)
  assert.equal(result.items[0].date, '2018-03-26')
})

test('cli.mjs default output includes both the notice lines and the markdown table', () => {
  const stdout = execFileSync('node', [cliPath, 'docs/adr'], { cwd: root, encoding: 'utf8' })
  assert.match(stdout, /^volume: count=\d+/m)
  assert.match(stdout, /\| metric \| p50 \| p90 \| p95 \| max \|/)
})

test('cli.mjs with no directory argument prints the usage message and exits with status 1', () => {
  // spawnSync (not execFileSync, which only throws on a non-zero exit and
  // gives no easy way to assert *why*) so a crash unrelated to the
  // documented usage check — one that also exits non-zero — cannot pass
  // this test by coincidence.
  const result = spawnSync('node', [cliPath], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /^usage: cli\.mjs <adr-directory> \[--json\] \[--dates <path>\]/m)
})

test('cli.mjs docs/adr --dates <path> (flags before the positional directory) still finds the directory', () => {
  const datesPath = path.join(tmpDir, 'flag-order-dates.json')
  writeFileSync(datesPath, JSON.stringify({}))
  const stdout = execFileSync('node', [cliPath, '--dates', datesPath, 'docs/adr', '--json'], { cwd: root, encoding: 'utf8' })
  const result = JSON.parse(stdout)
  assert.equal(result.count, 5)
})
