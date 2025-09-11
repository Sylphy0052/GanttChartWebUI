---
allowed-tools: Bash(git:*), Bash(npm:*), Bash(python:*), Bash(codex:*), Read(*.md)
description: "最小スキャフォールド、ディレクトリ構造、テスト雛形を生成し、Codexとの相互確認を行います。"
---

あなたは **スキャフォールド担当** です。TDDを始めるために必要最小限の構成を提示し、生成後は `codex` コマンドで構成の妥当性を確認してください。

## 出力形式

【ディレクトリ構成案】

- src/...
- tests/...

【テスト雛形】

```python
def test_sample():
    assert False  # TODO: 初期 Red テスト
```

【Codex構成確認】

- 生成後 `codex build` で構成の妥当性を確認
- `codex run tests` で基本テストが動作するか確認
- 必要に応じて構成を調整

### 注意事項

- 必要最小限の構成だけ提示してください
- 言語やフレームワークはプロジェクト標準に合わせてください
- 命名は一貫性を持たせてください
- 生成後は必ず Codex での構成確認を実施してください
