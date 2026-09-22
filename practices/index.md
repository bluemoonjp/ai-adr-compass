# Practice index

Generated from `practices/*.md` by `pnpm gen`; do not edit.

| ID | Rule | Topic | Applies to | Verified on |
| --- | --- | --- | --- | --- |
| 0001 | Capture a decision as an ADR only when it is architecturally significant (costly to reverse, or shapes the system); triage the rest instead of filling a template by habit. | adr-scope | general | 2026-09-22 |
| 0002 | Every ADR declares one Status value naming its current state and, per MADR, the date it was last updated; an unstated or undated record forces a reader to re-derive context. | adr-format | general | 2026-09-22 |
| 0003 | When a decision is reversed, replaced, or abandoned, update the ADR's Status and leave the file in place; never delete it, so a later reader can still see what was decided and why it changed. | adr-lifecycle | general | 2026-09-22 |
| 0004 | Measure an ADR corpus's volume as a whole — count, fan-in, fan-out, generation rate, staleness — with an instrument re-run as it grows, not by how well each record complies with its own template. | adr-volume | general | 2026-09-22 |

This table's content is drawn from `practices/`, licensed under [CC BY 4.0](../LICENSE-DOCS).
