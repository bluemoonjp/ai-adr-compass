import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluate } from './patrol-health.mjs'
import { nextFirstChangedAt } from './patrol/state.mjs'

function baseState(overrides = {}) {
  return {
    sources: {
      'sample-source': { role: 'source', state: 'unchanged', checkedAt: '2026-09-19T03:00:00.000Z', md5: 'abc' },
      'control-static-rfc2119': { role: 'control-static', state: 'unchanged', checkedAt: '2026-09-19T03:00:00.000Z' },
      'control-changing-time': { role: 'control-changing', state: 'changed', checkedAt: '2026-09-19T03:00:00.000Z' },
    },
    run: { openWeeklyIssues: 1, registryCheck: 'pass' },
    ...overrides,
  }
}

test('an empty state.json reports no-state and exits 0', () => {
  const { lines, exitCode } = evaluate({ sources: {} })
  assert.deepEqual(lines, ['no-state'])
  assert.equal(exitCode, 0)
})

test('a missing state.json (null) reports no-state and exits 0', () => {
  const { lines, exitCode } = evaluate(null)
  assert.deepEqual(lines, ['no-state'])
  assert.equal(exitCode, 0)
})

test('a healthy state reports ok: N sources and exits 0', () => {
  const { lines, exitCode } = evaluate(baseState())
  assert.equal(exitCode, 0)
  assert.equal(lines.at(-1), 'ok: 3 sources')
})

test('a control mismatch is broken and exits 1', () => {
  const state = baseState({
    sources: {
      ...baseState().sources,
      'control-changing-time': { role: 'control-changing', state: 'unchanged', checkedAt: '2026-09-19T03:00:00.000Z' },
    },
  })
  const { lines, exitCode } = evaluate(state)
  assert.equal(exitCode, 1)
  assert.ok(lines.some((l) => l.startsWith('broken:') && l.includes('control-changing-time')))
})

test('a changed published-static entry is broken and exits 1, with a distinct message from a control mismatch', () => {
  const state = baseState({
    sources: {
      ...baseState().sources,
      'measurement-corpus-a': { role: 'published-static', state: 'changed', checkedAt: '2026-09-19T03:00:00.000Z' },
    },
  })
  const { lines, exitCode } = evaluate(state)
  assert.equal(exitCode, 1)
  assert.ok(lines.some((l) => l.startsWith('broken:') && l.includes('published measurement measurement-corpus-a')))
  assert.ok(!lines.some((l) => l.includes('control measurement-corpus-a')))
})

test('exactly one failed source is degraded and exits 0, with the failure shown first', () => {
  const state = baseState({
    sources: {
      ...baseState().sources,
      'sample-source': { role: 'source', state: 'failed', checkedAt: '2026-09-19T03:00:00.000Z' },
      'other-source': { role: 'source', state: 'unchanged', checkedAt: '2026-09-19T03:00:00.000Z' },
    },
  })
  const { lines, exitCode } = evaluate(state)
  assert.equal(exitCode, 0)
  assert.match(lines[0], /^failed: sample-source/)
  assert.ok(lines.some((l) => l.startsWith('degraded:')))
})

test('an unknown source state string throws a validation error', () => {
  const state = baseState({
    sources: { ...baseState().sources, 'sample-source': { role: 'source', state: 'bogus-state', checkedAt: '2026-09-19T03:00:00.000Z' } },
  })
  assert.throws(() => evaluate(state))
})

test('a state.json not touched in over 8 days is reported stale', () => {
  const now = Date.UTC(2026, 8, 19)
  const state = baseState({
    sources: Object.fromEntries(
      Object.entries(baseState().sources).map(([id, e]) => [id, { ...e, checkedAt: '2026-09-10T03:00:00.000Z' }]),
    ),
  })
  const { lines } = evaluate(state, { now })
  assert.ok(lines.some((l) => l.startsWith('stale:')))
})

test('a state.json checked within 8 days is not reported stale', () => {
  const now = Date.UTC(2026, 8, 19)
  const { lines } = evaluate(baseState(), { now })
  assert.ok(!lines.some((l) => l.startsWith('stale:')))
})

test('firstChangedAt is carried across runs while a source stays changed, and clears once it stops', () => {
  const runOne = baseState({
    sources: {
      ...baseState().sources,
      'sample-source': { role: 'source', state: 'changed', checkedAt: '2026-09-01T03:00:00.000Z' },
    },
  })
  const firstChangedAt = nextFirstChangedAt({ state: 'changed', previousFirstChangedAt: undefined, today: '2026-09-01' })
  runOne.sources['sample-source'].firstChangedAt = firstChangedAt

  // Run two: still changed, a week later. firstChangedAt must be unchanged.
  const carried = nextFirstChangedAt({ state: 'changed', previousFirstChangedAt: firstChangedAt, today: '2026-09-08' })
  assert.equal(carried, '2026-09-01')

  // Run three: a human accepted a new baseline and the source is unchanged
  // again. firstChangedAt must clear.
  const cleared = nextFirstChangedAt({ state: 'unchanged', previousFirstChangedAt: carried, today: '2026-09-15' })
  assert.equal(cleared, undefined)
})
