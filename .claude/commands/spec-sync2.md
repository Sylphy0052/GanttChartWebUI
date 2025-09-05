---
description: 仕様（PRD）と実装のドリフトを検出し、受入条件を更新します。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Write(**), Grep(**)
---
If "$ARGUMENTS" is empty, load spec_path from .claude/flow/config.yaml.
Use the spec-writer subagent to reconcile the PRD and produce concrete updates.