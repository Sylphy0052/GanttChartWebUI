---
description: 変更確認→テスト→規約準拠のコミットメッセージ生成→承認後コミット。
argument-hint: [feat|fix|docs|refactor|chore] [scope] [summary]
allowed-tools: Bash(git status:*), Bash(git add:*), Bash(git commit:*), Bash(git restore:*), Bash(npm test:*), Bash(pytest*), Read(**)
---
Run tests, summarize changes, then propose a conventional commit message. Wait for approval before committing.