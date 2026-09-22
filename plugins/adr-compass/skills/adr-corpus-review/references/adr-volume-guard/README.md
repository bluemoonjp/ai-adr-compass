# adr-volume-guard

A self-contained instrument that measures an ADR corpus's volume: record
count, fan-in, fan-out, generation rate, and staleness. It ships with no
calibrated default thresholds — see "Thresholds" below for why, and for how
to derive your own safely.

## What it measures, and from what

Every dimension comes from the record text itself:

- **Decision date** — a `Date: YYYY-MM-DD` line in the record, or an entry
  you supply yourself (see `--dates` below) for a corpus whose date isn't in
  that exact form.
- **Cross-references** — literal `ADR-NNNN` occurrences in the record body,
  matched against the record numbers present in the same directory.
  A corpus that links records by filename or bare number instead of writing
  `ADR-NNNN` will read as having little or no fan-in/fan-out even though it
  does cross-reference records. That is a stated limitation of this v0.1
  detector, not a claim that such a corpus has no cross-references.

Every distribution (fan-out, fan-in, generation rate, days since decision)
is reported as a full quantile set — `p50`/`p90`/`p95`/`max` — never as a
mean or a mean-plus-standard-deviations figure. This class of count is
right-skewed (most records touch a few others; a handful touch many), and a
mean-based estimator misrepresents exactly the shape that matters here.

`fanOutTotal` and `fanOutDistinct` (and their `fanIn*` counterparts) are
always reported separately: a record that cites the same target four times
is a different situation from one that cites four different targets once,
and collapsing both into one number erases the difference.

An **unresolved reference** — `ADR-NNNN` naming a number that doesn't exist
in the directory — is reported as a finding regardless of any threshold.
It's a structural correctness problem, not a statistical one.

## Use

```bash
node cli.mjs <adr-directory> [--json] [--dates dates.json]
```

`--dates dates.json` supplies `{"<record id>": "YYYY-MM-DD"}` for records
whose own `Date:` line this tool can't parse (a different date format, or no
`Date:` line at all). A common source is each file's git-log add date — this
CLI never runs git itself (see "Why no git" below), so build that map with
your own `git log` invocation and pass it in.

As a library, import `measure(records, opts)` directly — `records` is
`[{path, text}, ...]`, the same shape this repository's own check runner
uses. `measure()` touches neither the filesystem nor git; it is a pure
function over whatever records you hand it.

## Thresholds

`config.example.json` ships every threshold `value` as `null` — this
instrument does not publish a calibrated default. A prior, unpublished
attempt at this exact instrument shipped thresholds that were arithmetically
broken (a pace limit that sat below the corpus's own ordinary rate, a
fan-out limit that mixed "every occurrence" with "distinct targets," a
staleness figure with no stated derivation) — see `docs/adr/0004-*.md` for
the fuller account. This instrument's answer is mechanical, not just a
promise to be more careful: `validateConfigAgainstCorpus(config, measured)`
rejects any `>`/`>=` threshold that would already trip on this corpus's own
current, already-accepted median for that metric — a threshold with no
safety margin over normal is not a threshold, it's a tripwire on everything.
Every non-null threshold must also carry `derivedFrom` (where the number
came from) and `measuredOn` (when).

`evaluateThresholds(measured, config)` checks a validated config's
thresholds against each metric's **p95** — the tail, not the median a
config's safety margin is checked against. Neither function is called by
`scripts/checks/volume-report.mjs`: with no calibrated thresholds shipped,
that check only ever reports the unresolved-reference signal. A project that
has derived its own thresholds calls `evaluateThresholds` itself.

## Severity

Two tiers. Unresolved references are always significant, independent of any
threshold — call this "fail" in your own CI if you wire this instrument into
a blocking check. Every threshold trip from `evaluateThresholds` is
statistical evidence, not a correctness defect — call this "warn."

## Honest scope

A record's `Date:` line records when the decision was made, not when anyone
last revisited it. "Days since decision" in this tool's output is exactly
that — decision age, not review recency — and this instrument does not
attempt to measure staleness of the decision's content itself.

## Why no git

`scripts/lib/runner.mjs`'s check runner passes every check `{path, text}`
pairs it already loaded; no check script in this repository imports
`node:child_process` or any network module (`scripts/check-checks.test.mjs`
enforces this for every `fast: true` check). `index.mjs` and `cli.mjs`
follow the same discipline for the same reason a check would need to:
`index.mjs` never touches disk or git so it stays trivially testable and
embeddable, and `cli.mjs`'s own git-derived `--dates` option is a
convenience layered on top, not a requirement this instrument's core logic
has of its caller.
