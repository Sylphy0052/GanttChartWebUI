# 仕様 → 計画 → 実装 → テスト を小刻みに回すフロー（how-to-flow）

> 目的：ChatGPTなどで作成した\*\*仕様書（PRD）\*\*を単一情報源として扱い、**計画 → 実装 → テスト**を小さく素早く反復するための、Claude Code用プレイブック。コピペで使えるコマンド例を収録。

---

## 0) 前提と配置

* 仕様書パス（例）：`docs/仕様書.md`
* 実装計画パス（例）：`docs/実装計画.md`
* Claude用ファイル配置：

  ```
  プロジェクトルート/
  ├─ .claude/
  │  ├─ agents/     # 役割ごとのサブエージェント定義 *.md
  │  └─ commands/   # カスタムコマンド *.md
  └─ CLAUDE.md      # 規約・DoD・禁止事項
  ```

* 推奨運用：**1受入条件＝1実装**、**diff-first**（提案→承認→適用）、**最小権限**。

---

## 1) 全体像（この順に回す）

1. 仕様書をチャットで作成/更新
2. 仕様と実装の整合 → **`/spec-sync`**
3. タスクを2時間以下に分割 → **`/task-slice`**
4. 足場を安全に生成 → **`/scaffold-module`**
5. 受入条件1つだけ実装 → **`/implement-ticket`**
6. 差分レビュー → **`/review-diff`**
7. テスト補強/安定化 → **`/qa-generate-tests`**, **`/stabilize-flaky`**
8. パフォーマンス検証 → **`/perf-profile`**
9. ドキュメント同期 → **`/doc-sync`**（必要に応じて **`/spec-sync`**）
10. リリース前チェック & ノート → **`/release-checklist`**, **`/changelog`**

> KPIが定義されている場合（例：初回描画 < 1.5s、操作応答 < 100ms）は、毎回プロンプトで明示して評価基準に固定。

---

## 2) 最初の一手（仕様ができた直後）

```text
/spec-sync docs/仕様書.md
```

* 仕様（PRD）の受入条件と現状コードの差分を洗い出し、更新案を生成。
* MVPに含める/含めないを再確認し、不要な作業を切り落とす。

---

## 3) 計画（2時間以下のタスクへ分割）

**スプリント開始時**

```text
/task-slice "Sprint 1: 基盤/API/CRUD"
```

* 2時間以下のステップに分割。依存関係・並行可否・オーナー案・受入条件を付与。

**機能ごとの分割例**

```text
/task-slice "WBSツリーD&D（親子変更）→ ガントへ即時反映"
```

* 「D\&D」「API `/wbs/reorder`」「再描画」「テレメトリ」といった受入条件単位に分解。

---

## 4) 足場作り（安全にスキャフォールド）

```text
/scaffold-module apps/web/gantt
/scaffold-module apps/api/projects
```

* 雛形＋最小テストの叩き台を**diff-first**で提示（破壊的操作は提案止まり）。

---

## 5) 実装（受入条件1つ＝1コマンド）

**API CRUD（例）**

```text
/implement-ticket "API: Issues CRUD（ETag/If-Match, cursor paging）"
```

**WBS D\&D（例）**

```text
/implement-ticket "WBS: ツリーD&Dで親子変更→API PATCH /wbs/reorder"
```

**ガントFS依存線（例）**

```text
/implement-ticket "Gantt: バー端スナップでFS依存線を作成/削除（SVG, 折れ線）"
```

**閲覧パスワード（例）**

```text
/implement-ticket "Project visibility=password: /projects/:id/access で閲覧トークン（24h）"
```

**スケジューリング（例）**

```text
/implement-ticket "Scheduler: 前進/後退パスで ES/EF/LS/LF/TF 計算（DAG増分）"
```

> どの実装でも、\*\*“受入条件1つだけ”\*\*に絞ると失敗しにくく、レビューが高速。

---

## 6) レビュー（差分中心）

```text
/review-diff "apps/**/*.{ts,tsx}"
```

* 重大度（High/Med/Low）付きで、根拠と**最小修正差分**まで提示。

---

