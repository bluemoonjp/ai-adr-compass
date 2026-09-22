import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

import { run } from './measurement-integrity.mjs'

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

const MEASUREMENT_TEXT = '# Measurement: corpus-x\n\nPublished: 2026-01-01\n\n## Corpus characteristics\n\n## Volume\n'
const MEASUREMENT_PATH = 'measurements/2026-01-01-corpus-x.md'
const MEASUREMENT_SHA256 = sha256(MEASUREMENT_TEXT)

function indexWith(entries) {
  return { path: 'measurements/index.json', text: JSON.stringify({ measurements: entries }) }
}

const VALID_ENTRY = {
  file: MEASUREMENT_PATH,
  sha256: MEASUREMENT_SHA256,
  publishedOn: '2026-01-01',
  corpus: 'corpus-x',
  url: 'https://raw.githubusercontent.com/example-owner/example-repo/main/measurements/2026-01-01-corpus-x.md',
}

test('no measurements/ content at all: no findings', () => {
  assert.deepEqual(run({ files: [] }), { findings: [] })
})

test('a measurement file with no index.json at all: unlisted-file', () => {
  const { findings } = run({ files: [{ path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }] })
  assert.deepEqual(findings, [{ path: MEASUREMENT_PATH, line: 1, ruleId: 'measurement-integrity:unlisted-file' }])
})

test('index.json that is not valid JSON: invalid-json, and nothing else runs', () => {
  const { findings } = run({ files: [{ path: 'measurements/index.json', text: '{ not valid json' }] })
  assert.deepEqual(findings, [{ path: 'measurements/index.json', line: 1, ruleId: 'measurement-integrity:invalid-json' }])
})

test('index.json missing a required schema field: schema finding (plus whatever the entry itself triggers)', () => {
  const { findings } = run({ files: [indexWith([{ ...VALID_ENTRY, corpus: undefined }])] })
  assert.ok(findings.some((f) => f.ruleId === 'measurement-integrity:schema'))
})

test('index.json entry naming a file absent from the repository: missing-file', () => {
  const { findings } = run({ files: [indexWith([VALID_ENTRY])] })
  assert.deepEqual(findings, [{ path: MEASUREMENT_PATH, line: 1, ruleId: 'measurement-integrity:missing-file' }])
})

test('index.json present but omits an existing measurement file: unlisted-file', () => {
  const { findings } = run({
    files: [indexWith([]), { path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }],
  })
  assert.deepEqual(findings, [{ path: MEASUREMENT_PATH, line: 1, ruleId: 'measurement-integrity:unlisted-file' }])
})

test('a listed file whose bytes no longer match the recorded sha256: digest-mismatch', () => {
  const { findings } = run({
    files: [indexWith([{ ...VALID_ENTRY, sha256: sha256('different content') }]), { path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }],
  })
  assert.deepEqual(findings, [{ path: MEASUREMENT_PATH, line: 1, ruleId: 'measurement-integrity:digest-mismatch' }])
})

test('a correctly listed, byte-matching file: no findings', () => {
  const { findings } = run({
    files: [indexWith([VALID_ENTRY]), { path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }],
  })
  assert.deepEqual(findings, [])
})

test('two index.json entries listing the same file: duplicate-file, not a doubled missing-file/digest-mismatch', () => {
  const { findings } = run({ files: [indexWith([VALID_ENTRY, VALID_ENTRY])] })
  // The first occurrence is checked normally (missing-file, since the file
  // itself isn't in {files} here); the second is reported once as a
  // duplicate, not re-run through missing-file/digest-mismatch again.
  assert.deepEqual(findings, [
    { path: MEASUREMENT_PATH, line: 1, ruleId: 'measurement-integrity:missing-file' },
    { path: MEASUREMENT_PATH, line: 1, ruleId: 'measurement-integrity:duplicate-file' },
  ])
})

test('a practice citing the exact listed URL: resolved, no finding', () => {
  const practice = {
    path: 'practices/9001-sample.md',
    text: `---\nid: "9001"\ntitle: Sample\nstatus: active\ntopic: adr-scope\napplies_to: [general]\nrule: Sample.\nlicense: CC-BY-4.0\nsources:\n  - url: ${VALID_ENTRY.url}\n    kind: primary\n    confidence: derived\n    verified_on: "2026-01-01"\n    summary: Sample.\n---\n\n## Why\n\nSample.\n`,
  }
  const { findings } = run({
    files: [indexWith([VALID_ENTRY]), { path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }, practice],
  })
  assert.deepEqual(findings, [])
})

test('a practice citing an unrelated host whose path merely ends with a listed filename: source-unresolved, not silently accepted', () => {
  // The exact bypass an earlier version of this check had: matching on
  // URL path suffix alone, ignoring which host actually served the file.
  const evilUrl = `https://evil.example.com/totally/unrelated/path/${MEASUREMENT_PATH}`
  const practice = {
    path: 'practices/9001-sample.md',
    text: `---\nid: "9001"\ntitle: Sample\nstatus: active\ntopic: adr-scope\napplies_to: [general]\nrule: Sample.\nlicense: CC-BY-4.0\nsources:\n  - url: ${evilUrl}\n    kind: primary\n    confidence: derived\n    verified_on: "2026-01-01"\n    summary: Sample.\n---\n\n## Why\n\nSample.\n`,
  }
  const { findings } = run({
    files: [indexWith([VALID_ENTRY]), { path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }, practice],
  })
  assert.deepEqual(findings, [{ path: 'practices/9001-sample.md', line: 1, ruleId: 'measurement-integrity:source-unresolved' }])
})

test('a source with kind/confidence other than primary/derived is ignored, even if it cites an unlisted measurement URL', () => {
  const practice = {
    path: 'practices/9001-sample.md',
    text: `---\nid: "9001"\ntitle: Sample\nstatus: active\ntopic: adr-scope\napplies_to: [general]\nrule: Sample.\nlicense: CC-BY-4.0\nsources:\n  - url: https://raw.githubusercontent.com/example-owner/example-repo/main/measurements/9999-01-01-corpus-unlisted.md\n    kind: other\n    confidence: unverified\n    verified_on: "2026-01-01"\n    summary: Sample.\n---\n\n## Why\n\nSample.\n`,
  }
  const { findings } = run({ files: [indexWith([VALID_ENTRY]), { path: MEASUREMENT_PATH, text: MEASUREMENT_TEXT }, practice] })
  assert.deepEqual(findings, [])
})
