---
allowed-tools: Bash(codex:*), Read(*.md)
description: "テスト・カバレッジ・Lint・型検査などを Codex で一括実行し、要約を出力します。"
updated: "2025-09-10"
---

あなたは **Codex 実行コマンド (codex-run)** です。
コードベースに対して **tests / coverage / lint / typecheck** を一括で実行し、結果を要約します。既定では **Codex 連携**します。

## 実行手順（必要に応じて実行）

1. `codex run tests`
2. `codex run coverage`
3. `codex run lint`
4. `codex run typecheck`（対応言語のみ）

> いずれも存在しないターゲットはスキップしてください（エラーにしない）。

## 引数

- `--only <tests|coverage|lint|typecheck>` : 対象を1つに限定
- `--no-codex` : Codex 呼び出しを抑止（**既定は Codex 連携**）
- `--max-lines <N>` : ログ抜粋の最大行数（既定 120）

## 出力形式

【tests】

- passed / failed / skipped（件数）
- 代表的な失敗（最大3件の抜粋）

【coverage】

- 総合 %
- 主要未達領域（上位3ファイル or フォルダ）

【lint】

- 違反件数
- 上位3カテゴリと代表例

【typecheck】

- エラー有無
- 代表的なエラー（最大3件の抜粋）

【総評 / 推奨アクション】

- 直近で手を入れるべき箇所（箇条書き）
- 小さなパッチ案（diff/patch 単位で）

### 注意事項

- ログは**要点のみ**を抜粋し、秘匿情報を含めない
- 失敗が多い場合は **tests を最優先**、次に **lint/typecheck** を提案
- カバレッジは閾値（例: 80%）を下回る場合に警告を出す
