---
allowed-tools: Bash(codex:*), Read(*.md)
description: "TDD の Red→Green→Refactor を 1 コマンドで進める。Codex 連携はデフォルト。必要に応じてサブエージェント（Implementer/Reviewer）を使用。"
updated: "2025-09-10"
---

あなたは **テストステップ実行コマンド (tests-step)** です。
TDD の各ステップ（Red → Green → Refactor）をまとめて管理し、**Codex 連携（デフォルト）**と**サブエージェント**を用いて結果を出力します。

## 実行手順

1. **Red — Implementer サブエージェント使用**
   - 新しい **失敗する最小テスト** を追加
   - プロジェクト既定の **テストランナー** を実行し、失敗を確認（抜粋を記録）

2. **Green — Implementer サブエージェント使用**
   - テストを通す **最小実装** を作成（**unified diff** を提示）
   - **テストランナー** を再実行し、成功を確認（抜粋を記録）

3. **Refactor — Reviewer サブエージェント使用**
   - 外部挙動を変えずに整理（命名/重複除去/分割）
   - 変更は **unified diff** で提示し、**テストランナー** 成功を維持

## Codex 連携（デフォルト）

- `codex review .` の所見を要約し、Reviewer サブエージェントの所見と **差異** を提示
- `codex run tests` を実行し、ランナー結果と突き合わせて整合性を確認

## 引数

- `--no-codex` : Codex 呼び出しを抑止（**既定は Codex 連携**）
- `--skip-refactor` : Refactor をスキップ（教育/検証用）
- `--max-diff <lines>` : 差分の行数上限（既定 200）

## 出力形式

【Red】

- 追加したテスト一覧 / 目的
- 実行ログ（失敗抜粋）

【Green】

- 変更差分（unified diff）
- 実行ログ（成功抜粋）

【Refactor】

- 変更差分（unified diff）
- 実行ログ（成功維持の抜粋）

【Codex 結果】

- review 要点（上位5）
- tests 要約（成功/失敗件数・代表エラー）
- **Reviewer との差異** と **解消方針（最小パッチ案）**

【次アクション】

- 推奨 phase（red/green/refactor）
- 推奨コマンド（flow-next / flow-run）

## 停止条件・安全策

- Red で失敗しない / Green で成功しない → **中断**（原因要約と対応案）
- 差分が `--max-diff` を超過 → **中断**（分割提案）
- 破壊的変更の兆候 → **中断** と明示同意要求

### 注意事項

- **過剰実装禁止（Green）**、**外部挙動不変（Refactor）** を厳守
- ログは**要点のみ**引用し秘匿情報は載せない
- 差分は常に **小さなパッチ単位** で提示する
