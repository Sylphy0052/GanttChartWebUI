---
description: 状態を見て“次にやるべき1手”を自動選択し、適切なサブエージェントで実行します。
allowed-tools: Read(**), Write(**), Grep(**), Bash(git branch:*), Bash(git diff:*), Bash(git status:*)
---
Behavior (no arguments):
1) Load .claude/flow/state.json. If current_task is null, pop one from next_tasks.
2) Decide phase by current_task kind: plan/spec/scaffold/implement/review/test/perf/docs/release.
3) Invoke the right subagent inline:
- plan → Use the planner subagent to slice and update state.
- spec → Use the spec-writer subagent to reconcile PRD.
- scaffold → Use the scaffolder subagent to create minimal scaffolds, show diffs first.
- implement → Use the implementer subagent to apply the smallest patch with tests and rollback.
- review → Use the reviewer subagent to review diffs with minimal fix.
- test → Use the qa subagent to generate/strengthen tests.
- perf → Use the perf-analyst subagent to profile and propose improvements.
- docs → Use the doc-smith subagent to sync docs.
- release → Use the release-manager subagent to draft checklist or notes.
4) Update state.log and clear current_task when done.