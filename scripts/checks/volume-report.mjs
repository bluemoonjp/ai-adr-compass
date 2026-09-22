// The CI check adapter for the volume instrument. This file only
// re-exports starter/adr-volume-guard/index.mjs's own run() — the
// distributed instrument and this check are deliberately the same code
// (checks.json's volume-report entry), not a copy that could drift from it.
export { run } from '../../starter/adr-volume-guard/index.mjs'
