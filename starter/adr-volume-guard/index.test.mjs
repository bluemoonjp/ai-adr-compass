import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluateThresholds, formatNotices, measure, renderMarkdown, run, validateConfigAgainstCorpus } from './index.mjs'

// Three synthetic corpora with dates spaced 10-11 days apart (never within
// the 7-day pace window) so hub and clean share the same trivial pace shape
// {p50:1,p90:1,p95:1,max:1}, and one corpus (burst) deliberately packed
// inside a single week to exercise the opposite case. Every expected number
// below was hand-derived from the quantile definition in index.mjs
// (pos = q*(n-1), linearly interpolated between the two nearest ranks).

function rec(path, text) {
  return { path, text }
}

function adr(id, date, body) {
  return rec(`docs/adr/${id}-sample.md`, `# ADR-${id}: Sample\n\nStatus: accepted\n\nDate: ${date}\n\n## Context\n\n${body}\n`)
}

const CLEAN = [
  adr('0001', '2023-01-01', 'No references.'),
  adr('0002', '2023-01-11', 'References ADR-0001.'),
  adr('0003', '2023-01-21', 'References ADR-0002.'),
]
const CLEAN_NOW = Date.UTC(2023, 1, 1) // 2023-02-01

const HUB = [
  adr('0001', '2023-01-01', 'No references — this is the hub target.'),
  adr('0002', '2023-01-11', 'References ADR-0001.'),
  adr('0003', '2023-01-21', 'References ADR-0001.'),
  adr('0004', '2023-02-01', 'References ADR-0001, ADR-0001, ADR-0001, and ADR-0002.'),
]
const HUB_NOW = Date.UTC(2023, 1, 11) // 2023-02-11

const BURST = [
  adr('0001', '2023-01-01', 'No references.'),
  adr('0002', '2023-01-02', 'No references.'),
  adr('0003', '2023-01-03', 'No references.'),
  adr('0004', '2023-01-04', 'No references.'),
  adr('0005', '2023-02-01', 'No references — isolated from the burst.'),
]
const BURST_NOW = Date.UTC(2023, 1, 1) // 2023-02-01

test('measure: clean corpus — a simple reference chain with no repeats', () => {
  const result = measure(CLEAN, { now: CLEAN_NOW })
  assert.equal(result.count, 3)
  assert.equal(result.datesResolved, 3)
  assert.equal(result.unresolvedRefsTotal, 0)
  assert.deepEqual(
    result.items.map((i) => [i.id, i.fanOutTotal, i.fanOutDistinct, i.fanInTotal, i.fanInDistinct, i.daysSinceDecision]),
    [
      ['0001', 0, 0, 1, 1, 31],
      ['0002', 1, 1, 1, 1, 21],
      ['0003', 1, 1, 0, 0, 11],
    ],
  )
  assert.deepEqual(result.fanOutTotal, { count: 3, p50: 1, p90: 1, p95: 1, max: 1 })
  assert.deepEqual(result.fanOutDistinct, { count: 3, p50: 1, p90: 1, p95: 1, max: 1 })
  assert.deepEqual(result.paceWindow7, { count: 3, p50: 1, p90: 1, p95: 1, max: 1 })
  assert.deepEqual(result.staleDays, { count: 3, p50: 21, p90: 29, p95: 30, max: 31 })
})

