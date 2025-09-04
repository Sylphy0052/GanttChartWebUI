# 実装計画（詳細）

**目的**: 最小PoC（§19）を3–4週間で着地し、操作感・性能の検証と次フェーズ判断材料を得る。

---

## 1. フェーズとタイムライン（暫定）

- **Phase 0（W0・2日）**: 環境整備／ベース合意
- **Sprint 1（W1）**: Project/Issue基盤
- **Sprint 2（W2）**: WBS + ガント最小機能
- **Sprint 3（W3）**: パスワード閲覧 + 進捗UI + 性能計測
- **Sprint 4（W4）**: スケジューリング（前進/後退）+ 安定化 + デモ

> 目安：4週間（営業日20日）。小規模チーム（FE×2, BE×2, QA×1兼任, PM×1）を想定。

---

## 2. 体制・担当（RACI）

- **PM**: スコープ管理、優先度、デモ進行
- **Tech Lead（BE）**: アーキ、DB/Prisma、API契約、性能指標
- **BE**: API実装、スケジューラ、監査ログ
- **FE Lead**: UI設計、状態管理、ガント描画
- **FE**: WBS/Issue詳細/Markdown、ショートカット、Undo/Redo
- **QA**: 受入基準、E2E、負荷試験
- **Ops**: CI/CD、監視、Secrets

---

## 3. スプリント別バックログ（DoDつき）

### Sprint 1（W1） Project/Issue基盤

- BE
  - Prismaモデリング（Project/Issue/Dependency/ActivityLog）
  - 認証（OIDCダミー）/RBAC簡易
  - Issues: `GET/POST/PATCH/DELETE`（ETag/If-Match, cursor）
  - Projects: `POST/GET` + 切替API
- FE
  - レイアウト/ルーティング/プロジェクト選択
  - Issue一覧（テーブル）+ 詳細サイドパネル（基本項目）
  - Markdownエディタ(Edit/Preview)最小
- 共通
  - Seed 1,000件導入、CI最小、構造化ログ
- **DoD**: CRUD/E2E（一覧→詳細→編集）、p95 API < 250ms

---

### Sprint 2（W2） WBS + ガント最小

- BE
  - WBS: 階層取得、並び替え/親変更
  - Dependencies: FS作成/削除、一覧
- FE
  - WBSツリー（D&D並び替え/親変更）
  - ガント描画（SVG、ズーム/スクロール、バー移動/伸縮）
  - 依存線作成（バー端スナップ、折れ線）
  - Undo/Redo（Z/Y）
- **DoD**: 先行移動→後続自動シフト（暫定ロジック）、主要操作にテレメトリ送出

---

### Sprint 3（W3） 閲覧パスワード + 進捗 + 性能

- BE
  - `visibility=password` 実装
  - `PUT /projects/:id/password`、`POST /projects/:id/access`
  - 進捗更新API、ActivityLog拡充
- FE
  - プロジェクト閲覧モーダル→トークン保存（24h）
  - 進捗ハンドル/％入力（Leafのみ編集）
  - KPI計測フック（初回描画/drag/zoom）
- **DoD**: 初回描画 < 1.5s、ドラッグ応答 < 100ms（seed 1,000件）

---

### Sprint 4（W4） スケジューリング + 安定化

- BE
  - スケジューラ：前進/後退パス
  - ComputedSchedule マテビュー、/gantt 高速化
- FE
  - 期限超過/Blocked表示、Todayライン、ハイライト
  - エラーハンドリング（409巻き戻しトースト＋差分モーダル）
- QA
  - Playwright E2E 3本 / 負荷試験
- **DoD**: 受入基準§19達成、デモシナリオA/B/C成功

---

## 4. チケット化テンプレ（例）

- タイトル: `[WBS] ツリーD&Dで親子変更`
- 背景/目的: ユーザーストーリー
- 実装概要: 主要関数、型、イベント
- AC: 操作・表示・監査・性能（ms）
- テスト観点: ユニット/E2E/回帰
- 影響: API/DB/権限/性能

---

## 5. 見積（人日）

- Sprint1: BE 6 / FE 6 / QA 2
- Sprint2: BE 7 / FE 8 / QA 3
- Sprint3: BE 5 / FE 5 / QA 2
- Sprint4: BE 7 / FE 6 / QA 3
- **合計**: BE 25 / FE 25 / QA 10 / PM 8

---

## 6. リスク & 対策

- ガント性能が出ない → 仮想スクロール/差分描画
- Undo/Redo複雑化 → コマンドパターン+履歴スタック
- 依存作図UX難 → 端スナップ＋ツールチップ
- スケジューリング遅延 → 影響範囲のみ再計算、WebWorker検討
- 仕様ブレ → 週次レビュー、仕様差分は即ドキュメント反映

---

## 7. 成果物・デモ

- 成果物: 稼働Docker Compose、操作GIF、性能レポート
- デモ台本: シナリオA/B/C（§19）、想定Q&A、既知制約一覧

---

## 8. Definition of Ready (DoR)

- 受入基準/UXモックあり
- API契約確定
- 非機能要件整理済み
- 計測フック/テレメトリ項目が決定

---

## 9. 計測・レビュー運用

- デイリースタンドアップ（15分）
- バーンダウン（GitHub Projects等）
- 毎週レビュー＆リトロ：KPI/バグ/学びを仕様に還元
