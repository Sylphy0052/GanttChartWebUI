---
description: 不足領域の検出とテスト雛形。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Write(**), Bash(npm run test:*), Bash(pytest*), Bash(go test:*), Bash(git diff:*), Bash(git show:*)
---
If "$ARGUMENTS" is empty, look at recent diffs (HEAD~1..HEAD) and focus on api_paths/web_paths from config.
Use the qa subagent to propose high-value tests.