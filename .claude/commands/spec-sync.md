---
description: 仕様（PRD）と実装の差分を検出し、受け入れ条件を最新化。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Write(**), Grep(**)
---
Use the spec-writer subagent to reconcile current behavior under "$ARGUMENTS" with the PRD.
List drift points and propose concrete updates to acceptance criteria.