---
description: 2時間以下のタスクに分割し、state.next_tasks を更新します。
argument-hint: [task-title]
allowed-tools: Read(**), Write(**), Grep(**)
---
If "$ARGUMENTS" is empty, load plan_path and the nearest milestone to today, then generate a small checklist.
Use the planner subagent and append items to .claude/flow/state.json.next_tasks.