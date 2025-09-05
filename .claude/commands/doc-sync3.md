---
description: README/CLI/Docs を実装に同期。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Write(**), Grep(**)
---
If "$ARGUMENTS" is empty, scan docs/ for impacted sections related to last diff and sync.
Use the doc-smith subagent to produce patches.