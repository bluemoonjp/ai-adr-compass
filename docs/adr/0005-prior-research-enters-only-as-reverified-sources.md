# ADR-0005: Prior research enters only as re-verified sources, never as inherited conclusions

Status: accepted

Issue: #17
Date: 2026-09-22

## Context

Before this repository existed, an earlier, private investigation explored the same subject — ADR corruption in volume and in staleness — and produced a set of candidate sources and figures. That investigation's own arithmetic contained multiple errors: figures that did not survive independent re-derivation, including specific numeric claims about statistical thresholds, publication cadence, fan-out, and staleness windows that this repository's own source-verification pass (Phase 0) found unsupported when checked against primary text.

An investigation that reached a conclusion is not the same thing as a source that supports it. Treating the earlier investigation's conclusions as settled would let its arithmetic errors, and any other unverified claim it produced, pass into this repository's own guidance unexamined.

## Decision

The prior investigation is used only as a *lead*: a pointer to a URL, a tool name, or a candidate claim worth checking. Every one of its findings is re-verified against a primary source in this repository's own Phase 0 before any practice or antipattern cites it. A conclusion the prior investigation reached is never copied into a practice, antipattern, or ADR as if it were itself a source; only the primary document it pointed at, once independently confirmed, can be.

The `no-false-premises` check's `forbidden-phrases.json` data file encodes four of the prior investigation's specific arithmetic errors as forbidden patterns (a statistical threshold, a publication-cadence figure, a fan-out count, and a staleness-window count), so that reintroducing any of them by habit or copy-paste fails the same way any other unsourced claim would.

## Consequences

Verifying every lead from scratch costs more than trusting the prior investigation's conclusions would have, and it means some leads are rejected here that the prior investigation treated as settled. That cost buys the same guarantee every other source in this repository already carries: a claim that could not be re-confirmed against primary text does not appear as if it had been.

This decision does not retroactively audit the prior investigation itself; it only governs what crosses into this repository, and it addresses arithmetic errors specific enough to encode as a check, not every possible category of unverified claim.
