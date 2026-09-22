import assert from 'node:assert/strict'
import { test } from 'node:test'

import { runPatrol } from './patrol.mjs'
import { md5Hex } from './patrol/fetch.mjs'

function mockResponse(status, body, { etag = null } = {}) {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'etag' ? etag : null) },
    text: async () => body,
  }
}

const REGISTRY = {
  sources: [
    { id: 'sample-source', url: 'https://example.com/llms.txt', method: 'md5', role: 'source', tools: ['general'] },
    {
      id: 'control-changing-time',
      url: 'https://example.com/time',
      method: 'md5',
      role: 'control-changing',
      tools: ['general'],
    },
  ],
}

test('runPatrol classifies each anchor and writes a next-state entry', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('llms.txt')) return mockResponse(200, 'stable content')
    return mockResponse(200, `time is ${Date.now()}`)
  }

  const { nextState, records } = await runPatrol({
    registry: REGISTRY,
    baseline: { 'sample-source': { md5: 'not-a-match', bytes: 1, acceptedOn: '2026-01-01' } },
    previousState: { sources: {} },
    repoFiles: [],
    fetchOpts: { fetchImpl, sleepImpl: async () => {} },
  })

  assert.equal(nextState.sources['sample-source'].state, 'changed')
  assert.equal(nextState.sources['sample-source'].role, 'source')
  assert.equal(nextState.sources['control-changing-time'].state, 'no-baseline')
  assert.equal(records.length, 2)
  assert.ok(records.every((r) => typeof r.hash === 'string'))
})

test('runPatrol carries firstChangedAt forward for a source that stays changed', async () => {
  const fetchImpl = async () => mockResponse(200, 'new content')

  const { nextState } = await runPatrol({
    registry: { sources: [REGISTRY.sources[0]] },
    baseline: { 'sample-source': { md5: 'old-md5', bytes: 1, acceptedOn: '2026-01-01' } },
    previousState: { sources: { 'sample-source': { role: 'source', state: 'changed', firstChangedAt: '2026-09-01' } } },
    repoFiles: [],
    fetchOpts: { fetchImpl, sleepImpl: async () => {} },
  })

  assert.equal(nextState.sources['sample-source'].firstChangedAt, '2026-09-01')
})

test('runPatrol clears firstChangedAt once a source stops being changed', async () => {
  const fetchImpl = async () => mockResponse(200, 'same-as-baseline')

  const { nextState } = await runPatrol({
    registry: { sources: [REGISTRY.sources[0]] },
    baseline: { 'sample-source': { md5: md5Hex('same-as-baseline'), bytes: 1, acceptedOn: '2026-01-01' } },
    previousState: { sources: { 'sample-source': { role: 'source', state: 'changed', firstChangedAt: '2026-09-01' } } },
    repoFiles: [],
    fetchOpts: { fetchImpl, sleepImpl: async () => {} },
  })

  assert.equal(nextState.sources['sample-source'].state, 'unchanged')
  assert.equal(nextState.sources['sample-source'].firstChangedAt, undefined)
})

test('runPatrol carries the last known digest forward across a failed fetch, so the next comparison is not silently reset to no-baseline', async () => {
  const anchor = { id: 'measurement-corpus-a', url: 'https://example.com/measurement.md', method: 'md5', role: 'published-static', tools: ['general'] }
  const previouslyAcceptedMd5 = md5Hex('accepted content')

  // This run's own fetch fails outright (a timeout, in this case).
  const failingFetch = async () => {
    throw new Error('simulated timeout')
  }
  const { nextState } = await runPatrol({
    registry: { sources: [anchor] },
    baseline: {},
    previousState: { sources: { 'measurement-corpus-a': { role: 'published-static', state: 'unchanged', md5: previouslyAcceptedMd5 } } },
    repoFiles: [],
    fetchOpts: { fetchImpl: failingFetch, sleepImpl: async () => {} },
  })

  assert.equal(nextState.sources['measurement-corpus-a'].state, 'failed')
  // Without carrying the digest forward, this would be undefined -- the
  // exact gap that let one transient failure erase the comparison baseline
  // and silently re-pin to whatever bytes a later fetch happened to see.
  assert.equal(nextState.sources['measurement-corpus-a'].md5, previouslyAcceptedMd5)
})

test('runPatrol never carries a digest forward when the fetch itself succeeded (even if the state is unchanged)', async () => {
  const anchor = { id: 'measurement-corpus-a', url: 'https://example.com/measurement.md', method: 'md5', role: 'published-static', tools: ['general'] }
  const fetchImpl = async () => mockResponse(200, 'current content')

  const { nextState } = await runPatrol({
    registry: { sources: [anchor] },
    baseline: {},
    previousState: { sources: { 'measurement-corpus-a': { role: 'published-static', state: 'unchanged', md5: md5Hex('current content') } } },
    repoFiles: [],
    fetchOpts: { fetchImpl, sleepImpl: async () => {} },
  })

  assert.equal(nextState.sources['measurement-corpus-a'].state, 'unchanged')
  assert.equal(nextState.sources['measurement-corpus-a'].md5, md5Hex('current content'))
})

test('runPatrol compares a published-static anchor against previousState, not baseline, and never gives it firstChangedAt', async () => {
  const fetchImpl = async () => mockResponse(200, 'measurement bytes')
  const anchor = { id: 'measurement-corpus-a', url: 'https://example.com/measurement.md', method: 'md5', role: 'published-static', tools: ['general'] }

  const { nextState } = await runPatrol({
    registry: { sources: [anchor] },
    // A baseline entry present for this id must be ignored entirely --
    // published-static compares against the previous state.json observation,
    // the same as a control, never against sources/baseline.json.
    baseline: { 'measurement-corpus-a': { md5: 'irrelevant', bytes: 1, acceptedOn: '2026-01-01' } },
    previousState: { sources: { 'measurement-corpus-a': { role: 'published-static', md5: md5Hex('measurement bytes') } } },
    repoFiles: [],
    fetchOpts: { fetchImpl, sleepImpl: async () => {} },
  })

  assert.equal(nextState.sources['measurement-corpus-a'].state, 'unchanged')
  assert.equal(nextState.sources['measurement-corpus-a'].firstChangedAt, undefined)
})

test('runPatrol reports registryCheck: pass when registry-check finds nothing', async () => {
  const fetchImpl = async () => mockResponse(200, 'content')
  const { nextState, registryCheckPass } = await runPatrol({
    registry: { sources: [] },
    baseline: {},
    previousState: { sources: {} },
    repoFiles: [{ path: 'sources/registry.json', text: JSON.stringify({ sources: [] }) }],
    fetchOpts: { fetchImpl, sleepImpl: async () => {} },
  })
  assert.equal(registryCheckPass, true)
  assert.equal(nextState.run.registryCheck, 'pass')
})

test('runPatrol passes openWeeklyIssues through to the run block', async () => {
  const { nextState } = await runPatrol({
    registry: { sources: [] },
    baseline: {},
    previousState: { sources: {} },
    repoFiles: [],
    openWeeklyIssues: 2,
    fetchOpts: {},
  })
  assert.equal(nextState.run.openWeeklyIssues, 2)
})
