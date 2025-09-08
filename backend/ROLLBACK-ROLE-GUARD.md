# RoleGuard実装のロールバック手順

## 概要
m3-role-guard タスクで実装した権限管理（Viewer/Editor）機能のロールバック手順

## 実装ファイル

### 新規作成ファイル（削除対象）
```bash
# RoleGuard本体
rm src/common/guards/role.guard.ts

# カスタムデコレーター
rm src/common/decorators/require-role.decorator.ts

# テストファイル（任意削除）
rm test-role-guard.js
rm test-role-guard-3006.js
rm test-role-guard-fixed.js
rm test-role-guard-unit.js
```

### 変更ファイル（復元対象）

#### 1. src/app.module.ts
```bash
# 元の状態に復元
git checkout HEAD~1 -- src/app.module.ts
```

または手動で以下に復元：
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    DatabaseModule,
    ProjectsModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [],
})
export class AppModule {}
```

#### 2. src/projects/projects.controller.ts
```bash
# 元の状態に復元
git checkout HEAD~1 -- src/projects/projects.controller.ts
```

または手動で以下のimport文とデコレーターを削除：
- `UseGuards` import
- `import { RoleGuard } from '../common/guards/role.guard';`
- `import { RequireRole } from '../common/decorators/require-role.decorator';`
- `@UseGuards(RoleGuard)` デコレーター
- 各メソッドの `@RequireRole('viewer')` / `@RequireRole('editor')` デコレーター

## ロールバック実行

```bash
# 1. 新規ファイル削除
rm src/common/guards/role.guard.ts
rm src/common/decorators/require-role.decorator.ts

# 2. 変更ファイル復元
git checkout HEAD~1 -- src/app.module.ts src/projects/projects.controller.ts

# 3. ビルド確認
npm run build

# 4. テスト実行（任意）
npm test
```

## 確認事項

### ロールバック後の動作
1. 全てのAPIが認証なしでアクセス可能になる
2. POST/PATCH/DELETE系APIが権限制御なしで実行される
3. RoleGuardが無効化される
4. @RequireRoleデコレーターが無効化される

### 確認コマンド
```bash
# ビルド成功確認
npm run build

# サーバー起動確認
npm run start:dev

# API動作確認
curl http://localhost:3001/projects
curl -X POST http://localhost:3001/projects -H "Content-Type: application/json" -d '{"name":"test"}'
```

## 影響範囲
- ✅ 権限管理機能が完全に削除される
- ✅ 既存のプロジェクトCRUD機能は影響なし
- ✅ データベース構造は変更なし
- ✅ 認証ミドルウェア（AuthMiddleware）は無効化される

## 注意事項
- ロールバック実行前にデータベースの状態を確認
- 実行中のサーバーを再起動してミドルウェア変更を反映
- テストデータが蓄積されている場合は必要に応じてクリーンアップ