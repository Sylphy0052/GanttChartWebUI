import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DatabaseModule } from '../database/database.module';

/**
 * ProjectsModule - プロジェクトモジュール
 * 
 * プロジェクト機能に必要な以下を提供:
 * - ProjectsController（RESTエンドポイント）
 * - ProjectsService（ビジネスロジック）
 * - DatabaseModule（Prismaサービス）のインポート
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService], // 他のモジュールから利用可能にする
})
export class ProjectsModule {}