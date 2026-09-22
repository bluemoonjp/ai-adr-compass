---
name: adr-record
description: Use when deciding whether a single design decision earns an Architecture Decision Record and, if so, drafting that one record — applying a write threshold, choosing a status, and writing Context/Decision/Consequences so each claim is checkable. Not when auditing an existing corpus of records for volume, hub concentration, or staleness — that is one aggregate judgment across many files and belongs to adr-corpus-review.
metadata:
  topics: [adr-scope, adr-format, adr-lifecycle]
---

# adr-record

## Procedure

1. **Triage the decision itself.** Read `references/adr-scope.md`. Judge the decision **Record** (costly to reverse, or shapes a key abstraction — write an ADR), **Inline** (worth a code comment or a line in existing docs, not its own record), or **Discard** (not worth capturing at all). Only a **Record** verdict continues to step 2.
2. **Start from the shared shape.** Copy `references/templates/adr.md.template`. Number it the next unused number in `docs/adr/`. `references/templates/adr-index.md.template` states a starting convention for this project's own Status vocabulary and filename rule, for a project whose `docs/adr/README.md` doesn't already state its own.
3. **Write each section, then grade it.** For `Context`, `Decision`, and `Consequences`: write the section, then judge it **Complete** (a later reader could act on this without asking a follow-up question), **Missing** (empty or a placeholder — go back and write it), or **Unsupported** (a claim with nothing behind it — delete the claim; an unsupported claim is worse than none).
4. **Declare Status and Date.** Read `references/adr-format.md` for why naming a current state and a date matters. Follow this project's own `docs/adr/README.md` for its Status vocabulary and what its Date line records (or `references/templates/adr-index.md.template`'s starting convention, where none exists yet — recording the date the decision was made). Exactly one `Status:` line and one `Date:` line.
5. **Never delete, only update Status.** Read `references/adr-lifecycle.md` for why a reversed decision stays in place. `references/templates/adr-index.md.template` states the vocabulary itself (`superseded by ADR-NNNN`, `amended by ADR-NNNN`, `withdrawn`) unless this project's own `docs/adr/README.md` already states a different one. If this record replaces or narrows an earlier one, mark the earlier one and point to this one — never delete it.
