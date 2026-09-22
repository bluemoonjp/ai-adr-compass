import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertValidSourceState,
  computeRunState,
  controlMismatch,
  daysSince,
  isValidSourceState,
  lingeringChanged,
  nextFirstChangedAt,
} from './state.mjs'

test('isValidSourceState accepts only the closed set', () => {
  for (const s of ['no-baseline', 'not-modified', 'unchanged', 'changed', 'failed']) {
    assert.equal(isValidSourceState(s), true)
  }
  assert.equal(isValidSourceState('unknown-state'), false)
  assert.equal(isValidSourceState(undefined), false)
})

test('assertValidSourceState throws on an unknown value', () => {
  assert.throws(() => assertValidSourceState('bogus'))
  assert.doesNotThrow(() => assertValidSourceState('changed'))
})

test('nextFirstChangedAt starts tracking the first time a source becomes changed', () => {
  assert.equal(nextFirstChangedAt({ state: 'changed', previousFirstChangedAt: undefined, today: '2026-09-19' }), '2026-09-19')
})

test('nextFirstChangedAt carries the original date forward while still changed', () => {
  assert.equal(nextFirstChangedAt({ state: 'changed', previousFirstChangedAt: '2026-09-01', today: '2026-09-19' }), '2026-09-01')
})

test('nextFirstChangedAt clears once the state is no longer changed', () => {
  assert.equal(nextFirstChangedAt({ state: 'unchanged', previousFirstChangedAt: '2026-09-01', today: '2026-09-19' }), undefined)
})

test('daysSince counts whole UTC days', () => {
  const now = Date.UTC(2026, 8, 19)
  assert.equal(daysSince('2026-09-01', now), 18)
})

test('lingeringChanged finds a source changed for more than 8 days', () => {
  const now = Date.UTC(2026, 8, 19)
  const entries = [
    { id: 'a', state: 'changed', firstChangedAt: '2026-09-10' }, // 9 days
    { id: 'b', state: 'changed', firstChangedAt: '2026-09-15' }, // 4 days
    { id: 'c', state: 'unchanged', firstChangedAt: undefined },
  ]
  const result = lingeringChanged(entries, now)
  assert.deepEqual(result.map((e) => e.id), ['a'])
})

test('controlMismatch: control-static mismatches only on changed', () => {
  assert.equal(controlMismatch('control-static', 'changed'), true)
  assert.equal(controlMismatch('control-static', 'unchanged'), false)
  assert.equal(controlMismatch('control-static', 'not-modified'), false)
})

test('controlMismatch: control-changing mismatches on unchanged or not-modified', () => {
  assert.equal(controlMismatch('control-changing', 'unchanged'), true)
  assert.equal(controlMismatch('control-changing', 'not-modified'), true)
  assert.equal(controlMismatch('control-changing', 'changed'), false)
})

test('controlMismatch: published-static mismatches only on changed, same comparison as control-static', () => {
  assert.equal(controlMismatch('published-static', 'changed'), true)
  assert.equal(controlMismatch('published-static', 'unchanged'), false)
  assert.equal(controlMismatch('published-static', 'not-modified'), false)
})

function sourceEntry(state, overrides = {}) {
  return { id: 'sample-source', state, ...overrides }
}

test('computeRunState: a healthy run is ok', () => {
  const { status, reasons } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [{ id: 'control-static-rfc2119', role: 'control-static', state: 'unchanged' }],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'ok')
  assert.deepEqual(reasons, [])
})

test('computeRunState: a control mismatch is broken', () => {
  const { status, reasons } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [{ id: 'control-changing-time', role: 'control-changing', state: 'unchanged' }],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'broken')
  assert.ok(reasons.some((r) => r.reason.includes('control-changing-time')))
})

test('computeRunState: exactly one failed source is degraded, not broken', () => {
  const { status } = computeRunState({
    sourceEntries: [sourceEntry('failed'), sourceEntry('unchanged', { id: 'other' })],
    controlEntries: [],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'degraded')
})

test('computeRunState: a changed published-static entry is broken, with a distinct reason from a control mismatch', () => {
  const { status, reasons } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [{ id: 'measurement-corpus-a', role: 'published-static', state: 'changed' }],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'broken')
  assert.ok(reasons.some((r) => r.reason.includes('published measurement measurement-corpus-a no longer matches its published bytes')))
  assert.ok(!reasons.some((r) => r.reason.startsWith('control ')))
})

test('computeRunState: a control that only failed to fetch is degraded, not broken', () => {
  const { status } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [{ id: 'control-static-rfc2119', role: 'control-static', state: 'failed' }],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'degraded')
})

test('computeRunState: a control with no prior observation is excluded from evaluation', () => {
  const { status, reasons } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [{ id: 'control-static-rfc2119', role: 'control-static', state: 'no-baseline' }],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'ok')
  assert.deepEqual(reasons, [])
})

test('computeRunState: no source fetched or not-modified is broken', () => {
  const { status, reasons } = computeRunState({
    sourceEntries: [sourceEntry('failed')],
    controlEntries: [],
    openWeeklyIssues: 1,
    registryCheckPass: true,
  })
  assert.equal(status, 'broken')
  assert.ok(reasons.some((r) => r.reason.includes('no source was fetched')))
})

test('computeRunState: a failing registry-check is broken', () => {
  const { status } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [],
    openWeeklyIssues: 1,
    registryCheckPass: false,
  })
  assert.equal(status, 'broken')
})

test('computeRunState: 2 or more open weekly issues is degraded', () => {
  const { status } = computeRunState({
    sourceEntries: [sourceEntry('unchanged')],
    controlEntries: [],
    openWeeklyIssues: 2,
    registryCheckPass: true,
  })
  assert.equal(status, 'degraded')
})

test('computeRunState: a source changed for more than 8 days is degraded', () => {
  const now = Date.UTC(2026, 8, 19)
  const { status } = computeRunState({
    sourceEntries: [sourceEntry('changed', { firstChangedAt: '2026-09-01' })],
    controlEntries: [],
    openWeeklyIssues: 1,
    registryCheckPass: true,
    now,
  })
  assert.equal(status, 'degraded')
})

test('computeRunState: broken outranks degraded when both apply', () => {
  const { status } = computeRunState({
    sourceEntries: [sourceEntry('failed')],
    controlEntries: [],
    openWeeklyIssues: 2,
    registryCheckPass: true,
  })
  assert.equal(status, 'broken')
})
