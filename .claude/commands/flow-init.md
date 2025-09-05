---
description: 仕様/計画から現在のフロー状態を初期化し、次アクションを抽出します。
allowed-tools: Read(**), Write(**), Grep(**)
---
Read .claude/flow/config.yaml and initialize .claude/flow/state.json from ${spec_path} and ${plan_path}.
Extract the first 5 actionable items (≤2h) as next_tasks and set phase to "plan".
Return a checklist and write it back to state.json.