const TARGET_EXT = /\.(?:md|template)$/
const LINE_REF_PATTERNS = [/\.md:\d+/, /#L\d+/]

export function run({ files }) {
  const findings = []
  for (const file of files) {
    if (!TARGET_EXT.test(file.path)) continue
    const lines = file.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (LINE_REF_PATTERNS.some((pattern) => pattern.test(line))) {
        findings.push({ path: file.path, line: i + 1, ruleId: 'no-line-refs' })
      }
    }
  }
  return { findings }
}
