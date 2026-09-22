# adr-volume

Generated from `practices/*.md` and `antipatterns/*.md` by `pnpm gen`; do not edit.

## Practices

### 0004: Measure the corpus, not just each new record

Rule: Measure an ADR corpus's volume as a whole — count, fan-in, fan-out, generation rate, staleness — with an instrument re-run as it grows, not by how well each record complies with its own template.

Applies to: general

#### Why

A per-record gate — a required `Status:` line, a valid `Date:`, a resolvable cross-reference — checks that one file is well-formed the moment it is written. None of those gates look at the corpus those files accumulate into: every record can pass its own gate individually while the corpus as a whole develops a hub a handful of later decisions all cite, a generation burst that lands dozens of records in one short stretch, or a highly-cited record nobody has revisited since. A per-record check has no way to see any of that, because none of it is visible from inside a single file.

Seeing it requires measuring the corpus as one object — count, fan-in, fan-out, the rate new records appear at, how long since each one's decision date — and re-measuring it as it grows, not from a single pass taken once and never repeated. A snapshot from months ago says nothing about the corpus's current shape; only re-running the same instrument against the current state does.

#### When it applies

This applies to any ADR corpus, regardless of which convention it follows. It does not supply a calibrated threshold for any of these dimensions — a number derived from one corpus's own history is not a default another corpus should inherit — and it does not by itself decide what to do about a corpus a measurement flags as unusual; that judgment stays with whoever reads the numbers. It also does not cover detecting staleness in a decision's own content, only how long ago the decision was made.

#### Sources

- This repository's own docs/adr/, measured directly with starter/adr-volume-guard/ — record count, fan-in/fan-out (total and distinct), generation rate, and staleness, computed from the corpus's own record text. (<https://raw.githubusercontent.com/bluemoonjp/ai-adr-compass/main/measurements/2026-09-22-corpus-a.md>)

This file's content is drawn from `practices/` and `antipatterns/`, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
