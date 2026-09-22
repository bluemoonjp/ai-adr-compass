const RULE_ID = 'release-check'
const MARKETPLACE_PATH = '.claude-plugin/marketplace.json'

function resolveSource(source) {
  return source.replace(/^\.\//, '').replace(/\/$/, '')
}

export function run({ files }) {
  const findings = []

  const marketplaceFile = files.find((f) => f.path === MARKETPLACE_PATH)
  if (!marketplaceFile) return { findings }

  let marketplace
  try {
    marketplace = JSON.parse(marketplaceFile.text)
  } catch {
    findings.push({ path: MARKETPLACE_PATH, line: 1, ruleId: `${RULE_ID}:invalid-marketplace-json` })
    return { findings }
  }

  const releaseTag = process.env.COMPASS_RELEASE_TAG
  const taggedVersion = releaseTag ? releaseTag.replace(/^v/, '') : null

  for (const entry of marketplace.plugins ?? []) {
    // A non-string source (an object) is a remote plugin (npm/git/github/...),
    // legitimately outside this check's scope. A string source that isn't a
    // "./"-prefixed relative path is not a valid alternative spelling of a
    // local plugin — the marketplace manifest schema requires that prefix for
    // the string form — so it is a malformed entry, not something to skip.
    if (typeof entry.source !== 'string') continue
    if (!entry.source.startsWith('./')) {
      findings.push({ path: MARKETPLACE_PATH, line: 1, ruleId: `${RULE_ID}:invalid-source` })
      continue
    }
    const pluginDir = resolveSource(entry.source)
    const pluginJsonPath = `${pluginDir}/.claude-plugin/plugin.json`
    const pluginFile = files.find((f) => f.path === pluginJsonPath)

    if (!pluginFile) {
      findings.push({ path: MARKETPLACE_PATH, line: 1, ruleId: `${RULE_ID}:plugin-manifest-missing` })
      continue
    }

    let plugin
    try {
      plugin = JSON.parse(pluginFile.text)
    } catch {
      findings.push({ path: pluginJsonPath, line: 1, ruleId: `${RULE_ID}:invalid-plugin-json` })
      continue
    }

    if (entry.version !== plugin.version) {
      findings.push({ path: pluginJsonPath, line: 1, ruleId: `${RULE_ID}:version-mismatch` })
    }

    if (taggedVersion && plugin.version !== taggedVersion) {
      findings.push({ path: pluginJsonPath, line: 1, ruleId: `${RULE_ID}:tag-mismatch` })
    }

    for (const licenseName of ['LICENSE', 'LICENSE-DOCS']) {
      if (!files.some((f) => f.path === `${pluginDir}/${licenseName}`)) {
        findings.push({ path: pluginDir, line: 1, ruleId: `${RULE_ID}:license-missing` })
      }
    }
  }

  return { findings }
}
