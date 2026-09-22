---
id: "0003"
title: Never delete an ADR; update its Status instead
status: active
topic: adr-lifecycle
applies_to: [general]
rule: When a decision is reversed, replaced, or abandoned, update the ADR's Status and leave the file in place; never delete it, so a later reader can still see what was decided and why it changed.
license: CC-BY-4.0
sources:
  - url: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
    kind: primary
    confidence: verified
    verified_on: "2026-09-22"
    summary: Nygard's original template states that a reversed decision is kept, not deleted, and marked superseded so a reader can see it was once the decision.
    quote: If a decision is reversed, we will keep the old one around, but mark it as superseded. (It's still relevant to know that it was the decision, but is no longer the decision.)
  - url: https://github.com/adr/madr/tree/develop/docs/decisions
    kind: primary
    confidence: verified
    verified_on: "2026-09-22"
    summary: MADR's own decision log keeps 0003-provide-own-madr-tools.md in place with status "on hold" rather than deleting it once that plan stalled, an in-repo example of the same never-delete rule. This is a live corpus, not a fixed publication, and may drift as the project adds ADRs.
    quote: "status: on hold"
---

## Why

Deleting an ADR erases the one thing a later reader most needs when they stumble on a stale reference or a puzzling piece of code: the record of what was decided and why it no longer holds. A reversed or abandoned decision is still load-bearing history — the next person facing the same choice benefits from seeing that it was tried, and why it did not stick, at least as much as they benefit from the decisions that stuck.

## When it applies

This applies whenever an ADR's decision is reversed, replaced, or simply abandoned before being carried out. Update the Status field to reflect the new state (MADR's own corpus shows this need not be binary — a decision can sit at an intermediate state like "on hold" rather than jumping straight to accepted or superseded) and, where a replacement decision exists, point to it. It does not cover what the closed set of valid Status values should be — that is `adr-format`'s concern — only that the file itself is never removed.
