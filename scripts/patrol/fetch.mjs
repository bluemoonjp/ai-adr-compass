import { createHash } from 'node:crypto'

export const USER_AGENT = 'ai-adr-compass-patrol/1'
export const TIMEOUT_MS = 30000
const RETRYABLE_STATUS_MIN = 500

// Anchor-specific body extractors for hosts whose raw response embeds a
// fresh envelope (a request id, a timestamp) on every request even when the
// result itself hasn't changed, so hashing the raw body would report
// "changed" every week. None of v0.1's anchors need one yet; add an entry
// keyed by anchor id, returning the stable signature to hash instead of the
// raw body, once one does.
const BODY_EXTRACTORS = {}

export function md5Hex(text) {
  return createHash('md5').update(text, 'utf8').digest('hex')
}

async function requestWithRetry(url, options, fetchImpl) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, options)
      if (res.status >= RETRYABLE_STATUS_MIN && res.status < 600 && attempt === 0) continue
      return { res }
    } catch (err) {
      lastError = err
      if (attempt === 0) continue
    }
  }
  return { error: lastError }
}

// Throttles by host, not by anchor: several anchors can share a host, and
// minIntervalSec protects the host, not any one anchor's own schedule.
async function throttle(host, minIntervalSec, hostState, { now, sleepImpl }) {
  if (!minIntervalSec || !hostState) return
  const last = hostState.get(host)
  if (last === undefined) return
  const waitMs = minIntervalSec * 1000 - (now() - last)
  if (waitMs > 0) await sleepImpl(waitMs)
}

// Pure classification of an already-completed fetch attempt against the
// previously accepted baseline entry, so the network path and the state
// logic can be tested independently.
export function classify({ anchor, error, res, bodyText }) {
  if (error) return { state: 'failed', http: null, bytes: 0 }
  if (res.status === 304) return { state: 'not-modified', http: 304, bytes: 0 }
  if (res.status < 200 || res.status >= 300) return { state: 'failed', http: res.status, bytes: 0 }

  const bytes = Buffer.byteLength(bodyText, 'utf8')
  if (bytes === 0) return { state: 'failed', http: res.status, bytes: 0 }

  if (anchor.method === 'etag') {
    const etag = res.headers.get('etag')
    if (!etag) return { state: 'failed', http: res.status, bytes }
    const state = anchor.baselineEtag === undefined ? 'no-baseline' : anchor.baselineEtag === etag ? 'unchanged' : 'changed'
    return { state, http: res.status, bytes, etag, hash: md5Hex(etag) }
  }

  const extractor = BODY_EXTRACTORS[anchor.id]
  const signature = extractor ? extractor(bodyText) : bodyText
  const md5 = md5Hex(signature)
  const state = anchor.baselineMd5 === undefined ? 'no-baseline' : anchor.baselineMd5 === md5 ? 'unchanged' : 'changed'
  return { state, http: res.status, bytes, md5, hash: md5 }
}

// anchor: {id, url, method: "etag"|"md5", minIntervalSec?}
// baselineEntry: {etag?, md5?} | undefined (no prior accepted observation)
export async function fetchAnchor(
  anchor,
  baselineEntry,
  { fetchImpl = fetch, now = () => Date.now(), sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)), hostState } = {},
) {
  const host = new URL(anchor.url).hostname
  await throttle(host, anchor.minIntervalSec, hostState, { now, sleepImpl })

  const headers = { 'User-Agent': USER_AGENT }
  if (anchor.method === 'etag' && baselineEntry?.etag) {
    headers['If-None-Match'] = baselineEntry.etag
  }

  const { res, error } = await requestWithRetry(
    anchor.url,
    { redirect: 'follow', headers, signal: AbortSignal.timeout(TIMEOUT_MS) },
    fetchImpl,
  )
  if (hostState) hostState.set(host, now())

  const bodyText = !error && res.status >= 200 && res.status < 300 ? await res.text() : ''
  const result = classify({
    anchor: { id: anchor.id, method: anchor.method, baselineEtag: baselineEntry?.etag, baselineMd5: baselineEntry?.md5 },
    error,
    res,
    bodyText,
  })

  // Full timestamp, not just a date: state.json is written even on a no-op
  // week, and a date-only value would make two same-day dispatches produce
  // byte-identical state.json, so there'd be nothing to commit on the
  // second run.
  return { id: anchor.id, url: anchor.url, checkedAt: new Date(now()).toISOString(), ...result }
}
