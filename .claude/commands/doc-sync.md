---
command: doc-sync
description: "実装差分からドキュメント差分案を生成・同期します。Doc Writer と Docs Guardian のサブエージェントを活用。"
updated: "2025-09-11"
referenced-agents:

- .claude/agents/doc-writer.md
- .claude/agents/docs-guardian.md

---

## 概要

`doc-sync` は、**実装（コード）変更**に対して `README` / `CHANGELOG` / `docs/**` / `docs/spec.md` の**更新漏れ**を検出し、**最小パッチ**としてドキュメント修正案を生成します。
生成・審査は以下の役割分担で行います。

- **Docs Guardian** … 乖離の抽出・優先度付け・是正方針（最小パッチ）提案
- **Doc Writer** … 文体・表記・構成の整形、見出し/章/リンクの編成

> **実装は Codex ベース**：`codex review .` / `codex run|tests` の結果を参照し、影響範囲と根拠（コミット/行番号）を明示します。Claude はレビュー/統合に注力します。

---

## 使い方

### プラン（ドライラン）

```bash
claude doc-sync --plan
```

- 乖離サマリと修正案（パッチ候補）を**標準出力**へ。ファイルは書き換えません。

### 適用（最小パッチ）

```bash
claude doc-sync --apply
```

- 対象ドキュメントへ**最小限の差分**を適用します。適用後は `git diff` を自動表示。

### 対象を絞る

```bash
claude doc-sync --apply --targets "README.md,docs/spec.md"
# パスのカンマ区切り。glob も可: "docs/**/*.md"
```

### 節単位で適用（見出し指定）

```bash
claude doc-sync --apply --sections "API/認証, CLI/flow-run"
# 見出し（H2/H3）名のカンマ区切り。Doc Writer が該当節だけを再生成します。
```

---

## フラグ & 引数

| 引数/フラグ         | 型/既定        | 説明 |
|---|---|---|
| `--plan`            | boolean / off  | ドライラン。適用せず提案のみ出力 |
| `--apply`           | boolean / off  | 最小パッチを適用 |
| `--targets`         | string         | 対象ファイル（カンマ区切り / glob 対応） |
| `--sections`        | string         | 見出し名のカンマ区切り（節単位で適用） |
| `--max-findings`    | number / 5     | 乖離サマリの上限件数 |
| `--severity`        | enum / all     | `all|high|medium`：重大度フィルタ（Docs Guardian 基準） |
| `--no-codex`        | boolean / off  | Codex 連携を無効化（オフ推奨） |

---

## 入力ソース

- 直近の unified diff（未コミット差分 + 直近コミット）
- `codex review .` の結果（公開API/CLI/設定/依存/CI の変更指摘を優先）
- 既存ドキュメント：`README` / `CHANGELOG` / `docs/**` / `docs/spec.md`

---

## 出力フォーマット（`--plan` 時）

### 【乖離サマリ】（最大 `--max-findings` 件）

- ファイル: `<path>` 範囲: `Lxx-Lyy`
  期待: … / 現状: … / 乖離: …
  重大度: `high|medium|low`（根拠: commit/PR/行番号）

### 【最小パッチ案】（パッチごと）

```diff
--- a/docs/spec.md
+++ b/docs/spec.md
@@
- 旧仕様の記述 …
+ 新仕様の記述 …（根拠: commit abc123 / codex review #4）
```

### 【適用コマンド例】

```bash
claude doc-sync --apply --targets "docs/spec.md"
```

---

## 内部ワークフロー

1. **差分収集**：`git status` / `git diff` / 直近コミットの unified diff を収集
2. **Codex 解析**：`codex review .` を実行し、公開API/CLI/設定/依存/CI の変更点を抽出
3. **乖離検出（Docs Guardian）**：ドキュメントとの不一致をランキング（重大度付与）
4. **ドラフト生成（Doc Writer）**：該当箇所の最小パッチを生成（文体・用語統一）
5. **出力整形**：`--plan` は提案のみ、`--apply` は最小パッチを適用
6. **結果要約**：適用後は `git diff --stat` と変更ファイル一覧を表示

---

## ガイドライン

- **仕様改定は最小限**。まずは既存仕様とコードの整合を優先
- 根拠（コミットID/PR/行番号/Codex 指摘ID）を**必ず**添える
- API 破壊変更は `CHANGELOG.md` の **Breaking Changes** 節へ
- CLI 変更は `README` のコマンド表/使用例を**同時更新**
- 依存/環境変更は `docs/setup.md` 等の環境節に反映

---

## 例

```bash
# 1) 差分を確認しつつ提案を確認
claude doc-sync --plan --max-findings 7 --severity high

# 2) 重要部分だけ先に適用
claude doc-sync --apply --targets "CHANGELOG.md,docs/spec.md"

# 3) CLI の使用例セクションだけ更新
claude doc-sync --apply --sections "CLI/使用例"
```

---

## 参照

- `.claude/agents/docs-guardian.md`（文書整合監視・乖離抽出）
- `.claude/agents/doc-writer.md`（文体/表記/構成の整形）
- `AGENTS.md`（役割と連携ポリシー）
- `HOW_TO_USE.md`（日常運用コマンド）
