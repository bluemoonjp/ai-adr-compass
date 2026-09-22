import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classify, fetchAnchor, md5Hex } from './fetch.mjs'

function mockResponse(status, { etag, body = '' } = {}) {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'etag' ? (etag ?? null) : null) },
    text: async () => body,
  }
}

function queueFetch(responses) {
  const calls = []
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    },
  }
}

const ANCHOR_MD5 = { id: 'sample-anchor', url: 'https://example.com/llms.txt', method: 'md5' }
const ANCHOR_ETAG = { id: 'sample-anchor', url: 'https://example.com/feed', method: 'etag' }

test('classify: a 0-byte 200 response is failed, not unchanged', () => {
  const result = classify({ anchor: ANCHOR_MD5, res: mockResponse(200), bodyText: '' })
  assert.equal(result.state, 'failed')
})

test('classify: a 304 response is not-modified', () => {
  const result = classify({ anchor: ANCHOR_ETAG, res: mockResponse(304), bodyText: '' })
  assert.equal(result.state, 'not-modified')
  assert.equal(result.http, 304)
})

test('classify: 200 with the same md5 as baseline is unchanged', () => {
  const body = 'hello world'
  const result = classify({
    anchor: { ...ANCHOR_MD5, baselineMd5: md5Hex(body) },
    res: mockResponse(200),
    bodyText: body,
  })
  assert.equal(result.state, 'unchanged')
})

test('classify: 200 with a different md5 than baseline is changed', () => {
  const result = classify({
    anchor: { ...ANCHOR_MD5, baselineMd5: md5Hex('old body') },
    res: mockResponse(200),
    bodyText: 'new body',
  })
  assert.equal(result.state, 'changed')
})

test('classify: 200 with no prior baseline is no-baseline', () => {
  const result = classify({ anchor: ANCHOR_MD5, res: mockResponse(200), bodyText: 'first look' })
  assert.equal(result.state, 'no-baseline')
})

test('classify: a network error is failed', () => {
  const result = classify({ anchor: ANCHOR_MD5, error: new Error('ECONNRESET') })
  assert.equal(result.state, 'failed')
  assert.equal(result.http, null)
})

test('classify: a non-2xx, non-304 status is failed', () => {
  const result = classify({ anchor: ANCHOR_MD5, res: mockResponse(404), bodyText: '' })
  assert.equal(result.state, 'failed')
  assert.equal(result.http, 404)
})

test('classify: etag method compares the response ETag header, not the body', () => {
  const result = classify({
    anchor: { ...ANCHOR_ETAG, baselineEtag: '"abc"' },
    res: mockResponse(200, { etag: '"def"' }),
    bodyText: 'irrelevant body text',
  })
  assert.equal(result.state, 'changed')
  assert.equal(result.etag, '"def"')
})

test('classify: etag method with a missing ETag header is failed', () => {
  const result = classify({ anchor: { ...ANCHOR_ETAG, baselineEtag: '"abc"' }, res: mockResponse(200), bodyText: 'body' })
  assert.equal(result.state, 'failed')
})

test('fetchAnchor: retries once on a network error, then succeeds', async () => {
  const { fetchImpl, calls } = queueFetch([new Error('ECONNRESET'), mockResponse(200, { body: 'ok' })])
  const result = await fetchAnchor(ANCHOR_MD5, undefined, { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.state, 'no-baseline')
  assert.equal(calls.length, 2)
})

test('fetchAnchor: retries once on a 5xx response', async () => {
  const { fetchImpl, calls } = queueFetch([mockResponse(503), mockResponse(200, { body: 'ok' })])
  const result = await fetchAnchor(ANCHOR_MD5, undefined, { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.state, 'no-baseline')
  assert.equal(calls.length, 2)
})

test('fetchAnchor: does not retry a second time', async () => {
  const { fetchImpl, calls } = queueFetch([new Error('a'), new Error('b')])
  const result = await fetchAnchor(ANCHOR_MD5, undefined, { fetchImpl, sleepImpl: async () => {} })
  assert.equal(result.state, 'failed')
  assert.equal(calls.length, 2)
})

test('fetchAnchor: sends If-None-Match only when a baseline etag exists', async () => {
  const { fetchImpl, calls } = queueFetch([mockResponse(304)])
  await fetchAnchor(ANCHOR_ETAG, { etag: '"abc"' }, { fetchImpl, sleepImpl: async () => {} })
  assert.equal(calls[0].options.headers['If-None-Match'], '"abc"')
})

test('fetchAnchor: sends a fixed User-Agent and follows redirects', async () => {
  const { fetchImpl, calls } = queueFetch([mockResponse(200, { body: 'ok' })])
  await fetchAnchor(ANCHOR_MD5, undefined, { fetchImpl, sleepImpl: async () => {} })
  assert.ok(calls[0].options.headers['User-Agent'].length > 0)
  assert.equal(calls[0].options.redirect, 'follow')
})

test('fetchAnchor: throttles two fetches to the same host by minIntervalSec', async () => {
  const anchor = { ...ANCHOR_MD5, minIntervalSec: 3 }
  const { fetchImpl } = queueFetch([mockResponse(200, { body: 'a' }), mockResponse(200, { body: 'a' })])
  const hostState = new Map()
  let clock = 1000
  const now = () => clock
  const waits = []
  const sleepImpl = async (ms) => {
    waits.push(ms)
    clock += ms
  }
  await fetchAnchor(anchor, undefined, { fetchImpl, now, sleepImpl, hostState })
  clock += 500 // only 0.5s elapsed before the second fetch, less than minIntervalSec
  await fetchAnchor(anchor, undefined, { fetchImpl, now, sleepImpl, hostState })
  assert.equal(waits.length, 1)
  assert.equal(waits[0], 2500)
})

test('fetchAnchor: does not throttle when enough time has already passed', async () => {
  const anchor = { ...ANCHOR_MD5, minIntervalSec: 3 }
  const { fetchImpl } = queueFetch([mockResponse(200, { body: 'a' }), mockResponse(200, { body: 'a' })])
  const hostState = new Map()
  let clock = 1000
  const now = () => clock
  const waits = []
  const sleepImpl = async (ms) => waits.push(ms)
  await fetchAnchor(anchor, undefined, { fetchImpl, now, sleepImpl, hostState })
  clock += 5000
  await fetchAnchor(anchor, undefined, { fetchImpl, now, sleepImpl, hostState })
  assert.equal(waits.length, 0)
})
