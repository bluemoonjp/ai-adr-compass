import {
  loadChecksRegistry,
  loadCommitMessages,
  loadRepoFiles,
  runCheck,
} from './lib/runner.mjs'

const root = process.cwd()
const fastOnly = process.argv.includes('--fast')
const strict = process.argv.includes('--strict')

async function main() {
  const checks = loadChecksRegistry(root)
  const files = loadRepoFiles(root)
  const messages = loadCommitMessages(root)

  let blockingFailed = false
  let totalFindings = 0

  for (const check of checks) {
    if (fastOnly && !check.fast) continue
    const { findings, notices } = await runCheck(root, check, { files, messages, strict })
    for (const notice of notices) {
      console.log(notice)
    }
    for (const finding of findings) {
      console.log(`${finding.path}:${finding.line} ${finding.ruleId}`)
    }
    if (findings.length > 0) {
      totalFindings += findings.length
      const suffix = check.blocking ? '' : ' (non-blocking)'
      console.log(`${check.id}: ${findings.length} finding(s)${suffix}`)
      if (check.blocking) blockingFailed = true
    }
  }

  if (totalFindings === 0) {
    console.log('all checks passed')
  }

  process.exit(blockingFailed ? 1 : 0)
}

main()
