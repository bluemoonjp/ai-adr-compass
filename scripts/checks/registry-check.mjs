import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { parse as parseYaml } from 'yaml'

const schemasDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas')
const defsSchema = JSON.parse(readFileSync(path.join(schemasDir, 'defs.schema.json'), 'utf8'))
const registrySchema = JSON.parse(readFileSync(path.join(schemasDir, 'registry.schema.json'), 'utf8'))

const ajv = new Ajv2020({ strict: true, allErrors: true })
ajv.addSchema(defsSchema)
const validateRegistry = ajv.compile(registrySchema)

const RULE_ID = 'registry-check'
const REGISTRY_PATH = 'sources/registry.json'
const BASELINE_PATH = 'sources/baseline.json'
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const CONTENT_FILE = /^(\d{4})-[a-z0-9-]+\.md$/

function findFile(files, relPath) {
  return files.find((f) => f.path === relPath)
}

function readJsonFile(files, relPath) {
  const file = findFile(files, relPath)
  if (!file) return { ok: true, data: undefined }
  try {
    return { ok: true, data: JSON.parse(file.text) }
  } catch {
    return { ok: false, data: undefined }
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// Approximates eTLD+1 as the last two dot-separated labels. A multi-label
// public suffix (co.uk, github.io) is out of scope; see the schema's note.
function etldPlus1(host) {
  const labels = host.split('.')
  return labels.slice(-2).join('.')
}

function collectSourceHosts(files) {
  const hosts = new Set()
  for (const file of files) {
    if (!CONTENT_FILE.test(path.basename(file.path))) continue
    if (
      !file.path.startsWith('practices/') &&
      !file.path.startsWith('antipatterns/') &&
      !file.path.startsWith('adapters/')
    )
      continue
    const match = FRONTMATTER.exec(file.text)
    if (!match) continue
    let data
    try {
      data = parseYaml(match[1])
    } catch {
      continue
    }
    for (const source of data?.sources ?? []) {
      if (source?.kind === 'other') continue
      const host = hostOf(source?.url ?? '')
      if (host) hosts.add(host)
    }
  }
  return hosts
}

export function run({ files }) {
  const findings = []

  const registryResult = readJsonFile(files, REGISTRY_PATH)
  if (!registryResult.ok) {
    return { findings: [{ path: REGISTRY_PATH, line: 1, ruleId: `${RULE_ID}:invalid-json` }] }
  }
  const registry = registryResult.data ?? { sources: [] }

  if (!validateRegistry(registry)) {
    findings.push({ path: REGISTRY_PATH, line: 1, ruleId: `${RULE_ID}:schema` })
  }
  const anchors = Array.isArray(registry.sources) ? registry.sources : []

  const seenIds = new Set()
  const coveredHosts = new Set()
  for (const anchor of anchors) {
    if (typeof anchor?.id !== 'string') continue
    if (seenIds.has(anchor.id)) {
      findings.push({ path: REGISTRY_PATH, line: 1, ruleId: `${RULE_ID}:duplicate-id` })
    }
    seenIds.add(anchor.id)

    const ownHost = hostOf(anchor.url ?? '')
    if (ownHost) coveredHosts.add(ownHost)

    for (const covers of anchor.covers ?? []) {
      if (typeof covers?.host !== 'string') continue
      coveredHosts.add(covers.host)
      if (ownHost && etldPlus1(covers.host) !== etldPlus1(ownHost)) {
        findings.push({ path: REGISTRY_PATH, line: 1, ruleId: `${RULE_ID}:invalid-covers` })
      }
    }
  }

  const baselineResult = readJsonFile(files, BASELINE_PATH)
  if (!baselineResult.ok) {
    findings.push({ path: BASELINE_PATH, line: 1, ruleId: `${RULE_ID}:invalid-json` })
  } else {
    const baseline = baselineResult.data ?? {}
    for (const id of Object.keys(baseline)) {
      if (!seenIds.has(id)) {
        findings.push({ path: BASELINE_PATH, line: 1, ruleId: `${RULE_ID}:baseline-unknown-id` })
      }
    }
  }

  for (const host of collectSourceHosts(files)) {
    if (!coveredHosts.has(host)) {
      findings.push({ path: REGISTRY_PATH, line: 1, ruleId: `${RULE_ID}:uncovered-host` })
    }
  }

  return { findings }
}
