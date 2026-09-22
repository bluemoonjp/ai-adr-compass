import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatLine, formatLines } from './format.mjs'

const VALID = {
  id: 'infoq-architecture-feed',
  state: 'unchanged',
  http: 200,
  bytes: 1234,
  hash: 'deadbeef',
  date: '2026-09-19',
  url: 'https://feed.infoq.com/architecture-design/',
}

const LINE_PATTERN = /^[a-z][a-z0-9-]* (no-baseline|not-modified|unchanged|changed|failed) (-|\d{3}) \d+ [0-9a-f]{0,8} \d{4}-\d{2}-\d{2} https:\/\/\S+$/

test('a well-formed record renders a line matching the allowed shape', () => {
  const line = formatLine(VALID)
  assert.match(line, LINE_PATTERN)
})

test('http: null renders as a bare dash, not the string "null"', () => {
  const line = formatLine({ ...VALID, http: null })
  assert.match(line, LINE_PATTERN)
  assert.ok(!line.includes('null'))
})

test('a poison value on a disallowed field never reaches the output', () => {
  const poisoned = {
    ...VALID,
    rawBody: '<script>alert(1)</script>\n| injected | markdown |\nsecret-token-should-not-leak',
    note: 'line one\nline two\x00\x1b[31m',
  }
  const line = formatLine(poisoned)
  assert.match(line, LINE_PATTERN)
  assert.ok(!line.includes('script'))
  assert.ok(!line.includes('injected'))
  assert.ok(!line.includes('secret-token'))
  assert.ok(!line.includes('\n'))
})

test('formatLines ignores disallowed fields across a batch', () => {
  const lines = formatLines([VALID, { ...VALID, id: 'other-anchor', secret: 'super-secret-token-should-not-leak' }])
  assert.equal(lines.length, 2)
  for (const line of lines) assert.ok(!line.includes('secret-token'))
})

for (const [field, badValue] of [
  ['id', 'not an id\nwith a newline'],
  ['id', 'UPPERCASE-not-allowed'],
  ['state', 'unknown-state'],
  ['http', 999],
  ['http', 'not-a-number'],
  ['bytes', -1],
  ['bytes', 1.5],
  ['hash', 'not-hex!!'],
  ['hash', '123456789'],
  ['date', '2026/09/19'],
  ['url', 'http://not-https.example.com'],
  ['url', 'https://has a space.example.com'],
]) {
  test(`a malformed ${field} throws instead of being formatted`, () => {
    assert.throws(() => formatLine({ ...VALID, [field]: badValue }))
  })
}

test('a missing record throws rather than formatting undefined', () => {
  assert.throws(() => formatLine(undefined))
})
