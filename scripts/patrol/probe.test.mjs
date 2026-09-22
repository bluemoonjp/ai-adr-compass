import assert from 'node:assert/strict'
import { test } from 'node:test'

import { matchedPatternLabels, probeUrl } from './probe.mjs'

function mockResponse(status, body, { etag = null } = {}) {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'etag' ? etag : null) },
    text: async () => body,
  }
}

function queueFetch(bodies) {
  return async () => mockResponse(200, bodies.shift())
}

test('identical bodies across both fetches are not volatile, and recommend md5', async () => {
  const fetchImpl = queueFetch(['same content', 'same content'])
  const result = await probeUrl('https://example.com/llms.txt', { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.volatile, false)
  assert.equal(result.recommendedMethod, 'md5')
})

test('a mock embedding the current timestamp on each fetch is volatile', async () => {
  const fetchImpl = queueFetch(['updated: 2026-09-19T00:00:00Z', 'updated: 2026-09-19T00:00:03Z'])
  const result = await probeUrl('https://example.com/feed', { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.volatile, true)
})

test('a body-volatile URL whose ETag survives a conditional GET is not volatile, and recommends etag', async () => {
  let call = 0
  const fetchImpl = async (url, options) => {
    if (options.headers['If-None-Match'] === '"stable-etag"') return mockResponse(304, '')
    call += 1
    return mockResponse(200, `body embeds a fresh nonce ${call}`, { etag: '"stable-etag"' })
  }
  const result = await probeUrl('https://example.com/feed', { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.volatile, false)
  assert.equal(result.recommendedMethod, 'etag')
})

test('a body-volatile URL whose ETag also changes stays volatile and recommends none', async () => {
  let call = 0
  const fetchImpl = async () => {
    call += 1
    return mockResponse(200, `body ${call}`, { etag: `"etag-${call}"` })
  }
  const result = await probeUrl('https://example.com/feed', { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.volatile, true)
  assert.equal(result.recommendedMethod, 'none')
})

test('a volatile URL with no ETag header recommends none, without a third fetch', async () => {
  const fetchImpl = queueFetch(['body one', 'body two'])
  const result = await probeUrl('https://example.com/feed', { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.volatile, true)
  assert.equal(result.recommendedMethod, 'none')
})

test('probeUrl waits between the two fetches', async () => {
  const fetchImpl = queueFetch(['a', 'a'])
  const waits = []
  await probeUrl('https://example.com/x', { fetchImpl, waitMs: 3000, sleepImpl: async (ms) => waits.push(ms) })
  assert.deepEqual(waits, [3000])
})

test('matchedPatternLabels detects an ISO-8601 timestamp', () => {
  assert.deepEqual(matchedPatternLabels('generated at 2026-09-19T00:00:00Z'), ['iso-timestamp', 'generated'])
})

test('matchedPatternLabels finds nothing in ordinary static text', () => {
  assert.deepEqual(matchedPatternLabels('a plain, unchanging paragraph of documentation'), [])
})

test('a page containing the word nonce but byte-stable across fetches is not volatile', () => {
  return (async () => {
    const fetchImpl = queueFetch(['<script nonce="fixed-token">x</script>', '<script nonce="fixed-token">x</script>'])
    const result = await probeUrl('https://example.com/x', { fetchImpl, sleepImpl: async () => {} })
    assert.equal(result.volatile, false)
    assert.equal(result.patterns.length, 0)
  })()
})
