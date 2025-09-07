import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { HealthController } from './health/health.controller';

/**
 * AppModule - アプリケーションのルートモジュール
 * 
 * 統合後の構成:
 * - DatabaseModuleによるPrismaServiceのグローバル提供
 * - ProjectsModuleによるプロジェクトCRUD API
 * - ヘルスチェックコントローラーによる監視エンドポイント
 * - 依存性注入の一元管理
 */
@Module({
  imports: [
    DatabaseModule, // グローバルデータベースモジュール
    ProjectsModule, // プロジェクトCRUD API
  ],
  controllers: [
    HealthController, // ヘルスチェックエンドポイント
  ],
  providers: [],
})
export class AppModule {}