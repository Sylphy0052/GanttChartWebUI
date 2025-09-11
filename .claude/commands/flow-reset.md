---
allowed-tools: Bash(git:*), Read(*.md), Fetch(*)
description: "ワークツリーと state を安全に巻き戻します。未コミット変更は退避し、必要なら直前のバックアップへ復元します。"
updated: "2025-09-10"
---

あなたは **リセットコマンド (flow-reset)** です。`flow-next` / `flow-run` 実行途中の不整合や失敗時に、作業ディレクトリと `.claude/flow/state.json` を**安全に**元へ戻します。

## 手順

1. **事前確認**
   - 現在のブランチ、未コミットファイル、直近の state を確認
   - 大きな差分がある場合は停止して要約提示

2. **退避（バックアップ）**
   - 未コミット変更を `./.claude/backups/<timestamp>/worktree.patch` として保存
   - `.claude/flow/state.json` を `state.json.bak-<timestamp>` として保存

3. **復元**
   - 既定は **直前の state バックアップ** を復元
   - `--from <path>` 指定があればその state を復元
   - ワークツリーは `git restore --staged --worktree .`（または同等）でクリーンに

4. **検証**
   - `flow-status` を自動実行し、phase / current_task / next_tasks を表示
   - 差分が残っていないかを確認し、必要なら再度退避→復元

## 引数

- `--hard` : 退避後に **強制的に**作業ツリーをクリーンにする（ローカル変更を復元対象から除外）
- `--from <path>` : 指定した state バックアップ（`state.json.bak-*`）から復元
- `--keep-worktree` : ワークツリーは変更せず、**state のみ**復元
- `--confirm` : 事前確認のプロンプトなしに実行（CI等の自動化向け）

> 注: **Codex 連携は行いません**（安全性優先）。必要に応じて復元後に `codex review .` を手動で実行してください。

## 出力形式

【実行サマリ】

- action: backup-and-restore / restore-only / noop
- state_restore_from: <path or latest>
- worktree_backup: <path or none>
- warnings: [...]

【flow-status（復元後）】

- phase / current_task / next_tasks
- last_diff（あれば要約）
- updated_at

## 停止条件・安全策

- 未コミット変更が巨大（しきい値超過）→ 停止して「まずコミット or 手動退避」を促す
- バックアップ作成に失敗 → 停止（理由を明示）
- 指定した `--from` が無効 → 停止（利用可能な一覧を提示）

### 注意事項

- リセットは**破壊的操作**になり得ます。バックアップが取れない場合は実行しないでください。
- 復元後は必ず `flow-status` で状態を確認してください。
