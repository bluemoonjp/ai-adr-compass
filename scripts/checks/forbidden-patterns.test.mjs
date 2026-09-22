import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { run } from './forbidden-patterns.mjs'

// This check reads process.env.COMPASS_PRIVATE_PATTERNS and process.env.CI
// directly, so every test here must restore both afterward or it would leak
// into every other test file's run within the same `node --test` process.
const saved = { CI: process.env.CI, COMPASS_PRIVATE_PATTERNS: process.env.COMPASS_PRIVATE_PATTERNS }
before(() => {
  delete process.env.CI
  delete process.env.COMPASS_PRIVATE_PATTERNS
})
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function reset() {
  delete process.env.CI
  delete process.env.COMPASS_PRIVATE_PATTERNS
}

test('unset and not strict: skipped, no finding', () => {
  reset()
  const { findings, notices } = run({ files: [], messages: [], strict: false })
  assert.deepEqual(findings, [])
  assert.ok(notices.includes('private-patterns: skipped (env unset)'))
})

test('unset and strict: env-unset finding', () => {
  reset()
  const { findings } = run({ files: [], messages: [], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:env-unset'))
})

test('unset with CI set: env-unset finding even without --strict', () => {
  reset()
  process.env.CI = 'true'
  const { findings } = run({ files: [], messages: [], strict: false })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:env-unset'))
})

test('invalid JSON: invalid-json finding', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = 'not json'
  const { findings } = run({ files: [], messages: [], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:invalid-json'))
})

test('valid JSON with an empty patterns array: invalid-json finding', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: [], probe: 'x' })
  const { findings } = run({ files: [], messages: [], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:invalid-json'))
})

test('a pattern that fails to compile as a regexp: invalid-regexp finding', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: ['(unclosed'], probe: 'x' })
  const { findings } = run({ files: [], messages: [], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:invalid-regexp'))
})

test('a probe that matches none of the patterns: probe-mismatch finding', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: ['secret-project-x'], probe: 'unrelated-value' })
  const { findings } = run({ files: [], messages: [], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:probe-mismatch'))
})

test('a valid config with a matching probe scans files and flags a real match', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: ['secret-project-x'], probe: 'secret-project-x' })
  const files = [{ path: 'README.md', text: 'This mentions secret-project-x by name.' }]
  const { findings } = run({ files, messages: [], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:private' && f.path === 'README.md'))
})

test('a valid config with a matching probe scans commit messages and flags a real match', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: ['secret-project-x'], probe: 'secret-project-x' })
  const { findings } = run({ files: [], messages: ['mentions secret-project-x in passing'], strict: true })
  assert.ok(findings.some((f) => f.ruleId === 'forbidden-patterns:private' && f.path === '(commit-message)'))
})

test('a valid config finds nothing when no file or message matches', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: ['secret-project-x'], probe: 'secret-project-x' })
  const files = [{ path: 'README.md', text: 'Nothing sensitive here.' }]
  const { findings } = run({ files, messages: ['an unrelated commit message'], strict: true })
  assert.equal(findings.filter((f) => f.ruleId === 'forbidden-patterns:private').length, 0)
})

test('a private pattern never fires against scripts/checks/data/ itself', () => {
  reset()
  process.env.COMPASS_PRIVATE_PATTERNS = JSON.stringify({ patterns: ['forbidden-patterns'], probe: 'forbidden-patterns' })
  const files = [{ path: 'scripts/checks/data/forbidden-patterns.json', text: 'forbidden-patterns appears here' }]
  const { findings } = run({ files, messages: [], strict: true })
  assert.equal(findings.filter((f) => f.ruleId === 'forbidden-patterns:private').length, 0)
})
