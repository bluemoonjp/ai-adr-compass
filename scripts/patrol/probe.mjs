import { TIMEOUT_MS, USER_AGENT, md5Hex } from './fetch.mjs'

// Labels only, never the matched substring itself: the probe's output is a
// public surface (CI logs, an Issue comment), so this must never carry a
// fragment of the fetched body — see format.mjs's same constraint.
const VOLATILE_PATTERN_LABELS = {
  'iso-timestamp': /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  lastBuildDate: /lastBuildDate/i,
  generated: /\bgenerated\b/i,
  nonce: /\bnonce\b/i,
  buildId: /\bbuildId\b/i,
}

export function matchedPatternLabels(text) {
  return Object.entries(VOLATILE_PATTERN_LABELS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label)
}

async function getOnce(url, fetchImpl, extraHeaders = {}) {
  const res = await fetchImpl(url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, ...extraHeaders },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await res.text()
  return { status: res.status, etag: res.headers.get('etag'), body }
}

// "volatile" answers "can this URL be tracked reliably", not "does its raw
// body ever change" — those are different questions once a conditional GET
// is available. A page whose raw body changes every request (a nonce, a
// per-request id) can still be perfectly trackable if its ETag stays valid
// across that same window, which is why a body-volatile URL gets one more
// conditional fetch before being called volatile: true. Body volatility
// itself is decided empirically (does the same URL return different bytes
// two fetches apart), not by pattern presence alone — a page can contain the
// literal word "nonce" in static markup and still be byte-stable, and
// pattern-only detection would wrongly block registering it.
export async function probeUrl(
  url,
  { fetchImpl = fetch, waitMs = 3000, sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)) } = {},
) {
  const first = await getOnce(url, fetchImpl)
  await sleepImpl(waitMs)
  const second = await getOnce(url, fetchImpl)

  const bodyVolatile = md5Hex(first.body) !== md5Hex(second.body)

  let etagStable = false
  if (bodyVolatile && first.etag) {
    await sleepImpl(waitMs)
    const third = await getOnce(url, fetchImpl, { 'If-None-Match': first.etag })
    etagStable = third.status === 304
  }

  const volatile = bodyVolatile && !etagStable
  const recommendedMethod = !bodyVolatile ? 'md5' : etagStable ? 'etag' : 'none'
  const patterns = bodyVolatile ? matchedPatternLabels(first.body) : []

  return { url, volatile, recommendedMethod, patterns }
}
