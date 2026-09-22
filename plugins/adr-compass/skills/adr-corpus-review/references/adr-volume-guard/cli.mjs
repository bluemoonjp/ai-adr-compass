// IO layer for adr-volume-guard. Not part of any CI check — a standalone
// CLI for a project to run this instrument against its own ADR directory,
// or for a maintainer here to re-run it against a directory outside this
// repository. Unlike scripts/checks/*.mjs, this file is not "fast": it
// reads the filesystem directly (measure() itself stays pure).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatNotices, measure, renderMarkdown } from './index.mjs'

function toPosix(p) {
  return p.split(path.sep).join('/')
}

// Every *.md file directly under `dir` becomes a candidate record; measure()
// itself discards anything whose basename doesn't start with a record
// number (an index or README file, for example).
function collectFiles(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.md')) continue
    files.push({ path: toPosix(path.join(dir, name)), text: readFileSync(path.join(dir, name), 'utf8') })
  }
  return files
}

// dates.json: {"<record id, exactly as it appears at the start of the
// filename>": "YYYY-MM-DD"}. Use this for a corpus whose own Date: line
// isn't in this repository's YYYY-MM-DD form (or is absent) — git log's own
// date for the commit that added the file is a common source for it. This
// option exists only in the CLI's IO layer: it never touches the CI check,
// which has no way to reach git (see scripts/lib/runner.mjs's discipline).
function loadDates(datesPath) {
  if (!datesPath) return {}
  const raw = JSON.parse(readFileSync(datesPath, 'utf8'))
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

// The one positional argument, order-independent with respect to --json and
// --dates <path>. A naive "first token not starting with --" scan is wrong
// here: it would misread --dates' own value (e.g. "dates.json" in
// "--dates dates.json docs/adr") as the directory when --dates precedes the
// directory on the command line. This walks the full argv instead, skipping
// --dates together with the single token it consumes.
function parsePositionalDir(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dates') {
      i++ // also skip --dates' own value
      continue
    }
    if (args[i].startsWith('--')) continue
    return args[i]
  }
  return undefined
}

function main() {
  const args = process.argv.slice(2)
  const dir = parsePositionalDir(args)
  if (!dir) {
    console.error('usage: cli.mjs <adr-directory> [--json] [--dates <path>]')
    process.exit(1)
  }
  const datesFlagIdx = args.indexOf('--dates')
  const dates = loadDates(datesFlagIdx !== -1 ? args[datesFlagIdx + 1] : undefined)

  const result = measure(collectFiles(dir), { dates })

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const line of formatNotices(result)) console.log(line)
    console.log('')
    console.log(renderMarkdown(result))
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
