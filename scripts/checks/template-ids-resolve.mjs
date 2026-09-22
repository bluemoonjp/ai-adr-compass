import path from 'node:path'
import { parse as parseYaml } from 'yaml'

const RULE_ID = 'template-ids-resolve'
const SIDECAR_FILE = /^templates\/[^/]+\.template\.json$/
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const PRACTICE_FILENAME = /^(\d{4})-[a-z0-9-]+\.md$/

// The ids of every practices/*.md file whose status is active -- a
// template's sidecar may only cite one of these, the same "active, not
// just present" rule self-check-resolves.mjs applies to enforces/
// not_applicable.json.
function activePracticeIds(files) {
  const ids = new Set()
  for (const file of files) {
    if (!file.path.startsWith('practices/')) continue
    if (!PRACTICE_FILENAME.test(path.basename(file.path))) continue
    const match = FRONTMATTER.exec(file.text)
    if (!match) continue
    let data
    try {
      data = parseYaml(match[1])
    } catch {
      continue
    }
    if (data?.status === 'active' && typeof data?.id === 'string') ids.add(data.id)
  }
  return ids
}

export function run({ files }) {
  const findings = []
  const activeIds = activePracticeIds(files)

  for (const file of files) {
    if (!SIDECAR_FILE.test(file.path)) continue

    let data
    try {
      data = JSON.parse(file.text)
    } catch {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-json` })
      continue
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-shape` })
      continue
    }

    for (const ids of Object.values(data)) {
      if (!Array.isArray(ids) || ids.length === 0) {
        findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-shape` })
        continue
      }
      for (const id of ids) {
        if (typeof id !== 'string' || !activeIds.has(id)) {
          findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:unresolved` })
        }
      }
    }
  }

  return { findings }
}
