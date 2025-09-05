---
description: 差分中心レビュー（重大度/最小修正案）。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Grep(**), Glob(**), Bash(git diff:*), Bash(git show:*), Bash(git status:*)
---
If "$ARGUMENTS" is empty, compute target from: staged files → last commit diff → config.review_glob.
Use the reviewer subagent with severity and minimal fix.