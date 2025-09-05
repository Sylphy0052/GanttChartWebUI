---
description: テスト環境を初期化（jest/pytest など）し、サンプルを生成します。
argument-hint: [node|python|go]
allowed-tools: Bash(npm install:*), Bash(npx:*), Bash(pip*), Bash(python*), Bash(go*), Write(**), Read(**)
---
対象スタック: $1 によって分岐（node/python/go）。

- Node: jest + ts-jest + @types/jest のセットアップ、`npm run test` 追加
- Python: pytest + coverage 設定、`pytest.ini`/`pyproject.toml` 更新
- Go: `go test` ベースの雛形
生成物: サンプルテスト、CI 例（.github/workflows/test.yml の提案）
