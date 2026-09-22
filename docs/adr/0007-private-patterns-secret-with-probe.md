# ADR-0007: Private patterns live in a CI secret with a self-test probe, and fail closed

Status: accepted

Issue: #17
Date: 2026-09-22

## Context

This repository's own tracked files, commit messages, and check fixtures must never carry another private repository's name, a maintainer's personal email address, or a local filesystem path — the same class of leak `forbidden-patterns`'s generic, committed patterns already catch for filesystem paths and email addresses in general. But a maintainer-specific string, such as the name of an unrelated private repository, cannot be added to a committed pattern file at all: writing the string into `scripts/checks/data/forbidden-patterns.json` so the check can detect it would itself publish the exact string the check exists to keep out.

This repository's own public surface has no fork-PR contribution path: it takes no pull requests from forks, so there is no scenario where a contributor's untrusted branch needs to run this check without the secret, and no need for a fork-recheck mechanism to bridge that gap.

## Decision

Maintainer-private strings live only in `COMPASS_PRIVATE_PATTERNS`, an environment variable set locally by each maintainer and, in CI, as a repository secret — never in a tracked file. Its value is a JSON object carrying a `patterns` array and a `probe` string that must match at least one pattern; the probe is a self-test so a typo that makes every pattern inert is caught immediately instead of silently scanning nothing.

Enforcement fails closed: whenever the variable is required (`CI` is set, or `pnpm check --strict`) and it is missing, invalid JSON, contains a pattern that fails to compile, or its probe does not match, the check reports a finding rather than skipping silently. Run locally without `--strict` and with `CI` unset, the variable may stay unset, and the check prints a skip notice instead of failing — this repository's own scaffolding development does not require every contributor to hold the private pattern set.

## Consequences

A maintainer who runs `pnpm check --strict` locally without first setting `COMPASS_PRIVATE_PATTERNS` sees the same failure CI would produce; this is the intended fail-closed behavior, not a bug to route around by weakening `--strict`. Because this repository accepts no fork pull requests, CI always has secret access on every run that matters, so the fail-closed path is only ever exercised by a genuine misconfiguration, never by an untrusted contributor's branch.

This mitigates one specific leak vector — the private-pattern text ending up in this repository's own tracked content or commit history — and does nothing to prevent that same text from being pasted into a GitHub issue, pull request description, or comment, which is a separate, coarser-grained defense (`docs/maintain/setup.md`, "Before pasting into a public issue or PR").
