import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { parse as parseYaml } from 'yaml'

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'schemas',
  'skill-frontmatter.schema.json',
)
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const ajv = new Ajv2020({ strict: true, allErrors: true })
const validate = ajv.compile(schema)

const RULE_ID = 'skill-shape'
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const SKILL_MD_PATTERN = /^((?:plugins\/[^/]+\/skills\/[^/]+)|(?:\.claude\/skills\/[^/]+))\/SKILL\.md$/
const MAX_BODY_LINES = 500
const LINK_TARGET = /\]\(([^)]+)\)/g
// Matches any URI scheme prefix, not just the `//`-authority form, so
// mailto:/tel:/data: links are treated as absolute like https:// links are,
// instead of falling through to the relative-link checks below.
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i

function bodyLineCount(text) {
  return (text.match(/\n/g) ?? []).length
}

function linkTargets(text) {
  const targets = []
  LINK_TARGET.lastIndex = 0
  let m
  while ((m = LINK_TARGET.exec(text))) targets.push(m[1])
  return targets
}

function isCheckable(target) {
  return !ABSOLUTE_URL.test(target) && !target.startsWith('#')
}

export function run({ files }) {
  const findings = []

  for (const file of files) {
    const m = SKILL_MD_PATTERN.exec(file.path)
    if (!m) continue
    const skillDir = m[1]
    const skillName = skillDir.split('/').pop()

    const fm = FRONTMATTER.exec(file.text)
    if (!fm) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:missing-frontmatter` })
      continue
    }
    const [, frontmatterText, body] = fm

    let data
    try {
      data = parseYaml(frontmatterText)
    } catch {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-yaml` })
      continue
    }

    if (!validate(data)) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:schema` })
    } else if (data.name !== skillName) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:name-mismatch` })
    }

    if (bodyLineCount(body) >= MAX_BODY_LINES) {
      findings.push({ path: file.path, line: MAX_BODY_LINES + 1, ruleId: `${RULE_ID}:too-long` })
    }

    for (const target of linkTargets(body)) {
      if (!isCheckable(target)) continue
      const normalized = target.startsWith('./') ? target.slice(2) : target
      if (!normalized.startsWith('references/')) {
        findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:link-outside-references` })
      }
    }
  }

  for (const file of files) {
    const referencesMatch = /^((?:plugins\/[^/]+\/skills\/[^/]+)|(?:\.claude\/skills\/[^/]+))\/references\//.exec(
      file.path,
    )
    if (!referencesMatch) continue
    for (const target of linkTargets(file.text)) {
      if (!isCheckable(target)) continue
      if (target.startsWith('/') || target.startsWith('../')) {
        findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:reference-escapes` })
      }
    }
  }

  return { findings }
}
