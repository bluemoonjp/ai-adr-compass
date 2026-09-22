import { scanPhraseGroups } from '../lib/phrase-scan.mjs'

const RULE_ID = 'no-history-words'
// The false-premise group is a separate check (no-false-premises); this
// check owns the remaining groups in forbidden-phrases.json.
const GROUP_IDS = ['history', 'single-canon']

export function run({ files }) {
  return { findings: scanPhraseGroups(files, RULE_ID, GROUP_IDS) }
}
