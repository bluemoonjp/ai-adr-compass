import assert from 'node:assert/strict'
import { test } from 'node:test'

import { run } from './measurement-shape.mjs'

const PATH = 'measurements/2026-01-01-corpus-x.md'

function file(text) {
  return { path: PATH, text }
}

const CLEAN = [
  '# Measurement: corpus-x',
  '',
  'Published: 2026-01-01',
  '',
  '## Corpus characteristics',
  '',
  '| field | value |',
  '| --- | --- |',
  '| visibility | public |',
  '| record count | 3 |',
  '',
  '## Volume',
  '',
  'records: 3 (dates resolved: 3)',
].join('\n')

test('a fully compliant file: no findings', () => {
  assert.deepEqual(run({ files: [file(CLEAN)] }), { findings: [] })
})

test('a file this check does not scope to (wrong path): never scanned, regardless of content', () => {
  const { findings } = run({ files: [{ path: 'measurements/README.md', text: 'Status: accepted\nADR-0042' }] })
  assert.deepEqual(findings, [])
})

test('a malformed H1: invalid-h1', () => {
  const bad = CLEAN.replace('# Measurement: corpus-x', '# Some other title')
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:invalid-h1'))
})

test('no Published: line anywhere: missing-published-line', () => {
  const bad = CLEAN.replace('Published: 2026-01-01\n\n', '')
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:missing-published-line'))
})

test('a heading outside the allowed set, inserted between the two allowed ones: unknown-heading catches it; heading-set stays about the allowed pair only, so it does not also fire', () => {
  const bad = CLEAN.replace('## Volume', '## Decision Log\n\nSome prose.\n\n## Volume')
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:unknown-heading'))
  // seenH2 only records the two ALLOWED headings, in the order they were
  // seen; an intervening unknown heading is invisible to it, by design --
  // unknown-heading is the signal for "something extra is here" and
  // heading-set is reserved for "Corpus characteristics"/"Volume"
  // themselves being missing, duplicated, or reordered. See the dedicated
  // reordering test below for heading-set's own real trigger.
  assert.ok(!findings.some((f) => f.ruleId === 'measurement-shape:heading-set'))
})

test('the two allowed headings present but reordered: heading-set, with no unknown-heading', () => {
  const bad = [
    '# Measurement: corpus-x',
    '',
    'Published: 2026-01-01',
    '',
    '## Volume',
    '',
    'records: 3 (dates resolved: 3)',
    '',
    '## Corpus characteristics',
    '',
    '| field | value |',
    '| --- | --- |',
    '| visibility | public |',
  ].join('\n')
  const { findings } = run({ files: [file(bad)] })
  assert.deepEqual(
    findings.map((f) => f.ruleId),
    ['measurement-shape:heading-set'],
  )
})

test('an unknown field in the Corpus characteristics table: unknown-field', () => {
  const bad = CLEAN.replace('| record count | 3 |', '| record count | 3 |\n| repository | some-private-repo-name |')
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:unknown-field'))
})

test('a GFM alignment separator row (:---, ---:) is recognized as a separator, not an unknown field', () => {
  const withAlignment = CLEAN.replace('| --- | --- |', '| :--- | ---: |')
  const { findings } = run({ files: [file(withAlignment)] })
  assert.deepEqual(findings, [])
})

test('a plain Status: line: status-line', () => {
  const bad = CLEAN + '\nStatus: accepted\n'
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:status-line'))
})

test('a Status: line with 1-3 leading spaces (insignificant indentation in CommonMark) is still caught', () => {
  const bad = CLEAN + '\n  Status: accepted\n'
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:status-line'))
})

test('a bold-split "**Status:**" is still caught', () => {
  const bad = CLEAN + '\n**Status:** accepted\n'
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:status-line'))
})

test('a plain ADR-NNNN record id: record-id', () => {
  const bad = CLEAN + '\nSee ADR-0042 for details.\n'
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:record-id'))
})

test('a lowercase record id ("adr-0042") is still caught', () => {
  const bad = CLEAN + '\nSee adr-0042 for details.\n'
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:record-id'))
})

test('a bold-split record id ("**ADR**-1234") is still caught', () => {
  const bad = CLEAN + '\nSee **ADR**-1234 for details.\n'
  const { findings } = run({ files: [file(bad)] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-shape:record-id'))
})

test('the generic placeholder "ADR-NNNN" (not digits) is never flagged as a record id', () => {
  const withPlaceholder = CLEAN.replace('| record count | 3 |', '| record count | 3 |\n| reference notation | ADR-NNNN |')
  const { findings } = run({ files: [file(withPlaceholder)] })
  assert.ok(!findings.some((f) => f.ruleId === 'measurement-shape:record-id'))
})
