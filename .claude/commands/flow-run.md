---
allowed-tools: Bash(git:*), Bash(codex:*), Read(*.md), Fetch(*)
description: "指定した1マイルストーン、または1フェーズをまとめて進め、最後に総合テスト・レビュー・承認を行います。Codex 連携はデフォルト。"
updated: "2025-09-10"
---

あなたは **統合コマンド (flow-run)** です。**1マイルストーン**または**1フェーズ**をまとめて進め、その後に総合テスト・レビュー・人間承認を行います。

## 実行モード（いずれか必須）

- `--milestone "<name|index|current>"` : 指定マイルストーンが **完了条件** を満たすまで `flow-next` を繰り返す
- `--phase <red|green|refactor>` : 指定フェーズを **完了条件** まで繰り返す

> 未指定時は **`--milestone current`** を既定。

## 繰り返し制御

- 内部で `flow-next --cycles 1` を **必要回数** 呼び出し、state を逐次更新
- セーフティ上限 `--max-steps <M>`（既定: 10）を超えると停止

## 内部実行（Orchestration）

- 反復中の **各ステップ**で `flow-next --cycles 1` を内部実行（その内部で `tests-step` / `codex-review` が呼ばれる）
- 反復終了後に **`codex-run`**（`tests/coverage/lint/typecheck`）を内部実行して総合結果を取得
- 比較レポートは **`codex-bridge`** を内部実行して生成（Codex vs Reviewer の差異・解消方針）
- ドキュメント整合が必要な場合は **Doc Writer サブエージェント** を内部実行（README/CHANGELOG など）
- 公開API/設定/依存に影響する変更がある場合、**`doc-sync`** を実行しドキュメント整合を確保
- `doc-sync` 内で **Docs Guardian** による乖離検出を必ず実施

## 手順

1. **対象の決定**
   - `--milestone` or `--phase` を解析し、ゴール条件を確定

2. **まとめ実行（flow-next 反復）**
   - 上記の繰り返し制御に従い `flow-next` を連続実行
   - 途中で停止条件に当たれば中断して要約・原因・推奨を出す

3. **総合テスト（Codex 連携・デフォルト）**
   - `codex run tests`
   - `codex run coverage`
   - `codex run lint`
   - `codex run typecheck`

4. **レビュー統合**
   - **Reviewer サブエージェント** と **Codex** の所見を突き合わせ、差異を整理
   - 必要に応じて **Doc Writer サブエージェント** を呼び、README/CHANGELOG/docs を更新提案

5. **人間承認 → 適用**
   - 主要差分を unified diff で提示
   - 「適用しますか？ (Yes/No)」を必ず確認
   - Yes → 統合 & `CHANGELOG.md` 追記 & リリースノート案生成
   - No → 変更破棄（ロールバック案提示）

## 引数

- `--milestone "<name|index|current>"` : マイルストーン単位の実行
- `--phase <red|green|refactor>` : フェーズ単位の実行
- `--max-steps <M>` : 内部で呼ぶ `flow-next` の最大回数（既定 10）
- `--no-bridge` : `codex-bridge` を省略
- `--no-codex` : Codex 呼び出し抑止（**既定は Codex 連携**）
- `--dry-run` : 適用せずに結果のみ

## 出力形式

【実行サマリ】

- mode: milestone|phase
- target: <milestone name|index|phase>
- executed_steps: K / max-steps
- stop_reason: <completed|safety-limit|error|user-stop>

【差分要約（主要変更の抜粋）】

```diff
<unified diff>
```

【総合テスト結果】

- tests / coverage / lint / typecheck 要約

【レビュー要約】

- Reviewer サブエージェントの所見
- Codex の所見
- 差異と統合見解

【承認確認】

- 適用しますか？ (Yes/No)

【リリースノート案】

- 機能追加: ...
- 修正: ...
- 注意事項: ...

### 安全策

- `--max-steps` 超過 → 停止して要約提示
- 大規模差分を検知 → 停止して「分割提案」
- 破壊的変更の兆候 → 停止して明示同意要求
