# ロールバック手順

## m2-nestjs-prisma-integration パッチのロールバック

### バックアップファイル
- `src/app.module.ts.backup` - 元のAppModule設定

### ロールバック手順

1. **AppModuleの復元**
```bash
cp src/app.module.ts.backup src/app.module.ts
```

2. **新規作成ファイルの削除**
```bash
rm src/database/database.module.ts
rm -rf src/health/
```

3. **main.tsの復元（必要に応じて）**
```bash
git checkout HEAD -- src/main.ts
```

### 復元後の確認
```bash
npm run start:dev
```

### 問題が発生したファイル
- `src/database/database.module.ts` - 新規作成
- `src/health/health.controller.ts` - 新規作成
- `src/app.module.ts` - 修正（バックアップあり）
- `src/main.ts` - 修正
- `test-integration.ts` - テスト用（削除可）
- `test-simple.js` - テスト用（削除可）