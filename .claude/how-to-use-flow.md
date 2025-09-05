# how-to-use-flow — 引数なしで回せる実装フロー運用ガイド

> 目的：引数を与えなくても、**仕様 → 計画 → 実装 → レビュー → テスト → 性能 → ドキュメント → リリース** の一連を Claude Code のカスタムコマンドで安全に回せるようにする。
> 仕組み：`.claude/flow/config.yaml` と `.claude/flow/state.json` により、コマンドは **state → branch/diff → config → 仕様/計画** の順でデフォルト解決する。

---

## 1) セットアップ

### 1.1 ディレクトリ構成

```
プロジェクトルート/
├─ .claude/
│  ├─ agents/          # 役割別サブエージェント（provided）
│  ├─ commands/        # カスタムコマンド（provided）
│  └─ flow/
│     ├─ config.yaml   # 設定（仕様/計画のパスやKPIなど）
│     └─ state.json    # 実行状態（自動更新）
├─ docs/
│  ├─ 仕様書.md
│  └─ 実装計画.md
└─ CLAUDE.md
```

### 1.2 初期ファイル例

**.claude/flow/config.yaml**

```yaml
spec_path: docs/仕様書.md
plan_path: docs/実装計画.md
review_glob: "apps/**/*.{ts,tsx,py,go}"
api_paths:
  - apps/api/src/**
web_paths:
  - apps/web/src/**
kpis:
  initial_render_ms_p95: 1500
  drag_latency_ms_p95: 100
```

**.claude/flow/state.json**（初回は空でOK）

```json
{
  "phase": null,
  "current_task": null,
  "next_tasks": [],
  "log": []
}
```

> それぞれプロジェクトの実パス/KPIに合わせて調整してください。

---

## 2) 導入コマンド（引数なし運用のカギ）

### /flow-init

* 仕様/計画を読み、**next\_tasks** を抽出（≤2h 粒度）
* `state.json` に `phase: "plan"` と候補タスクを書き込む

### /flow-next

* `state.json` を見て**次の一手**を自動選択し、適切なサブエージェントを起動
* 選択ロジック：`state.current_task` → branch名 → `git diff` → `config.yaml` → 仕様/計画
* 実行後は `state.log` を更新し `current_task` をクリア

### /flow-status

* 現在の `phase`、`current_task`、`next_tasks`（上位5件）と最近の `log` を表示

### /flow-reset

* `state.json` をバックアップしてリセット

---

## 3) 既存フェーズコマンドの無引数モード

> すべて **diff-first**（差分提示→承認→適用）。危険操作は提案止まり。

* **/spec-sync**：引数なしで `config.spec_path` を使用し、PRDと実装のズレを解消
* **/task-slice**：引数なしで `plan_path` の直近マイルストーンからチェックリスト生成→`next_tasks` へ追記
* **/scaffold-module**：引数なしで `state.current_task` or `git status` の変更フォルダから推定
* **/implement-ticket**：引数なしで `state.current_task` → branch名(`feat/FOO-123`) → `git diff` の順で推測し最小パッチ
* **/review-diff**：引数なしで staged → last commit diff → `review_glob` の順に対象決定
* **/qa-generate-tests**：引数なしで直近 diff と `api_paths/web_paths` を参照して不足テストを提案
* **/perf-profile**：引数なしでホットパスを直近 diff から推定し `kpis` を評価軸に計測/提案
* **/doc-sync**：引数なしで `docs/` の関連セクションを自動同期案
* **/release-checklist / /changelog**：引数なしで最新タグから次パッチ版を推定

---

## 4) 使い始め（Quick Start）

```text
/flow-init        # 状態初期化＋next_tasks 抽出
/flow-next        # 以降はこれで“次の一手”を自動実行
/flow-status      # いつでも進捗を確認
```

> 引数なしで回したい場合は、以後 **/flow-next** を連打するだけで OK。
> 個別フェーズを直接打ちたい場合も**無引数**で動きます（上の優先順で推定）。

---

## 5) ブランチ/差分の自動解決ルール（実装のコツ）

* ブランチ規約を決める（例：`feat/FEAT-123-短い説明`, `fix/BUG-456-短い説明`）。
* 小さくコミットし、**staged diff** を保つと対象推定が安定。
* タスクは**受入条件1つ**に絞り `/implement-ticket` を小刻みに回す。

---

## 6) 権限と安全運用（重要）

`.claude/settings.json` 例：

```json
{
  "permissions": {
    "allow": [
      "Read(**)", "Write(**)",
      "Bash(git status:*)", "Bash(git diff:*)",
      "Bash(npm run test:*)", "Bash(pytest*)"
    ],
    "deny": [
      "Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"
    ]
  },
  "defaultMode": "plan"
}
```

* **最小権限**から開始し、必要時だけ `allow` を追加。
* すべてのコマンドは **diff-first + 人間承認** を必須化。

---

## 7) 運用レシピ

* **新機能**：`/flow-next` → `/implement-ticket` → `/review-diff` → `/qa-generate-tests` → `/doc-sync`
* **バグ修正**：`/flow-next`（または `/implement-ticket` 無引数）→ `/review-diff` → `/qa-generate-tests`
* **性能改善**：`/flow-next` → `/perf-profile` → `/implement-ticket` → `/review-diff`
* **リリース**：`/flow-next` → `/release-checklist` → `/changelog`

---

## 8) トラブルシュート

* **対象が推定されない**：`git add -p` で差分を絞る or `state.current_task` を `/flow-next` 実行前に明示設定（`/task-slice` で再追加）
* **権限で止まる**：`/permissions` で可視化し `settings.json` の `allow` を最小追加
* **精度低下**：長い会話は `/clear`、節目で新スレッド。`state.json` が壊れたら `/flow-reset`

---

## 9) よく使うスニペット

```text
/flow-init
/flow-next
/flow-status
# 直接フェーズを叩く（無引数OK）
/spec-sync
/task-slice
/scaffold-module
/implement-ticket
/review-diff
/qa-generate-tests
/perf-profile
/doc-sync
/release-checklist
/changelog
```

---

### 備考

* 本ガイドは `.claude/flow/` を利用した **引数なし運用** 前提の手順書です。
* プロジェクト固有の構成に合わせて `config.yaml` を更新し、**状態はコマンドが自動で更新**します。
