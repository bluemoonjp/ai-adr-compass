import { parse as parseYaml } from 'yaml'

const RULE_ID = 'layer-b-no-a-content'
const B_LAYER_EXACT = new Set(['AGENTS.md', 'CLAUDE.md'])
const B_LAYER_PREFIX = 'docs/maintain/'
const PRACTICE_ID_PATTERN = /\bpractices?\/\d{4}\b|\bpractice:\s*\d{4}\b/i
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/

function isBLayer(filePath) {
  return B_LAYER_EXACT.has(filePath) || filePath.startsWith(B_LAYER_PREFIX)
}

function extractTitle(text) {
  const match = FRONTMATTER.exec(text)
  if (!match) return null
  try {
    const data = parseYaml(match[1])
    return typeof data?.title === 'string' && data.title.length > 0 ? data.title : null
  } catch {
    return null
  }
}

// A coarse proxy, not a complete boundary check: it only catches the
// mechanically-detectable shape of a practice id or a verbatim title.
// checks.json's `protects` for this check says so.
export function run({ files }) {
  const findings = []
  const bLayerFiles = files.filter((f) => isBLayer(f.path))
  if (bLayerFiles.length === 0) return { findings }

  const practiceTitles = files
    .filter((f) => f.path.startsWith('practices/') && f.path.endsWith('.md'))
    .map((f) => extractTitle(f.text))
    .filter(Boolean)

  for (const file of bLayerFiles) {
    const lines = file.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (PRACTICE_ID_PATTERN.test(line)) {
        findings.push({ path: file.path, line: i + 1, ruleId: `${RULE_ID}:practice-id` })
      }
      if (practiceTitles.some((title) => line.includes(title))) {
        findings.push({ path: file.path, line: i + 1, ruleId: `${RULE_ID}:practice-title` })
      }
    }
  }

  return { findings }
}
