import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { parse as parseYaml } from 'yaml'

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'schemas',
  'measurement-index.schema.json',
)
const measurementIndexSchema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const ajv = new Ajv2020({ strict: true, allErrors: true })
const validateIndex = ajv.compile(measurementIndexSchema)

const RULE_ID = 'measurement-integrity'
const INDEX_PATH = 'measurements/index.json'
// A dated measurement file, e.g. measurements/2026-09-22-corpus-a.md.
// measurements/README.md deliberately does not match this: it is prose
// about the channel itself, not a published measurement, and carries
// neither a fixed heading set nor an index.json entry.
const MEASUREMENT_FILE = /^measurements\/\d{4}-\d{2}-\d{2}-corpus-[a-z0-9]+\.md$/
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const CONTENT_FILE = /^(\d{4})-[a-z0-9-]+\.md$/

function findFile(files, relPath) {
  return files.find((f) => f.path === relPath)
}

function sha256Of(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// Sources whose kind/confidence pair claims a measurement backing
// (practices/0004's own shape: kind: primary, confidence: derived, url
// pointing into measurements/), from practices/, antipatterns/, adapters/.
function collectMeasurementSourceUrls(files) {
  const urls = []
  for (const file of files) {
    if (!CONTENT_FILE.test(path.basename(file.path))) continue
    if (!file.path.startsWith('practices/') && !file.path.startsWith('antipatterns/') && !file.path.startsWith('adapters/')) {
      continue
    }
    const match = FRONTMATTER.exec(file.text)
    if (!match) continue
    let data
    try {
      data = parseYaml(match[1])
    } catch {
      continue
    }
    for (const source of data?.sources ?? []) {
      if (source?.kind !== 'primary' || source?.confidence !== 'derived') continue
      if (typeof source?.url !== 'string' || !source.url.includes('/measurements/')) continue
      urls.push({ path: file.path, url: source.url })
    }
  }
  return urls
}

export function run({ files }) {
  const findings = []

  const indexFile = findFile(files, INDEX_PATH)
  const measurementFiles = files.filter((f) => MEASUREMENT_FILE.test(f.path))

  if (!indexFile) {
    if (measurementFiles.length === 0) return { findings }
    // Measurement files exist with no index to account for them at all.
    return { findings: measurementFiles.map((f) => ({ path: f.path, line: 1, ruleId: `${RULE_ID}:unlisted-file` })) }
  }

  let index
  try {
    index = JSON.parse(indexFile.text)
  } catch {
    return { findings: [{ path: INDEX_PATH, line: 1, ruleId: `${RULE_ID}:invalid-json` }] }
  }

  if (!validateIndex(index)) {
    findings.push({ path: INDEX_PATH, line: 1, ruleId: `${RULE_ID}:schema` })
  }

  const entries = Array.isArray(index?.measurements) ? index.measurements : []
  const seenFiles = new Set()
  const listedPaths = new Set()

  for (const entry of entries) {
    if (typeof entry?.file !== 'string') continue
    if (seenFiles.has(entry.file)) {
      // A second entry for a file already accounted for above -- report the
      // duplication itself rather than re-running missing-file/digest-mismatch
      // a second time for the same path, which would just double-report
      // whatever the first entry already found.
      findings.push({ path: entry.file, line: 1, ruleId: `${RULE_ID}:duplicate-file` })
      continue
    }
    seenFiles.add(entry.file)
    listedPaths.add(entry.file)
    const file = findFile(files, entry.file)
    if (!file) {
      findings.push({ path: entry.file, line: 1, ruleId: `${RULE_ID}:missing-file` })
      continue
    }
    const actualSha256 = sha256Of(file.text)
    if (actualSha256 !== entry.sha256) {
      findings.push({ path: entry.file, line: 1, ruleId: `${RULE_ID}:digest-mismatch` })
    }
  }

  for (const file of measurementFiles) {
    if (!listedPaths.has(file.path)) {
      findings.push({ path: file.path, line: 1, ruleId: `${RULE_ID}:unlisted-file` })
    }
  }

  // A citing source must name the exact URL an index.json entry records --
  // not merely a URL whose path happens to end with a listed filename. A
  // path-suffix match alone would accept any host (an attacker-controlled
  // mirror, a typo'd fork) serving unrelated, non-digest-pinned bytes under
  // a same-named path; only entry.url itself is ever digest-checked above.
  const listedUrls = new Set(entries.filter((e) => typeof e?.url === 'string').map((e) => e.url))
  for (const { path: sourcePath, url } of collectMeasurementSourceUrls(files)) {
    if (!listedUrls.has(url)) {
      findings.push({ path: sourcePath, line: 1, ruleId: `${RULE_ID}:source-unresolved` })
    }
  }

  return { findings }
}
