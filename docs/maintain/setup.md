# Maintainer setup

## Private patterns (`COMPASS_PRIVATE_PATTERNS`)

The `forbidden-patterns` check also scans for maintainer-private strings (a
real name, another repository's name, a home directory, ...) that the
generic patterns in `scripts/checks/data/forbidden-patterns.json` cannot
know about — committing the string itself would defeat the point of hiding
it. Those strings never live in this repository; they live only in an
environment variable, `COMPASS_PRIVATE_PATTERNS`, set locally by each
maintainer and, in CI, as a GitHub Actions secret (ADR-0007).

The value is a JSON object with two fields:

- `patterns`: an array of regular-expression source strings to search for
- `probe`: a string that must match at least one of `patterns` — this is a
  self-test so a typo that makes every pattern inert fails closed instead of
  silently scanning nothing

### Set the CI secret

```bash
gh secret set COMPASS_PRIVATE_PATTERNS --repo bluemoonjp/ai-adr-compass
```

### Set it locally

PowerShell:

```powershell
$env:COMPASS_PRIVATE_PATTERNS = '{"patterns":["<your-private-pattern>"],"probe":"<value-your-pattern-matches>"}'
```

bash:

```bash
export COMPASS_PRIVATE_PATTERNS='{"patterns":["<your-private-pattern>"],"probe":"<value-your-pattern-matches>"}'
```

Set it for the current shell session only; do not write it into a file that
could be committed.

### Behavior

Enforcement depends on which command invoked the check, not only on whether
`CI` is set:

- `pnpm check` with `CI` set (GitHub Actions) or with `pnpm check --strict`:
  enforced.
- `pnpm check` run locally without `--strict`, `CI` unset: the variable may
  be left unset; the check prints `private-patterns: skipped (env unset)`
  and exits 0.

Whenever enforcement applies, the variable must be set, valid JSON, contain
at least one pattern that compiles as a regular expression, and its `probe`
must match one of those patterns. Any failure is fail-closed (exit 1) with
one of the fixed messages below — never the pattern or probe value itself.

### Fixed failure messages

| ruleId | Meaning |
| --- | --- |
| `forbidden-patterns:env-unset` | `COMPASS_PRIVATE_PATTERNS` is required here (CI or `--strict`) but not set |
| `forbidden-patterns:invalid-json` | The value is not valid JSON, or has no `patterns` |
| `forbidden-patterns:invalid-regexp` | One of `patterns` does not compile as a regular expression |
| `forbidden-patterns:probe-mismatch` | `probe` does not match any compiled pattern |

## Before pasting into a public issue or PR

An issue, a PR description, and a PR or issue comment are all public
surface — pasting the output of a test run or a shell session into one can
carry a local filesystem path or another private string along with it, the
same way a tracked file can. `public-surface.yml` scans a newly
opened/edited issue, PR, or comment against the generic patterns in
`scripts/checks/data/forbidden-patterns.json` and adds a fixed-wording
comment and the `needs-redaction` label when it finds a match — it does not
repeat the matched text. This repository takes no pull requests from forks
(ADR-0007), so there is no separate fork-recheck path to run.