test('measure: hub corpus — one record cites the same target three times (fanOutTotal !== fanOutDistinct)', () => {
  const result = measure(HUB, { now: HUB_NOW })
  assert.equal(result.count, 4)
  assert.equal(result.unresolvedRefsTotal, 0)

  const hubRecord = result.items.find((i) => i.id === '0004')
  assert.equal(hubRecord.fanOutTotal, 4)
  assert.equal(hubRecord.fanOutDistinct, 2)
  assert.notEqual(hubRecord.fanOutTotal, hubRecord.fanOutDistinct)

  const target = result.items.find((i) => i.id === '0001')
  assert.equal(target.fanInTotal, 5) // 1 (0002) + 1 (0003) + 3 (0004)
  assert.equal(target.fanInDistinct, 3) // 0002, 0003, 0004
  assert.notEqual(target.fanInTotal, target.fanInDistinct)

  assert.deepEqual(result.fanOutTotal, { count: 4, p50: 1, p90: 3.1, p95: 3.55, max: 4 })
  assert.deepEqual(result.fanOutDistinct, { count: 4, p50: 1, p90: 1.7, p95: 1.85, max: 2 })
  assert.deepEqual(result.fanInTotal, { count: 4, p50: 0.5, p90: 3.8, p95: 4.4, max: 5 })
  assert.deepEqual(result.fanInDistinct, { count: 4, p50: 0.5, p90: 2.4, p95: 2.7, max: 3 })
  assert.deepEqual(result.paceWindow7, { count: 4, p50: 1, p90: 1, p95: 1, max: 1 })
  assert.deepEqual(result.staleDays, { count: 4, p50: 26, p90: 38, p95: 39.5, max: 41 })
})

test('measure: burst corpus — four records inside one week, a fifth isolated', () => {
  const result = measure(BURST, { now: BURST_NOW })
  assert.equal(result.count, 5)
  assert.deepEqual(
    result.items.map((i) => i.id),
    ['0001', '0002', '0003', '0004', '0005'],
  )
  // The corpus-level paceWindow7 distribution (records per each record's own
  // trailing 7-day window, including itself) is the real assertion on this
  // dimension — measure() exposes no per-item pace field to check directly.
  assert.deepEqual(result.paceWindow7, { count: 5, p50: 2, p90: 3.6, p95: 3.8, max: 4 })
  assert.deepEqual(result.staleDays, { count: 5, p50: 29, p90: 30.6, p95: 30.8, max: 31 })
  // Every BURST record's own H1 ("# ADR-000N: Sample") does contain an
  // ADR-NNNN match, but it is a reference to itself, excluded from fan-out
  // and fan-in by the self-reference rule — not because this corpus has no
  // ADR-NNNN text at all. No record here cites another.
  assert.deepEqual(result.fanOutTotal, { count: 5, p50: 0, p90: 0, p95: 0, max: 0 })
  assert.deepEqual(result.fanInTotal, { count: 5, p50: 0, p90: 0, p95: 0, max: 0 })
})

test('measure: an ADR-NNNN reference to a number absent from the corpus is unresolved, not fan-out', () => {
  const records = [
    adr('0001', '2023-01-01', 'No references.'),
    adr('0002', '2023-01-11', 'References ADR-9999, which does not exist here.'),
  ]
  const result = measure(records, { now: Date.UTC(2023, 1, 1) })
  assert.equal(result.unresolvedRefsTotal, 1)
  assert.equal(result.unresolvedRefs[0].ref, 9999)
  assert.equal(result.unresolvedRefs[0].path, 'docs/adr/0002-sample.md')
  // The adr() helper's template puts the body on line 9 (H1, blank, Status:,
  // blank, Date:, blank, ## Context, blank, then the body) — line is what
  // makes a finding anchorable to a location in CI output, so a regression
  // here (an off-by-one in findRefs()) must fail this test.
  assert.equal(result.unresolvedRefs[0].line, 9)
  const referencer = result.items.find((i) => i.id === '0002')
  assert.equal(referencer.fanOutTotal, 0, 'an unresolved reference must not count as fan-out')
})

test('measure: a --dates override wins over the record\'s own Date: line', () => {
  const records = [adr('0001', '2023-01-01', 'No references.')]
  const result = measure(records, { now: Date.UTC(2023, 1, 1), dates: { '0001': '2023-01-20' } })
  assert.equal(result.items[0].date, '2023-01-20')
})

