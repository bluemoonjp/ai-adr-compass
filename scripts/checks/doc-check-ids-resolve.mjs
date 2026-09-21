const RULE_ID = 'doc-check-ids-resolve'
const CI_ID_PATTERN = /\(ci:\s*([a-z0-9-]+)\)/g
const TABLE_ROW_ID_PATTERN = /^\|\s*`([a-z0-9-]+)`\s*\|/
const AGENTS_PATH = 'AGENTS.md'
const AUTHORING_PATH = 'docs/maintain/authoring.md'

function idsFromAgents(text) {
  const found = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    let m
    CI_ID_PATTERN.lastIndex = 0
    while ((m = CI_ID_PATTERN.exec(lines[i]))) {
      found.push({ id: m[1], line: i + 1 })
    }
  }
  return found
}

function idsFromAuthoringTable(text) {
  const found = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = TABLE_ROW_ID_PATTERN.exec(lines[i])
    if (m) found.push({ id: m[1], line: i + 1 })
  }
  return found
}

export function run({ files }) {
  const findings = []
  const checksFile = files.find((f) => f.path === 'checks.json')
  const knownIds = new Set(checksFile ? JSON.parse(checksFile.text).checks.map((c) => c.id) : [])

  const agents = files.find((f) => f.path === AGENTS_PATH)
  if (agents) {
    for (const { id, line } of idsFromAgents(agents.text)) {
      if (!knownIds.has(id)) {
        findings.push({ path: AGENTS_PATH, line, ruleId: `${RULE_ID}:unresolved` })
      }
    }
  }

  const authoring = files.find((f) => f.path === AUTHORING_PATH)
  if (authoring) {
    for (const { id, line } of idsFromAuthoringTable(authoring.text)) {
      if (!knownIds.has(id)) {
        findings.push({ path: AUTHORING_PATH, line, ruleId: `${RULE_ID}:unresolved` })
      }
    }
  }

  return { findings }
}
