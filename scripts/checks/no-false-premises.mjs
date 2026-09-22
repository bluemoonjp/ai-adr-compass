import { scanPhraseGroups } from '../lib/phrase-scan.mjs'

const RULE_ID = 'no-false-premises'
const GROUP_IDS = ['false-premise']

export function run({ files }) {
  return { findings: scanPhraseGroups(files, RULE_ID, GROUP_IDS) }
}
