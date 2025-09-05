---
description: エラーログ/再現手順を基に原因を特定し、修正パッチとテストを提示します。
argument-hint: [error-summary]
allowed-tools: Read(**), Grep(**), Bash(git diff:*), Bash(npm test:*), Bash(pytest*), Bash(go test:*), Write(**)
---
入力: 簡潔なエラー要約 $ARGUMENTS、詳細ログや再現手順は本文に貼付。
出力: 原因仮説→検証計画→修正パッチ(diff)→再発防止テスト→代替案（副作用低/高）。

Use the debugger subagent to reproduce and diagnose: "$ARGUMENTS".
Produce the smallest safe patch and a prevention test.
