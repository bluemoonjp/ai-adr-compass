import assert from 'node:assert/strict'
import { test } from 'node:test'

import { renderLinkSection, summarizeLycheeStats } from './link-report.mjs'

// Shape verified against lychee-bin/src/formatters/stats/json.rs's own test
// fixture (lycheeverse/lychee, master, checked 2026-09-19).
const SAMPLE_STATS = {
  total: 5,
  successful: 3,
  error_map: {
    'practices/0001-sample.md': [
      { url: 'https://example.invalid/broken', status: { text: 'Rejected status code: 404 Not Found', code: 404 } },
    ],
  },
  timeout_map: {
    'practices/0002-sample.md': [{ url: 'https://example.invalid/slow', status: { text: 'Timeout' } }],
  },
}

test('summarizeLycheeStats counts total as checked', () => {
  const { checked } = summarizeLycheeStats(SAMPLE_STATS)
  assert.equal(checked, 5)
})

test('summarizeLycheeStats counts errors and timeouts as broken', () => {
  const { broken } = summarizeLycheeStats(SAMPLE_STATS)
  assert.equal(broken, 2)
})

test('summarizeLycheeStats lists broken URLs from both maps', () => {
  const { brokenUrls } = summarizeLycheeStats(SAMPLE_STATS)
  assert.deepEqual(brokenUrls.sort(), ['https://example.invalid/broken', 'https://example.invalid/slow'].sort())
})

test('summarizeLycheeStats handles missing/empty stats without throwing', () => {
  assert.deepEqual(summarizeLycheeStats(undefined), { checked: 0, broken: 0, brokenUrls: [] })
  assert.deepEqual(summarizeLycheeStats({}), { checked: 0, broken: 0, brokenUrls: [] })
})

test('a malformed broken-url entry is counted but not listed', () => {
  const stats = {
    total: 1,
    error_map: {
      'a.md': [
        { url: 'not a url with\ninjected content' },
        { url: 'javascript:alert(1)' },
      ],
    },
  }
  const { broken, brokenUrls } = summarizeLycheeStats(stats)
  assert.equal(broken, 2)
  assert.deepEqual(brokenUrls, [])
})

test('renderLinkSection renders the summary line first, then one bullet per broken URL', () => {
  const section = renderLinkSection({ checked: 5, broken: 2, brokenUrls: ['https://example.invalid/broken'] })
  const lines = section.split('\n')
  assert.equal(lines[0], 'broken: 2 / checked: 5')
  assert.equal(lines[1], '- https://example.invalid/broken')
})

test('summarizeLycheeStats caps the listed URLs at 20', () => {
  const many = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [`f${i}.md`, [{ url: `https://example.invalid/${i}` }]]),
  )
  const { broken, brokenUrls } = summarizeLycheeStats({ total: 30, error_map: many })
  assert.equal(broken, 30)
  assert.equal(brokenUrls.length, 20)
})
