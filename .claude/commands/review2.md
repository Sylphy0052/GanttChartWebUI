---
description: セキュリティ/パフォーマンス/可読性の観点で差分中心のレビューを行います。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Grep(**), Glob(**), Bash(git diff:*), Bash(git show:*), Write(**)
---
観点:

- セキュリティ: インジェクション、秘密情報、権限境界、依存の既知脆弱性
- パフォーマンス: 計算量/メモリ、I/O、N+1、不要同期
- メンテ性: 命名、一貫性、テスト容易性、ドキュメンテーション
出力: 重大度付きの指摘リスト、修正案、必要なら最小パッチ。

Use the code-reviewer subagent to review the changes in "$ARGUMENTS".
Focus on security/performance/readability and propose minimal diffs if needed.
