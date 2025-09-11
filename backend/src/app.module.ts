import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { IssuesModule } from './issues/issues.module';
import { CommentsModule } from './comments/comments.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { ChangeLogModule } from './changelog/changelog.module';
import { SettingsModule } from './settings/settings.module';
import { WebSocketModule } from './websocket/websocket.module';
import { BackupModule } from './backup/backup.module';
import { UploadsModule } from './uploads/uploads.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { HealthController } from './health/health.controller';
import { AuthMiddleware } from './auth/auth.middleware';

/**
 * AppModule - アプリケーションのルートモジュール（監視機能統合版）
 * 
 * 統合後の構成:
 * - DatabaseModuleによるPrismaServiceのグローバル提供
 * - ProjectsModuleによるプロジェクトCRUD API
 * - IssuesModuleによるIssue管理API
 * - CommentsModuleによるComment管理API
 * - DependenciesModuleによる依存関係管理API
 * - ChangeLogModuleによる変更履歴管理機能
 * - SettingsModuleによるグローバル設定API（休日設定など）
 * - WebSocketModuleによるリアルタイム通知機能
 * - BackupModuleによるプロジェクトエクスポート機能
 * - UploadsModuleによる画像アップロード機能
 * - MonitoringModuleによる監視・メトリクス機能（新規追加）
 * - ヘルスチェックコントローラーによる監視エンドポイント
 * - AuthMiddlewareによる認証・権限管理
 * - 依存性注入の一元管理
 * 
 * 監視機能:
 * - Prometheusメトリクス収集・公開
 * - 詳細ヘルスチェック（アプリケーション・DB・システム・FS・パフォーマンス）
 * - HTTPリクエスト・レスポンス時間監視
 * - WebSocket接続・メッセージ監視
 * - カスタムビジネスメトリクス（プロジェクト数・Issue数・依存関係数）
 */
@Module({
  imports: [
    DatabaseModule,      // グローバルデータベースモジュール
    ProjectsModule,      // プロジェクトCRUD API
    IssuesModule,        // Issue管理API
    CommentsModule,      // Comment管理API
    DependenciesModule,  // 依存関係管理API
    ChangeLogModule,     // 変更履歴管理機能
    SettingsModule,      // グローバル設定API（休日設定）
    WebSocketModule,     // WebSocket通知機能
    BackupModule,        // プロジェクトエクスポート機能
    UploadsModule,       // 画像アップロード機能
    MonitoringModule,    // 監視・メトリクス機能（新規追加）
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
    // AuthMiddleware を全てのルートに適用（health・metricsエンドポイントを除く）
    consumer
      .apply(AuthMiddleware)
      .exclude('/health', '/health/detailed', '/metrics', '/metrics/stats') // 監視エンドポイントは認証不要
      .forRoutes('*'); // その他すべてのルートに適用
  }
}