# ADR-0002: `applies_to` enumerates ADR conventions, not agent tools

Status: accepted

Issue: #17
Date: 2026-09-22

## Context

The scaffolding this repository borrows uses `applies_to` to name which agent tool a practice targets (`claude-code`, `codex`, `copilot`, ...). That enum does not fit this repository's subject matter: an ADR-writing practice is not specific to a coding agent's brand, it is specific to which record convention (MADR, Nygard's original format, a project's own variant, or none in particular) the practice's guidance assumes. Reusing the agent-tool enum here would leave nearly every practice tagged `general`, carrying no information a reader could act on.

Applicability in this domain varies by record convention, not by which tool is writing the record.

## Decision

`applies_to` is a closed enum of ADR conventions: `general`, `madr`, `nygard`. A practice tagged `general` applies regardless of which convention a project has adopted; `madr` or `nygard` marks guidance that assumes that convention's specific structure or vocabulary. `adapters/` (when populated) holds convention-specific differences from the sourced practices and antipatterns, the same role an agent-tool adapter would have played in the borrowed design.

Agent-tool names are deliberately excluded from this enum. The pre-existing candidates for it (`adr-tools`, `log4brains`, `backstage`, ...) are exactly the tool names an earlier, unverified investigation used as unsourced evidence for an absence claim; admitting an unverified name into a closed schema enum would carry that investigation's shortcut into this repository's own structure.

## Consequences

`no-empty-groups` enforces that every value in the `topic` enum has at least one active practice, but no equivalent check exists for `applies_to` — a value could sit unused indefinitely and nothing here would flag it. Keeping every `applies_to` value earning its place in practice is a manual discipline, upheld by review, not by a check.

Widening this enum with a fourth ADR convention follows the same rule `topic` already follows: the value and the content that uses it land in the same change.
