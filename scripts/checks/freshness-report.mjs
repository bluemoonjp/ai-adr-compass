import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const RULE_ID = 'freshness-report'
const STALE_DAYS = 180
const CONTENT_DIRS = ['practices', 'antipatterns']
const CONTENT_FILE = /^(\d{4})-[a-z0-9-]+\.md$/
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/

function toUtcDays(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

function daysSince(dateStr, nowMs) {
  return Math.floor(nowMs / 86400000) - toUtcDays(dateStr)
}

function oldestVerifiedOn(sources) {
  return (sources ?? [])
    .map((s) => s?.verified_on)
    .filter((v) => typeof v === 'string')
    .sort()[0]
}

// Pure: takes files ({path, text}[]) so both the check runner and the CLI's
// disk-backed collector feed the same computation.
export function computeFreshness(files, nowMs = Date.now()) {
  const items = []
  for (const file of files) {
    if (!CONTENT_FILE.test(path.basename(file.path))) continue
    if (!CONTENT_DIRS.some((dir) => file.path.startsWith(`${dir}/`))) continue
    const match = FRONTMATTER.exec(file.text)
    if (!match) continue
    let data
    try {
      data = parseYaml(match[1])
    } catch {
      continue
    }
    if (data?.status !== 'active' || typeof data?.id !== 'string') continue
    const verifiedOn = oldestVerifiedOn(data.sources)
    if (!verifiedOn) continue
    items.push({ path: file.path, id: data.id, days: daysSince(verifiedOn, nowMs) })
  }
  items.sort((a, b) => a.path.localeCompare(b.path))
  const stale = items.filter((item) => item.days > STALE_DAYS)
  return { checked: items.length, stale }
}

export function run({ files }) {
  const { checked, stale } = computeFreshness(files)
  const findings = stale.map((item) => ({ path: item.path, line: 1, ruleId: `${RULE_ID}:stale` }))
  const notices = [
    ...stale.map((item) => `${item.path} ${item.id} ${item.days}`),
    `stale: ${stale.length} / checked: ${checked}`,
  ]
  return { findings, notices }
}

function collectFilesFromDisk(root) {
  const files = []
  for (const dir of CONTENT_DIRS) {
    const abs = path.join(root, dir)
    let names
    try {
      names = readdirSync(abs)
    } catch {
      continue
    }
    for (const name of names) {
      if (!CONTENT_FILE.test(name)) continue
      files.push({ path: `${dir}/${name}`, text: readFileSync(path.join(abs, name), 'utf8') })
    }
  }
  return files
}

export function renderMarkdown({ checked, stale }) {
  const lines = ['| path | id | days |', '| --- | --- | --- |']
  for (const item of stale) {
    lines.push(`| \`${item.path}\` | ${item.id} | ${item.days} |`)
  }
  lines.push('', `stale: ${stale.length} / checked: ${checked}`)
  return lines.join('\n')
}

function main() {
  const root = process.cwd()
  const files = collectFilesFromDisk(root)
  const result = computeFreshness(files)
  const format = process.argv.includes('--format=markdown') ? 'markdown' : 'text'
  if (format === 'markdown') {
    console.log(renderMarkdown(result))
  } else {
    for (const item of result.stale) {
      console.log(`${item.path} ${item.id} ${item.days}`)
    }
    console.log(`stale: ${result.stale.length} / checked: ${result.checked}`)
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
