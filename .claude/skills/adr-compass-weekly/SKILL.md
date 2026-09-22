---
name: adr-compass-weekly
description: Use when processing the weekly patrol Issue that `patrol.yml` opens (title starting "Weekly patrol") — reading what changed in a registered source, updating the practices/antipatterns it affects (or recording that nothing needs to change), advancing sources/baseline.json for the sources processed, and opening a draft PR. Triggered by /adr-compass-weekly or when asked to work through the latest patrol Issue.
---

# adr-compass-weekly

## Procedure

1. **Confirm the patrol path is alive before trusting anything it reports.** Run `gh run list --workflow patrol.yml -L 1` and check the `patrol-state` branch's most recent commit date. If the workflow hasn't run, or the `patrol-state` branch's last commit is more than 8 days old, stop here and report that instead of proceeding — a stale patrol path means the Issue's data may not reflect anything recent, and `patrol-health.mjs`'s own staleness check exists to catch exactly this.
2. Read the open weekly Issue's body (`gh issue view <number>`): the run status, the source table, the `Changed` list, the `Failed` list, the freshness section, and the volume section (`docs/adr/`'s record count, fan-in/fan-out, generation rate, and staleness — non-blocking; only its unresolved-reference count is ever a real defect to act on).
3. Split the source table's rows into two groups — a source can only be in one, and a `failed` or already-`unchanged`/`not-modified` row is in neither and needs no action:
   - **`Changed`.** Fetch the source's current content yourself with `curl`, not `WebFetch` — a raw byte fetch is what a diff needs; `WebFetch`'s summary is not a citable quote and is at most a reading aid for a long page, never the basis for a judgment about what changed. Compare against what `sources/baseline.json`'s entry for that id last accepted, and read for anything that would change a rule this repository states.
   - **`no-baseline`.** Nothing has ever been accepted for this id — whether because this is patrol's first-ever run or because the source was only just registered — so there is no prior observation to diff against and nothing a read could compare. Do not fetch or read the content for this reason; go straight to accepting its baseline in step 5.
4. For each `Changed` source that actually affects existing content, list the `practices/` and `antipatterns/` ids it touches, by id.
5. Start a worktree for this issue (`EnterWorktree`). For every `Changed` source id — not just the ones that affected content — do one of:
   - Update the affected practice or antipattern file (`sources[].verified_on`, and `quote` if the cited text itself changed), following `docs/maintain/authoring.md`.
   - If the change doesn't affect what any file here claims, record that judgment against the source id instead of editing anything.

   For every `no-baseline` source id, record "initial baseline, no prior observation to compare against" — no content judgment is possible for one.

   For every source id processed either way, advance `sources/baseline.json`'s entry for that source id to the byte state `patrol-state`'s `state.json` last observed for it (copy its `etag`/`md5`/`bytes`; set `acceptedOn` to today) — copy it from `state.json`, not from your own `curl` fetch, since a fresh fetch can disagree with `fetch.mjs`'s own measurement (redirect-following, byte counting) and the next dispatch would then report `changed` for a source nothing actually changed in. Never add a baseline entry for a `control-static`/`control-changing` role id — controls compare against the previous `state.json`, not a baseline, and giving one a baseline entry would silently change what it's compared against. Run `pnpm gen` and `pnpm check --strict`. Open a draft PR (`gh pr create --draft`) titled `#N: <summary>` for the Issue's number, with the body listing every processed source id and its judgment. Never push to `main` directly — the PR is how this branch's changes reach `main`, same as every other change to this repository.
6. Run an Output review (`docs/maintain/review.md`) once against the changed practice/antipattern files — the four lenses, applied exactly once — and post the finding count per lens in a PR comment.
