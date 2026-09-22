# adr-scope

Generated from `practices/*.md` and `antipatterns/*.md` by `pnpm gen`; do not edit.

## Practices

### 0001: Triage before capturing a decision as an ADR

Rule: Capture a decision as an ADR only when it is architecturally significant (costly to reverse, or shapes the system); triage the rest instead of filling a template by habit.

Applies to: general

#### Why

An ADR log exists so a later reader can find the reasoning behind a decision without reconstructing an incident or a long investigation. That purpose only holds while the log stays small enough to search: once every decision a team makes lands in it, the architecturally significant ones become as hard to find as if nothing had been recorded at all. Filling out a template because the team has adopted one, rather than because this specific decision clears a significance bar, produces exactly that dilution — a full log that answers fewer questions than a short one would.

#### When it applies

This rule applies to any ADR convention (MADR, Nygard's original format, or a project's own variant): before opening a new record, check whether the decision is costly to reverse, affects a key abstraction, or carries real business or technical stakes, rather than defaulting to "write one for everything." It does not supply a mechanical formula for what counts as architecturally significant — that judgment stays with whoever is deciding — and it does not cover how an existing ADR should be formatted or how its status should change once written; those are separate concerns.

#### Sources

- Pureur and Bittner argue an ADR log loses its purpose once every decision a team makes is logged in it, and give a cost-of-change-based test for which decisions are actually architectural. (<https://www.infoq.com/articles/architectural-decision-record-purpose/>)
- Zimmermann, a maintainer of MADR, warns that filling a template out of habit gains little and states that not all decisions are worth capturing, so a triage step is required. (<https://ozimmer.ch/practices/2021/04/23/AnyDecisionRecords.html>)

This file's content is drawn from `practices/` and `antipatterns/`, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
