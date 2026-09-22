# adr-lifecycle

Generated from `practices/*.md` and `antipatterns/*.md` by `pnpm gen`; do not edit.

## Practices

### 0003: Never delete an ADR; update its Status instead

Rule: When a decision is reversed, replaced, or abandoned, update the ADR's Status and leave the file in place; never delete it, so a later reader can still see what was decided and why it changed.

Applies to: general

#### Why

Deleting an ADR erases the one thing a later reader most needs when they stumble on a stale reference or a puzzling piece of code: the record of what was decided and why it no longer holds. A reversed or abandoned decision is still load-bearing history — the next person facing the same choice benefits from seeing that it was tried, and why it did not stick, at least as much as they benefit from the decisions that stuck.

#### When it applies

This applies whenever an ADR's decision is reversed, replaced, or simply abandoned before being carried out. Update the Status field to reflect the new state (MADR's own corpus shows this need not be binary — a decision can sit at an intermediate state like "on hold" rather than jumping straight to accepted or superseded) and, where a replacement decision exists, point to it. It does not cover which Status vocabulary a project should use — that is `adr-format`'s concern — only that the file itself is never removed.

#### Sources

- Nygard's original template states that a reversed decision is kept, not deleted, and marked superseded so a reader can see it was once the decision. (<https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions>)
- MADR's own decision log keeps this ADR in place with status "on hold" rather than deleting it once that plan stalled, an in-repo example of the same never-delete rule. The wider decisions/ directory is a live corpus, not a fixed publication, and may drift as the project adds ADRs. (<https://github.com/adr/madr/blob/develop/docs/decisions/0003-provide-own-madr-tools.md>)

This file's content is drawn from `practices/` and `antipatterns/`, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
