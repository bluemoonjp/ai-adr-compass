import assert from 'node:assert/strict'
import { test } from 'node:test'

import { run } from './template-ids-resolve.mjs'

function practice(id, status) {
  return {
    path: `practices/${id}-sample.md`,
    text: [
      '---',
      `id: "${id}"`,
      'title: Sample',
      `status: ${status}`,
      'topic: adr-scope',
      'applies_to: [general]',
      'rule: A sample rule.',
      'license: CC-BY-4.0',
      'sources:',
      '  - url: https://example.invalid/source',
      '    kind: primary',
      '    confidence: unverified',
      '    verified_on: "2026-09-17"',
      '    summary: A sample summary.',
      '---',
      '',
      '## Why',
      '',
      'Sample.',
    ].join('\n'),
  }
}

function sidecar(data) {
  return { path: 'templates/sample.md.template.json', text: JSON.stringify(data) }
}

test('a sidecar citing an id present in an active corpus: no findings', () => {
  const { findings } = run({ files: [practice('0001', 'active'), sidecar({ Section: ['0001'] })] })
  assert.deepEqual(findings, [])
})

test('a sidecar citing an id absent from an otherwise non-empty active corpus: unresolved', () => {
  const { findings } = run({ files: [practice('0001', 'active'), sidecar({ Section: ['9999'] })] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:unresolved' }])
})

// The active-vs-draft distinction, specifically: a practice existing is not
// enough, the same rule self-check-resolves.mjs applies to enforces/
// not_applicable.json.
test('a sidecar citing an id whose only matching practice is status: draft: unresolved', () => {
  const { findings } = run({ files: [practice('0001', 'draft'), sidecar({ Section: ['0001'] })] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:unresolved' }])
})

test('the same id resolves once its practice becomes active', () => {
  const { findings } = run({ files: [practice('0001', 'active'), sidecar({ Section: ['0001'] })] })
  assert.deepEqual(findings, [])
})

test('a sidecar that is not valid JSON: invalid-json', () => {
  const { findings } = run({ files: [{ path: 'templates/sample.md.template.json', text: '{ not valid json' }] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:invalid-json' }])
})

test('a top-level array instead of an object: invalid-shape', () => {
  const { findings } = run({ files: [sidecar(['0001'])] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:invalid-shape' }])
})

test('a top-level null: invalid-shape', () => {
  const { findings } = run({ files: [{ path: 'templates/sample.md.template.json', text: 'null' }] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:invalid-shape' }])
})

test('a section value that is not an array: invalid-shape', () => {
  const { findings } = run({ files: [sidecar({ Section: '0001' })] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:invalid-shape' }])
})

test('a section value that is an empty array: invalid-shape', () => {
  const { findings } = run({ files: [sidecar({ Section: [] })] })
  assert.deepEqual(findings, [{ path: 'templates/sample.md.template.json', line: 1, ruleId: 'template-ids-resolve:invalid-shape' }])
})

test('an empty top-level object ({}): no sections claimed, no findings', () => {
  const { findings } = run({ files: [sidecar({})] })
  assert.deepEqual(findings, [])
})

test('a file outside templates/*.template.json is never scanned, regardless of content', () => {
  const { findings } = run({ files: [{ path: 'templates/unrelated.md', text: '{ not valid json' }] })
  assert.deepEqual(findings, [])
})
