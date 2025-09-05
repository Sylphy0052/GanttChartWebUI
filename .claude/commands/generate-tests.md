---
description: 指定モジュールの単体テスト雛形を生成し、境界ケースを列挙します。
argument-hint: [path-or-glob]
allowed-tools: Read(**), Write(**), Grep(**)
---
出力: 代表入力/境界値/エラーパスを列挙。既存テストを尊重し重複回避。スナップショットは乱用しない方針。

Use the qa subagent to create unit test scaffolds for "$ARGUMENTS".
List boundary cases and failure paths; avoid snapshot overuse.
