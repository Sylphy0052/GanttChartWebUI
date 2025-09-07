# Project CRUD API 実装のロールバック手順

## 作成されたファイル（削除対象）

### プロジェクトモジュール
- `src/projects/projects.controller.ts`
- `src/projects/projects.service.ts`
- `src/projects/projects.module.ts`
- `src/projects/dto/create-project.dto.ts`
- `src/projects/dto/update-project.dto.ts`
- `src/projects/dto/project-response.dto.ts`
- `src/projects/dto/index.ts`
- `src/projects/` (ディレクトリ全体)

### 共通フィルター
- `src/common/filters/http-exception.filter.ts`
- `src/common/filters/` (ディレクトリ)
- `src/common/` (他に何もなければディレクトリ)

## 変更されたファイル（復元対象）

### パッケージ依存関係
```bash
npm uninstall class-validator class-transformer @nestjs/mapped-types
```

### src/app.module.ts
```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';

/**
 * AppModule - アプリケーションのルートモジュール
 * 
 * 統合後の構成:
 * - DatabaseModuleによるPrismaServiceのグローバル提供
 * - ヘルスチェックコントローラーによる監視エンドポイント
 * - 依存性注入の一元管理
 */
@Module({
  imports: [
    DatabaseModule, // グローバルデータベースモジュール
  ],
  controllers: [
    HealthController, // ヘルスチェックエンドポイント
  ],
  providers: [],
})
export class AppModule {}
```

### src/main.ts
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * アプリケーションのエントリーポイント
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS設定（開発環境用）
  if (process.env.NODE_ENV === 'development') {
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    });
  }

  // ポート設定
  const port = process.env.PORT || 3001;
  
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
```

## ロールバック実行コマンド

```bash
# 1. 新規作成ファイル・ディレクトリの削除
rm -rf src/projects/
rm -rf src/common/

# 2. パッケージのアンインストール
npm uninstall class-validator class-transformer @nestjs/mapped-types

# 3. 変更ファイルの復元
# app.module.ts と main.ts を上記の内容に戻す

# 4. アプリケーション再起動
npm run start:dev
```

## 確認手順

1. `GET /health` - ヘルスチェックが動作する
2. `GET /projects` - 404エラーが返される（元の状態）
3. アプリケーションが正常に起動する

## 注意事項

- データベースに作成されたプロジェクトデータは残るが、APIでアクセスできなくなる
- 物理的にプロジェクトデータを削除したい場合は別途SQLで削除
- package-lock.jsonも変更されているため、必要に応じて復元