const RULE_ID = 'instruction-limits'
const AGENTS_MAX_LINES = 40
const CLAUDE_MAX_LINES = 10
const CLAUDE_FIRST_LINE = '@AGENTS.md'

// Matches `wc -l`: the number of newline characters, not the number of
// text lines, so a file without a trailing newline is one short.
function wcLines(text) {
  return (text.match(/\n/g) ?? []).length
}

export function run({ files }) {
  const findings = []
  const agents = files.find((f) => f.path === 'AGENTS.md')
  const claude = files.find((f) => f.path === 'CLAUDE.md')

  if (agents && wcLines(agents.text) > AGENTS_MAX_LINES) {
    findings.push({ path: 'AGENTS.md', line: AGENTS_MAX_LINES + 1, ruleId: `${RULE_ID}:agents-too-long` })
  }

  if (claude) {
    if (wcLines(claude.text) > CLAUDE_MAX_LINES) {
      findings.push({ path: 'CLAUDE.md', line: CLAUDE_MAX_LINES + 1, ruleId: `${RULE_ID}:claude-too-long` })
    }
    if (claude.text.split('\n')[0] !== CLAUDE_FIRST_LINE) {
      findings.push({ path: 'CLAUDE.md', line: 1, ruleId: `${RULE_ID}:claude-first-line-mismatch` })
    }
  }

  return { findings }
}
