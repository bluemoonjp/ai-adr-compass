# ADR-0001: Two layers: deliverable (A) and repository operations (B)

Status: accepted

Issue: #17
Date: 2026-09-22

## Context

This repository has two audiences for its instruction text. Layer A is the deliverable: `practices/`, `antipatterns/`, `adapters/`, `templates/`, `starter/`, `measurements/`, and a distributed plugin's `SKILL.md` files, written to be read by an agent writing or reviewing ADRs in *some other* project. Layer B is this repository's own operations: the root `AGENTS.md` and `CLAUDE.md`, `.claude/`, and `docs/maintain/`, written to be read by an agent working *on this repository*.

Left unstated, the two blur together. A practice's title or rule text creeps into `AGENTS.md` because it happens to be the guidance the maintainer wants enforced right now, and the root instruction file grows without bound. Worse, this repository documents ADR corruption mechanisms while itself writing ADRs — if the boundary between what it ships and how it operates is not named, the repository has no way to notice it is breaking its own advice.

## Decision

Keep the two layers separate by convention and by check:

- Layer A is written for another project's agent. It never assumes this repository's tooling, file layout, or check registry.
- Layer B is written only for an agent working on this repository. It never restates a Layer A practice's title, ID, or rule text — it may enforce one, but always by reference (`enforces` in `checks.json`, or `not_applicable.json`), never by repetition.
- This repository follows its own Layer A advice where it applies: its own `docs/adr/` is triaged by the same significance threshold `practices/0001` states for any other project's ADRs.

The check `layer-b-no-a-content` is a coarse proxy for this boundary: it greps `AGENTS.md`, `CLAUDE.md`, and `docs/maintain/` for the shape of a practice ID or title and fails if one appears. It cannot detect every violation of the boundary — only that specific, mechanically-checkable one — and `checks.json`'s `protects` field for that check says so.

## Consequences

This makes it possible to check the deliverable and the repository's own operation against different, sometimes conflicting, constraints (Layer A must work when copied into a project with none of this repository's tooling; Layer B must stay small enough to always-load) without one silently absorbing the other's content over time.

It does not solve human review on a single-maintainer repository: GitHub cannot require a second human's approval when there is only one maintainer. `.claude/settings.json`'s `permissions.deny` narrows what an agent working through Claude Code can do unsupervised (it blocks the specific command spellings used for secret management, repository deletion, and forced ref rewrites — not every possible spelling of those operations), but this is a mitigation for one agent, not a substitute for review — it has no effect on any other agent or on a human running the same commands directly, and a spelling the deny list doesn't literally match still falls through to Claude Code's own approval prompt rather than running unchecked.
