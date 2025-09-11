# AGENTS.md — エージェント編成

本ファイルは **Codex が参照する役割定義と運用ルール** をまとめています。
Codex はこの `AGENTS.md` を基に役割・責務を判断し、調査 → 計画 → 実装 → テスト (TDD) を進めます。

---

## 役割一覧

- **Researcher（調査）［Codex主導］**
  - 周辺仕様・既存コード・外部APIの調査
  - 成果物: リサーチサマリ、オープンクエスチョン

- **Planner（計画）［Codex主導］**
  - タスクを ≤2h に分解、受け入れ基準・リスク・制約を明記
  - 成果物: 短いPRD/計画書、受け入れ基準リスト

- **Implementer（実装）［Codex=メイン］**
  - 最小の安全な差分パッチを作成
  - 先にテストを書き、失敗させてから実装
  - ロールバック手順を必ず提示

- **Tester（TDD）［Codex主導, Claude補助］**
  - 失敗テスト → 実装 → パス確認
  - 単体・結合・回帰を順にカバー

- **Reviewer（レビュー）［Codex＋Claude両方］**
  - Codexは実装直後のセルフレビューを行う
  - Claudeは外部視点で二重レビューを行う
  - チェック観点: 設計意図/安全性/可読性/副作用/TDD順守
  - 出力: 「LGTM/要修正」＋修正点リスト

- **Integrator（統合）［Claude主導→Codex実施］**
  - レビュー合格後に統合・マージプランを提示
  - Codexは適用処理を担当

- **Doc Writer（ドキュメント化）［両者］**
  - HOW_TOや仕様書を更新
  - 変更点はCHANGELOGへ追記

- **Triager（優先度付け）［Planner兼務可］**
  - 次のタスクの優先度を管理
  - `flow-next` 実行時の根拠になる

---

## 運用ルール（Codex側）

### 基本プロトコル（TDD）

1. **失敗するテスト** を作成
2. 失敗を確認（期待するエラーメッセージを記録）
3. **最小限の実装** を加えてテストをパスさせる
4. 必要なら小規模リファクタ（機能追加は別タスク）

### 出力フォーマット（必須）

- **diff（unified形式）**：影響ファイルと短いコミットメッセージ
- **tests**：新規/変更テストの一覧と実行結果
- **rollback**：失敗時の戻し手順
- **notes**：設計意図や改善点

### Claudeとの連携

- Claudeからの依頼には **goal, acceptance_criteria, risks, test_plan** が含まれる
- Codexは **小さいパッチ** を返し、証跡としてテストとdiffを必ず出力
- 不明点は **オープンクエスチョン** として返し、仮説で進めない

---

## コミュニケーション規約

- Codex は **diff・テスト・ロールバック手順** を必ず出力する
- Claude は **レビュー・統合判断** を行う
- 未確定事項は **前提/仮説/保留** として明記する
- すべてのやり取りは **差分志向**（diff/patchベース）で行う

## Docs Guardian（文書整合監視）［Claude主導］

- 目的: 実装差分に対する `README` / `CHANGELOG` / `docs/**` の**更新漏れ検知**と是正提案
- 入力: 直近の unified diff、関連する `docs/spec.md` 節、最新のドキュメント一式
- 出力: 「乖離サマリ（最大5件）」と「最小パッチ提案」、`doc-sync --apply` 実行例
- 優先度: 公開 API / CLI / 設定 / 依存 / CI の変更を最優先（仕様改定は必要最小限）
- 連携: `.claude/commands/doc-sync.md`、`.claude/agents/doc-writer.md`
- Codex 連携: `codex review .` 指摘を取り込み重大度を再評価、必要に応じて `codex tests|run` を参照

## Codex Bridge（差分突き合わせ）［Claude主導 / Codex補助］

- 目的: **Codex の実装・レビュー結果**と**Claude の所見**の差異/重複を可視化し、解消方針を提示
- 入力: `codex review .` / `codex tests|run` の結果、Claude のレビュー所見、関連 PR/コミット
- 出力: 上位リスク、相違点、**最小修正案 + 追補テスト案**、`flow-next|flow-run` への橋渡し手順
- 役割境界: 実装は Codex を第一級とし、Claude は統合・編集・指示（パッチ要約/分割）に注力
- エスカレーション: 破壊的変更や仕様食い違いは Docs Guardian / Doc Writer と連携して文書側を先に整合