test('measure: an invalid (non-ISO) --dates override falls back to the record\'s own Date: line', () => {
  const records = [adr('0001', '2023-01-05', 'No references.')]
  const result = measure(records, { now: Date.UTC(2023, 1, 1), dates: { '0001': '05/01/2023' } })
  assert.equal(result.items[0].date, '2023-01-05')
})

test('measure: a record with no resolvable date is excluded from date-based stats but still counted', () => {
  const records = [rec('docs/adr/0001-no-date.md', '# ADR-0001\n\nStatus: accepted\n\n## Context\n\nNo Date: line here.\n')]
  const result = measure(records, { now: Date.UTC(2023, 1, 1) })
  assert.equal(result.count, 1)
  assert.equal(result.datesResolved, 0)
  assert.equal(result.items[0].date, null)
  assert.equal(result.items[0].daysSinceDecision, null)
  assert.deepEqual(result.staleDays, { count: 0, p50: null, p90: null, p95: null, max: null })
})

test('run: docs/adr/** only, README excluded, unresolved refs become findings', () => {
  const files = [
    ...HUB,
    rec('docs/adr/README.md', '# Architecture Decision Records\n\nADR-9999 mentioned here must not be scanned.\n'),
    rec('practices/0001-unrelated.md', 'Not an ADR directory.'),
  ]
  const { findings, notices } = run({ files })
  assert.deepEqual(findings, [])
  assert.ok(notices.some((n) => n.startsWith('volume: count=4 ')))
})

test('run: an unresolved reference inside docs/adr/ produces exactly one finding', () => {
  const files = [
    adr('0001', '2023-01-01', 'No references.'),
    adr('0002', '2023-01-11', 'References ADR-9999.'),
  ]
  const { findings } = run({ files })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].ruleId, 'volume-report:unresolved-ref')
  assert.equal(findings[0].path, 'docs/adr/0002-sample.md')
  assert.equal(findings[0].line, 9)
})

test('measure and run: a genuinely empty records array never throws, and every distribution is null/zero', () => {
  const result = measure([])
  assert.equal(result.count, 0)
  assert.equal(result.datesResolved, 0)
  assert.equal(result.unresolvedRefsTotal, 0)
  for (const key of ['fanOutTotal', 'fanOutDistinct', 'fanInTotal', 'fanInDistinct', 'paceWindow7', 'staleDays']) {
    assert.deepEqual(result[key], { count: 0, p50: null, p90: null, p95: null, max: null })
  }
  assert.deepEqual(run({ files: [] }), { findings: [], notices: formatNotices(result) })
  assert.ok(!formatNotices(result).some((n) => n.includes('NaN') || n.includes('undefined')))
  assert.ok(!renderMarkdown(result).includes('NaN'))
})

test('formatNotices and renderMarkdown both surface the unresolved-ref count', () => {
  const result = measure(
    [adr('0001', '2023-01-01', 'No references.'), adr('0002', '2023-01-11', 'References ADR-9999.')],
    { now: Date.UTC(2023, 1, 1) },
  )
  assert.ok(formatNotices(result)[0].includes('unresolvedRefs=1'))
  assert.ok(renderMarkdown(result).includes('unresolved references (always significant, regardless of any threshold): 1'))
})

test('validateConfigAgainstCorpus: an all-null config is always accepted', () => {
  const measured = measure(HUB, { now: HUB_NOW })
  const config = JSON.parse(
    '{"thresholds":{"fanOutTotal":{"operator":">","value":null,"derivedFrom":null,"measuredOn":null}}}',
  )
  assert.deepEqual(validateConfigAgainstCorpus(config, measured), [])
})

test('validateConfigAgainstCorpus: rejects a threshold at or below the corpus\'s own measured median', () => {
  const measured = measure(HUB, { now: HUB_NOW }) // fanOutTotal p50 = 1
  const config = {
    thresholds: {
      fanOutTotal: { operator: '>', value: 1, derivedFrom: 'this corpus', measuredOn: '2026-09-22' },
    },
  }
  const errors = validateConfigAgainstCorpus(config, measured)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].metric, 'fanOutTotal')
})

