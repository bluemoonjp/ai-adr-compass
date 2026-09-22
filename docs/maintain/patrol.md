# Patrol

This page is the maintainer's own reference for operating the weekly patrol
(`patrol.yml`) once it is already running. It does not explain how patrol
works internally — see `scripts/patrol/*` and `scripts/patrol.mjs` for the
implementation and `.claude/skills/adr-compass-weekly/SKILL.md` for the
procedure that processes what patrol finds.

## 1. Run patrol manually

```bash
gh workflow run patrol.yml
```

Watch it with `gh run list --workflow patrol.yml -L 1` for the run id, then
`gh run view <run-id>`. A successful run adds one commit to the
`patrol-state` branch (even on a no-op run — `checkedAt` always advances)
and either opens a new `Weekly patrol YYYY-Www` Issue or, if nothing
changed, still closes the previous one and opens a fresh one in its place.
`patrol.yml` only runs on `workflow_dispatch` in v0.1; there is no `schedule`
trigger yet, so there is nothing to re-enable after GitHub's 60-day
inactivity auto-disable.

## 2. What the weekly Issue's content safety actually rests on

`public-surface.yml` triggers on `issues: [opened]`, but GitHub does not
cascade a workflow trigger for an event created by the default
`GITHUB_TOKEN` — the weekly Issue `patrol.yml` opens with `gh issue create`
is exactly that kind of event, so `public-surface.yml` does not scan it.
The only thing standing between a rendered Issue body and a leak is
`scripts/patrol/issue-body.mjs`'s own field-level validation (the same
allowlist-and-throw design as `scripts/patrol/format.mjs`). A change to
either file needs its own manual re-check — render a realistic body locally
and confirm it produces no findings against `forbidden-patterns` — before
merging.

## 3. Adding a new registry anchor

Both a frozen artifact (a specific blog post, a specific release tag) and
its living index (a feed, a releases page) are worth registering — they
detect different failure modes. A frozen artifact's link rotting or moving
is caught by watching the artifact itself; a living index's content being
revised, retracted, or handed off to a new canonical URL is caught by
watching the index. Registering only the index leaves the artifact itself
unwatched, which is the false sense of security the registry exists to
avoid. Probe a candidate URL (`node scripts/patrol.mjs --probe <url>`)
before registering it as `role: "source"`: the schema requires
`approval.probe.volatile: false`, so a URL whose raw body changes on every
request needs a stable ETag before it can be trusted to detect real change.
