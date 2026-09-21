import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

import { loadChecksRegistry, loadRepoFiles, runCheck, walkDir } from './lib/runner.mjs'

const root = process.cwd()
const checksDir = path.join(root, 'scripts', 'checks')
const fixturesRoot = path.join(checksDir, 'fixtures')
const checks = loadChecksRegistry(root)

// This file only exercises the generic findings>0 / findings===0 contract. A
// check's own environment-variable-driven behavior is covered by that
// check's own *.test.mjs. Neutralize every such variable here so this
// file's results do not depend on the environment it happens to run in.
const savedEnv = {
  CI: process.env.CI,
  COMPASS_PRIVATE_PATTERNS: process.env.COMPASS_PRIVATE_PATTERNS,
  COMPASS_RELEASE_TAG: process.env.COMPASS_RELEASE_TAG,
}
before(() => {
  for (const key of Object.keys(savedEnv)) delete process.env[key]
})
after(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function fixturesFor(checkId) {
  const dir = path.join(fixturesRoot, checkId)
  if (!existsSync(dir)) return { dir, positive: [], negative: [] }
  const all = walkDir(dir).filter((p) => p.endsWith('.fixture'))
  const positive = all.filter((p) => !p.startsWith('negative/'))
  const negative = all.filter((p) => p.startsWith('negative/'))
  return { dir, positive, negative }
}

function expand(dir, relFixturePaths) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'compass-fixture-'))
  const files = []
  for (const rel of relFixturePaths) {
    // `negative/` is a classification prefix, not part of the file's real
    // repository path — a negative fixture for practices/0001.md lives at
    // negative/practices/0001.md.fixture but must expand back to
    // practices/0001.md, or checks that gate on a path prefix (practices/,
    // docs/adr/, ...) silently skip the fixture instead of validating it.
    const withoutClassifier = rel.startsWith('negative/') ? rel.slice('negative/'.length) : rel
    const destRel = withoutClassifier.slice(0, -'.fixture'.length)
    const dest = path.join(tmp, destRel)
    mkdirSync(path.dirname(dest), { recursive: true })
    const text = readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n')
    writeFileSync(dest, text)
    files.push({ path: destRel.split(path.sep).join('/'), text })
  }
  return { tmp, files }
}

test('every scripts/checks/*.mjs script is registered in checks.json', () => {
  const registered = new Set(checks.map((c) => path.resolve(root, c.script)))
  for (const entry of readdirSync(checksDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs')) {
      const abs = path.join(checksDir, entry.name)
      assert.ok(registered.has(abs), `${entry.name} is not registered in checks.json`)
    }
  }
})

test('package.json declares at most 3 devDependencies', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const count = Object.keys(pkg.devDependencies ?? {}).length
  assert.ok(count <= 3, `devDependencies has ${count} packages, expected at most 3`)
})

test('every blocking check has at least one positive fixture', () => {
  for (const check of checks) {
    if (!check.blocking) continue
    const { positive } = fixturesFor(check.id)
    assert.ok(positive.length > 0, `${check.id} is blocking but has no positive fixture`)
  }
})

for (const check of checks) {
  const { dir, positive, negative } = fixturesFor(check.id)

  if (positive.length > 0) {
    test(`${check.id}: positive fixtures produce findings`, async () => {
      const { tmp, files } = expand(dir, positive)
      try {
        const { findings } = await runCheck(root, check, { root: tmp, files, messages: [] })
        assert.ok(findings.length > 0, `expected findings from ${check.id} positive fixtures`)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })
  }

  if (negative.length > 0) {
    test(`${check.id}: negative fixtures produce no findings`, async () => {
      const { tmp, files } = expand(dir, negative)
      try {
        const { findings } = await runCheck(root, check, { root: tmp, files, messages: [] })
        assert.equal(findings.length, 0, `expected no findings from ${check.id} negative fixtures`)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })
  }
}

test('blocking checks find nothing in the repository itself', async () => {
  const files = loadRepoFiles(root)
  for (const check of checks) {
    if (!check.blocking) continue
    const { findings } = await runCheck(root, check, { files, messages: [] })
    assert.equal(
      findings.length,
      0,
      `${check.id} found issues in the repository: ${JSON.stringify(findings)}`,
    )
  }
})

test('fast checks do not import git or network modules', () => {
  const forbiddenImport = /from\s+['"]node:(child_process|https?|dns|net|tls)['"]/
  for (const check of checks) {
    if (!check.fast) continue
    const src = readFileSync(path.join(root, check.script), 'utf8')
    assert.ok(
      !forbiddenImport.test(src),
      `${check.id} is marked fast but imports a git/network-capable module`,
    )
  }
})

test('.claude/settings.json declares a non-empty permissions.deny list', () => {
  const settings = JSON.parse(readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'))
  assert.ok(Array.isArray(settings.permissions?.deny) && settings.permissions.deny.length > 0)
})

test("AGENTS.md's working rules each end in (ci: ...) or (none)", () => {
  const text = readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
  const bulletLines = text.split('\n').filter((line) => line.startsWith('- '))
  const annotatedLines = bulletLines.filter((line) => /\((ci: [a-z-]+|none)\)$/.test(line))
  assert.equal(annotatedLines.length, bulletLines.length, 'every working-rule bullet must end in (ci: <id>) or (none)')
})

test('fixture files use a .fixture suffix and never a live instruction filename', () => {
  const out = execFileSync('git', ['ls-files', 'scripts/checks/fixtures'], {
    cwd: root,
    encoding: 'utf8',
  })
  const liveNames = new Set(['CLAUDE.md', 'AGENTS.md', 'SKILL.md'])
  for (const f of out.split('\n').filter(Boolean)) {
    assert.ok(f.endsWith('.fixture'), `${f} does not end with .fixture`)
    assert.ok(!liveNames.has(path.basename(f)), `${f} has a live instruction filename`)
  }
})
