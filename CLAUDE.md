# CLAUDE.md — プロジェクト運用ガイド（テンプレート）

> 目的：Claude Code / Subagents / Custom Commands を用いて、設計→実装→レビュー→テスト→リリースまで **安全・一貫** して進めるための**単一の参照文書**。
> このファイルは LLM が常に参照します。**曖昧さを減らすため、規約・禁止事項・手順を明文化**してください。

---

## 0. プロジェクト概要（編集して使用）

* 名前: `<PROJECT_NAME>`
* 目的/価値: `例）Issue/WBS/ガント統合の軽量PMツール`
* 技術スタック: `例）TypeScript + Node.js / Python (FastAPI) / SQLite / React`
* 非機能要件（優先度順）: `信頼性 > セキュリティ > パフォーマンス > 可読性`
* 依存/制約: `例）WSL2 前提、GitLab、CIはGitHub Actions`

---

## 1. 作業モードと原則

* **Small steps**: 1回の実装は**受け入れ条件1つ**まで。
* **Diff-first**: 破壊的変更は**必ず差分提示→人間承認→適用**。
* **Explain-then-apply**: 目的/代替案/リスク/ロールバック手順を先に提示。
* **No secrets**: `.env` / `secrets/**` は読み取らない（必要なら**明示許可**）。
* **Reproducible**: 再現手順と検証方法を常に併記（テスト or スクリプト）。

---

## 2. フェーズ別の推奨フロー

* **Explore → Plan → Spec → Scaffold → Implement → Review → Test → Perf → Docs → Release → Ops**
* 既定のサブエージェント（agents）とコマンド（commands）を次の表に従って使用：

| フェーズ    | サブエージェント                    | 主なコマンド                                               | 期待アウトプット                 |
| ------- | --------------------------- | ---------------------------------------------------- | ------------------------ |
| 企画/計画   | `planner`                   | `/kickoff`, `/task-slice`                            | 目的、制約、タスク分割（≤2h）、受け入れ基準案 |
| 仕様      | `spec-writer`               | `/kickoff`, `/spec-sync`                             | 簡潔PRD、DoD、未確定事項          |
| 足場      | `scaffolder`                | `/scaffold-module`                                   | 雛形、TODO、最小テスト、diff提示     |
| 実装      | `implementer`               | `/implement-ticket`                                  | 最小パッチ、ロールバック手順、テスト更新     |
| バグ      | `debugger`                  | `/fix-from-log`                                      | 再現→原因仮説→最小修正→回帰テスト       |
| レビュー    | `reviewer`                  | `/review-diff`, `/security-scan`                     | 重大度/根拠/最小修正案             |
| テスト     | `qa`                        | `/qa-generate-tests`, `/stabilize-flaky`             | 不足領域/高価値テスト/フレーク対策       |
| 性能      | `perf-analyst`              | `/perf-profile`                                      | 計測→改善案（効果の見積もり）          |
| ドキュメント  | `doc-smith`                 | `/doc-sync`                                          | README/CLI/Docs 同期案とパッチ  |
| リリース/運用 | `release-manager`, `triage` | `/changelog`, `/release-checklist`, `/triage-issues` | リリースノート、チェックリスト、一次切り分け   |

> 役割は**必要最小限の権限**で運用し、書き込みは**単一のスレッド/エージェント**に集約。

---

## 3. コーディング規約（編集して使用）

### 3.1 共通

* 可読性: 早期 return、明確な命名、関数は**単一責務**。
* 例外/エラー: 業務例外は `DomainError` 等で分類、**握りつぶさない**。ユーザー向け文言とログ文言を分離。
* ログ: `level=info` は業務可視化、`warn/error` はアラート経路へ。PII は記録しない。
* 型/Null: `null/undefined` は入力境界で**早期検証**。型ガード/スキーマ（Zod/Pydantic）を使用。

### 3.2 TypeScript/Node（例）

* Lint/Format: `eslint@latest` + `prettier`。
* 設計: `domain`/`app`/`infra` レイヤ分離、入出力 DTO で境界固定。
* テスト: `vitest` or `jest`、ユニット優先、I/Oはモック。

### 3.3 Python（例）

* Lint/Format: `ruff` + `black`、import順は `ruff` に従う。
* 設計: 関数は 50–80 行を上限目安、状態は引数で明示注入。
* テスト: `pytest`、fixtures 乱用禁止、I/O は `tmp_path` + モック。

---

