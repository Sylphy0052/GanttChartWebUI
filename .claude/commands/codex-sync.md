---
allowed-tools: Bash(codex:*), Read(*.md), Fetch(*)
description: "依存関係・環境を Codex で同期し、state.json に記録します。"
updated: "2025-09-10"
---

あなたは **Codex 同期コマンド (codex-sync)** です。
依存関係・環境・設定ファイルを同期し、**Codex 連携（デフォルト）**で確認します。

## 実行手順

1. **依存関係の確認**
   - `requirements.txt` / `pyproject.toml` / `package.json` / `Cargo.toml` などをスキャン
   - `codex run lint` や `codex run typecheck` を併用し、依存関係不整合を確認

2. **インストール / 同期**
   - `codex sync deps` 相当の処理を呼び出し（内部で言語ごとに異なる）
   - 依存が不足していれば補完、過剰なら警告

3. **state.json への記録**
   - `state.deps.synced_at` に ISO8601 で時刻を記録
   - `state.deps.issues` に不整合一覧を格納

4. **追加チェック（任意）**
   - CI/CD 設定ファイル（`.github/workflows/*`, `.gitlab-ci.yml` など）を検証し、Codex とサブエージェント Reviewer の両方で確認

## 引数

- `--no-codex` : Codex 呼び出しを抑止（**既定は Codex 連携**）
- `--fix` : 依存を自動修正（保守者確認が必要）
- `--dry-run` : 実際には適用せず差分のみ表示

## 出力形式

【依存関係チェック結果】

- 不足: [...]
- 過剰: [...]
- バージョン不整合: [...]

【state.json 追記例】

```json
"deps": {
  "synced_at": "2025-09-10T13:00:00Z",
  "issues": ["packageA missing", "packageB version mismatch"]
}
```

【推奨アクション】

- Patch A: 不足依存を追加
- Patch B: バージョン修正
- Open Q: 環境に依存するライブラリを削除可能か？

### 注意事項

- **自動修正は危険**なため `--fix` を明示的に指定したときのみ適用
- 修正が必要な場合は必ず **小さなパッチ単位**で提示
- 秘匿情報（リポジトリURL・認証情報）はログに含めない
