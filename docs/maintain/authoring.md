# Authoring practices and antipatterns

This page is the contract for anyone writing a `practices/` or `antipatterns/` file. It does not restate any single file's content; it states the shape every file must take, and the checks in the generated table below hold that shape at CI time.

## Practice files

A practice's frontmatter carries the rule itself: `rule` is the one-sentence statement of what to do, short enough to summarize in a table row. The body never repeats that sentence in prose. It may only use the fixed heading set `Why`, `When it applies`, and `Conflicting guidance` — a schema check rejects any other H2. `Why` explains the mechanism the sources support, not just that the sources exist. `When it applies` states the boundary: which ADR conventions, which situations, and what this practice deliberately does not cover. `Conflicting guidance` is optional and only appears when a source genuinely disagrees with another source about this exact rule; it is not a place to hedge a rule that has no real counter-evidence.

## Antipattern files

An antipattern's frontmatter adds two fields a practice does not have: `classification` (one of `obsolete`, `undetermined`, or `harmful`) and `relates_to`, an array of practice ids the antipattern speaks to. Every id in `relates_to` must resolve to a practice file that exists; a check enforces that at CI time. The body's heading set is wider than a practice's: `Symptom`, `Cause`, `Remedy` describe a pattern that is simply wrong, while `What we did`, `Why it worked`, `What changed`, `What to do now` describe a pattern whose correctness reversed under changed conditions. Pick the set that matches the classification; do not mix headings from both sets in one file.

## Sourcing tiers

Every source object has a `kind`: `primary` (the ADR convention's own authors writing about it, or the standard's own text), `research` (a peer-reviewed or otherwise independently verifiable study), or `other` (a blog post, a forum thread, a secondhand summary). A file's `sources` array must contain at least one `primary` or `research` entry; `other` entries may add color but can never be the only support for a rule. This is enforced by schema, not left to reviewer judgment.

## Confidence and verification dates

Each source also carries a `confidence`: `verified` (someone actually re-read the source and it says what the summary claims), `unverified` (cited but not re-checked since it was added), `unavailable` (the source no longer resolves, and a `note` field explains what was tried), or `derived` (the claim follows from a `verified` or `unverified` source by reasoning that is not itself in the source text). `verified_on` is the only place a re-check date lives; it records the last time a human actually revisited the source, not the date the file was created or last edited.

## Verbatim quotes

A `quote` field is required whenever `confidence` is `verified`, and it exists as evidence that the verification actually happened, not as a way to pad the file with source text. Keep it to 300 characters or fewer — long enough to prove the claim, short enough that this repository is not redistributing the source. Every other reference to a source belongs in `summary`, in your own words, with the `url` field carrying the reader to the original.

## Presenting disagreement

Only `practices/` and `antipatterns/` files may show two sides of a disagreement, and only through the `Conflicting guidance` heading described above. Every template and every plugin `SKILL.md` file is a single canonical answer for the agent reading it at the moment it acts; an agent mid-task has no use for "some argue X, others argue Y" and a check rejects that phrasing in those files.

## What not to write

Do not state a rule that has no source behind it — every claim in a practice or antipattern traces to at least one entry in `sources`. Do not narrate this repository's own history in the body text; a file describes the rule as it stands today, not how the rule got there. A practice must never link to `antipatterns/`; the link runs the other way, from an antipattern's `relates_to` to the practice it complicates. And never hand-edit a generated file — the block below, and any future generated content, is produced by `pnpm gen` from its source of truth, and a hand edit is simply overwritten the next time someone runs it.

## Citing a forbidden pattern

When a practice or antipattern needs to show what a forbidden pattern looks like — a private-information shape, a banned phrase, a known false premise from an earlier draft — split the example across the sentence instead of writing it as one contiguous match. The repository's own pattern checks scan every tracked file, this one included, so an unbroken example is indistinguishable from a real violation.

## Retiring a practice

A practice is never marked deprecated in place. Delete the practice file outright, and add an antipattern with `classification: obsolete` and `relates_to` pointing at whatever practice replaced it, or, if none did, at whichever still-existing practice best explains what the retirement leaves in its place. The antipattern's `What we did` / `Why it worked` / `What changed` / `What to do now` headings carry the transition; the deleted practice file itself carries none of it, because it no longer exists.

## Check table

Generated by `pnpm gen` from `checks.json`. Do not hand-edit the block below; running `pnpm gen` again will overwrite it.

