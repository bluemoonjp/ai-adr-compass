import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const AUTHORING_PATH = 'docs/maintain/authoring.md'
const PRACTICES_DIR = 'practices'
const ANTIPATTERNS_DIR = 'antipatterns'
const PRACTICE_INDEX_PATH = 'practices/index.md'
const README_PATH = 'README.md'
const TABLE_HEADER = '| Check | Blocking | Enforces | What it protects |'
const TABLE_SEP = '| --- | --- | --- | --- |'
const START_MARKER = '<!-- gen:start -->'
const END_MARKER = '<!-- gen:end -->'
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
const PRACTICE_FILENAME = /^(\d{4})-[a-z0-9-]+\.md$/
const SKILL_MD_PATH = /^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/
const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/'
const MIT_URL = 'https://opensource.org/license/mit/'
// adr-record copies templates/ (prose starter files) into its own
// references/; adr-corpus-review copies starter/adr-volume-guard/ (the
// runnable instrument) into its own -- an install only ever copies
// plugins/adr-compass/, never the repository root, so a skill's own
// instructions can only ever point at a path that exists inside the
// installed plugin.
export const TEMPLATES_DIR = 'templates'
export const TEMPLATE_SKILL_DIR = 'plugins/adr-compass/skills/adr-record'
export const TEMPLATE_FILE = /\.template(?:\.json)?$/
export const VOLUME_GUARD_SOURCE_DIR = 'starter/adr-volume-guard'
export const VOLUME_GUARD_SKILL_DIR = 'plugins/adr-compass/skills/adr-corpus-review'
// Runtime files only -- .test.mjs is dev-only and adds nothing to a
// distributed copy a skill's own instructions run directly.
export const VOLUME_GUARD_FILE = /^(?!.*\.test\.mjs$).+$/
const ADAPTERS_NOTE_MARKER = "\n\nBefore copying, check this repository's [adapters/README.md]"

function parseFrontmatteredFile(file) {
  const match = FRONTMATTER.exec(file.text)
  if (!match) return null
  try {
    return { data: parseYaml(match[1]), body: match[2] }
  } catch {
    return null
  }
}

export function renderAuthoringTable(checks) {
  const rows = checks.map((c) => {
    const blocking = c.blocking ? 'yes' : 'no'
    const enforces = (c.enforces ?? []).join(', ')
    return `| \`${c.id}\` | ${blocking} | ${enforces} | ${c.protects} |`
  })
  return [TABLE_HEADER, TABLE_SEP, ...rows].join('\n')
}

export function applyBlock(text, block, id = null) {
  const startMarker = id ? `<!-- gen:start:${id} -->` : START_MARKER
  const endMarker = id ? `<!-- gen:end:${id} -->` : END_MARKER
  const startIdx = text.indexOf(startMarker)
  const endIdx = text.indexOf(endMarker)
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`applyBlock: could not find ${startMarker}/${endMarker} markers`)
  }
  const before = text.slice(0, startIdx + startMarker.length)
  const after = text.slice(endIdx)
  return `${before}\n${block}\n${after}`
}

// Pure: takes files ({path, text}[]) instead of reading disk, so a fixture
// test can exercise it with a temporary file set (see generated-fresh.mjs).
export function parsePracticeRows(files) {
  const rows = []
  for (const item of parsePracticeDetails(files)) {
    const verifiedOn = (item.sources ?? [])
      .map((s) => s?.verified_on)
      .filter((v) => typeof v === 'string')
      .sort()[0]
    rows.push({
      id: item.id,
      rule: item.rule,
      topic: item.topic,
      appliesTo: (item.applies_to ?? []).join(', '),
      verifiedOn: verifiedOn ?? '',
    })
  }
  rows.sort((a, b) => a.id.localeCompare(b.id))
  return rows
}

