# Roadmap

This file only summarizes shape and order. Full design rationale, concrete values, and acceptance gates for every phase live in the linked issues — anyone can pick one up without needing prior context.

Tracking issue: [#27](https://github.com/bluemoonjp/ai-adr-compass/issues/27)

| Phase | Scope | Issues |
| --- | --- | --- |
| Phase 0 — Source verification | Verify every candidate source as `primary`/`research` before any content lands. 14 URLed leads (one issue each), 9 nameless leads (one grouped issue — a single absence-claim gate), 9 second-hand leads (one grouped issue, rejected by default). No commits to `main` in this phase. | [#1](https://github.com/bluemoonjp/ai-adr-compass/issues/1)–[#14](https://github.com/bluemoonjp/ai-adr-compass/issues/14), [#15](https://github.com/bluemoonjp/ai-adr-compass/issues/15), [#16](https://github.com/bluemoonjp/ai-adr-compass/issues/16) |
| Phase 1 — Scaffolding + one topic | Root files, schemas, the migrated/adjusted check set, one active practice under topic `adr-scope`, this repository's own `docs/adr/`. Gated on a verified `adr-scope` seed source. | [#17](https://github.com/bluemoonjp/ai-adr-compass/issues/17) |
| Phase 2 — Patrol wiring | Weekly source-freshness patrol, `registry-check`, `freshness-report`. | [#18](https://github.com/bluemoonjp/ai-adr-compass/issues/18) |
| Phase 3 — Add topics | `adr-format`, then `adr-lifecycle`, each its own PR. | [#19](https://github.com/bluemoonjp/ai-adr-compass/issues/19), [#20](https://github.com/bluemoonjp/ai-adr-compass/issues/20) |
| Phase 4 — Public measurement channel + `adr-volume` | 4a: the volume instrument (`starter/adr-volume-guard/`), run against this repository's own corpus. 4b: `measurements/`, an append-only public aggregate channel with integrity and shape checks. 4c: the `adr-volume` topic and the `published-static` registry role. | [#21](https://github.com/bluemoonjp/ai-adr-compass/issues/21), [#22](https://github.com/bluemoonjp/ai-adr-compass/issues/22), [#23](https://github.com/bluemoonjp/ai-adr-compass/issues/23) |
| Phase 5 — Distribution | 5a: prose templates (`templates/`). 5b: the `adr-compass` plugin — two skills, `adr-record` and `adr-corpus-review`. | [#24](https://github.com/bluemoonjp/ai-adr-compass/issues/24), [#25](https://github.com/bluemoonjp/ai-adr-compass/issues/25) |
| Phase 6 — Antipatterns | Corruption mechanisms, each sourced from Phase 4's public measurements. | [#26](https://github.com/bluemoonjp/ai-adr-compass/issues/26) |

Progress is tracked via the sub-issues of [#27](https://github.com/bluemoonjp/ai-adr-compass/issues/27), not by editing this file.
