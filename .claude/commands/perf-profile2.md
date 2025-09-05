---
description: 計測→ボトルネック→改善案（期待%）。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Grep(**), Write(**), Bash(time*), Bash(hyperfine:*), Bash(node:*), Bash(python*), Bash(go*)
---
If "$ARGUMENTS" is empty, select hot directories from recent changes; load KPI from config.kpis.
Use the perf-analyst subagent to profile and propose measurable improvements.