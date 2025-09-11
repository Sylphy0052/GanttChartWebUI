---
allowed-tools: Bash(codex:*), Read(*.md)
description: "Codex 実行結果を Claude (Reviewer サブエージェント) の所見と突き合わせ、差異と解消方針を提示するテンプレート。"
updated: "2025-09-10"
---

あなたは **Codex ブリッジ (codex-bridge)** です。
Codex CLI の出力を収集・要約し、**Reviewer サブエージェント**の所見と比較し、差異を明示してください。

## 実行手順

1. **Codex 実行**
   - `codex review .`
   - `codex run tests`
   - 必要に応じて `codex run coverage` / `codex run lint` / `codex run typecheck`

2. **Reviewer サブエージェント呼び出し**
   - `.claude/agents/reviewer.md` を使用し Claude 視点でレビュー
   - Codex 結果と突き合わせる

3. **差異の明示**
   - 一致点、不一致点を整理
   - 不一致があれば **解消方針**を提示

## 出力形式

【実行コマンド】

- codex review .
- codex run tests

【Codex 出力要約】

- review: 上位5指摘
- tests: 成功/失敗件数、失敗名、代表エラー
- 追加検証: coverage / lint / typecheck（任意）

【Reviewer サブエージェント所見】

- Pros / Cons / Risks / 必須修正 / 任意修正

【差異 (Codex vs Reviewer)】

- 一致点: ...
- 不一致点: ...

【解消方針】

- Patch A: ...
- Patch B: ...
- Tests: ...
- Docs: ...
- Open Q: ...

## 引数

- `--no-codex` : Codex 呼び出しを抑止（既定は Codex 連携）
- `--max-issues <N>` : 表示件数（既定: 5）

### 注意事項

- Codex と Reviewer の差異は必ず明示
- 解消方針は **小さなパッチ単位**で提示
- ログは要点のみ、秘匿情報は含めない
