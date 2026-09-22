import { matchesAnyGlob } from '../lib/glob.mjs'

const SCOPE = [
  'practices/**',
  'templates/**',
  'adapters/**',
  'plugins/**/SKILL.md',
  '.claude/skills/**/SKILL.md',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
]

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const ADDENDUM_HEADING = /^#+\s*(Addendum|Updates?|Changelog|追記|更新履歴)\s*$/
const RULE_ID = 'no-addendum-sections'

// Returns the body text plus how many lines of the original file preceded
// it, so a body-relative line index can be translated back to a real file
// line number. Frontmatter, when present, shifts every body line down.
function bodyOf(text) {
  const match = FRONTMATTER.exec(text)
  if (!match) return { body: text, offset: 0 }
  const prefix = text.slice(0, text.length - match[2].length)
  const offset = (prefix.match(/\n/g) ?? []).length
  return { body: match[2], offset }
}

export function run({ files }) {
  const findings = []
  for (const file of files) {
    if (!matchesAnyGlob(file.path, SCOPE)) continue
    const { body, offset } = bodyOf(file.text)
    const lines = body.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (ADDENDUM_HEADING.test(lines[i].trim())) {
        findings.push({ path: file.path, line: offset + i + 1, ruleId: RULE_ID })
      }
    }
  }
  return { findings }
}
