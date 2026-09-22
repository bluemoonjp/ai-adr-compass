---
id: "0002"
title: Declare one Status naming the decision's current state
status: active
topic: adr-format
applies_to: [general]
rule: Every ADR declares one Status value naming its current state and, per MADR, the date it was last updated; an unstated or undated record forces a reader to re-derive context.
license: CC-BY-4.0
sources:
  - url: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
    kind: primary
    confidence: verified
    verified_on: "2026-09-22"
    summary: Nygard's original template defines a fixed four-value Status vocabulary (proposed, accepted, deprecated, superseded) as one of the format's few required parts, with no stated mechanism for adding a fifth value.
    quote: A decision may be "proposed" if the project stakeholders haven't agreed with it yet, or "accepted" once it is agreed. If a later ADR changes or reverses a decision, it may be marked as "deprecated" or "superseded" with a reference to its replacement.
  - url: https://github.com/adr/madr/blob/develop/template/adr-template.md
    kind: primary
    confidence: verified
    verified_on: "2026-09-22"
    summary: MADR's own template lists a Status enum and a last-updated date as optional metadata fields; the enum's own "…" placeholder marks it as extensible, not closed, and the field can be omitted entirely (MADR's minimal template drops both).
    quote: |-
      status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123}"
      date: {YYYY-MM-DD when the decision was last updated}
---

## Why

A Status field that never states which values are meaningful gives a reader nothing to check a decision's current trust level against. Naming the current state, with an explicit superseding pointer for the one value that reverses a decision, lets a reader tell in one glance whether a record still applies. The decision date matters for the same reason: without it, a reader has to guess how much has changed since the decision was made, which is exactly the guess a written record exists to remove.

## When it applies

This applies to any ADR convention, but "closed set" is not a claim either source actually supports on its own: Nygard's four values (`proposed`/`accepted`/`deprecated`/`superseded`) are presented as the complete list, with no stated way to add a fifth. MADR's template lists a longer starting vocabulary but marks it extensible with its own "…" placeholder, and MADR's real decision log uses at least one value outside that list (`on hold`, see `practices/0003`) — so a project following MADR should treat its enum as a floor, not a ceiling. Both fields are explicitly optional in MADR's own template (its minimal variant omits them entirely); a project that wants them mandatory, as this repository's own `docs/adr/README.md` does, is choosing a stricter convention than either source requires, not merely restating one. This rule does not by itself require referencing other records by ID rather than by file location or line number — a related convention this repository's own `docs/adr/README.md` states separately.
