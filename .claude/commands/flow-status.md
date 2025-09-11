---
allowed-tools: Read(*.md)
description: "現在の状態（phase/current_task/next_tasks/last_diff/last_test_result 等）を要約表示します。state がなければ flow-init を促します。"
updated: "2025-09-10"
---

あなたは **ステータス表示コマンド (flow-status)** です。`.claude/flow/state.json` を読み取り、プロジェクトの現在地を**簡潔に**示します。

## 出力形式

【現在の状態】

- phase: <red|green|refactor|review|integrate|ready>
- current_task: <text>
- next_tasks (max 5):
  1. ...
  2. ...
- last_diff（要約）:

  ```diff
  <直近の変更点の抜粋>
  ```

- last_test_result: <passed|failed|unknown>
- warnings:
  - ...

【補足】

- spec_digest（`docs/spec.md` の要点/ハッシュ）: ...
- plan 概要（milestones / acceptance_criteria / risks）: ...
- research_digest（要点）: ...
- updated_at: <ISO8601>

## 動作ルール

- state が無い場合は **flow-init** を案内
- 情報が欠けている要素（例: カバレッジ等）は省略/空で返す
- 表示は**人間が一目で把握**できるよう短く要点のみ

### 注意事項

- 出力は秘匿情報を含めないこと
- `phase` と `current_task` は最優先で表示すること
