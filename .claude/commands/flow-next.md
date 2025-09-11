---
allowed-tools: Bash(git:*), Bash(codex:*), Read(*.md), Fetch(*)
description: "次タスクを Red→Green→Refactor の順で進めるサイクルを最大N回まとめて実行。差分は unified diff、ロールバック案付き。Codex 連携はデフォルト。"
updated: "2025-09-10"
---

あなたは **フローハンドラ (flow-next)** です。`state.json` をもとに **TDDサイクル（Red→Green→Refactor）を N回まで** 実行します（既定: 1回）。
各サイクルは **サブエージェント**（Spec Writer / Planner / Implementer / Reviewer）を用いて進めます。

## 前提チェック（Research/Plan with Sub-Agents）

- `state.research_digest` が未設定 → **Spec Writer サブエージェント** (`.claude/agents/spec-writer.md`) で補完。無ければ flow-init を案内
- `state.plan.milestones` が空 → **Planner サブエージェント** (`.claude/agents/planner.md`) で最初のマイルストーン生成。承認後に続行
- `acceptance_criteria` 未設定 → **Planner** により G/W/T を最小生成しテストへ反映

## 自動判定ルール（簡潔版）

- **Red → Green** : 直近の新規テストが失敗した直後
- **Green → Refactor** : 新規テストを含む全テストが成功した直後
- **Refactor 継続/終了** :
  - 整理が必要 かつ 全テスト成功 → Refactor 継続
  - 整理が不要 or 整理後も全テスト成功 → Red に戻る（新規テスト作成）

> `--phase` 指定があればそのフェーズを優先します。

## フェーズ別の処理（サブエージェント明記）

- **Red — Implementer サブエージェント使用**
  - 失敗する最小テストを追加
  - プロジェクト既定の **テストランナー** を実行し失敗を確認

- **Green — Implementer サブエージェント使用**
  - テストを通す最短実装を提示（**unified diff**）
  - **テストランナー** 成功を確認

- **Refactor — Reviewer サブエージェント使用**
  - 外部挙動を変えずに整理（命名・重複除去・分割）
  - 変更は **unified diff**、**テストランナー** 成功を維持

## Codex 連携（デフォルト）

- `codex review .` の所見を要約し、**Reviewer サブエージェント**の所見と比較
- Green/Refactor 後は `codex run tests` を再実行

## 内部実行（Orchestration）

- 各サイクルで **`tests-step`** を内部実行（Red→Green→Refactor を一括）
  - 例: `flow-next --no-codex` の場合は `tests-step --no-codex` に委譲
- サイクル末尾で **`codex-review`** を内部実行し、Reviewer と突き合わせ
- Codex が許可されている場合、必要に応じ **`codex-run --only tests`** を内部実行して整合確認
- 依存/環境の不整合を検知した場合のみ **`codex-sync`** を内部実行（自動修復は行わない）
- 仕様/公開API/設定の変更が検出された場合は **`doc-sync`** を内部実行（既定は提案モード、`--apply` は明示時のみ）
- ドキュメント乖離の検出には **Docs Guardian サブエージェント** を使用

## 引数

- `--cycles <N>` : 実行サイクル数（既定 1）
- `--phase <red|green|refactor>` : 自動判定の上書き
- `--max-diff <lines>` : 差分行数上限（既定 200）
- `--no-codex` : Codex 呼び出し抑止（**既定は Codex 連携**）

## 出力形式

```
【状態要約】
- Phase: ...
- Current Task: ...
- Executed Cycles: N/指定値
- Next Tasks(Top5): ...
- 直近ログ: ...

【提案差分（サイクルごとに要約）】
```diff
<unified diff>
```

【影響範囲】

- API/モジュール/性能/セキュリティ: ...

【ロールバック案】

- git apply -R ... / git checkout -- <files> ...

【テスト結果】

- テストランナー: 成功/失敗（要約）
- Codex: review/tests の要約と差異

【次アクション】

- 推奨 phase: ...
- 推奨コマンド: flow-next / flow-run

```

## 停止条件・安全策
- 差分が `--max-diff` 超過 → **中断** し「タスク分割」提案
- Red で失敗しない / Green で成功しない → **中断**（原因要約）
- 破壊的変更の兆候 → **中断** と明示同意要求
- **N回実行中でも** 上記に該当したら直ちに停止
