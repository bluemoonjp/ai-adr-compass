import { matchesAnyGlob } from '../lib/glob.mjs'

const SCOPE = [
  'practices/**',
  'templates/**',
  'adapters/**',
  'plugins/**/SKILL.md',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
]

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const ADDENDUM_HEADING = /^#+\s*(Addendum|Updates?|Changelog|追記|更新履歴)\s*$/
const RULE_ID = 'no-addendum-sections'

function bodyOf(text) {
  const match = FRONTMATTER.exec(text)
  return match ? match[2] : text
}

export function run({ files }) {
  const findings = []
  for (const file of files) {
    if (!matchesAnyGlob(file.path, SCOPE)) continue
    const lines = bodyOf(file.text).split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (ADDENDUM_HEADING.test(lines[i].trim())) {
        findings.push({ path: file.path, line: i + 1, ruleId: RULE_ID })
      }
    }
  }
  return { findings }
}
