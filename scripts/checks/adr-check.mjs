const ADR_DIR_PREFIX = 'docs/adr/'
const README_PATH = 'docs/adr/README.md'
const FILENAME_PATTERN = /^docs\/adr\/(\d{4})-[a-z0-9-]+\.md$/
const STATUS_LINE = /^Status:\s*(.+)$/m
const VALID_STATUS = /^(accepted|withdrawn|superseded by ADR-(\d{4})|amended by ADR-(\d{4}))$/
const DATE_LINE = /^Date:\s*(.+)$/m
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/
const ADR_REF = /ADR-(\d{4})/g
const LINE_REF_PATTERNS = [/\.md:\d+/, /#L\d+/]
const RULE_ID = 'adr-check'

function findAdrFiles(files) {
  return files.filter((f) => f.path.startsWith(ADR_DIR_PREFIX) && f.path !== README_PATH && f.path.endsWith('.md'))
}

export function run({ files }) {
  const findings = []
  const adrFiles = findAdrFiles(files)

  const numberToPaths = new Map()
  for (const file of adrFiles) {
    const match = FILENAME_PATTERN.exec(file.path)
    if (!match) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:bad-filename` })
      continue
    }
    const number = match[1]
    if (!numberToPaths.has(number)) numberToPaths.set(number, [])
    numberToPaths.get(number).push(file.path)
  }

  for (const paths of numberToPaths.values()) {
    if (paths.length > 1) {
      for (const p of paths) {
        findings.push({ path: p, line: 1, ruleId: `${RULE_ID}:duplicate-number` })
      }
    }
  }

  const existingNumbers = new Set(numberToPaths.keys())

  for (const file of adrFiles) {
    if (!FILENAME_PATTERN.test(file.path)) continue

    const statusMatch = STATUS_LINE.exec(file.text)
    if (!statusMatch || !VALID_STATUS.test(statusMatch[1].trim())) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-status` })
    }

    const dateMatch = DATE_LINE.exec(file.text)
    if (!dateMatch || !VALID_DATE.test(dateMatch[1].trim())) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-date` })
    }

    const lines = file.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      ADR_REF.lastIndex = 0
      let ref
      while ((ref = ADR_REF.exec(line))) {
        if (!existingNumbers.has(ref[1])) {
          findings.push({ path: file.path, line: i + 1, ruleId: `${RULE_ID}:unresolved-reference` })
        }
      }

      if (LINE_REF_PATTERNS.some((pattern) => pattern.test(line))) {
        findings.push({ path: file.path, line: i + 1, ruleId: `${RULE_ID}:line-citation` })
      }
    }
  }

  return { findings }
}
