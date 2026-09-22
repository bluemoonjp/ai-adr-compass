// A self-contained volume instrument for an ADR corpus. Every dimension is
// derived from record text alone — no git, no new front-matter, no network —
// so this file can be copied into another project's CI unmodified and
// imported directly by scripts/checks/volume-report.mjs in this repository,
// making the distributed instrument and the CI check the same code.
//
// Design choices this file exists to encode (see docs/adr/0004-*.md):
//  - Decision date comes only from a `Date: YYYY-MM-DD` line in the record's
//    own text (or an injected override — see `opts.dates`), because that is
//    the date a decision was made, not the date anyone last reviewed it.
//  - Cross-references are recognized only in the literal `ADR-NNNN` form.
//    A corpus that links records by filename or bare number instead (common
//    outside this repository's own convention) will read as having little
//    or no fan-in/fan-out even if it does cross-reference — a stated scope
//    limit, not a bug.
//  - fan-out is always reported as two separate numbers, `fanOutTotal` (every
//    occurrence) and `fanOutDistinct` (distinct targets), because collapsing
//    them into one `fanOut` key hides whether a record cites one thing four
//    times or four different things once.
//  - A record's own number in its own text (most commonly its H1 title,
//    "# ADR-NNNN: Title") never counts as a reference to itself: it is the
//    record naming itself, not a cross-reference, so it is excluded from
//    both fan-out and fan-in.
//  - Every distribution is reported as a full quantile set (p50/p90/p95/max),
//    never as mean + a multiple of standard deviation: fan-in, fan-out, and
//    generation-rate counts are right-skewed, and mean+2sd is not a
//    trustworthy estimator for that shape.

const RECORD_FILENAME = /^(\d+)-.+\.md$/i
const STATUS_LINE = /^Status:\s*(.+)$/m
const DATE_LINE = /^Date:\s*(\d{4}-\d{2}-\d{2})$/m
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ADR_REF = /ADR-(\d+)/g
const RULE_ID = 'volume-report'
const PACE_WINDOW_DAYS = 7

function basename(filePath) {
  const idx = filePath.lastIndexOf('/')
  return idx === -1 ? filePath : filePath.slice(idx + 1)
}

function toUtcDays(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

function daysBetween(earlierIso, laterIso) {
  return toUtcDays(laterIso) - toUtcDays(earlierIso)
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function findRefs(text) {
  const refs = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    ADR_REF.lastIndex = 0
    let m
    while ((m = ADR_REF.exec(lines[i]))) {
      refs.push({ numericId: Number(m[1]), line: i + 1 })
    }
  }
  return refs
}

// Parses one file into a record, or null when its basename doesn't carry a
// leading record number (an index/README file, for example).
function parseRecord(file, dates) {
  const match = RECORD_FILENAME.exec(basename(file.path))
  if (!match) return null
  const id = match[1]
  const statusMatch = STATUS_LINE.exec(file.text)
  const status = statusMatch ? statusMatch[1].trim() : null
  const override = dates[id]
  let date = typeof override === 'string' && ISO_DATE.test(override) ? override : null
  if (!date) {
    const dateMatch = DATE_LINE.exec(file.text)
    date = dateMatch ? dateMatch[1] : null
  }
  return { path: file.path, id, numericId: Number(id), status, date, refs: findRefs(file.text) }
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0]
  const pos = q * (sorted.length - 1)
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (lower === upper) return sorted[lower]
  const interpolated = sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower)
  // Round away binary floating-point noise (e.g. 3.549999999999999 for an
  // exact 3.55) so --json output and every threshold comparison are stable.
  return Math.round(interpolated * 1e6) / 1e6
}

// A full quantile set, never a mean or a standard deviation — see the file
// header for why.
function distribution(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  return {
    count: sorted.length,
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    p95: quantile(sorted, 0.95),
    max: sorted.length ? sorted[sorted.length - 1] : null,
  }
}

// Records in a trailing 7-day window ending on each dated record's own date
// (inclusive), counted per record. This is the corpus's generation rate,
// expressed in the same "records per 7 days" unit the pace concern is
// usually stated in, without ever collapsing it to a single mean.
function computePaceWindow(datesSorted) {
  const days = datesSorted.map(toUtcDays)
  return days.map((d) => days.filter((other) => other <= d && other > d - PACE_WINDOW_DAYS).length)
}