<!-- gen:start -->
| Check | Blocking | Enforces | What it protects |
| --- | --- | --- | --- |
| `no-line-refs` | yes |  | Markdown and template files must not reference a specific line number, since the reference silently drifts out of sync the moment either file is edited. |
| `forbidden-patterns` | yes |  | Repository text and commit messages in the PR range must not contain filesystem paths, email addresses, or maintainer-private strings, since a public repository cannot redact history after the fact. |
| `adr-check` | yes |  | Each ADR file must follow the docs/adr/NNNN-slug.md naming scheme, declare one of the four valid Status values, declare a Date: line formatted YYYY-MM-DD, and reference other ADRs by ID only, since a broken, undated, or ambiguous decision record cannot be trusted the next time it is read. |
| `frontmatter-schema` | yes |  | Every practice, antipattern, and adapter file's frontmatter must validate against its JSON Schema, its id must match its file name, and its body may only use the fixed set of H2 headings for its kind, since ungoverned metadata is what lets a single unsupported claim, an uncited quote, or a dangling relates_to pass as settled guidance. |
| `self-check-resolves` | yes |  | Every active practice must be named in some check's enforces list, and every active practice or antipattern must otherwise be named in scripts/checks/data/not_applicable.json with a reason (an antipattern can only ever be resolved this way, never via enforces), since a practice or antipattern nobody enforces and nobody has excused is silently unchecked. |
| `no-empty-groups` | yes |  | Every topic in the closed topic enum must have at least one active practice, since an empty topic is either dead taxonomy or content nobody finished. |
| `no-history-words` | yes |  | Practice, template, adapter, plugin SKILL.md, AGENTS.md, and CLAUDE.md bodies must not narrate their own history or present two sides where only one canonical answer belongs, since prose that records how a rule changed decays the moment it changes again. |
| `no-false-premises` | yes |  | Practice, template, adapter, plugin SKILL.md, AGENTS.md, and CLAUDE.md bodies must not restate a known false premise from the prior, unverified research repository, such as a misderived statistical threshold or fan-out/staleness figure, since a plausible-sounding misstatement spreads exactly like an accurate one once it is written down. |
| `no-addendum-sections` | yes |  | Instruction and content files must not grow an Addendum/Updates/Changelog heading, since an appended section is where narrated history accumulates outside of version control. |
| `links-one-way` | yes |  | A practice file must not link to antipatterns/, since a practice pointing at its own rebuttal is the antipattern's link to make, not the other way around. |
| `instruction-limits` | yes |  | Root AGENTS.md must stay at or under 40 lines, root CLAUDE.md at or under 10 lines with @AGENTS.md as its first line, since an unbounded always-loaded file is exactly the antipattern this repository documents. |
| `layer-b-no-a-content` | yes |  | AGENTS.md, CLAUDE.md, and docs/maintain/ must not restate a practice's id or title, since that is layer A content leaking into layer B (ADR-0001). This is a coarse proxy: it only catches the mechanically-detectable shape of a practice id or a verbatim title, not every restatement. |
| `no-live-instruction-files` | yes |  | Only the allowlisted paths may use a filename some agent discovers as a live instruction file, since a raw copy under templates/ fires for an agent working on this repository. |
| `generated-fresh` | yes |  | docs/maintain/authoring.md's generated check table, practices/index.md, and README.md's generated blocks must match what pnpm gen produces from checks.json and practices/*.md, since a hand-edited or missing copy silently drifts from the source it claims to summarize. |
| `doc-check-ids-resolve` | yes |  | Every check id named in AGENTS.md's (ci: ...) annotations and in docs/maintain/authoring.md's generated table must exist in checks.json, since a renamed or removed check otherwise leaves a dangling reference nothing catches. |
| `adr-template-matches-own-adrs` | yes |  | Every H2 heading in templates/adr.md.template must also appear in each of this repository's own docs/adr/NNNN-*.md files' H2 set, since a template making a structural claim this repository's own ADRs don't follow is advice this repository does not itself practice. templates/ does not exist yet in v0.1, so this check has no real target and passes trivially until it is populated. |
| `readme-sections-paired` | yes |  | README.md's English and 日本語 sections must have the same number of H3 subsections, since a reader following one language must find every section the other language has. |
| `skill-shape` | yes |  | Every plugins/*/skills/*/SKILL.md and .claude/skills/*/SKILL.md must have frontmatter matching schemas/skill-frontmatter.schema.json with a name matching its own directory, a body under 500 lines, and relative links confined to its own references/ subdirectory, since a skill that grows past this shape stops being the thin, always-loaded file the runtime assumes it is. |
| `release-check` | yes |  | Every plugin a marketplace entry points at must have a plugin.json whose version matches the marketplace entry (and, when COMPASS_RELEASE_TAG is set, the pushed tag) and must carry its own LICENSE/LICENSE-DOCS copies, since an install only ever copies the plugin directory, not the repository root. |
| `registry-check` | yes |  | sources/registry.json must validate against its JSON Schema with no duplicate anchor id, every id in sources/baseline.json must resolve to a registered anchor, every covers host must share its anchor's eTLD+1, and every non-other source host cited by practices/, antipatterns/, and adapters/ must be covered by a registered anchor, since an anchor nothing approved or a host nothing tracks lets a source drift without the weekly patrol ever seeing it. |
| `freshness-report` | no |  | Every active practice and antipattern's oldest sources[].verified_on is checked against a 180-day threshold and reported, since a source nobody has revisited in six months is exactly what the weekly patrol exists to catch. |
<!-- gen:end -->
