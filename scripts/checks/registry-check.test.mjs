import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'

import { run } from './registry-check.mjs'

const root = process.cwd()
const schemasDir = path.join(root, 'schemas')

test('schemas/registry.schema.json compiles under ajv strict mode', () => {
  const defs = JSON.parse(readFileSync(path.join(schemasDir, 'defs.schema.json'), 'utf8'))
  const registry = JSON.parse(readFileSync(path.join(schemasDir, 'registry.schema.json'), 'utf8'))

  const ajv = new Ajv2020({ strict: true, allErrors: true })
  ajv.addSchema(defs)
  assert.doesNotThrow(() => ajv.compile(registry))
})

function sourceAnchor(overrides = {}) {
  return {
    id: 'anchor-a',
    url: 'https://docs.example.com/llms.txt',
    method: 'md5',
    role: 'source',
    tools: ['general'],
    approval: { decidedBy: 'human', on: '2026-01-01', probe: { on: '2026-01-01', volatile: false } },
    ...overrides,
  }
}

function registryFile(sources) {
  return { path: 'sources/registry.json', text: JSON.stringify({ sources }) }
}

function baselineFile(data) {
  return { path: 'sources/baseline.json', text: JSON.stringify(data) }
}

test('an empty registry validates with no findings', () => {
  const { findings } = run({ files: [registryFile([]), baselineFile({})] })
  assert.deepEqual(findings, [])
})

test('a role:source anchor without approval.probe fails schema', () => {
  const anchor = sourceAnchor({ approval: { decidedBy: 'human', on: '2026-01-01' } })
  const { findings } = run({ files: [registryFile([anchor]), baselineFile({})] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:schema'))
})

test('a role:source anchor whose probe reported volatile:true fails schema', () => {
  const anchor = sourceAnchor({
    approval: { decidedBy: 'human', on: '2026-01-01', probe: { on: '2026-01-01', volatile: true } },
  })
  const { findings } = run({ files: [registryFile([anchor]), baselineFile({})] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:schema'))
})

test('approval.decidedBy other than "human" fails schema', () => {
  const anchor = sourceAnchor({
    approval: { decidedBy: 'bot', on: '2026-01-01', probe: { on: '2026-01-01', volatile: false } },
  })
  const { findings } = run({ files: [registryFile([anchor]), baselineFile({})] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:schema'))
})

test('two anchors sharing an id are flagged as duplicates', () => {
  const a = sourceAnchor({ id: 'dup' })
  const b = sourceAnchor({ id: 'dup', url: 'https://other.example.com/x' })
  const { findings } = run({ files: [registryFile([a, b]), baselineFile({})] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:duplicate-id'))
})

test('a covers host that does not share the anchor host eTLD+1 is flagged', () => {
  const anchor = sourceAnchor({ covers: [{ host: 'unrelated-domain.test', reason: 'test' }] })
  const { findings } = run({ files: [registryFile([anchor]), baselineFile({})] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:invalid-covers'))
})

test('a covers host sharing the anchor host eTLD+1 is accepted', () => {
  const anchor = sourceAnchor({
    url: 'https://docs.example.com/llms.txt',
    covers: [{ host: 'platform.example.com', reason: 'same product, different subdomain' }],
  })
  const { findings } = run({ files: [registryFile([anchor]), baselineFile({})] })
  assert.deepEqual(findings, [])
})

test('a baseline id absent from the registry is flagged', () => {
  const { findings } = run({ files: [registryFile([]), baselineFile({ 'ghost-id': { bytes: 1, acceptedOn: '2026-01-01' } })] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:baseline-unknown-id'))
})

test('a source host cited by practices/ but not covered by any anchor is flagged', () => {
  const practice = {
    path: 'practices/0001-sample.md',
    text: [
      '---',
      'id: "0001"',
      'title: Sample',
      'status: active',
      'sources:',
      '  - url: https://uncovered.example.net/docs',
      '    kind: primary',
      '---',
      '',
    ].join('\n'),
  }
  const { findings } = run({ files: [registryFile([]), baselineFile({}), practice] })
  assert.ok(findings.some((f) => f.ruleId === 'registry-check:uncovered-host'))
})

test('a source host covered by an anchor url produces no finding', () => {
  const anchor = sourceAnchor({ url: 'https://uncovered.example.net/llms.txt' })
  const practice = {
    path: 'practices/0001-sample.md',
    text: [
      '---',
      'id: "0001"',
      'title: Sample',
      'status: active',
      'sources:',
      '  - url: https://uncovered.example.net/docs',
      '    kind: primary',
      '---',
      '',
    ].join('\n'),
  }
  const { findings } = run({ files: [registryFile([anchor]), baselineFile({}), practice] })
  assert.deepEqual(findings, [])
})

test('a source with kind:other is not required to be covered', () => {
  const practice = {
    path: 'practices/0001-sample.md',
    text: [
      '---',
      'id: "0001"',
      'title: Sample',
      'status: active',
      'sources:',
      '  - url: https://uncovered.example.net/docs',
      '    kind: other',
      '---',
      '',
    ].join('\n'),
  }
  const { findings } = run({ files: [registryFile([]), baselineFile({}), practice] })
  assert.deepEqual(findings, [])
})

test('invalid JSON in sources/registry.json is reported without throwing', () => {
  const { findings } = run({ files: [{ path: 'sources/registry.json', text: '{not json' }] })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].ruleId, 'registry-check:invalid-json')
})

test('a missing sources/registry.json is treated as an empty registry', () => {
  const { findings } = run({ files: [] })
  assert.deepEqual(findings, [])
})
