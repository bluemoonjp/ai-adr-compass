# ADR-0004: The volume instrument reads record text only, ships no calibrated thresholds, and reports percentiles, not mean+2sd

Status: accepted

Issue: #21
Date: 2026-09-22

## Context

This repository's central claim is that an ADR corpus can rot in volume, not only in staleness, and that the rot is measurable. A claim like that needs an instrument that actually measures the corpus it is made about (ADR-0001's layer A), not a description of one. An unrelated, unpublished prior attempt at this same instrument exists as a cautionary case, not a source: its derived values were arithmetically broken — a pace threshold that sat below the corpus's own ordinary rate, giving it a negative safety margin; a fan-out warning list that disagreed with the comparison operator its own implementation used; a fan-out threshold applied to a total count while its stated rationale was about a distinct-target count; a staleness figure with no recorded derivation. None of those numbers can be reconstructed from prose alone, and this repository's own review rule (`docs/maintain/review.md`'s Verdict) removes a normative statement that traces to neither a source nor an enforcing check rather than keep it hedged.

`scripts/checks/*.mjs`'s own discipline (`scripts/check-checks.test.mjs`) forbids a `fast: true` check from importing git or network modules; every check receives only the `{path, text}` pairs `scripts/lib/runner.mjs` already loaded. A volume instrument meant to run as a CI check inherits that same constraint, and `adr-check` (Phase 1) already requires every `docs/adr/*.md` file to carry a `Date:` line formatted `YYYY-MM-DD` — a fact already available in the same text a check receives, with no new mechanism needed to reach it.

## Decision

`starter/adr-volume-guard/index.mjs`'s `measure()` derives every dimension — record count, fan-in, fan-out, generation rate, staleness — from record text alone: a `Date: YYYY-MM-DD` line for decision date, and literal `ADR-NNNN` occurrences for cross-references. It touches neither git nor the filesystem; `starter/adr-volume-guard/cli.mjs` is the separate IO layer that reads a directory and optionally accepts a git-derived `--dates` override for a corpus whose own date isn't in that exact form. `scripts/checks/volume-report.mjs`, the registered CI check, re-exports the same `run()` this distributes — the check and the distributed instrument are one piece of code, not two that could drift apart.

Fan-out and fan-in are each reported as two separate numbers — `...Total` (every occurrence) and `...Distinct` (distinct targets) — never collapsed into one key, and every distribution (fan-out, fan-in, generation rate, staleness) is reported as a full quantile set (`p50`/`p90`/`p95`/`max`), never as a mean or a mean-plus-standard-deviations figure: these are right-skewed counts, and that estimator misrepresents the shape that matters.

`starter/adr-volume-guard/config.example.json` ships every threshold `value` as `null`. `validateConfigAgainstCorpus()` refuses to accept a `>`/`>=` threshold that has no safety margin over the corpus's own currently measured median for that metric, and requires `derivedFrom` and `measuredOn` on every non-null threshold — the exact class of mistake this ADR's Context describes, prevented mechanically rather than by asking a future editor to be more careful. An unresolved `ADR-NNNN` reference is reported as a finding regardless of any threshold: it is a structural correctness defect, not a statistical signal, and no threshold could ever make it acceptable.

## Consequences

A record's `Date:` line is the date a decision was made, not the date anyone last reviewed it; this instrument's "days since decision" figure is decision age, and it does not attempt to measure whether a decision's content has gone stale (that remains `freshness-report`'s concern, for `practices/` and `antipatterns/`, and has no equivalent for `docs/adr/` in v0.1).

Cross-reference detection recognizes only the literal `ADR-NNNN` form. A corpus that links records by filename or bare number instead — common outside this repository's own convention — will read as having little or no fan-in/fan-out even though it does cross-reference; fan-in-driven measures (hub concentration, a highly-cited record's own staleness) are correspondingly unreliable on such a corpus, and this is a stated limit of v0.1's detector, not a claim that those corpora lack structure.

At the time this ADR was written, this repository's own `docs/adr/` holds 5 records. Every distribution this instrument reports over that corpus — fan-in, fan-out, generation-rate, and staleness percentiles alike — is a number computed correctly from too few records to mean anything about typical shape; `volume-report`'s notices report them anyway, because the wiring itself is what makes the self-application argument possible once the corpus grows, and no default threshold is derived from them.