// Pure: takes records ({path, text}[]) and returns every measured dimension
// with no severity judgment attached — measure() only describes the corpus,
// it never decides what is a problem. `opts.now` (ms) and `opts.dates`
// ({recordId: 'YYYY-MM-DD'}) are both injectable so this stays testable and
// so a caller with git-derived dates for a corpus that doesn't carry a
// parseable `Date:` line can supply them instead.
export function measure(records, opts = {}) {
  const now = opts.now ?? Date.now()
  const dates = opts.dates ?? {}

  const parsed = records.map((f) => parseRecord(f, dates)).filter(Boolean)
  const numericIds = new Set(parsed.map((r) => r.numericId))

  const fanInTotalById = new Map()
  const fanInDistinctById = new Map()
  const unresolvedRefs = []

  for (const rec of parsed) {
    const seenTargets = new Set()
    for (const ref of rec.refs) {
      // This repository's own ADR format (and most others') states its own
      // number in its H1 title, "# ADR-NNNN: Title" — that is the record
      // naming itself, not a cross-reference, so it counts toward neither
      // fan-out nor fan-in.
      if (ref.numericId === rec.numericId) continue
      if (!numericIds.has(ref.numericId)) {
        unresolvedRefs.push({ path: rec.path, line: ref.line, ref: ref.numericId })
        continue
      }
      fanInTotalById.set(ref.numericId, (fanInTotalById.get(ref.numericId) ?? 0) + 1)
      if (!seenTargets.has(ref.numericId)) {
        seenTargets.add(ref.numericId)
        fanInDistinctById.set(ref.numericId, (fanInDistinctById.get(ref.numericId) ?? 0) + 1)
      }
    }
  }

  const nowIso = isoFromMs(now)
  const items = parsed.map((rec) => {
    const resolved = rec.refs.filter((r) => r.numericId !== rec.numericId && numericIds.has(r.numericId))
    return {
      path: rec.path,
      id: rec.id,
      status: rec.status,
      date: rec.date,
      daysSinceDecision: rec.date ? daysBetween(rec.date, nowIso) : null,
      fanOutTotal: resolved.length,
      fanOutDistinct: new Set(resolved.map((r) => r.numericId)).size,
      fanInTotal: fanInTotalById.get(rec.numericId) ?? 0,
      fanInDistinct: fanInDistinctById.get(rec.numericId) ?? 0,
    }
  })
  items.sort((a, b) => a.path.localeCompare(b.path))

  const datedSorted = items
    .filter((i) => i.date)
    .map((i) => i.date)
    .sort()
  const paceWindow7 = computePaceWindow(datedSorted)

  return {
    count: items.length,
    datesResolved: datedSorted.length,
    items,
    unresolvedRefs,
    unresolvedRefsTotal: unresolvedRefs.length,
    fanOutTotal: distribution(items.map((i) => i.fanOutTotal)),
    fanOutDistinct: distribution(items.map((i) => i.fanOutDistinct)),
    fanInTotal: distribution(items.map((i) => i.fanInTotal)),
    fanInDistinct: distribution(items.map((i) => i.fanInDistinct)),
    paceWindow7: distribution(paceWindow7),
    staleDays: distribution(items.filter((i) => i.daysSinceDecision !== null).map((i) => i.daysSinceDecision)),
  }
}

// The only metric names a threshold in config.example.json may use.
// validateConfigAgainstCorpus checks every configured key against this set
// explicitly — without it, a typo (e.g. "fanOut" for "fanOutTotal") would
// look up an absent key in p50ByMetric/p95ByMetric's returned object, get
// `undefined`, and be silently skipped by the same
// "corpusValue === undefined → continue" guard that protects a metric this
// corpus genuinely has no data for yet. That would defeat the whole point
// of validateConfigAgainstCorpus: a broken threshold under a misspelled key
// would pass validation with zero errors and then never evaluate anything.
const METRIC_NAMES = ['fanOutTotal', 'fanOutDistinct', 'fanInTotal', 'fanInDistinct', 'paceWindow7', 'staleDays']

