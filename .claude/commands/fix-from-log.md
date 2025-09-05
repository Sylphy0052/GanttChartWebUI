---
description: ログ/再現手順から原因特定→最小修正→再発防止テスト。
argument-hint: [error-summary]
allowed-tools: Read(**), Grep(**), Bash(npm test:*), Bash(pytest*), Bash(go test:*), Write(**)
---
Use the debugger subagent to reproduce "$ARGUMENTS" and diagnose root causes.
Output minimal fix patch and a regression test.