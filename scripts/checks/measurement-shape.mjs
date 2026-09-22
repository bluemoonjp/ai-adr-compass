// Allowlist-and-throw over measurements/*.md, the same design as
// scripts/patrol/format.mjs: only a fixed heading set and a fixed
// "Corpus characteristics" field set may appear; anything else fails
// closed rather than being reviewed case by case. This is the structural
// half of measurements/README.md's leak-prevention story (the other half
// is measurement-integrity's digest pin, which stops the published bytes
// themselves from silently changing after this check last passed them).
const RULE_ID = 'measurement-shape'
const MEASUREMENT_FILE = /^measurements\/\d{4}-\d{2}-\d{2}-corpus-[a-z0-9]+\.md$/
const H1_PATTERN = /^#\s+(.+?)\s*$/
const VALID_H1 = /^Measurement: [a-z][a-z0-9-]*$/
const PUBLISHED_LINE = /^Published:\s*\d{4}-\d{2}-\d{2}$/
const H2_PATTERN = /^##\s+(.+?)\s*$/
const HEADING_LINE = /^#{1,6}\s/
const ALLOWED_H2 = ['Corpus characteristics', 'Volume']
const CHARACTERISTICS_FIELDS = new Set(['visibility', 'record count', 'observed days', 'primary language', 'reference notation'])
const TABLE_ROW = /^\|\s*([^|]+?)\s*\|/
// Any GFM header-separator cell: --- , :--- , ---: , :---: . Not just the
// literal "---" this repository's own fixtures happen to use.
const TABLE_SEPARATOR_CELL = /^:?-+:?$/
// A specific, instantiated record id ("ADR-0042") is a leak of the source
// corpus's own record; the generic placeholder "ADR-NNNN" naming the
// notation itself is not digits and never matches this. Case-insensitive:
// "adr-0042" names the same record as "ADR-0042".
const FORBIDDEN_RECORD_ID = /\bADR-\d+\b/i
const FORBIDDEN_STATUS_LINE = /^Status:\s/i

// Strips the inline markdown emphasis/code markers (*, _, `) a decision's
// own "Status:" line or record id could be wrapped in without changing how
// it renders, and any leading indentation (1-3 spaces is insignificant in
// CommonMark/GFM) — so "  **Status:**" or "*ADR*-0042" cannot slip past
// FORBIDDEN_STATUS_LINE/FORBIDDEN_RECORD_ID just by formatting differently
// on the page. Used only for those two content checks, never for heading or
// table-row detection, which have their own exact syntax to match.
function forbiddenScanText(line) {
  return line.replace(/[*_`]/g, '').replace(/^\s+/, '')
}

export function run({ files }) {
  const findings = []

  for (const file of files) {
    if (!MEASUREMENT_FILE.test(file.path)) continue
    const lines = file.text.split('\n')

    const h1Match = H1_PATTERN.exec(lines[0] ?? '')
    if (!h1Match || !VALID_H1.test(h1Match[1])) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:invalid-h1` })
    }

    let sawPublished = false
    let currentSection = null
    const seenH2 = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNo = i + 1

      if (HEADING_LINE.test(line)) {
        if (i === 0) continue // the H1, already validated above
        const h2Match = H2_PATTERN.exec(line)
        if (h2Match && ALLOWED_H2.includes(h2Match[1])) {
          seenH2.push(h2Match[1])
          currentSection = h2Match[1]
        } else {
          findings.push({ path: file.path, line: lineNo, ruleId: `${RULE_ID}:unknown-heading` })
          currentSection = 'unknown'
        }
        continue
      }

      if (currentSection === null && PUBLISHED_LINE.test(line)) sawPublished = true

      if (currentSection === 'Corpus characteristics') {
        const row = TABLE_ROW.exec(line)
        if (row) {
          const field = row[1].trim()
          if (field !== 'field' && !TABLE_SEPARATOR_CELL.test(field) && !CHARACTERISTICS_FIELDS.has(field)) {
            findings.push({ path: file.path, line: lineNo, ruleId: `${RULE_ID}:unknown-field` })
          }
        }
      }

      const scanText = forbiddenScanText(line)
      if (FORBIDDEN_STATUS_LINE.test(scanText)) {
        findings.push({ path: file.path, line: lineNo, ruleId: `${RULE_ID}:status-line` })
      }
      if (FORBIDDEN_RECORD_ID.test(scanText)) {
        findings.push({ path: file.path, line: lineNo, ruleId: `${RULE_ID}:record-id` })
      }
    }

    if (!sawPublished) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:missing-published-line` })
    }
    if (seenH2.join(',') !== ALLOWED_H2.join(',')) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:heading-set` })
    }
  }

  return { findings }
}
