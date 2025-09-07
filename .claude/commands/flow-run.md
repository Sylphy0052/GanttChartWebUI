---
description: フローの次タスクを**連続実行**（安全停止・上限・フェーズ絞り・自動補充対応）
argument-hint: \[--auto] \[--max=N] \[--include=plan,spec,...] \[--exclude=...] \[--refresh] \[--dry-run]
allowed-tools: Read(**), Write(**), Grep(**), Glob(**), Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git show:*), Bash(npm run test:*), Bash(pytest\*), Bash(go test:*), Bash(time*), Bash(hyperfine:*), Bash(node:*), Bash(python\*), Bash(npx:\*)
---

# flow-run — run flow-next repeatedly until tasks are done

## 前提

* `.claude/flow/config.yaml` と `.claude/flow/state.json` を使用。
* まだ無い場合は `/flow-init` を先に実行。

## 目的

* **引数なし運用**を前提に、`/flow-next` と同等のロジックを**繰り返し**実行して、
  `state.next_tasks` が空になるまで、または上限に達するまで進める。

## 安全原則（必読）

* すべて **diff-first**：編集は必ず差分を提示→**人間承認**→適用。
* `--auto` は**ステップ選択の自動化**のみ。**編集の承認は必須**（自動承認はしない）。
* 破壊的操作（削除/一括置換/DBスキーマ変更等）は**提案止まり**。

## オプション

* `--max=N`：今回の実行で進める最大ステップ数（既定: 5）
* `--include=plan,spec,scaffold,implement,review,test,perf,docs,release`：対象フェーズを限定
* `--exclude=...`：除外フェーズ
* `--refresh`：`next_tasks` が空のとき、`plan_path` から**小タスクを自動補充**（planner subagent 使用）
* `--dry-run`：実変更なしで計画のみ（実行プランと想定diffの要約を返す）
* `--auto`：各ステップの**選択と遷移のみ**自動（承認は都度必要）

## アルゴリズム

1. `config.yaml` と `state.json` を読み込み。
2. ループ（最大 `--max` 回 or `next_tasks` が空になるまで）：

   * `state.current_task` が空なら `state.next_tasks` から1件取り出し設定。
   * **フェーズ判定**（`/flow-next` と同等）：

     * 明示タグ（`[plan]`, `[spec]`, `[scaffold]`, `[implement]`, `[review]`, `[test]`, `[perf]`, `[docs]`, `[release]`）を優先。
     * 無ければヒューリスティクス（語彙）と `git status/diff` から推定。
   * `--include/--exclude` に反するならスキップして次を選択。
   * **フェーズ別処理**（明示的にサブエージェントを起動）:

     * plan → *Use the planner subagent* to slice/update `state.next_tasks`（≤2h 粒度）。
     * spec → *Use the spec-writer subagent* to reconcile PRD (`config.spec_path`).
     * scaffold → *Use the scaffolder subagent*（必ず diff 提示）。
     * implement → *Use the implementer subagent*（最小パッチ＋テスト＋ロールバック案）。
     * review → *Use the reviewer subagent*（Severity＋最小修正差分）。
     * test → *Use the qa subagent*（不足テスト生成/フレーク対策）。
     * perf → *Use the perf-analyst subagent*（KPI は `config.kpis`）。
     * docs → *Use the doc-smith subagent*（README/CLI/Doc 同期）。
     * release → *Use the release-manager subagent*（チェックリスト/ノート）。
   * 各ステップ完了後：

     * サマリ（task/phase/result/notes）を `state.log` に追記し、`current_task` をクリア。
     * `--dry-run` の場合は**適用せず**にプランのみ返す。
3. `next_tasks` が空になったら終了。`--refresh` 指定時のみ planner で補充を試みる（最大1回）。

## 失敗時の扱い

* 該当フェーズのエラーは `state.log` に記録し、次タスクへ進むか中断するかを問い合わせる。

## 実行例

* 引数なし・上限3ステップ：

  ```
  /flow-run --max=3
  ```
* 実装とレビューだけを一気に：

  ```
  /flow-run --include=implement,review --max=5
  ```
* タスクが尽きたら自動補充（計画を小タスク化）：

  ```
  /flow-run --refresh
  ```
* 乾式実行（計画と想定diffの要約だけ）：

  ```
  /flow-run --dry-run --max=10
  ```
