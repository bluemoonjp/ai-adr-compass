const RULE_ID = 'adr-template-matches-own-adrs'
const TEMPLATE_PATH = 'templates/adr.md.template'
const ADR_FILENAME = /^docs\/adr\/\d{4}-[a-z0-9-]+\.md$/
const H2_PATTERN = /^##\s+(.+?)\s*$/gm

function extractH2s(text) {
  const headings = new Set()
  H2_PATTERN.lastIndex = 0
  let m
  while ((m = H2_PATTERN.exec(text))) headings.add(m[1])
  return headings
}

// No-op until templates/adr.md.template exists (Phase 5a): this repository's
// own docs/adr/ is not itself a template consumer before then, so there is
// nothing yet for a template's structural claim to disagree with.
export function run({ files }) {
  const findings = []

  const template = files.find((f) => f.path === TEMPLATE_PATH)
  if (!template) return { findings }

  const templateH2s = extractH2s(template.text)
  const adrFiles = files.filter((f) => ADR_FILENAME.test(f.path))

  for (const adr of adrFiles) {
    const adrH2s = extractH2s(adr.text)
    for (const heading of templateH2s) {
      if (!adrH2s.has(heading)) {
        findings.push({ path: adr.path, line: 1, ruleId: `${RULE_ID}:not-in-adr` })
      }
    }
  }

  return { findings }
}
