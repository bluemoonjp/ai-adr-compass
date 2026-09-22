# ADR-0003: Measurements are published as anonymized, append-only files with a recorded digest, cited as primary sources with derived confidence

Status: accepted

Issue: #22
Date: 2026-09-22

## Context

`docs/maintain/review.md`'s Verdict rule keeps a normative statement only when it traces to a source in `sources` or to a check that already enforces it; a statement backed by neither is removed, not hedged. A claim about ADR volume — that a corpus tends toward a hub, that generation bursts, that a highly-cited record goes stale — cannot clear that bar from prose alone once `starter/adr-volume-guard/` (ADR-0004) exists to measure it: the strongest form that claim can take is "here is a corpus, here is what re-running the instrument against it reports," and that requires a public place to publish the numbers and a way for a reader to check them.

`schemas/defs.schema.json`'s `sourceKind` enum is `primary`/`research`/`other`. Widening it to add a fourth kind for "a measurement this repository ran itself" would let a single source object claim newly-invented backing that no downstream reader of the schema has ever seen justified, and would still need to answer the same question a new enum value doesn't answer on its own: what stops the cited numbers from silently changing after a practice already relies on them.

## Decision

A measurement is published as its own frozen, append-only file under `measurements/`, is never edited after publication, and is cited from `practices/`/`antipatterns/` with `kind: primary` (this repository is the primary source for a measurement of its own corpus; `research` would misrepresent it as third-party peer review, and `other` cannot be a claim's only backing under `practice.schema.json`'s existing `contains` gate) and `confidence: derived` (the existing enum value for a claim that follows from already-verified material by reasoning not itself in that material — exactly what a percentile computed from a corpus is). Neither enum is widened.

Two blocking checks hold the channel closed against drift and leakage. `measurement-integrity` pins every listed file in `measurements/index.json` to a sha256 of its own text, so an edited or missing file fails the check that guards it, and it also confirms every `kind: primary`/`confidence: derived` source pointing into `measurements/` resolves to a listed file. `measurement-shape` allows only a fixed heading set (an H1 naming the corpus's anonymous label, `Published:`, `## Corpus characteristics`, `## Volume`) and a fixed field set in the characteristics table; a decision's own title, its `Status:` line, or a specific `ADR-NNNN` record id can never appear in a published measurement file, structurally, not by review.

This repository's own `docs/adr/` needs no anonymization: it already is the corpus, published in the open, so its first measurement (`corpus-a`) is a direct, un-anonymized reading of a directory anyone can already see.

## Consequences

Host-coverage (`registry-check`'s existing rule that a cited source's host must be covered by a registered anchor) is a coarse approximation that only confirms a `raw.githubusercontent.com` URL sits on a watched host; it says nothing about whether that specific file's bytes are the ones last accepted. The real guarantee that a cited measurement's content hasn't silently changed is `measurement-integrity`'s digest pin, not host-coverage — a `role: source` or `role: published-static` anchor and host-coverage answer "is anyone watching this host," not "are these exact bytes still what a reader fetches."

A matching digest proves only that the published file's bytes have not changed since `measurement-integrity` last accepted them — commit continuity, not that the numbers were computed correctly in the first place. That correctness rests on `starter/adr-volume-guard/`'s own tests (ADR-0004) and on anyone being free to re-run it against the same corpus and compare, which is why the instrument, not just its output, is published.