## 4. セキュリティ & プライバシー

* 入力検証: すべての外部入力（API/CLI/フォーム）は**スキーマ検証**。
* 権限境界: 重要操作（削除/上書き/スキーマ変更）は**確認付き**で段階適用。
* 秘密情報: `.env*`、`secrets/**` は**既定で非参照**。必要時に人間が明示許可。
* 依存監査: 重大脆弱性(CRITICAL/HIGH)が出たら**Fail the build**。

---

## 5. テスト方針

* 優先度: **ユニット > 統合 > E2E**。E2E は**少数の幸福経路**に限定。
* カバレッジ目標: 行 80% / ブランチ 70%（例）。**重要領域は例外的に100%目標**。
* 回帰防止: バグ修正時は**再発防止テスト**を必須化。
* フレーク対策: 乱数シード固定、非決定的 I/O をモック、リトライは最後の手段。

---

## 6. パフォーマンス予算（例）

* CLI/同期API: p95 < 200ms、バッチ: 許容時間を明示。
* 計測: 変更前後で**数値比較**。`hyperfine`/`time` 等で可視化。
* メモリ: 大入力処理は**ストリーミング/チャンク**を検討。

---

## 7. ドキュメント規約

* 変更が仕様/CLI/APIに影響→ `/doc-sync` を必ず実施。
* README には: 目的、セットアップ、コマンド、開発ルール、FAQ、トラブルシュート。
* サンプル/スニペットは**実行可能**なものを優先（テストと共有）。

---

## 8. PR/コミット規約

* Conventional Commits: `feat|fix|docs|refactor|chore|perf|test`。scope はモジュール名。
* PR テンプレ（要約/背景/やったこと/やらないこと/試験範囲/リスク/ロールバック）。
* コミット前に `/commit-safely-with-tests` を使用（テスト→要約→文案→承認コミット）。

---

## 9. 既定のサブエージェントと役割

* `planner`: 計画立案とタスク分割（≤2h）。
* `spec-writer`: PRD/DoD を明文化、曖昧さを列挙。
* `scaffolder`: 雛形生成（**diff-first**）。
* `implementer`: 最小実装、ロールバック併記。
* `debugger`: 再現→最小修正→回帰テスト必須。
* `reviewer`: 差分レビュー、重大度/根拠/最小修正案。
* `qa`: カバレッジ不足とフレーク対策。
* `perf-analyst`: 計測→改善案（見積％）。
* `doc-smith`: README/CLI/Doc を最新化。
* `release-manager`: リリースノート、チェックリスト、移行/ロールバック。
* `triage`: 運用一次対応（症状→範囲→暫定回避→担当）。

---

## 10. カスタムコマンドの既定使用順（例）

```text
/kickoff → /task-slice → /scaffold-module → /implement-ticket → /review-diff → /qa-generate-tests → /doc-sync → /commit-safely-with-tests → /release-checklist → /changelog
```

* バグ: `/fix-from-log` を起点に `/review-diff` → `/qa-generate-tests`。
* 性能: `/perf-profile` → `/implement-ticket` → `/review-diff`。

---

## 11. 危険操作の扱い（人間承認が必須）

* ファイル削除/一括置換/スキーマ変更/マイグレーション/シークレット操作。
* `git push --force` や破壊的 API 変更は**提案のみ**。実行は人間が行う。

---

## 12. よくある指示テンプレ

* *「このチケットの受け入れ条件Aだけ満たす最小変更を提案し、diffを見せて」*
* *「この差分を High/Med/Low でレビューし、最小パッチを示して」*
* *「このドキュメントと実装のズレを列挙し、更新案のパッチを出して」*
* *「この関数のパフォーマンスを測って、改善案と期待スピードアップを%で見積もって」*

---

## 13. 付録：ディレクトリ指針（例）

```
src/
  domain/        # ビジネスルール（副作用なし）
  app/           # ユースケース（編成）
  infra/         # 外部I/O（DB/HTTP/FS）
  ui/            # 表層（React/CLI）
 tests/          # 単体/統合/E2E を階層分け
 docs/           # ユーザー/開発者向けドキュメント
```

---

### メモ

* 本テンプレはプロジェクトに合わせて自由に編集してください。
* 実際の**権限制御**は `.claude/settings.json`（`permissions.allow/deny`、`defaultMode` 等）で行います。
* CLAUDE.md は**規範**・**背景**・**判断基準**を提示し、AIの出力を**安定**させることが目的です。
