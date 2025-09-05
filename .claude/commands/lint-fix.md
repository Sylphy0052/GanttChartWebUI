---
description: Linter/Formatter を走らせ、差分を提示して適用の可否を確認します。
argument-hint: [path-or-glob]
allowed-tools: Bash(npm run lint:*), Bash(npm run format:*), Bash(prettier:*), Bash(ruff:*), Bash(black:*), Read(**), Write(**)
---
ルール: 破壊的変更は提案のみ。規約違反の自動修正は diff を提示して承認後に適用。
