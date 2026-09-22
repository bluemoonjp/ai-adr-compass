const RULE_ID = 'no-live-instruction-files'

// Exact basenames that some agent discovers as a live instruction file,
// wherever they appear in the tree.
const DANGEROUS_BASENAMES = new Set([
  'CLAUDE.md',
  'AGENTS.md',
  'SKILL.md',
  'GEMINI.md',
  '.cursorrules',
  'copilot-instructions.md',
  '.windsurfrules',
  'CONVENTIONS.md',
])
const DANGEROUS_EXTENSION = /\.mdc$/

// Anything under these directories is discovered regardless of filename.
const DANGEROUS_DIR_PATTERNS = [
  /^\.claude\//,
  /^\.github\/(instructions|prompts|agents)\//,
  /^\.gemini\//,
  /^\.codex\//,
  /^\.cursor\//,
]

// The fixed set of paths allowed to use a live instruction filename because
// they are genuinely meant for this repository's own agents.
const ALLOWLIST_EXACT = new Set(['AGENTS.md', 'CLAUDE.md', '.claude/settings.json'])
const ALLOWLIST_PATTERNS = [/^\.claude\/skills\/adr-compass-[^/]+\/SKILL\.md$/, /^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/]

function isDangerous(filePath) {
  const basename = filePath.split('/').pop()
  if (DANGEROUS_BASENAMES.has(basename)) return true
  if (DANGEROUS_EXTENSION.test(basename)) return true
  return DANGEROUS_DIR_PATTERNS.some((pattern) => pattern.test(filePath))
}

function isAllowlisted(filePath) {
  if (ALLOWLIST_EXACT.has(filePath)) return true
  return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(filePath))
}

export function run({ files }) {
  const findings = []
  for (const file of files) {
    if (isDangerous(file.path) && !isAllowlisted(file.path)) {
      findings.push({ path: file.path, line: 1, ruleId: RULE_ID })
    }
  }
  return { findings }
}
