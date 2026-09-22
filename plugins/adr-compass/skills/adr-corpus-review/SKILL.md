---
name: adr-corpus-review
description: Use when auditing an existing directory of Architecture Decision Records as a whole — measuring record count, fan-in hubs, fan-out mixing, generation pace, and staleness, then judging which records to keep, merge, retire, or promote out of the corpus. Not when writing or gating a single new record — that is a per-record judgment and belongs to adr-record.
metadata:
  topics: [adr-scope, adr-format, adr-lifecycle, adr-volume]
---

# adr-corpus-review

## Procedure

1. **Measure before judging.** Run `node references/adr-volume-guard/cli.mjs <path-to-docs/adr> --json` and read `references/adr-volume.md`. Every judgment below cites a number this run produced — an impression of the corpus is not evidence.
2. **Report the corpus-wide distribution first, as its own table.** Record count, fan-out (total and distinct), fan-in (total and distinct), generation rate, and days-since-decision, each as p50/p90/p95/max. This table stands on its own; it is not a summary of the per-record table in step 4 — a corpus's overall shape and one record's own standing are different questions with different answers.
3. **Find the outliers the distribution names.** A record whose fan-in sits at or above the corpus's own p95 is a hub — read what cites it and check those citations still agree with each other. A generation-rate spike above the corpus's own p95 is a burst — check whether the records inside it are distinct decisions or one decision copied into several records.
4. **Judge each flagged record, in a second, separate table.** For each: **Keep** (a live, singular decision, nothing else covers it), **Merge** (two or more records describing the same decision — combine them and mark the losers `superseded by ADR-NNNN`, per `references/adr-lifecycle.md`), **Retire** (the decision no longer applies to the current system — update its Status per this project's own `docs/adr/README.md`, typically `withdrawn`, and never delete the file, per `references/adr-lifecycle.md`), or **Promote** (a decision currently inline in code or another doc is significant enough to earn its own record — see `references/adr-scope.md`).
5. **State what the measurement does not cover.** `references/adr-volume-guard/README.md` names this instrument's own limits (decision date is not review recency; cross-reference detection recognizes only the literal `ADR-NNNN` form) — carry them into the judgment, don't restate them as settled.
