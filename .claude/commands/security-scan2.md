---
description: シークレット/インジェクション/権限境界の簡易スキャンと修正案。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Grep(**), Bash(git diff:*), Write(**)
---
Use the reviewer subagent to scan "$ARGUMENTS" for security risks and propose minimal fixes.