# Architecture Decision Records

Write an ADR only when deleting the decision would let someone repeat the mistake, and re-deciding it would need reconstructing an incident or a long investigation.

## Status

Each ADR has exactly one `Status:` line with one of these four values:

- `accepted`
- `superseded by ADR-NNNN`
- `amended by ADR-NNNN`
- `withdrawn`

`superseded` replaces the decision; `amended` narrows or corrects it while the original decision still holds. Either way, the superseding or amending ADR must exist in this directory.

## Referencing an ADR

Reference another ADR by its ID only, `ADR-NNNN`. Never cite a line number or a `file:line` location; the check `no-line-refs` forbids it, and `adr-check` forbids it a second time inside this directory because a stale line reference is unreadable even when the file it points to hasn't moved.

## Deleting an ADR

Don't delete an ADR outright. Mark it `withdrawn`, or `superseded by ADR-NNNN` / `amended by ADR-NNNN` pointing at the ADR that replaces or narrows it, so a future reader always has somewhere to go next.

## Filename

`docs/adr/NNNN-short-slug.md`, a zero-padded four-digit number followed by a lowercase, hyphenated slug. Numbers are never reused, but a gap in the sequence (a number an abandoned draft used and never committed) is not itself an error.

## Date

Each ADR has exactly one `Date:` line, formatted `YYYY-MM-DD`, recording the date the decision was made. `adr-check` validates both its presence and its format.

## Template

```markdown
# ADR-NNNN: Title

Status: accepted

Issue: #NNNN
Date: YYYY-MM-DD

## Context

What forces are in tension, and what happens if this is never decided.

## Decision

What was decided, stated as a single commitment.

## Consequences

What this makes easier, what it makes harder, and what it rules out.
```
