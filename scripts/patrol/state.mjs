export const SOURCE_STATES = ['no-baseline', 'not-modified', 'unchanged', 'changed', 'failed']
export const RUN_STATES = ['ok', 'degraded', 'broken']
export const CHANGED_DEGRADED_DAYS = 8
export const STALE_CHECK_DAYS = 8

const SOURCE_STATE_SET = new Set(SOURCE_STATES)

export function isValidSourceState(value) {
  return SOURCE_STATE_SET.has(value)
}

export function assertValidSourceState(value) {
  if (!isValidSourceState(value)) {
    throw new Error(`state.mjs: "${value}" is not a valid source state (expected one of ${SOURCE_STATES.join(', ')})`)
  }
  return value
}

function toUtcDays(dateStr) {
  return Math.floor(Date.parse(dateStr) / 86400000)
}

export function daysSince(dateStr, nowMs) {
  return Math.floor(nowMs / 86400000) - toUtcDays(dateStr)
}

// The next value for an entry's firstChangedAt: carried forward while the
// state stays "changed" (so the 8-day rule can measure how long it has been
// changed across runs), cleared the moment the state stops being "changed" —
// whether that is because the source reverted or because a human accepted a
// new baseline (either way, "changed relative to what?" no longer has the
// same answer, so the clock must restart).
export function nextFirstChangedAt({ state, previousFirstChangedAt, today }) {
  if (state !== 'changed') return undefined
  return previousFirstChangedAt ?? today
}

// Only role:source entries have a baseline to compare "changed" against;
// controls compare against the previous state.json entry and are excluded
// from this rule by definition.
export function lingeringChanged(sourceEntries, nowMs) {
  return sourceEntries.filter(
    (e) => e.state === 'changed' && e.firstChangedAt && daysSince(e.firstChangedAt, nowMs) > CHANGED_DEGRADED_DAYS,
  )
}

// control-static must match its previous observation; control-changing must
// differ from it. Only meaningful once a previous observation exists — a
// "no-baseline" or "failed" state means there is nothing to compare, so the
// caller should not ask this question for those states (computeRunState
// already filters them out before calling this).
export function controlMismatch(role, state) {
  if (role === 'control-static') return state === 'changed'
  if (role === 'control-changing') return state === 'unchanged' || state === 'not-modified'
  return false
}

// Pure: computes the run-level verdict from already-gathered facts. Two of
// those facts (openWeeklyIssues, registryCheckPass) cannot be recomputed
// from state.json alone, which is why patrol.mjs writes them into state.json's
// `run` block for patrol-health.mjs to pass in here.
export function computeRunState({ sourceEntries, controlEntries, openWeeklyIssues, registryCheckPass, now = Date.now() }) {
  const reasons = []

  const fetchedOrNotModified = sourceEntries.filter((e) => e.state !== 'failed').length
  if (fetchedOrNotModified === 0) {
    reasons.push({ level: 'broken', reason: 'no source was fetched or not-modified this run' })
  }
  if (!registryCheckPass) {
    reasons.push({ level: 'broken', reason: 'registry-check did not pass' })
  }
  for (const control of controlEntries) {
    if (control.state === 'no-baseline' || control.state === 'failed') continue
    if (controlMismatch(control.role, control.state)) {
      reasons.push({ level: 'broken', reason: `control ${control.id} did not match its expectation (state: ${control.state})` })
    }
  }

  const failed = [...sourceEntries, ...controlEntries].filter((e) => e.state === 'failed')
  if (failed.length > 0) {
    reasons.push({ level: 'degraded', reason: `${failed.length} anchor(s) failed` })
  }
  if (openWeeklyIssues >= 2) {
    reasons.push({ level: 'degraded', reason: `${openWeeklyIssues} open weekly patrol issues` })
  }
  const lingering = lingeringChanged(sourceEntries, now)
  if (lingering.length > 0) {
    reasons.push({ level: 'degraded', reason: `${lingering.length} source(s) changed for more than ${CHANGED_DEGRADED_DAYS} days` })
  }

  const status = reasons.some((r) => r.level === 'broken')
    ? 'broken'
    : reasons.some((r) => r.level === 'degraded')
      ? 'degraded'
      : 'ok'

  return { status, reasons, failed }
}
