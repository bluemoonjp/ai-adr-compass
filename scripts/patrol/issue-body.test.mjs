import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildSourceRows, listIdsByState, renderIssueBody } from './issue-body.mjs'

const NOW = Date.UTC(2026, 8, 19)

function sampleState(overrides = {}) {
  return {
    sources: {
      'sample-source': { role: 'source', state: 'changed', http: 200, bytes: 100, checkedAt: '2026-09-19T00:00:00.000Z', firstChangedAt: '2026-09-05' },
      'other-source': { role: 'source', state: 'unchanged', http: 200, bytes: 200, checkedAt: '2026-09-19T00:00:00.000Z' },
      'control-static-rfc2119': { role: 'control-static', state: 'unchanged', http: 200, bytes: 10, checkedAt: '2026-09-19T00:00:00.000Z' },
    },
    run: { openWeeklyIssues: 1, registryCheck: 'pass' },
    ...overrides,
  }
}

const REGISTRY = {
  sources: [
    { id: 'sample-source', url: 'https://example.com/a' },
    { id: 'other-source', url: 'https://example.com/b' },
    { id: 'control-static-rfc2119', url: 'https://www.rfc-editor.org/rfc/rfc2119.txt' },
  ],
}

test('buildSourceRows computes unprocessed weeks only for a changed source with firstChangedAt', () => {
  const rows = buildSourceRows({ state: sampleState(), baseline: {}, now: NOW })
  const sample = rows.find((r) => r.id === 'sample-source')
  assert.equal(sample.weeks, '2')
  const other = rows.find((r) => r.id === 'other-source')
  assert.equal(other.weeks, '—')
})

test('buildSourceRows shows baseline date only for role:source, never for a control', () => {
  const rows = buildSourceRows({
    state: sampleState(),
    baseline: { 'sample-source': { acceptedOn: '2026-08-01' }, 'control-static-rfc2119': { acceptedOn: '2026-08-01' } },
    now: NOW,
  })
  assert.equal(rows.find((r) => r.id === 'sample-source').baselineDate, '2026-08-01')
  assert.equal(rows.find((r) => r.id === 'control-static-rfc2119').baselineDate, '—')
})

test('buildSourceRows rejects an unknown source state instead of printing it verbatim', () => {
  const state = sampleState()
  state.sources['sample-source'].state = 'a poisoned <script>state\nwith a newline'
  const rows = buildSourceRows({ state, baseline: {}, now: NOW })
  assert.equal(rows.find((r) => r.id === 'sample-source').state, 'unknown')
})

test('listIdsByState finds changed sources and excludes controls when sourceOnly', () => {
  const changed = listIdsByState(sampleState(), REGISTRY, 'changed', { sourceOnly: true })
  assert.deepEqual(changed.map((c) => c.id), ['sample-source'])
})

test('listIdsByState includes a failed control when not sourceOnly', () => {
  const state = sampleState({
    sources: { ...sampleState().sources, 'control-static-rfc2119': { role: 'control-static', state: 'failed' } },
  })
  const failed = listIdsByState(state, REGISTRY, 'failed')
  assert.deepEqual(failed.map((f) => f.id), ['control-static-rfc2119'])
})

test('renderIssueBody never leaks a poisoned id, state, or url beyond their allowed shape', () => {
  const poisonedState = {
    sources: {
      'sample-source': {
        role: 'source',
        state: 'changed\n<script>alert(1)</script>',
        http: 200,
        bytes: 1,
        checkedAt: '2026-09-19T00:00:00.000Z',
        firstChangedAt: '2026-09-01',
      },
    },
    run: { openWeeklyIssues: 1, registryCheck: 'pass' },
  }
  const poisonedRegistry = {
    sources: [{ id: 'sample-source', url: 'https://example.com/a\n| injected | row |\nsecret-token-should-not-leak' }],
  }

  const health = { lines: ['ok: 1 sources'], exitCode: 0 }
  const sourceRows = buildSourceRows({ state: poisonedState, baseline: {}, now: NOW })
  const changed = listIdsByState(poisonedState, poisonedRegistry, 'changed', { sourceOnly: true })
  const failed = listIdsByState(poisonedState, poisonedRegistry, 'failed')

  const body = renderIssueBody({
    health,
    sourceRows,
    changed,
    failed,
    freshnessMarkdown: 'stale: 0 / checked: 0',
    linksSection: 'broken: 0 / checked: 0',
  })

  assert.ok(!body.includes('<script>'))
  assert.ok(!body.includes('injected'))
  assert.ok(!body.includes('secret-token'))
  // The poisoned url must not appear verbatim (it fails the https, no-space,
  // no-newline pattern), but the id row it belongs to must still render.
  assert.ok(!body.includes('| injected | row |'))
  assert.match(body, /## Sources/)
  assert.match(body, /sample-source/)
})

test('renderIssueBody renders (none) for empty changed/failed lists', () => {
  const body = renderIssueBody({
    health: { lines: ['ok: 0 sources'], exitCode: 0 },
    sourceRows: [],
    changed: [],
    failed: [],
    freshnessMarkdown: 'stale: 0 / checked: 0',
    linksSection: 'broken: 0 / checked: 0',
  })
  assert.match(body, /## Changed\n\n\(none\)/)
  assert.match(body, /## Failed\n\n\(none\)/)
})

test('renderIssueBody includes a clickable registry url for a changed source', () => {
  const changed = [{ id: 'sample-source', url: 'https://example.com/a' }]
  const body = renderIssueBody({
    health: { lines: ['ok: 1 sources'], exitCode: 0 },
    sourceRows: [],
    changed,
    failed: [],
    freshnessMarkdown: 'stale: 0 / checked: 0',
    linksSection: 'broken: 0 / checked: 0',
  })
  assert.match(body, /- sample-source \(https:\/\/example\.com\/a\)/)
})
