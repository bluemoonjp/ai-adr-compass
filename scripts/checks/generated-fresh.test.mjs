import assert from 'node:assert/strict'
import { test } from 'node:test'

import { run } from './generated-fresh.mjs'

// This file exists because scripts/check-checks.test.mjs's generic
// per-check harness only asserts aggregate findings.length > 0 (positive) /
// === 0 (negative) for the whole scripts/checks/fixtures/generated-fresh/
// set. Since that one fixture set carries findings from several unrelated
// blocks at once (the authoring.md table, practices/index.md, README, plain
// skill references, the templates sync, and the adr-volume-guard sync), a
// regression that silently breaks ONE block's detection would still pass
// that generic assertion as long as some OTHER block in the same fixture
// set still produces a finding. These tests isolate each new block.

const README_TEXT = 'Copied from `templates/*.template` by `pnpm gen`; do not edit. Licensed under [MIT](https://opensource.org/license/mit/).\n'

function templateFiles({ target = 'source content\n', includeReadme = true, extra = [] } = {}) {
  const files = [
    { path: 'templates/sample.md.template', text: 'source content\n' },
    { path: 'plugins/adr-compass/skills/adr-record/SKILL.md', text: 'x' },
    { path: 'plugins/adr-compass/skills/adr-record/references/templates/sample.md.template', text: target },
  ]
  if (includeReadme) files.push({ path: 'plugins/adr-compass/skills/adr-record/references/templates/README.md', text: README_TEXT })
  return [...files, ...extra]
}

function volumeGuardFiles({ target = '// source content\n', extra = [] } = {}) {
  return [
    { path: 'starter/adr-volume-guard/sample.mjs', text: '// source content\n' },
    { path: 'plugins/adr-compass/skills/adr-corpus-review/SKILL.md', text: 'x' },
    { path: 'plugins/adr-compass/skills/adr-corpus-review/references/adr-volume-guard/sample.mjs', text: target },
    ...extra,
  ]
}

test('templates sync: in sync (matching content, README present): no reference-template findings', () => {
  const { findings } = run({ files: templateFiles() })
  assert.deepEqual(
    findings.filter((f) => f.ruleId.startsWith('generated-fresh:reference-template')),
    [],
  )
})

test('templates sync: mismatched content: reference-template-stale', () => {
  const { findings } = run({ files: templateFiles({ target: 'stale content\n' }) })
  assert.deepEqual(
    findings.filter((f) => f.ruleId.startsWith('generated-fresh:reference-template')),
    [{ path: 'plugins/adr-compass/skills/adr-record/references/templates/sample.md.template', line: 1, ruleId: 'generated-fresh:reference-template-stale' }],
  )
})

test('templates sync: missing target file: reference-template-stale', () => {
  const files = templateFiles().filter((f) => f.path !== 'plugins/adr-compass/skills/adr-record/references/templates/sample.md.template')
  const { findings } = run({ files })
  assert.ok(
    findings.some((f) => f.ruleId === 'generated-fresh:reference-template-stale' && f.path.endsWith('/sample.md.template')),
  )
})

test('templates sync: missing README.md: reference-template-stale', () => {
  const { findings } = run({ files: templateFiles({ includeReadme: false }) })
  assert.ok(
    findings.some((f) => f.ruleId === 'generated-fresh:reference-template-stale' && f.path.endsWith('/README.md')),
  )
})

test('templates sync: a target file with no matching templates/ source: reference-template-orphan', () => {
  const files = templateFiles({
    extra: [{ path: 'plugins/adr-compass/skills/adr-record/references/templates/orphan.md.template', text: 'orphan\n' }],
  })
  const { findings } = run({ files })
  assert.deepEqual(
    findings.filter((f) => f.ruleId === 'generated-fresh:reference-template-orphan'),
    [{ path: 'plugins/adr-compass/skills/adr-record/references/templates/orphan.md.template', line: 1, ruleId: 'generated-fresh:reference-template-orphan' }],
  )
})

test('templates sync: adr-record\'s SKILL.md absent: no reference-template findings at all, even with stale content present', () => {
  const files = templateFiles({ target: 'stale content\n' }).filter((f) => f.path !== 'plugins/adr-compass/skills/adr-record/SKILL.md')
  const { findings } = run({ files })
  assert.deepEqual(
    findings.filter((f) => f.ruleId.startsWith('generated-fresh:reference-template')),
    [],
  )
})

test('adr-volume-guard sync: in sync (matching content): no reference-volume-guard findings', () => {
  const { findings } = run({ files: volumeGuardFiles() })
  assert.deepEqual(
    findings.filter((f) => f.ruleId.startsWith('generated-fresh:reference-volume-guard')),
    [],
  )
})

test('adr-volume-guard sync: mismatched content: reference-volume-guard-stale', () => {
  const { findings } = run({ files: volumeGuardFiles({ target: '// stale content\n' }) })
  assert.deepEqual(
    findings.filter((f) => f.ruleId.startsWith('generated-fresh:reference-volume-guard')),
    [
      {
        path: 'plugins/adr-compass/skills/adr-corpus-review/references/adr-volume-guard/sample.mjs',
        line: 1,
        ruleId: 'generated-fresh:reference-volume-guard-stale',
      },
    ],
  )
})

test('adr-volume-guard sync: missing target file: reference-volume-guard-stale', () => {
  const files = volumeGuardFiles().filter((f) => f.path !== 'plugins/adr-compass/skills/adr-corpus-review/references/adr-volume-guard/sample.mjs')
  const { findings } = run({ files })
  assert.ok(findings.some((f) => f.ruleId === 'generated-fresh:reference-volume-guard-stale'))
})

test('adr-volume-guard sync: a target file with no matching starter/adr-volume-guard/ source: reference-volume-guard-orphan', () => {
  const files = volumeGuardFiles({
    extra: [{ path: 'plugins/adr-compass/skills/adr-corpus-review/references/adr-volume-guard/orphan.mjs', text: '// orphan\n' }],
  })
  const { findings } = run({ files })
  assert.deepEqual(
    findings.filter((f) => f.ruleId === 'generated-fresh:reference-volume-guard-orphan'),
    [
      {
        path: 'plugins/adr-compass/skills/adr-corpus-review/references/adr-volume-guard/orphan.mjs',
        line: 1,
        ruleId: 'generated-fresh:reference-volume-guard-orphan',
      },
    ],
  )
})

test('adr-volume-guard sync: adr-corpus-review\'s SKILL.md absent: no reference-volume-guard findings at all, even with stale content present', () => {
  const files = volumeGuardFiles({ target: '// stale content\n' }).filter(
    (f) => f.path !== 'plugins/adr-compass/skills/adr-corpus-review/SKILL.md',
  )
  const { findings } = run({ files })
  assert.deepEqual(
    findings.filter((f) => f.ruleId.startsWith('generated-fresh:reference-volume-guard')),
    [],
  )
})

test('both blocks fire independently in the same run, and neither masks the other', () => {
  const { findings } = run({
    files: [...templateFiles({ target: 'stale content\n' }), ...volumeGuardFiles({ target: '// stale content\n' })],
  })
  assert.ok(findings.some((f) => f.ruleId === 'generated-fresh:reference-template-stale'))
  assert.ok(findings.some((f) => f.ruleId === 'generated-fresh:reference-volume-guard-stale'))
})
