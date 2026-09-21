import {
  applyBlock,
  INSTRUCTION_FILE_SKILL_DIR,
  INSTRUCTION_FILE_TEMPLATE_NAMES,
  listOrphanReferenceNames,
  listSkillFiles,
  parseAntipatternDetails,
  parsePracticeDetails,
  parsePracticeRows,
  parseSkillTopics,
  renderAuthoringTable,
  renderPracticeIndex,
  renderReadmeBlockEn,
  renderReadmeBlockJa,
  renderReferenceFile,
  renderTemplateReferenceReadme,
  stripAdaptersNote,
} from '../gen.mjs'

const RULE_ID = 'generated-fresh'
const CHECKS_PATH = 'checks.json'
const AUTHORING_PATH = 'docs/maintain/authoring.md'
const PRACTICE_INDEX_PATH = 'practices/index.md'
const README_PATH = 'README.md'

function normalize(text) {
  return text.replace(/\r\n/g, '\n')
}

// The .md files directly inside dirPath — depth-1 only, so a nested
// directory such as a skill's references/templates/ (a different
// generator's output, syncInstructionFileTemplates) is never included.
function directChildMdNames(files, dirPath) {
  const prefix = `${dirPath}/`
  const names = []
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue
    const rest = f.path.slice(prefix.length)
    if (rest.includes('/') || !rest.endsWith('.md')) continue
    names.push(rest.slice(0, -'.md'.length))
  }
  return names
}

function markerLine(text, marker) {
  const idx = text.indexOf(marker)
  if (idx === -1) return 1
  return text.slice(0, idx).split('\n').length
}

export function run({ files }) {
  const findings = []
  const notices = []

  const checksFile = files.find((f) => f.path === CHECKS_PATH)
  const authoringFile = files.find((f) => f.path === AUTHORING_PATH)
  if (checksFile && authoringFile) {
    const checks = JSON.parse(checksFile.text).checks
    const table = renderAuthoringTable(checks)
    const actual = normalize(authoringFile.text)
    const expected = normalize(applyBlock(actual, table))
    if (actual !== expected) {
      findings.push({ path: AUTHORING_PATH, line: markerLine(actual, '<!-- gen:start -->'), ruleId: `${RULE_ID}:stale` })
      notices.push(`${RULE_ID}: ${AUTHORING_PATH} is stale — run: pnpm gen`)
    }
  }

  const rows = parsePracticeRows(files)

  const indexFile = files.find((f) => f.path === PRACTICE_INDEX_PATH)
  if (indexFile) {
    const actual = normalize(indexFile.text)
    const expected = normalize(renderPracticeIndex(rows))
    if (actual !== expected) {
      findings.push({ path: PRACTICE_INDEX_PATH, line: 1, ruleId: `${RULE_ID}:index-stale` })
      notices.push(`${RULE_ID}: ${PRACTICE_INDEX_PATH} is stale — run: pnpm gen`)
    }
  }

  const readmeFile = files.find((f) => f.path === README_PATH)
  if (readmeFile) {
    const actual = normalize(readmeFile.text)
    const withEn = applyBlock(actual, renderReadmeBlockEn(rows), 'how-to-use-en')
    const expected = normalize(applyBlock(withEn, renderReadmeBlockJa(rows), 'how-to-use-ja'))
    if (actual !== expected) {
      findings.push({
        path: README_PATH,
        line: markerLine(actual, '<!-- gen:start:how-to-use-en -->'),
        ruleId: `${RULE_ID}:readme-stale`,
      })
      notices.push(`${RULE_ID}: ${README_PATH} is stale — run: pnpm gen`)
    }
  }

  const practices = parsePracticeDetails(files)
  const antipatterns = parseAntipatternDetails(files)

  // A missing target (a topic just added to metadata.topics, or a plugin
  // scaffolded without running pnpm gen yet) is staleness too, not something
  // to skip — files.find returns undefined, actual stays null, and null
  // never equals a non-empty expected string.
  for (const skillFile of listSkillFiles(files)) {
    const skillDir = skillFile.path.slice(0, -'/SKILL.md'.length)
    const topics = parseSkillTopics(skillFile)
    for (const topic of topics) {
      const refPath = `${skillDir}/references/${topic}.md`
      const refFile = files.find((f) => f.path === refPath)
      const actual = refFile ? normalize(refFile.text) : null
      const expected = normalize(renderReferenceFile(topic, practices, antipatterns))
      if (actual !== expected) {
        findings.push({ path: refPath, line: 1, ruleId: `${RULE_ID}:reference-stale` })
        notices.push(`${RULE_ID}: ${refPath} is stale — run: pnpm gen`)
      }
    }

    const referencesDir = `${skillDir}/references`
    const existingNames = directChildMdNames(files, referencesDir)
    for (const orphan of listOrphanReferenceNames(existingNames, topics)) {
      const orphanPath = `${referencesDir}/${orphan}.md`
      findings.push({ path: orphanPath, line: 1, ruleId: `${RULE_ID}:reference-orphan` })
      notices.push(`${RULE_ID}: ${orphanPath} is an orphaned reference file — run: pnpm gen`)
    }
  }

  const instructionFileSkill = files.find((f) => f.path === `${INSTRUCTION_FILE_SKILL_DIR}/SKILL.md`)
  if (instructionFileSkill) {
    for (const name of INSTRUCTION_FILE_TEMPLATE_NAMES) {
      const sourceFile = files.find((f) => f.path === `templates/${name}`)
      if (!sourceFile) continue
      const targetPath = `${INSTRUCTION_FILE_SKILL_DIR}/references/templates/${name}`
      const targetFile = files.find((f) => f.path === targetPath)
      const expected = normalize(stripAdaptersNote(sourceFile.text))
      const actual = targetFile ? normalize(targetFile.text) : null
      if (actual !== expected) {
        findings.push({ path: targetPath, line: 1, ruleId: `${RULE_ID}:reference-template-stale` })
        notices.push(`${RULE_ID}: ${targetPath} is stale — run: pnpm gen`)
      }
    }

    const readmePath = `${INSTRUCTION_FILE_SKILL_DIR}/references/templates/README.md`
    const readmeTemplateFile = files.find((f) => f.path === readmePath)
    const actualReadme = readmeTemplateFile ? normalize(readmeTemplateFile.text) : null
    const expectedReadme = normalize(renderTemplateReferenceReadme())
    if (actualReadme !== expectedReadme) {
      findings.push({ path: readmePath, line: 1, ruleId: `${RULE_ID}:reference-template-stale` })
      notices.push(`${RULE_ID}: ${readmePath} is stale — run: pnpm gen`)
    }
  }

  return notices.length > 0 ? { findings, notices } : { findings }
}
