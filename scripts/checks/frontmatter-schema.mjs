import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { parse as parseYaml } from 'yaml'

const schemasDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas')

const defsSchema = JSON.parse(readFileSync(path.join(schemasDir, 'defs.schema.json'), 'utf8'))
const practiceSchema = JSON.parse(readFileSync(path.join(schemasDir, 'practice.schema.json'), 'utf8'))
const antipatternSchema = JSON.parse(readFileSync(path.join(schemasDir, 'antipattern.schema.json'), 'utf8'))

const ajv = new Ajv2020({ strict: true, allErrors: true })
ajv.addSchema(defsSchema)
const validatePractice = ajv.compile(practiceSchema)
const validateAntipattern = ajv.compile(antipatternSchema)

const RULE_ID = 'frontmatter-schema'
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const FILENAME_ID = /^(\d{4})-[a-z0-9-]+\.md$/

// "Rule" is deliberately absent: the frontmatter `rule` field already carries
// it, and an H2 of the same name would duplicate it.
const PRACTICE_H2 = new Set(['Why', 'When it applies', 'Conflicting guidance'])
const ANTIPATTERN_H2 = new Set([
  'Symptom',
  'Cause',
  'Remedy',
  'What we did',
  'Why it worked',
  'What changed',
  'What to do now',
])

// A generated file such as practices/index.md lives under practices/ but is
// not itself a practice instance — only a file whose basename matches the
// numbered-id shape is. An adapter file reuses the practice schema and
// heading set verbatim — it is a practice-shaped file scoped to one tool.
function kindOf(filePath) {
  if (!FILENAME_ID.test(path.basename(filePath))) return null
  if (filePath.startsWith('practices/')) return 'practice'
  if (filePath.startsWith('antipatterns/')) return 'antipattern'
  if (filePath.startsWith('adapters/')) return 'adapter'
  return null
}

function extractH2s(body) {
  const headings = []
  const pattern = /^##\s+(.+?)\s*$/gm
  let m
  while ((m = pattern.exec(body))) headings.push(m[1])
  return headings
}

export function run({ files }) {
  const findings = []
  const targetFiles = files.filter((f) => kindOf(f.path) && f.path.endsWith('.md'))

  const practiceIds = new Set()
  for (const file of targetFiles) {
    if (kindOf(file.path) !== 'practice') continue
    const m = FILENAME_ID.exec(path.basename(file.path))
    if (m) practiceIds.add(m[1])
  }
  // adapters/ ids and practices/ ids both start counting from 0001; keeping
  // adapters out of practiceIds means an antipattern's relates_to can never
  // accidentally resolve against an adapter file of the same number.

  for (const file of targetFiles) {
    const kind = kindOf(file.path)
    const match = FRONTMATTER.exec(file.text)
    if (!match) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:missing-frontmatter` })
      continue
    }
    const [, frontmatterText, body] = match

    let data
    try {
      data = parseYaml(frontmatterText)
    } catch {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-yaml` })
      continue
    }

    const validate = kind === 'antipattern' ? validateAntipattern : validatePractice
    if (!validate(data)) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:schema` })
    }

    const filenameMatch = FILENAME_ID.exec(path.basename(file.path))
    const filenameId = filenameMatch ? filenameMatch[1] : null
    if (!filenameId || data?.id !== filenameId) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:id-filename-mismatch` })
    }

    const allowedH2 = kind === 'antipattern' ? ANTIPATTERN_H2 : PRACTICE_H2
    for (const heading of extractH2s(body)) {
      if (!allowedH2.has(heading)) {
        findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:unknown-heading` })
      }
    }

    if (kind === 'antipattern' && Array.isArray(data?.relates_to)) {
      for (const relatedId of data.relates_to) {
        if (!practiceIds.has(relatedId)) {
          findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:unresolved-relates-to` })
        }
      }
    }
  }

  return { findings }
}
