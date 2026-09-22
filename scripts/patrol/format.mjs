const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const STATE_VALUES = new Set(['no-baseline', 'not-modified', 'unchanged', 'changed', 'failed'])
const HASH_PATTERN = /^[0-9a-f]{0,8}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const URL_PATTERN = /^https:\/\/\S+$/

// Reads only the seven allowed fields off `record`; any other property a
// caller attaches (raw response text, an error message, ...) is never
// inspected, so it cannot reach the CI log or the weekly Issue body this
// feeds — a public surface.
export function formatLine(record) {
  const { id, state, http, bytes, hash, date, url } = record ?? {}

  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('format.mjs: invalid id')
  if (typeof state !== 'string' || !STATE_VALUES.has(state)) throw new Error('format.mjs: invalid state')
  if (http !== null && !(Number.isInteger(http) && http >= 100 && http < 600)) {
    throw new Error('format.mjs: invalid http')
  }
  if (!Number.isInteger(bytes) || bytes < 0) throw new Error('format.mjs: invalid bytes')
  if (typeof hash !== 'string' || !HASH_PATTERN.test(hash)) throw new Error('format.mjs: invalid hash')
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) throw new Error('format.mjs: invalid date')
  if (typeof url !== 'string' || !URL_PATTERN.test(url)) throw new Error('format.mjs: invalid url')

  const httpText = http === null ? '-' : String(http)
  return `${id} ${state} ${httpText} ${bytes} ${hash} ${date} ${url}`
}

export function formatLines(records) {
  return records.map(formatLine)
}
