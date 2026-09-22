---
name: adr-compass-measure
description: Use when publishing a new measurement of an ADR corpus (this repository's own docs/adr/, or an anonymized private corpus) to measurements/, so a practice or antipattern can cite it as a primary, derived-confidence source. Not when reading an already-published measurement, and not when authoring the practice or antipattern content that cites one -- that follows docs/maintain/authoring.md's normal sourcing rules once the measurement already exists.
---

# adr-compass-measure

## Procedure

1. Run `starter/adr-volume-guard/cli.mjs` against the corpus directory. For this repository's own `docs/adr/`, no anonymization is needed — it is already public. For a private corpus, first confirm with whoever holds it that publishing an anonymized aggregate is acceptable; never publish without that confirmation.
2. Choose an anonymous corpus label (`corpus-a`, `corpus-b`, ...) — never the corpus owner's repository name or any other identifying string. This repository's own corpus is `corpus-a`.
3. Write `measurements/YYYY-MM-DD-corpus-<label>.md` following `measurements/README.md`'s exact shape: an H1 `# Measurement: corpus-<label>`, a `Published: YYYY-MM-DD` line, a `## Corpus characteristics` table using only the fields `visibility`, `record count`, `observed days`, `primary language`, `reference notation`, and a `## Volume` section holding the CLI's own text output verbatim. `measurement-shape` (blocking) rejects anything outside this shape — including a decision's own title, a `Status:` line, or a specific `ADR-NNNN` record id copied from the corpus.
4. Compute the new file's sha256 the same way `measurement-integrity` does: over its CRLF-normalized text (`node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex'))" measurements/YYYY-MM-DD-corpus-<label>.md`). Add an entry to `measurements/index.json` with that digest, `publishedOn`, `corpus`, and `url` (the file's `raw.githubusercontent.com` address once merged to `main`).
5. Register a `role: "published-static"` anchor in `sources/registry.json` pointing at that same URL, so the weekly patrol watches the published file for a post-publication change (`docs/maintain/patrol.md`).
6. Run `pnpm gen && pnpm check --strict`. A published measurement file is never edited afterward — a later re-measurement of the same corpus is a new dated file with a new `index.json` entry, not a change to an old one.
