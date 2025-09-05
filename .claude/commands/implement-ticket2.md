---
description: 受入条件を1つだけ満たす最小パッチ＋テスト＋ロールバック。
argument-hint: [ticket-id or summary]
allowed-tools: Read(**), Write(**), Grep(**), Bash(git diff:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(npm run build:*), Bash(pytest*), Bash(npm test:*)
---
If "$ARGUMENTS" is empty, resolve in this order:
1) .claude/flow/state.json.current_task
2) current branch name like feat/FEAT-123 or fix/BUG-456
3) the largest logical change from git diff --name-only HEAD
Then use the implementer subagent to produce the minimal patch and tests; update state.