// The metric names a threshold in config.example.json may name, each mapped
// to the p95 of that dimension — the tail, not the median. p95 is what a
// runtime warn should react to; the corpus's median plays a different role,
// in validateConfigAgainstCorpus below.
function p95ByMetric(measured) {
  return {
    fanOutTotal: measured.fanOutTotal.p95,
    fanOutDistinct: measured.fanOutDistinct.p95,
    fanInTotal: measured.fanInTotal.p95,
    fanInDistinct: measured.fanInDistinct.p95,
    paceWindow7: measured.paceWindow7.p95,
    staleDays: measured.staleDays.p95,
  }
}

function p50ByMetric(measured) {
  return {
    fanOutTotal: measured.fanOutTotal.p50,
    fanOutDistinct: measured.fanOutDistinct.p50,
    fanInTotal: measured.fanInTotal.p50,
    fanInDistinct: measured.fanInDistinct.p50,
    paceWindow7: measured.paceWindow7.p50,
    staleDays: measured.staleDays.p50,
  }
}

// Pure: given a config (starter/adr-volume-guard/config.example.json's
// shape — {thresholds: {<metric>: {operator, value, derivedFrom,
// measuredOn}}}) and this corpus's own measure() result, rejects any
// threshold whose value gives it no safety margin over what this corpus
// currently measures as normal (its own median, not its tail) — the
// specific arithmetic mistake this instrument exists to stop a caller from
// repeating: a ">"/">=" threshold that already sits at or below the
// corpus's ordinary, already-accepted history would start failing on
// content nobody flagged as a problem. Returns an array of errors, empty
// when the config is safe to adopt. A null `value` (the shipped default) is
// never validated — it names no threshold yet.
export function validateConfigAgainstCorpus(config, measured) {
  const errors = []
  const normal = p50ByMetric(measured)
  for (const [metric, threshold] of Object.entries(config?.thresholds ?? {})) {
    if (threshold?.value === null || threshold?.value === undefined) continue
    if (!METRIC_NAMES.includes(metric)) {
      errors.push({ metric, reason: `unknown metric ${JSON.stringify(metric)}; expected one of ${METRIC_NAMES.join(', ')}` })
      continue
    }
    if (threshold.operator !== '>' && threshold.operator !== '>=') {
      errors.push({ metric, reason: `operator must be ">" or ">=", got ${JSON.stringify(threshold.operator)}` })
      continue
    }
    if (!threshold.derivedFrom || !threshold.measuredOn) {
      errors.push({ metric, reason: 'derivedFrom and measuredOn are required whenever value is set' })
      continue
    }
    const corpusNormal = normal[metric]
    if (corpusNormal === null || corpusNormal === undefined) continue
    if (threshold.value - corpusNormal <= 0) {
      errors.push({
        metric,
        reason: `threshold (${threshold.operator} ${threshold.value}) has no safety margin over this corpus's own measured median (${corpusNormal})`,
      })
    }
  }
  return errors
}

