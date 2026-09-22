# adr-format

Generated from `practices/*.md` and `antipatterns/*.md` by `pnpm gen`; do not edit.

## Practices

### 0002: Declare one Status naming the decision's current state

Rule: Every ADR declares one Status value naming its current state and, per MADR, the date it was last updated; an unstated or undated record forces a reader to re-derive context.

Applies to: general

#### Why

A Status field that never states which values are meaningful gives a reader nothing to check a decision's current trust level against. Naming the current state, with an explicit superseding pointer for the one value that reverses a decision, lets a reader tell in one glance whether a record still applies. The decision date matters for the same reason: without it, a reader has to guess how much has changed since the decision was made, which is exactly the guess a written record exists to remove.

#### When it applies

This applies to any ADR convention, but "closed set" is not a claim either source actually supports on its own: Nygard's four values (`proposed`/`accepted`/`deprecated`/`superseded`) are presented as the complete list, with no stated way to add a fifth. MADR's template lists a longer starting vocabulary but marks it extensible with its own "…" placeholder, and MADR's real decision log uses at least one value outside that list (`on hold`, see `practices/0003`) — so a project following MADR should treat its enum as a floor, not a ceiling. Both fields are explicitly optional in MADR's own template (its minimal variant omits them entirely); a project that wants them mandatory, as this repository's own `docs/adr/README.md` does, is choosing a stricter convention than either source requires, not merely restating one. This rule does not by itself require referencing other records by ID rather than by file location or line number — a related convention this repository's own `docs/adr/README.md` states separately.

#### Sources

- Nygard's original template defines a fixed four-value Status vocabulary (proposed, accepted, deprecated, superseded) as one of the format's few required parts, with no stated mechanism for adding a fifth value. (<https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions>)
- MADR's own template lists a Status enum and a last-updated date as optional metadata fields; the enum's own "…" placeholder marks it as extensible, not closed, and the field can be omitted entirely (MADR's minimal template drops both). (<https://github.com/adr/madr/blob/develop/template/adr-template.md>)

This file's content is drawn from `practices/` and `antipatterns/`, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
