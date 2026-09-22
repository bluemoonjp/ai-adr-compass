// Shared engine for a check that scans tracked files for forbidden phrases
// defined in scripts/checks/data/forbidden-phrases.json. Each caller passes
// its own ruleId and the subset of groups (by id) it owns, so two checks can
// split the same data file's groups without duplicating the scan logic.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchesAnyGlob } from './glob.mjs'

const dataPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'checks',
  'data',
  'forbidden-phrases.json',
)
const { groups } = JSON.parse(readFileSync(dataPath, 'utf8'))

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

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

export function scanPhraseGroups(files, ruleId, groupIds) {
  const compiledGroups = groups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => ({
      id: group.id,
      scope: group.scope,
      patterns: group.patterns.map((p) => new RegExp(p, 'i')),
      excludeIfMatches: (group.excludeIfMatches ?? []).map((p) => new RegExp(p, 'i')),
    }))

  const findings = []
  for (const file of files) {
    const { body, offset } = bodyOf(file.text)
    const lines = body.split('\n')
    for (const group of compiledGroups) {
      if (!matchesAnyGlob(file.path, group.scope)) continue
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (group.excludeIfMatches.some((p) => p.test(line))) continue
        if (group.patterns.some((p) => p.test(line))) {
          findings.push({ path: file.path, line: offset + i + 1, ruleId: `${ruleId}:${group.id}` })
        }
      }
    }
  }
  return findings
}