// Pure: given an already-validated config (validateConfigAgainstCorpus
// returned no errors for it) and a measure() result, returns the metrics
// whose p95 trips their configured threshold. Never called by run() below —
// v0.1 ships no calibrated thresholds (config.example.json's values are all
// null), so the registered CI check only ever reports the structural
// unresolvedRefs signal. A downstream project that has derived its own
// thresholds calls this itself. An unknown metric name is silently skipped
// here rather than flagged, on the assumption the config was already
// validated — validateConfigAgainstCorpus, not this function, is where an
// unknown metric is an error.
export function evaluateThresholds(measured, config) {
  const tail = p95ByMetric(measured)
  const warnings = []
  for (const [metric, threshold] of Object.entries(config?.thresholds ?? {})) {
    if (threshold?.value === null || threshold?.value === undefined) continue
    if (!METRIC_NAMES.includes(metric)) continue
    const corpusValue = tail[metric]
    if (corpusValue === null || corpusValue === undefined) continue
    const tripped = threshold.operator === '>=' ? corpusValue >= threshold.value : corpusValue > threshold.value
    if (tripped) warnings.push({ metric, p95: corpusValue, threshold })
  }
  return warnings
}

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// Shared between run() (the CI check) and the CLI's non-JSON output, so a
// caller comparing the two can hold them to a byte-for-byte match.
export function formatNotices(result) {
  return [
    `volume: count=${result.count} datesResolved=${result.datesResolved} unresolvedRefs=${result.unresolvedRefsTotal}`,
    `volume: fanOutTotal p50=${fmt(result.fanOutTotal.p50)} p90=${fmt(result.fanOutTotal.p90)} p95=${fmt(result.fanOutTotal.p95)} max=${fmt(result.fanOutTotal.max)}`,
    `volume: fanOutDistinct p50=${fmt(result.fanOutDistinct.p50)} p90=${fmt(result.fanOutDistinct.p90)} p95=${fmt(result.fanOutDistinct.p95)} max=${fmt(result.fanOutDistinct.max)}`,
    `volume: fanInTotal p50=${fmt(result.fanInTotal.p50)} p90=${fmt(result.fanInTotal.p90)} p95=${fmt(result.fanInTotal.p95)} max=${fmt(result.fanInTotal.max)}`,
    `volume: fanInDistinct p50=${fmt(result.fanInDistinct.p50)} p90=${fmt(result.fanInDistinct.p90)} p95=${fmt(result.fanInDistinct.p95)} max=${fmt(result.fanInDistinct.max)}`,
    `volume: paceWindow7 p50=${fmt(result.paceWindow7.p50)} p90=${fmt(result.paceWindow7.p90)} p95=${fmt(result.paceWindow7.p95)} max=${fmt(result.paceWindow7.max)}`,
    `volume: staleDays p50=${fmt(result.staleDays.p50)} p90=${fmt(result.staleDays.p90)} p95=${fmt(result.staleDays.p95)} max=${fmt(result.staleDays.max)}`,
  ]
}

const ADR_DIR_PREFIX = 'docs/adr/'
const ADR_README = 'docs/adr/README.md'

// Filters a repository's full file list down to its docs/adr/ records
// (README excluded) and measures them. Shared by the check adapter below
// and by scripts/patrol/issue-body.mjs's `## Volume` section, so both read
// exactly the same corpus the same way.
export function measureAdrDir(files, opts = {}) {
  const records = files.filter((f) => f.path.startsWith(ADR_DIR_PREFIX) && f.path !== ADR_README && f.path.endsWith('.md'))
  return measure(records, opts)
}

// The check adapter. Only unresolvedRefs ever becomes a finding — a
// structural correctness signal, not a statistical one, per the file
// header's severity design. Everything else is descriptive and surfaces
// only as notices. volume-report is registered non-blocking, so these
// findings are always reported, never gate CI on their own.
export function run({ files }) {
  const result = measureAdrDir(files)
  const findings = result.unresolvedRefs.map((u) => ({ path: u.path, line: u.line, ruleId: `${RULE_ID}:unresolved-ref` }))
  return { findings, notices: formatNotices(result) }
}

// Exported presenter for the weekly patrol Issue's `## Volume` section
// (scripts/patrol/issue-body.mjs) and the CLI's default text output.
export function renderMarkdown(result) {
  function row(label, dist) {
    return `| ${label} | ${fmt(dist.p50)} | ${fmt(dist.p90)} | ${fmt(dist.p95)} | ${fmt(dist.max)} |`
  }
  return [
    `records: ${result.count} (dates resolved: ${result.datesResolved})`,
    `unresolved references (always significant, regardless of any threshold): ${result.unresolvedRefsTotal}`,
    '',
    '| metric | p50 | p90 | p95 | max |',
    '| --- | --- | --- | --- | --- |',
    row('fan-out (total)', result.fanOutTotal),
    row('fan-out (distinct)', result.fanOutDistinct),
    row('fan-in (total)', result.fanInTotal),
    row('fan-in (distinct)', result.fanInDistinct),
    row('generation rate (records / trailing 7 days)', result.paceWindow7),
    row('days since decision', result.staleDays),
  ].join('\n')
}