test('validateConfigAgainstCorpus: accepts a threshold with real margin over the median, given derivedFrom/measuredOn', () => {
  const measured = measure(HUB, { now: HUB_NOW }) // fanOutTotal p50 = 1
  const config = {
    thresholds: {
      fanOutTotal: { operator: '>', value: 10, derivedFrom: 'this corpus, 2026-09-22', measuredOn: '2026-09-22' },
    },
  }
  assert.deepEqual(validateConfigAgainstCorpus(config, measured), [])
})

test('validateConfigAgainstCorpus: a non-null value without derivedFrom/measuredOn is rejected', () => {
  const measured = measure(HUB, { now: HUB_NOW })
  const config = { thresholds: { fanOutTotal: { operator: '>', value: 10, derivedFrom: null, measuredOn: null } } }
  const errors = validateConfigAgainstCorpus(config, measured)
  assert.equal(errors.length, 1)
  assert.match(errors[0].reason, /derivedFrom and measuredOn/)
})

test('validateConfigAgainstCorpus: rejects an operator other than > or >=', () => {
  const measured = measure(HUB, { now: HUB_NOW })
  const config = {
    thresholds: { fanOutTotal: { operator: '<', value: 10, derivedFrom: 'x', measuredOn: '2026-09-22' } },
  }
  const errors = validateConfigAgainstCorpus(config, measured)
  assert.equal(errors.length, 1)
  assert.match(errors[0].reason, /operator must be/)
})

test('validateConfigAgainstCorpus: a misspelled metric name is rejected, not silently skipped', () => {
  const measured = measure(HUB, { now: HUB_NOW })
  // A broken value (below zero, which no fan-out count can ever be) under a
  // typo'd key ("fanOut" instead of "fanOutTotal") must not pass silently —
  // that would be the same class of arithmetically-broken-threshold mistake
  // this instrument exists to prevent, reached by a different route.
  const config = { thresholds: { fanOut: { operator: '>', value: -999, derivedFrom: 'x', measuredOn: '2026-09-22' } } }
  const errors = validateConfigAgainstCorpus(config, measured)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].metric, 'fanOut')
  assert.match(errors[0].reason, /unknown metric/)
  assert.deepEqual(evaluateThresholds(measured, config), [], 'an unvalidated, unknown metric evaluates to no warnings, not a crash')
})

test('evaluateThresholds: trips a warning when the corpus p95 exceeds the threshold', () => {
  const measured = measure(HUB, { now: HUB_NOW }) // fanOutTotal p95 = 3.55
  const config = { thresholds: { fanOutTotal: { operator: '>', value: 3, derivedFrom: 'x', measuredOn: '2026-09-22' } } }
  const warnings = evaluateThresholds(measured, config)
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].metric, 'fanOutTotal')
  assert.equal(warnings[0].p95, 3.55)
})

test('evaluateThresholds: no warning when the corpus p95 does not exceed the threshold', () => {
  const measured = measure(HUB, { now: HUB_NOW }) // fanOutTotal p95 = 3.55
  const config = { thresholds: { fanOutTotal: { operator: '>', value: 4, derivedFrom: 'x', measuredOn: '2026-09-22' } } }
  assert.deepEqual(evaluateThresholds(measured, config), [])
})

test('evaluateThresholds: ">=" trips exactly at the threshold value', () => {
  const measured = measure(HUB, { now: HUB_NOW }) // fanOutDistinct p95 = 1.85
  const config = { thresholds: { fanOutDistinct: { operator: '>=', value: 1.85, derivedFrom: 'x', measuredOn: '2026-09-22' } } }
  assert.equal(evaluateThresholds(measured, config).length, 1)
})
