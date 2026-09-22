# Measurements

Public, append-only structural measurements of ADR corpora, published so a `practices/` or `antipatterns/` file can cite a claim about ADR volume with more than a plausible-sounding number behind it. `docs/maintain/review.md`'s Verdict rule keeps a normative statement only when it traces to a source or an enforcing check; a measurement published here is what lets a volume-related claim clear that bar honestly, since re-running `starter/adr-volume-guard/` against the same corpus is how a reader checks it.

## What gets measured

Only what `starter/adr-volume-guard/index.mjs`'s `measure()` computes from record text: record count, fan-in, fan-out, generation rate, and staleness (decision age, not review recency), each as a full quantile set. Nothing else. See that instrument's own README for exactly what each number means and its stated detection limits.

## What never gets published here

A measurement file may never name a decision's own title, its `Status:` line, its specific record ID, or any prose from the record itself — `measurement-shape` (blocking) enforces this mechanically with a fixed, allowlisted heading and field set; anything outside that set fails the check rather than getting reviewed case by case. A private corpus's identity is likewise never named in a measurement file's own text; a corpus is identified only by its anonymous label (`corpus-a`, `corpus-b`, ...) and the "Corpus characteristics" table's already-public-safe fields (visibility, record count, observed days, primary language, reference notation).

This repository's own `docs/adr/` needs no anonymization — it is already the primary source for its own measurement, cited as `kind: primary` / `confidence: derived` (`docs/maintain/measurement.md`).

## How a measurement is published

1. Run `starter/adr-volume-guard/cli.mjs` against the corpus directory.
2. Write a new `measurements/YYYY-MM-DD-corpus-<label>.md` file: an H1 naming the corpus label, a `Published: YYYY-MM-DD` line, a `## Corpus characteristics` table, and a `## Volume` section holding the CLI's own text output verbatim.
3. Add an entry to `measurements/index.json` with the file's sha256 (of its CRLF-normalized text — the same normalization every check receives), `publishedOn`, `corpus`, and `url` (the file's `raw.githubusercontent.com` address once merged).
4. Register a `role: "published-static"` anchor in `sources/registry.json` pointing at that same URL, so the weekly patrol watches it for a post-publication change.

## After publication

A published measurement file is never edited. A later re-measurement of the same corpus is a new dated file with a new entry, not a change to an old one — `measurement-integrity` (blocking) pins every listed file's digest, so an edit is indistinguishable from tampering and fails the check either way.
