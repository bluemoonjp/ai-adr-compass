# Contributing

## What this repository accepts

- A correction, a source update, or a new practice, antipattern, or adapter
  under `practices/`, `antipatterns/`, or `adapters/`, backed by a link to a
  primary source.
- A new measurement under `measurements/`, published through
  `.claude/skills/adr-compass-measure/SKILL.md`'s procedure.
- A fix to a check, script, or workflow under `scripts/` or
  `.github/workflows/`.
- A documentation fix to `README.md`, `docs/adr/`, or `docs/maintain/`.

Open an issue first for anything larger than a small fix, so the approach is
agreed before you spend time on a pull request. `AGENTS.md` and
`docs/maintain/authoring.md` describe this repository's conventions and
check suite.

## Opening a pull request

- PR titles match `#N: summary`, where `N` is the issue the PR addresses.
- Run `pnpm check --strict` and `pnpm test` locally before opening the PR;
  both must pass.
- The maintainer reviews every pull request before it merges.

## License

Code, scripts, schemas, and configuration are licensed under
[MIT](LICENSE); documentation (practices, antipatterns, adapters, docs, and
this repository's other prose) is licensed under
[CC BY 4.0](LICENSE-DOCS) — see `README.md`'s "License" section for the
exact split. By opening a pull request, you agree to license your
contribution under whichever of those licenses covers the path(s) it
changes.
