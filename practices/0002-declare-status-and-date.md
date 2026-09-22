---
id: "0002"
title: Declare one Status from a closed set, and the date
status: active
topic: adr-format
applies_to: [general]
rule: Every ADR declares exactly one Status value from a closed set, plus the date it was decided; an undated or unstated record forces a reader to re-derive context.
license: CC-BY-4.0
sources:
  - url: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
    kind: primary
    confidence: verified
    verified_on: "2026-09-22"
    summary: Nygard's original template defines a closed Status vocabulary (proposed, accepted, deprecated, superseded) as one of the format's few required parts.
    quote: A decision may be "proposed" if the project stakeholders haven't agreed with it yet, or "accepted" once it is agreed. If a later ADR changes or reverses a decision, it may be marked as "deprecated" or "superseded" with a reference to its replacement.
  - url: https://github.com/adr/madr/blob/develop/template/adr-template.md
    kind: primary
    confidence: verified
    verified_on: "2026-09-22"
    summary: MADR's own template requires both a closed Status enum and a date field recording when the decision was last updated.
    quote: |-
      status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123}"
      date: {YYYY-MM-DD when the decision was last updated}
---

## Why

A Status field with an unbounded vocabulary is not a status field — "in progress, sort of accepted, mostly still true" gives a reader nothing to check a decision's current trust level against. A closed set, with an explicit superseding pointer for the one value that reverses a decision, lets a reader tell in one glance whether a record still applies. The decision date matters for the same reason: without it, a reader has to guess how much has changed since the decision was made, which is exactly the guess a written record exists to remove.

## When it applies

This applies to any ADR convention. The two primary sources here converge on the same shape (a closed Status set, an explicit supersede pointer) but do not use identical vocabularies — Nygard's four values are `proposed`/`accepted`/`deprecated`/`superseded`, while MADR's are `proposed`/`rejected`/`accepted`/`deprecated`/`…`/`superseded by ADR-NNNN` — so a project adopting one convention should use that convention's own vocabulary rather than mixing the two. Only MADR's template makes the date field explicit; a project following Nygard's original format should still record one, since the underlying problem (an unreadably stale record) is the same either way. This rule does not by itself require referencing other records by ID rather than by file location or line number — a related convention this repository's own `docs/adr/README.md` states separately.
