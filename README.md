# ai-adr-compass

[![CI](https://github.com/bluemoonjp/ai-adr-compass/actions/workflows/ci.yml/badge.svg)](https://github.com/bluemoonjp/ai-adr-compass/actions/workflows/ci.yml)

## English

### What this is

Sourced practices and antipatterns for keeping Architecture Decision Records (ADRs) from rotting, in volume and in staleness, as AI coding agents write them, together with the checks and a self-contained volume-measuring instrument needed to enforce them.

### Who reads it

An AI coding agent writing or reviewing ADRs in some other project is the primary reader; a human maintains this repository and reviews what an agent proposes.

### Status

v0.1 in progress. Content only lands once each claim traces to a primary or research source verified against the live document, or to a measurement this repository publishes and re-runs against itself. See [ROADMAP.md](ROADMAP.md) for the phased plan, tracked issue by issue.

### How to use

Clone this repository and read [`practices/index.md`](practices/index.md) for the current sourced guidance on writing ADRs.

<!-- gen:start:how-to-use-en -->
_Generated from `practices/*.md` by `pnpm gen`; do not edit this block._ **1** active practices are indexed in [`practices/index.md`](practices/index.md), licensed under [CC BY 4.0](LICENSE-DOCS).
<!-- gen:end:how-to-use-en -->

### Layout

See the Map table in this repository's own [AGENTS.md](AGENTS.md) for what each top-level directory holds.

### Update policy

A weekly patrol proposes updates against primary sources; a human approves every change. Nothing lands on `main` without review.

### License

Documentation (practices, antipatterns, adapters, docs, and this README's prose) is licensed under [CC BY 4.0](LICENSE-DOCS). Code, scripts, schemas, templates, and configuration are licensed under [MIT](LICENSE). Paths not listed in either place are MIT. Short verbatim quotations belong to their original authors and are reproduced only for verification.

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

### How this differs

Every claim traces to a source and a verification date, not just a plausible-sounding rule. Content is organized for an agent to read at the moment it writes or reviews an ADR, not as a wiki for humans to browse. A repeatable check, not a one-time review, is what keeps the content from drifting out of date.

## 日本語

### What this is

AI コーディングエージェントが書く Architecture Decision Record(ADR)が、量・鮮度の両面で腐敗しないための sourced practices / antipatterns と、それを強制する検査群・自己完結した量測定器を提供します。

### Who reads it

主な読者は、他のプロジェクトで ADR を書く・レビューする AI コーディングエージェントです。このリポジトリ自体は人間が保守し、エージェントの提案をレビューします。

### Status

v0.1 進行中。各主張が一次情報・研究情報として生きた文書に対して検証済みであるか、このリポジトリ自身が公開し再実行する測定に基づく場合にのみ、内容が反映されます。フェーズごとの計画は [ROADMAP.md](ROADMAP.md) を参照してください(Issue ごとに追跡)。

### How to use

このリポジトリを clone し、[`practices/index.md`](practices/index.md) で ADR 執筆に関する現時点の出典付きガイダンスを確認してください。

<!-- gen:start:how-to-use-ja -->
_`practices/*.md` から `pnpm gen` で生成。このブロックは編集しないこと。_ **1** 件の active な practice を [`practices/index.md`](practices/index.md) に索引化(ライセンス: [CC BY 4.0](LICENSE-DOCS))。
<!-- gen:end:how-to-use-ja -->

### Layout

各トップレベルディレクトリの中身は、このリポジトリ自身の [AGENTS.md](AGENTS.md) にある Map 表を参照してください。

### Update policy

週次巡回が一次情報に基づく更新案を作り、人間が全ての変更を承認します。レビューを経ずに `main` へ反映されることはありません。

### License

文書(practices、antipatterns、adapters、docs、この README の本文)は [CC BY 4.0](LICENSE-DOCS)、コード・スクリプト・スキーマ・テンプレート・設定は [MIT](LICENSE) です。どちらにも挙げていないパスは MIT です。短い逐語引用は原著作者に帰属し、検証のためにのみ掲載します。

### Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

### How this differs

全ての主張は出典と確認日にまで遡れます。もっともらしいだけの規則ではありません。内容はエージェントが ADR を書く・レビューする瞬間に読めるよう整理されており、人間が眺めるための wiki ではありません。内容を陳腐化させないのは、一度きりのレビューではなく繰り返し実行される検査です。