## 7) テスト（生成・補強・安定化）

**契約/ユニットの叩き台**

```text
/qa-generate-tests apps/api/src/projects/**
/qa-generate-tests apps/web/src/features/gantt/**
```

**フレーク対策**

```text
/stabilize-flaky tests/e2e/**
```

---

## 8) パフォーマンス（KPI直結）

```text
/perf-profile "apps/web/src/features/gantt/**"
```

* 計測→ボトルネック→**改善案（予想効果%）**→ロールバック手順まで提示。

---

## 9) ドキュメント同期

```text
/doc-sync docs/**
/spec-sync docs/仕様書.md
```

* 実装後は毎回、仕様と挙動のドリフトを小さく保つ。

---

## 10) リリース前とノート

```text
/release-checklist v0.1.0
/changelog v0.1.0
```

* 破壊的変更・移行手順・検証・ロールバックの整理。

---

## 11) “命令の例”（プロンプトの書き方）

### 仕様→計画

```
/spec-sync docs/仕様書.md
前提：MVPは Issue CRUD / WBS / ガント（FS依存）/ カレンダー / Undo。KPIは初回1.5s・操作<100ms。
差分があれば受入条件を更新して提案して。必要なら docs/実装計画.md のスプリントも微調整して。
```

```
/task-slice "Sprint 2: WBS + ガント最小機能"
制約：2時間以下で分割。依存関係と並行可否を明記。各タスクに受入条件と失敗時ロールバックを一行で。
参照：docs/実装計画.md の該当スプリント（API/UIの責務分担）
```

### 実装

```
/implement-ticket "Gantt: バー移動/伸縮（Todayライン、ズーム/スクロール）"
受入条件：ズームとスクロールの操作特性、ドラッグ応答<100ms、テレメトリ送出。
最小パッチ＋回帰テストを出して。危険な置換は提案止まりで。
```

### レビュー & テスト

```
/review-diff "apps/web/src/features/gantt/**"
観点：性能（仮想スクロール/差分描画の妥当性）、可読性、セキュリティ（イベント入力検証）。
重大度と最小修正差分を提示して。
```

```
/qa-generate-tests apps/api/src/**
目的：API契約に基づく契約テストを重点。ETag/If-Matchとカーソルページングの境界ケースを列挙して。
```

### 性能

```
/perf-profile "apps/web/src/features/gantt/**"
目標：1,000 Issueで初回描画<1.5s、ドラッグ応答<100ms。
計測スクリプト案と改善案（予想効果%）を出して。副作用とロールバック手順も。
```

---

## 12) スプリント別・推奨コマンドセット（例）

* **Sprint 1（基盤）**
  `/task-slice "Sprint 1: 基盤"` → `/scaffold-module apps/api/projects` →
  `/implement-ticket "Projects/Issues CRUD"` → `/review-diff apps/api/**` → `/qa-generate-tests apps/api/**`

* **Sprint 2（WBS + ガント）**
  `/task-slice "Sprint 2: WBS+Gantt"` → `/implement-ticket "WBS D&D 親子変更"` →
  `/implement-ticket "Gantt FS依存線"` → `/review-diff apps/web/**` → `/qa-generate-tests apps/web/**`

* **Sprint 3（閲覧パス+進捗+性能）**
  `/implement-ticket "Project visibility=password"` → `/implement-ticket "進捗UI（Leafのみ編集）"` → `/perf-profile apps/web/gantt`

* **Sprint 4（スケジューリング+安定化）**
  `/implement-ticket "前進/後退パス"` → `/review-diff ...` → `/qa-generate-tests ...` →
  `/release-checklist v0.1.0` → `/changelog v0.1.0`

---

## 13) 失敗しないコツ（超重要）

* **1受入条件＝1実装**で回す（`/implement-ticket` は小さく）。
* **diff-first & 承認ゲート**を守る（危険操作は提案止まり→あなたが承認）。
* **毎スプリント頭の `/spec-sync`** で仕様と実装のズレを即修復。
* **KPI追従**（例：1.5s/100ms）を毎回プロンプトに明示して `/perf-profile` に渡す。
