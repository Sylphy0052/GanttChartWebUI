import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { IssuesModule } from './issues/issues.module';
import { CommentsModule } from './comments/comments.module';
import { ChangeLogModule } from './changelog/changelog.module';
import { SettingsModule } from './settings/settings.module';
import { WebSocketModule } from './websocket/websocket.module';
import { BackupModule } from './backup/backup.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthController } from './health/health.controller';
import { AuthMiddleware } from './auth/auth.middleware';

/**
 * AppModule - アプリケーションのルートモジュール（画像アップロード機能統合版）
 * 
 * 統合後の構成:
 * - DatabaseModuleによるPrismaServiceのグローバル提供
 * - ProjectsModuleによるプロジェクトCRUD API
 * - IssuesModuleによるIssue管理API
 * - CommentsModuleによるComment管理API
 * - ChangeLogModuleによる変更履歴管理機能
 * - SettingsModuleによるグローバル設定API（休日設定など）
 * - WebSocketModuleによるリアルタイム通知機能
 * - BackupModuleによるプロジェクトエクスポート機能
 * - UploadsModuleによる画像アップロード機能
 * - ヘルスチェックコントローラーによる監視エンドポイント
 * - AuthMiddlewareによる認証・権限管理
 * - 依存性注入の一元管理
 * 
 * 新機能:
 * - Issue CRUD API（プロジェクトスコープ）
 * - Comment CRUD API（Issue紐付け）
 * - ChangeLog Service（Issue・Comment変更履歴記録）
 * - 画像アップロード API（Issue紐付け、サムネイル対応）
 * - Editor権限による制御
 * - 削除済みデータの除外処理
 */
@Module({
  imports: [
    DatabaseModule,   // グローバルデータベースモジュール
    ProjectsModule,   // プロジェクトCRUD API
    IssuesModule,     // Issue管理API
    CommentsModule,   // Comment管理API
    ChangeLogModule,  // 変更履歴管理機能
    SettingsModule,   // グローバル設定API（休日設定）
    WebSocketModule,  // WebSocket通知機能
    BackupModule,     // プロジェクトエクスポート機能
    UploadsModule,    // 画像アップロード機能
  ],
  controllers: [
    HealthController, // ヘルスチェックエンドポイント
  ],
  providers: [],
})
export class AppModule implements NestModule {
  /**
   * ミドルウェア設定
   * @param consumer ミドルウェアコンシューマー
   */
  configure(consumer: MiddlewareConsumer): void {
    // AuthMiddleware を全てのルートに適用（healthエンドポイントを除く）
    consumer
      .apply(AuthMiddleware)
      .exclude('/health') // ヘルスチェックは認証不要
      .forRoutes('*'); // その他すべてのルートに適用
  }
}