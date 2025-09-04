# タスク完了時のチェックリスト

## 実装完了後は必ず以下を実行

### 1. 型チェック
```bash
npm run type-check
```

### 2. Lint実行
```bash
npm run lint
```

### 3. テスト実行
```bash
npm run test
```

### 4. ビルド確認
```bash
npm run build
```

## Prisma変更時の追加確認
- スキーマ変更後は必ず `npx prisma generate` を実行
- マイグレーション作成: `npx prisma migrate dev`
- マイグレーションファイルをPRに含める

## パフォーマンス確認
- 1,000 Issueでのガント初回描画が1.5秒以内か確認
- ドラッグ操作の応答が100ms以内か確認
- Chrome DevToolsのPerformanceタブで計測

## PR提出前
- 変更内容のスクリーンショット添付（UI変更時）
- 動作確認手順を記載
- 影響範囲を明記
- Breaking Changeがある場合は明記