---
allowed-tools: Bash(git:*), Bash(codex:*), Read(*.md), Fetch(*)
description: "初期化。docs/spec.md を読み、調査→計画→最初の Red テスト準備→state 作成までを自動実行します。Codex 連携はデフォルト。"
updated: "2025-09-10"
---

あなたは **初期化コマンド (flow-init)** です。引数が無ければ自動で情報源を探索し、TDD を開始できる最小セットを整えます。必要に応じて `--goal` などで上書きできます。

## デフォルト挙動（引数なし）

1. **情報源の発見**
   - `docs/spec.md`（必須・Claudeの基準）
   - `README.md` / `docs/` / `SPEC.md` / `PRD.md`
   - 直近の Issue/ToDo（`TODO.md` / `CHANGELOG.md` など）

2. **調査 (Research) — サブエージェント使用**
   - `.claude/agents/spec-writer.md` を用い、仕様・既存コード・外部APIの現状を把握
   - **出力**: `research_digest`（要点 / 未解決のオープンクエスチョン）

3. **計画 (Plan) — サブエージェント使用**
   - `.claude/agents/planner.md` を用い、**≤2h タスク**に分解し受入基準を整備（Given/When/Then）
   - **出力**: `plan.milestones[]`, `acceptance_criteria[]`, `risks[]`

4. **目的・制約の要約**
   - 目的 (Goal) / 非目的 (Non-Goals) / 制約（技術・運用・性能・セキュリティ）を抽出

5. **最初の Red テスト準備**
   - `tests/` が無ければ作成し、**失敗が保証される**最小テストの叩き台を提示
   - テスト実行は **プロジェクト既定のテストランナー** を前提（言語非依存）

6. **状態ファイルの生成**
   - `.claude/flow/state.json` を新規作成（既存があれば `.bak-YYYYMMDD-HHMMSS` を保存）
   - **初期値例**:

     ```json
     {
       "phase": "red",
       "goal": "<短い目的>",
       "research_digest": "<要点サマリ>",
       "plan": {
         "milestones": ["..."],
         "acceptance_criteria": ["Given/When/Then ..."],
         "risks": ["..."]
       },
       "current_task": "<First Task>",
       "next_tasks": ["..."]
     }
     ```

7. **Codex 連携（デフォルト）**
   - `codex review .` の要点を収集
   - `codex run tests` を呼び、テスト系の初期動作を確認（存在する場合）

## 任意引数

- `--goal "<text>"` : 目的テキストを直接指定（spec より優先）
- `--spec "<file>"` : 仕様ファイルを明示指定（既定: `docs/spec.md`）
- `--reset` : 既存 state を無視して再生成
- `--no-codex` : Codex 呼び出しを抑止（**デフォルトは Codex 連携**）

## 出力形式（人間が読みやすい要約）

【Research 要点】 …
【Plan 要点】 …
【受入基準 (G/W/T)】 …
【最初の Red テスト】 ファイル名 / 目的 / 実行結果（失敗の抜粋）
【state.json 要約】 phase / current_task / next_tasks / warnings

### 注意事項

- **サブエージェント（spec-writer / planner）** を必ず使用し、調査→計画を経てから Red を作成すること
- 初期化直後は常に **Red フェーズ** から開始
- state は人間が追える粒度で整形し、秘匿情報は含めないこと
