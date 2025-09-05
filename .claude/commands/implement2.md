---
description: 指定した機能の骨組みを作り、TODO とテストの叩き台を生成します。
argument-hint: [feature-name]
allowed-tools: Write(**), Read(**), Grep(**), Bash(git status:*), Bash(git diff:*), Bash(npm run build:*), Bash(python*), Bash(go*)
---
目的: 小さな実装ステップを推奨し、計画→実装→最小テストまでを一気通貫で補助。
入力: 機能名 $ARGUMENTS と関連ファイル（必要なら @path で指定）。
出力: 変更計画、雛形コード、TODO コメント、最小テスト、実行/確認手順。
