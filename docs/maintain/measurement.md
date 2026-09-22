# Measurement

This page is the maintainer's own reference for the public measurement channel (`measurements/`) once it already exists. It does not restate `measurements/README.md`'s charter — see that file for what gets measured and what never gets published — and the publishing steps themselves live in `.claude/skills/adr-compass-measure/SKILL.md`.

## What `measurement-integrity`'s digest actually pins

`measurement-integrity` computes each listed file's sha256 over the same input every other check receives: `scripts/lib/runner.mjs`'s `{path, text}` pairs, where `text` is already CRLF-normalized. That is a digest of the file's text after normalization, not of the exact byte sequence `raw.githubusercontent.com` serves to a client. This repository's `.gitattributes` (`* text=auto eol=lf`) makes the two agree in practice for every text file this repository tracks, but the check's real guarantee is narrower than "the published bytes are pinned" — it is "the CRLF-normalized text is pinned," and that gap is the check's own stated limit, not an oversight to file an issue about.

## Why `kind: primary` / `confidence: derived`, not a new source kind

`schemas/defs.schema.json`'s `sourceKind` enum (`primary`/`research`/`other`) is not widened for measurements (ADR-0003). This repository is the primary source for a measurement of its own corpus — the entity that ran the instrument and can be asked to re-run it, which is what `primary` already means here, not a claim of third-party peer review. `confidence: derived` is the existing value for a claim that follows from already-verified material by reasoning not itself in that material; a percentile computed from a corpus is exactly that, and it does not need a `quote` the way `confidence: verified` does — there is no sentence in the measurement file to quote, only numbers.

## Anonymization is a judgment call this page cannot make for you

`measurements/README.md`'s "Corpus characteristics" field set (visibility, record count, observed days, primary language, reference notation) is already public-safe by construction. Whether a specific private corpus's owner is comfortable with even that much being published is not something `measurement-shape` can check — confirm it with them before publishing, every time, not only the first time.
