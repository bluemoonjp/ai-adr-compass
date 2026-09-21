const RULE_ID = 'readme-sections-paired'
const H2 = /^##\s+(.+?)\s*$/
const H3 = /^###\s+/

export function run({ files }) {
  const findings = []
  const readme = files.find((f) => f.path === 'README.md')
  if (!readme) return { findings }

  const sections = {}
  let current = null
  for (const line of readme.text.split('\n')) {
    const h2 = H2.exec(line)
    if (h2) {
      current = h2[1]
      sections[current] = sections[current] ?? 0
      continue
    }
    if (current && H3.test(line)) sections[current] += 1
  }

  const english = sections['English'] ?? 0
  const japanese = sections['日本語'] ?? 0
  if (english !== japanese) {
    findings.push({ path: readme.path, line: 1, ruleId: `${RULE_ID}:mismatch` })
  }

  return { findings }
}
