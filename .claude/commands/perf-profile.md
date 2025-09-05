---
description: ホットパス計測→比較→改善案とリスク評価。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Grep(**), Write(**), Bash(time*), Bash(hyperfine:*), Bash(node:*), Bash(python*), Bash(go*)
---
Use the perf-analyst subagent to profile "$ARGUMENTS" and propose measurable improvements with expected speedups.