---
description: |
  [仕様書から初期化] docs/spec.mdを読み込み、開発タスクリストと状態ファイルを生成します。
argument_hint: "[--reset (任意)]"
notes: |
  バージョン: 1.0
  計画変換担当: @plan-converter
  状態管理: @state-manager
---

# 仕様書からのFlow初期化コマンド (init-from-spec)

このコマンドは、`docs/spec.md`を唯一の情報源として読み込み、AIが実行可能なタスクリスト（`.flow/tasks.md`）と、進捗を管理する状態ファイル（`.flow/state.json`）を自動生成します。
これは、大まかな指示から計画を立てる`/flow-init`とは異なり、**完成した仕様書から忠実に**計画を立てる場合に使用します。

## 使用例

```bash
# docs/spec.md を基にプロジェクトを初期化

/init-from-spec
```

---

## 実行フロー

### ステップ1: 事前チェック

- **`docs/spec.md`の存在確認:**
  - **もし`docs/spec.md`が存在しない場合:**
    処理を**中断**し、「エラー: 仕様書 `docs/spec.md` が見つかりません。先に `/spec-writer` コマンドで仕様書を作成してください。」と報告してください。

### ステップ2: 開発計画の変換 (by @plan-converter)

**進捗報告:**
「`docs/spec.md`を解析し、開発計画に変換します...」

`@plan-converter` エージェントを呼び出し、`docs/spec.md`を`.flow/tasks.md`に変換させます。

### ステップ3: 状態ファイルの初期化 (by @state-manager)

**進捗報告:**
「プロジェクトの状態を初期化します...」

`@state-manager` を呼び出し、状態ファイル `.flow/state.json` を初期状態 (`{ "phase": "red" }`) で作成させます。

### ステップ4: 最終報告

全ての初期化プロセスが完了したことを報告し、最後に `@state-manager` を呼び出して、生成されたばかりのプロジェクトの初期状態を表示してください。
