---
description: 初期ドキュメント雛形を生成し、CLAUDE.md に基本方針を追記します。
argument-hint: [project-name]
allowed-tools: Bash(mkdir:*), Bash(touch:*), Bash(echo:*), Write(**), Read(**)
---
目的: 新規/既存プロジェクトの初期文書整備。$1 が空なら既存名を推測。

出力/編集方針:

- README.md を生成/更新（目的・セットアップ・実行方法・テスト）
- CONTRIBUTING.md に開発ポリシーを雛形追加
- CLAUDE.md にコーディング規約/レビュー観点/禁止事項を追記
- docs/ ディレクトリが無ければ作成

作業手順:

1) プロジェクト名を $1 として採用（無ければ package.json や pyproject.toml から推測）
2) 必要ファイルを安全に新規作成（既存は追記。破壊的変更は提案→確認）
3) 差分を提示し、人間承認を待ってから確定
