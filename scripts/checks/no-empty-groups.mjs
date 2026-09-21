import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const defsSchema = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas', 'defs.schema.json'),
    'utf8',
  ),
)
const TOPICS = defsSchema.$defs.topic.enum

const RULE_ID = 'no-empty-groups'
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

export function run({ files }) {
  const findings = []
  const activeTopics = new Set()

  const practiceFiles = files.filter((f) => f.path.startsWith('practices/') && f.path.endsWith('.md'))
  for (const file of practiceFiles) {
    const data = extractFrontmatter(file.text)
    if (data?.status === 'active' && typeof data.topic === 'string') {
      activeTopics.add(data.topic)
    }
  }

  for (const topic of TOPICS) {
    if (!activeTopics.has(topic)) {
      findings.push({ path: 'practices', line: 1, ruleId: `${RULE_ID}:${topic}` })
    }
  }

  return { findings }
}
