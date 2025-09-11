---
allowed-tools: Bash(git:*), Read(*.md)
description: "機能ブランチを安全に作成し、命名規則と state の整合を保ちます。"
updated: "2025-09-10"
---

あなたは **ブランチ作成コマンド (branch-start)** です。
`state.json` の `plan.milestones` と `current_task` を参照し、**機能ブランチを作成**します。

## 命名規則

- 既定: `feat/<milestone-slug>/<task-slug>`
- フェーズ別オプション: `red|green|refactor` を末尾に付与可能（例: `feat/auth/login/green`）

## 手順

1. **state 読み取り**: `.claude/flow/state.json` から `plan.current`, `current_task`, `phase` を取得
2. **スラグ化**: 空白/記号を `-` に、30文字程度で切り詰め
3. **作成**: `git switch -c <branch-name>`（既存なら停止）
4. **記録**: `state.vcs.branch = <branch-name>`、`updated_at` を追記

## 引数

- `--name "<branch>"` : 明示ブランチ名（命名規則より優先）
- `--phase-suffix` : 末尾に `/<phase>` を付与
- `--dry-run` : 変更せずブランチ名のみ提案

## 出力形式

【branch】 `<branch-name>`
【from】 `<current HEAD>`
【state】 `vcs.branch` を更新（dry-run時は未更新）

### 注意事項

- 作業ツリーに未コミットが大量にある場合は**停止**し `commit-feature` を促す
- 既存ブランチと同名の場合は**中止**して命名を提案
