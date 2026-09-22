# AGENTS.md

Sourced practices and antipatterns for keeping Architecture Decision Records from rotting, in volume and in staleness, as AI coding agents write them; written to be read by an agent working on some other project.

Always-loaded context here is limited to principles and an index; anything longer belongs in a linked document.

## Layers

This repository has two layers (ADR-0001): the deliverable (layer A: `practices/`, `antipatterns/`, `adapters/`, `templates/`, `starter/`, `measurements/`, plugin `SKILL.md` files) and this repository's own operation (layer B: this file, `CLAUDE.md`, `.claude/`, `docs/maintain/`). Layer B never restates layer A's content by ID or title.

## Working rules

- Work only through pull requests. (none)
- PR titles match `#N: summary`. (none)
- Run `pnpm check --strict` before opening a PR. (none)
- Regenerate generated files with `pnpm gen`; never hand-edit them. (ci: generated-fresh)
- Never narrate this repository's own history in prose. (ci: no-history-words)
- Never write filesystem paths, email addresses, or other private information. (ci: forbidden-patterns)
- Cite a source with a summary and a link, not a bare claim. (ci: frontmatter-schema)
- Reference another ADR by ID only, never by line number. (ci: adr-check)

Write an ADR only when deleting the decision would let someone repeat the mistake, and re-deciding it would need reconstructing an incident or a long investigation.

## Map

| Path | Contents |
| --- | --- |
| `adapters/` | ADR-convention-specific differences from the sourced practices and antipatterns |
| `antipatterns/` | Sourced antipatterns: what to avoid and why |
| `docs/adr/` | Architecture decision records |
| `docs/maintain/` | Maintainer setup, authoring, review, and patrol instructions |
| `measurements/` | Public, append-only aggregate measurements this repository publishes |
| `practices/` | Sourced best practices for writing and maintaining ADRs |
| `schemas/` | JSON Schemas for practice, antipattern, skill frontmatter, and the source registry |
| `scripts/` | The check toolchain: runner, checks, and their fixtures |
| `sources/` | The source registry and observed-state baseline the weekly patrol tracks |
| `starter/` | A self-contained instrument another project's CI can run against its own ADR corpus |
| `templates/` | Copyable starter files for another project's ADR conventions |
