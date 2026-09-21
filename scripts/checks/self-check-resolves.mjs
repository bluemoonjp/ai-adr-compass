import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

const RULE_ID = 'self-check-resolves'
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/

function extractFrontmatter(text) {
  const match = FRONTMATTER.exec(text)
  if (!match) return null
  try {
    return parseYaml(match[1])
  } catch {
    return null
  }
}

function readJson(root, relPath, fallback) {
  try {
    return JSON.parse(readFileSync(path.join(root, relPath), 'utf8'))
  } catch {
    return fallback
  }
}

// not_applicable.json keys are full paths ("practices/0002", "antipatterns/0001"),
// not bare ids: practice and antipattern ids both start counting from 0001, so a
// bare-id key would silently resolve the wrong content the moment both used the
// same number.
export function run({ root, files }) {
  const findings = []

  const checks = readJson(root, 'checks.json', { checks: [] }).checks ?? []
  const enforcedIds = new Set(checks.flatMap((c) => c.enforces ?? []))

  const notApplicable = readJson(root, 'scripts/checks/data/not_applicable.json', {})
  const notApplicableKeys = new Set(Object.keys(notApplicable))

  const contentFiles = files.filter(
    (f) => (f.path.startsWith('practices/') || f.path.startsWith('antipatterns/')) && f.path.endsWith('.md'),
  )

  for (const file of contentFiles) {
    const data = extractFrontmatter(file.text)
    if (!data || data.status !== 'active' || typeof data.id !== 'string') continue
    const kind = file.path.startsWith('practices/') ? 'practices' : 'antipatterns'
    const resolvedByEnforces = kind === 'practices' && enforcedIds.has(data.id)
    const resolvedByNotApplicable = notApplicableKeys.has(`${kind}/${data.id}`)
    if (!resolvedByEnforces && !resolvedByNotApplicable) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:unresolved` })
    }
  }

  return { findings }
}
