import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const GENERIC_PATTERNS = JSON.parse(
  readFileSync(path.join(dataDir, 'forbidden-patterns.json'), 'utf8'),
)
const TRAILER_ALLOWLIST = JSON.parse(
  readFileSync(path.join(dataDir, 'trailer-allowlist.json'), 'utf8'),
)

const OWN_DATA_PREFIX = 'scripts/checks/data/'
const TRAILER_LINE = /^[A-Za-z-]+: .*<([^>]+)>$/
const RULE_ID = 'forbidden-patterns'

function compilePatterns(defs) {
  return defs.map((d) => ({ id: d.id, re: new RegExp(d.pattern, 'g') }))
}

function isAllowedTrailerLine(line) {
  const m = TRAILER_LINE.exec(line.trim())
  if (!m) return false
  const domain = m[1].split('@')[1]
  return Boolean(domain) && TRAILER_ALLOWLIST.noreplyDomains.includes(domain)
}

function scanLines(lines, patterns, findings, filePath) {
  for (let i = 0; i < lines.length; i++) {
    for (const { id, re } of patterns) {
      re.lastIndex = 0
      if (re.test(lines[i])) {
        findings.push({ path: filePath, line: i + 1, ruleId: `${RULE_ID}:${id}` })
      }
    }
  }
}

function scanFiles(files, patterns) {
  const findings = []
  for (const file of files) {
    if (file.path.startsWith(OWN_DATA_PREFIX)) continue
    scanLines(file.text.split('\n'), patterns, findings, file.path)
  }
  return findings
}

function scanCommitMessages(messages, patterns) {
  const findings = []
  for (const message of messages) {
    const lines = message.split('\n').filter((line) => !isAllowedTrailerLine(line))
    scanLines(lines, patterns, findings, '(commit-message)')
  }
  return findings
}

function configError(reason) {
  return { path: '(private-patterns)', line: 0, ruleId: `${RULE_ID}:${reason}` }
}

function maskIfCi(value) {
  if (process.env.CI && value) {
    process.stdout.write(`::add-mask::${value}\n`)
  }
}

function evaluatePrivatePatterns({ files, messages, strict }) {
  const raw = process.env.COMPASS_PRIVATE_PATTERNS
  const enforceUnset = Boolean(process.env.CI) || strict

  if (!raw) {
    if (enforceUnset) {
      return { findings: [configError('env-unset')], notices: [] }
    }
    return { findings: [], notices: ['private-patterns: skipped (env unset)'] }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { findings: [configError('invalid-json')], notices: [] }
  }

  const patternDefs = Array.isArray(parsed?.patterns) ? parsed.patterns : []
  const probe = typeof parsed?.probe === 'string' ? parsed.probe : ''

  for (const p of patternDefs) maskIfCi(p)
  maskIfCi(probe)

  if (patternDefs.length === 0) {
    return { findings: [configError('invalid-json')], notices: [] }
  }

  let compiled
  try {
    compiled = compilePatterns(patternDefs.map((pattern) => ({ id: 'private', pattern })))
  } catch {
    return { findings: [configError('invalid-regexp')], notices: [] }
  }

  const probeMatches = compiled.some(({ re }) => {
    re.lastIndex = 0
    return re.test(probe)
  })
  if (!probeMatches) {
    return { findings: [configError('probe-mismatch')], notices: [] }
  }

  const findings = [
    ...scanFiles(files, compiled),
    ...scanCommitMessages(messages, compiled),
  ]
  return { findings, notices: [] }
}

export function run({ files, messages, strict }) {
  const generic = compilePatterns(GENERIC_PATTERNS)
  const findings = [
    ...scanFiles(files, generic),
    ...scanCommitMessages(messages, generic),
  ]

  const privateResult = evaluatePrivatePatterns({ files, messages, strict })
  findings.push(...privateResult.findings)

  return {
    findings,
    notices: [`commits checked: ${messages.length}`, ...privateResult.notices],
  }
}
