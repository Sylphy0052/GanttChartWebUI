---
description: 雛形と最小テストの足場を作成（diff-first）。
argument-hint: [module-name]
allowed-tools: Read(**), Write(**), Grep(**), Bash(git status:*), Bash(git diff:*), Bash(npm init:*), Bash(python*), Bash(go*)
---
If "$ARGUMENTS" is empty, infer module from .claude/flow/state.json.current_task or from changed folders in git status.
Use the scaffolder subagent; always show diffs first and wait for approval.