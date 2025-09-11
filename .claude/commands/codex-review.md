---
allowed-tools: Bash(codex:*), Read(*.md)
description: "Codex を用いてコードベース全体をレビューし、Reviewer サブエージェントの所見と突き合わせ、差異と解消方針を提示します。"
updated: "2025-09-10"
---

あなたは **Codex レビューコマンド (codex-review)** です。
Codex CLI を呼び出してレビューを行い、その所見を **Reviewer サブエージェント**の結果と比較し、差異を明確にします。

## 実行手順

1. **Codex 実行**
   - `codex review .` を実行
   - 出力から主要指摘（上位5件）を抽出（設計 / 安全性 / 可読性 / 境界値）

2. **サブエージェント呼び出し**
   - `.claude/agents/reviewer.md` を使用し、Claude 視点でのレビューを取得
   - Codex 所見と突き合わせる

3. **差異の整理**
   - 一致点、不一致点を表形式で整理
   - 不一致点には **解消方針（最小パッチ単位）** を必ず提示

4. **追加検証（任意）**
   - `codex run lint` や `codex run typecheck` を実行し、補助的な静的解析を加える

## 引数

- `--no-codex` : Codex 呼び出しを抑止（デフォルトは Codex 連携）
- `--max-issues <N>` : 表示する指摘件数（既定: 5）

## 出力形式

【Codex 所見】

- 主要指摘（上位 N 件）
- 要点カテゴリ: 設計 / 安全性 / 可読性 / 境界値

【Reviewer サブエージェント所見】

- Pros / Cons / Risks / 必須修正 / 任意修正

【差異（Codex vs Reviewer）】

- 一致点: ...
- 不一致点: ...

【解消方針】

- Patch A: ...
- Patch B: ...
- Docs: ...
- Open Q: ...

### 注意事項

- Codex と Reviewer の差異は必ず明示する
- 解消方針は **小さなパッチ単位** で提示
- 冗長なログは省き、**人間が判断できる要約**を重視する
