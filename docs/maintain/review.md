# Review

This page defines two distinct review procedures used in this repository. They differ in what they look at and how many times they run, and a request for one must not be answered with the other's checklist.

## Output review

Run once, against a finished piece of content — a new practice, a new antipattern, a new adapter. Four lenses, each applied exactly once:

1. **Fact-check.** Does every claim trace to a source in `sources`, and does the `summary` actually say what the source says?
2. **Coverage gaps.** Is there a case the `When it applies` section (or the antipattern's equivalent) silently fails to mention, where the rule would give the wrong answer?
3. **Oversights.** Did the required frontmatter fields, heading set, and file naming all land correctly, independent of content quality?
4. **Consistency with premises.** Does this file agree with what the rest of the repository already asserts, rather than quietly contradicting a sibling file?

An output review produces a list of findings or an empty list. It does not iterate; if the findings are large enough to need a second look, that second look is a new output review of the fixed file, not a continuation of the first.

## Convention-revision review

Run against a change to this repository's own rules — an edit to this page, to `authoring.md`, to a schema, to a check. Three lenses:

1. **Fact-check.** Does the revised text describe what the checks and schemas actually enforce, not what they were meant to enforce?
2. **Canon duplication.** Does the revision restate something another file already states as the canonical source, instead of referring to it?
3. **Accumulation judgment.** Does the revision keep growing the page with caveats and special cases, when the better fix is to simplify the rule itself?

This review is bounded at five rounds, and the rounds are not identical:

- **Round 1** applies all three lenses without restriction.
- **From round 2 onward**, do not surface a new finding that is minor — a wording nit, a formatting preference — unless it is load-bearing for one of the three lenses. Round 2 exists to catch what round 1's fixes broke, not to keep mining the same text for smaller and smaller issues.
- **From round 3 onward**, if the finding count has not gone down relative to the previous round, stop looking for new findings and switch that round's purpose to removing text instead: whatever was added in the previous round to address a finding is a candidate for deletion if it does not clearly earn its place. A page that keeps growing to satisfy each round's findings is not converging.

The round stops early, before five, whenever a round returns zero findings.

## Per-round count table

Post one comment per round to the issue tracking the revision, with a three-column count: how many findings trace to the original draft, how many trace to a fix a previous review round introduced, and how many were already present before this revision started (a pre-existing gap the revision happened to expose). This table is what makes "the review is not converging" visible before round five arrives, rather than only in hindsight.

## Request text template

Every review request, for either procedure, states four things up front so the reviewer does not have to guess scope:

- **Subject.** The exact file or files under review, by path.
- **Out of scope.** What the requester is deliberately not asking about in this pass.
- **Already settled.** Any prior decision the reviewer should treat as fixed rather than reopen.
- **Fixed in a previous round.** For a convention-revision review past round 1, what the previous round's findings were and how each was addressed, so round *n* is read as a diff against round *n-1*, not as a fresh read of the whole page.

## Verdict

When a convention-revision review disagrees about whether a normative statement should stay: a statement backed by a source in `sources`, or by a check that already enforces it, stays. A statement with neither is removed, not hedged into a weaker claim — a rule this repository cannot point to evidence or enforcement for is not a rule it can ask anyone else to follow.
