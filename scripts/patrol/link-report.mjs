import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const URL_PATTERN = /^https?:\/\/\S+$/
const MAX_LISTED = 20

// Pure: takes lychee's own `--format json` stats object (see
// https://github.com/lycheeverse/lychee lychee-bin/src/formatters/stats/json.rs
// for the shape), not a file path, so this is testable without running lychee.
export function summarizeLycheeStats(stats) {
  const checked = Number.isInteger(stats?.total) ? stats.total : 0

  const collect = (map) =>
    Object.values(map ?? {})
      .flat()
      .map((entry) => entry?.url)
      .filter((url) => typeof url === 'string')

  const allBroken = [...collect(stats?.error_map), ...collect(stats?.timeout_map)]
  const safeBroken = allBroken.filter((url) => URL_PATTERN.test(url))

  return { checked, broken: allBroken.length, brokenUrls: safeBroken.slice(0, MAX_LISTED) }
}

export function renderLinkSection({ checked, broken, brokenUrls }) {
  const lines = [`broken: ${broken} / checked: ${checked}`]
  for (const url of brokenUrls) lines.push(`- ${url}`)
  return lines.join('\n')
}

function main() {
  const jsonPath = process.argv[2]
  let stats = {}
  if (jsonPath) {
    try {
      stats = JSON.parse(readFileSync(jsonPath, 'utf8'))
    } catch {
      stats = {}
    }
  }
  console.log(renderLinkSection(summarizeLycheeStats(stats)))
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
