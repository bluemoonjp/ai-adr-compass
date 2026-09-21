const LINK_TARGET = /\]\(([^)]+)\)/g
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i
const ANTIPATTERNS_PATH = /(^|\/)antipatterns\//
const RULE_ID = 'links-one-way'

export function run({ files }) {
  const findings = []
  for (const file of files) {
    if (!file.path.startsWith('practices/')) continue
    const lines = file.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      LINK_TARGET.lastIndex = 0
      let m
      while ((m = LINK_TARGET.exec(lines[i]))) {
        const target = m[1]
        if (ABSOLUTE_URL.test(target)) continue
        if (ANTIPATTERNS_PATH.test(target)) {
          findings.push({ path: file.path, line: i + 1, ruleId: RULE_ID })
        }
      }
    }
  }
  return { findings }
}