// Pure: active practices/antipatterns with their parsed frontmatter and raw
// body, for anything that needs more than the index's summary fields (the
// per-skill references/<topic>.md generator).
function parseActiveContentFiles(files, dir) {
  const items = []
  for (const file of files) {
    if (!file.path.startsWith(`${dir}/`)) continue
    if (!PRACTICE_FILENAME.test(path.basename(file.path))) continue
    const parsed = parseFrontmatteredFile(file)
    if (!parsed || parsed.data?.status !== 'active') continue
    items.push({ ...parsed.data, body: parsed.body })
  }
  items.sort((a, b) => a.id.localeCompare(b.id))
  return items
}

export function parsePracticeDetails(files) {
  return parseActiveContentFiles(files, PRACTICES_DIR)
}

export function parseAntipatternDetails(files) {
  return parseActiveContentFiles(files, ANTIPATTERNS_DIR)
}

function extractH2Sections(body) {
  const sections = []
  let current = null
  for (const line of body.split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      current = { heading: m[1], lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  return sections.map((s) => ({ heading: s.heading, content: s.lines.join('\n').trim() }))
}

function renderSourceList(sources) {
  return (sources ?? []).filter((s) => s?.summary && s?.url).map((s) => `- ${s.summary} (<${s.url}>)`)
}

// Pure: one skill's topic reference file, from that topic's active practices
// and the active antipatterns whose relates_to names one of them.
export function renderReferenceFile(topic, practices, antipatterns) {
  const topicPractices = practices.filter((p) => p.topic === topic)
  const includedIds = new Set(topicPractices.map((p) => p.id))
  const relatedAntipatterns = antipatterns.filter((a) => (a.relates_to ?? []).some((id) => includedIds.has(id)))

  const lines = [`# ${topic}`, '', 'Generated from `practices/*.md` and `antipatterns/*.md` by `pnpm gen`; do not edit.']

  lines.push('', '## Practices')
  for (const p of topicPractices) {
    lines.push('', `### ${p.id}: ${p.title}`, '', `Rule: ${p.rule}`, '', `Applies to: ${(p.applies_to ?? []).join(', ')}`)
    for (const section of extractH2Sections(p.body)) {
      lines.push('', `#### ${section.heading}`, '', section.content)
    }
    const sources = renderSourceList(p.sources)
    if (sources.length > 0) lines.push('', '#### Sources', '', ...sources)
  }

  if (relatedAntipatterns.length > 0) {
    lines.push('', '## Antipatterns')
    for (const a of relatedAntipatterns) {
      lines.push(
        '',
        `### ${a.id}: ${a.title}`,
        '',
        `Rule: ${a.rule}`,
        '',
        `Classification: ${a.classification}`,
        '',
        `Applies to: ${(a.applies_to ?? []).join(', ')}`,
      )
      for (const section of extractH2Sections(a.body)) {
        lines.push('', `#### ${section.heading}`, '', section.content)
      }
      const sources = renderSourceList(a.sources)
      if (sources.length > 0) lines.push('', '#### Sources', '', ...sources)
    }
  }

  lines.push(
    '',
    `This file's content is drawn from \`practices/\` and \`antipatterns/\`, licensed under [CC BY 4.0](${CC_BY_URL}).`,
    '',
  )
  return lines.join('\n')
}

// Pure: the skills whose SKILL.md declares metadata.topics, from a files
// array (repo files or a fixture's files list — see generated-fresh.mjs).
export function listSkillFiles(files) {
  return files.filter((f) => SKILL_MD_PATH.test(f.path))
}

export function parseSkillTopics(skillFile) {
  const parsed = parseFrontmatteredFile(skillFile)
  return parsed?.data?.metadata?.topics ?? []
}

// Pure: given the names (extension stripped) of a skill's existing
// references/*.md files and the topics its SKILL.md currently declares,
// returns the names that name no declared topic — orphans left behind after
// a topic is removed from metadata.topics. Depth-1 only: a caller passes
// names from references/ itself, never from a nested directory such as
// references/templates/, which is a different generator's output.
export function listOrphanReferenceNames(existingNames, topics) {
  const declared = new Set(topics)
  return existingNames.filter((name) => !declared.has(name))
}

export function stripAdaptersNote(text) {
  const idx = text.indexOf(ADAPTERS_NOTE_MARKER)
  return idx === -1 ? text : `${text.slice(0, idx)}\n`
}

export function renderTemplateReferenceReadme() {
  return `Copied from \`templates/*.template\` by \`pnpm gen\`; do not edit. Licensed under [MIT](${MIT_URL}).\n`
}

export function renderPracticeIndex(rows) {
  const header = ['# Practice index', '', 'Generated from `practices/*.md` by `pnpm gen`; do not edit.', '']
  const table = [
    '| ID | Rule | Topic | Applies to | Verified on |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.id} | ${r.rule} | ${r.topic} | ${r.appliesTo} | ${r.verifiedOn} |`),
  ]
  const footer = ['', "This table's content is drawn from `practices/`, licensed under [CC BY 4.0](../LICENSE-DOCS)."]
  return [...header, ...table, ...footer, ''].join('\n')
}

export function renderReadmeBlockEn(rows) {
  return `_Generated from \`practices/*.md\` by \`pnpm gen\`; do not edit this block._ **${rows.length}** active practices are indexed in [\`practices/index.md\`](practices/index.md), licensed under [CC BY 4.0](LICENSE-DOCS).`
}

export function renderReadmeBlockJa(rows) {
  return `_\`practices/*.md\` から \`pnpm gen\` で生成。このブロックは編集しないこと。_ **${rows.length}** 件の active な practice を [\`practices/index.md\`](practices/index.md) に索引化(ライセンス: [CC BY 4.0](LICENSE-DOCS))。`
}

function listContentFiles(root, dir) {
  const abs = path.join(root, dir)
  const files = []
  for (const name of readdirSync(abs)) {
    if (!PRACTICE_FILENAME.test(name)) continue
    files.push({ path: `${dir}/${name}`, text: readFileSync(path.join(abs, name), 'utf8') })
  }
  return files
}

function listSkillFilesFromDisk(root) {
  const files = []
  const pluginsDir = path.join(root, 'plugins')
  if (!existsSync(pluginsDir)) return files
  for (const plugin of readdirSync(pluginsDir)) {
    const skillsDir = path.join(pluginsDir, plugin, 'skills')
    if (!existsSync(skillsDir)) continue
    for (const skill of readdirSync(skillsDir)) {
      const skillMdAbs = path.join(skillsDir, skill, 'SKILL.md')
      if (!existsSync(skillMdAbs)) continue
      const relPath = `plugins/${plugin}/skills/${skill}/SKILL.md`
      files.push({ path: relPath, text: readFileSync(skillMdAbs, 'utf8') })
    }
  }
  return files
}

export function generateReferences(root) {
  const practices = parsePracticeDetails(listContentFiles(root, PRACTICES_DIR))
  const antipatterns = parseAntipatternDetails(listContentFiles(root, ANTIPATTERNS_DIR))

  for (const skillFile of listSkillFilesFromDisk(root)) {
    const skillDir = path.dirname(skillFile.path)
    const referencesAbs = path.join(root, skillDir, 'references')
    mkdirSync(referencesAbs, { recursive: true })
    const topics = parseSkillTopics(skillFile)
    for (const topic of topics) {
      const outAbs = path.join(referencesAbs, `${topic}.md`)
      writeFileSync(outAbs, renderReferenceFile(topic, practices, antipatterns).replace(/\r\n/g, '\n'))
    }

    const existingNames = readdirSync(referencesAbs, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name.slice(0, -'.md'.length))
    for (const orphan of listOrphanReferenceNames(existingNames, topics)) {
      unlinkSync(path.join(referencesAbs, `${orphan}.md`))
    }
  }
}

// { withFileTypes: true } + isFile() -- a plain readdirSync(dir).filter(regex)
// would try to readFileSync() a matching *directory* name (VOLUME_GUARD_FILE
// in particular matches almost anything that isn't *.test.mjs) and crash
// with EISDIR; skip anything that isn't a real file instead.
function listTemplateFilesFromDisk(root) {
  const dir = path.join(root, TEMPLATES_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && TEMPLATE_FILE.test(e.name))
    .map((e) => ({ name: e.name, text: readFileSync(path.join(dir, e.name), 'utf8') }))
}

// Removes any file under targetDir not named in expectedNames -- the
// counterpart to generateReferences' own listOrphanReferenceNames/unlinkSync
// a few lines above, applied here to a flat file list instead of a topic
// list. Without this, a templates/ or starter/adr-volume-guard/ file that is
// later renamed or removed leaves a stale, permanently-shipped copy behind
// with nothing to prune it.
function pruneOrphans(targetDir, expectedNames) {
  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    if (entry.isFile() && !expectedNames.has(entry.name)) {
      unlinkSync(path.join(targetDir, entry.name))
    }
  }
}

// Copies every templates/*.template(.json) file into adr-record's own
// references/templates/ -- a no-op until that skill exists.
function syncTemplatesIntoSkill(root) {
  if (!existsSync(path.join(root, TEMPLATE_SKILL_DIR, 'SKILL.md'))) return
  const targetDir = path.join(root, TEMPLATE_SKILL_DIR, 'references', 'templates')
  mkdirSync(targetDir, { recursive: true })
  const entries = listTemplateFilesFromDisk(root)
  for (const { name, text } of entries) {
    writeFileSync(path.join(targetDir, name), stripAdaptersNote(text).replace(/\r\n/g, '\n'))
  }
  writeFileSync(path.join(targetDir, 'README.md'), renderTemplateReferenceReadme())
  pruneOrphans(targetDir, new Set([...entries.map((e) => e.name), 'README.md']))
}

function listVolumeGuardFilesFromDisk(root) {
  const dir = path.join(root, VOLUME_GUARD_SOURCE_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && VOLUME_GUARD_FILE.test(e.name))
    .map((e) => ({ name: e.name, text: readFileSync(path.join(dir, e.name), 'utf8') }))
}

// Copies starter/adr-volume-guard/'s runtime files into adr-corpus-review's
// own references/adr-volume-guard/ -- a no-op until that skill exists. The
// distributed instrument and the CI check (scripts/checks/volume-report.mjs)
// already share starter/adr-volume-guard/'s own code; this is that same
// source copied a second way, for an installed plugin to run directly.
function syncVolumeGuardIntoSkill(root) {
  if (!existsSync(path.join(root, VOLUME_GUARD_SKILL_DIR, 'SKILL.md'))) return
  const targetDir = path.join(root, VOLUME_GUARD_SKILL_DIR, 'references', 'adr-volume-guard')
  mkdirSync(targetDir, { recursive: true })
  const entries = listVolumeGuardFilesFromDisk(root)
  for (const { name, text } of entries) {
    writeFileSync(path.join(targetDir, name), text.replace(/\r\n/g, '\n'))
  }
  pruneOrphans(targetDir, new Set(entries.map((e) => e.name)))
}

function main() {
  const root = process.cwd()
  const checks = JSON.parse(readFileSync(path.join(root, 'checks.json'), 'utf8')).checks
  const table = renderAuthoringTable(checks)
  const authoringAbs = path.join(root, AUTHORING_PATH)
  const currentAuthoring = readFileSync(authoringAbs, 'utf8')
  const nextAuthoring = applyBlock(currentAuthoring, table).replace(/\r\n/g, '\n')
  writeFileSync(authoringAbs, nextAuthoring)

  const rows = parsePracticeRows(listContentFiles(root, PRACTICES_DIR))

  const indexAbs = path.join(root, PRACTICE_INDEX_PATH)
  writeFileSync(indexAbs, renderPracticeIndex(rows).replace(/\r\n/g, '\n'))

  const readmeAbs = path.join(root, README_PATH)
  const currentReadme = readFileSync(readmeAbs, 'utf8')
  const withEn = applyBlock(currentReadme, renderReadmeBlockEn(rows), 'how-to-use-en')
  const nextReadme = applyBlock(withEn, renderReadmeBlockJa(rows), 'how-to-use-ja').replace(/\r\n/g, '\n')
  writeFileSync(readmeAbs, nextReadme)

  generateReferences(root)
  syncTemplatesIntoSkill(root)
  syncVolumeGuardIntoSkill(root)
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
