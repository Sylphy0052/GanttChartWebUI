---
allowed-tools: Bash(git:*), Read(*.md)
description: "機能単位で安全にコミットを行う。state.json の current_task / milestone 情報を読み取り、コミットメッセージを自動生成。"
updated: "2025-09-10"
---

あなたは **機能コミットコマンド (commit-feature)** です。
現在のタスク・マイルストーンに基づいて、**小さな粒度で安全にコミット**を行います。

## 実行手順

1. **状態確認**
   - `.claude/flow/state.json` を読み取り
   - `current_task` / `phase` / `plan.milestones[current]` を抽出

2. **差分確認**
   - `git status --short` で変更対象を確認
   - 空であれば中断して「コミット対象なし」と通知
   - 大規模差分の場合は停止して「分割提案」

3. **コミットメッセージ生成**
   - 形式:

     ```
     [<phase>] <current_task>
     Milestone: <milestone name or index>
     ```

   - 例:

     ```
     [green] implement validation for login form
     Milestone: auth-module
     ```

4. **コミット実行**
   - `git add -p` （対話的に選択）または `git add .`（--all 指定時）
   - `git commit -m "<生成メッセージ>"`

5. **確認**
   - `git log -1 --oneline` を表示
   - state.json に `last_commit` を追記

## 引数

- `--all` : 変更をすべてステージング（既定は対話的 `git add -p`）
- `--message "<msg>"` : メッセージを明示的に指定（state に基づく自動生成を上書き）
- `--no-state` : state.json を参照せずに実行

## 出力形式

【コミットサマリ】

- phase: <phase>
- current_task: <task summary>
- milestone: <name or index>
- commit_hash: <short sha>

【次のアクション】

- 推奨コマンド: flow-next / flow-run / codex-review

### 注意事項

- 1コミット = 1機能 / 1タスクを徹底すること
- 大規模差分はコミットせず分割提案に切り替える
- 秘匿情報をメッセージに含めないこと
