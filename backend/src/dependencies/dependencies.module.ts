import { Module, forwardRef } from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { DependenciesController } from './dependencies.controller';
import { DatabaseModule } from '../database/database.module';
import { ChangeLogModule } from '../changelog/changelog.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { SettingsModule } from '../settings/settings.module';
import { IssuesModule } from '../issues/issues.module';

/**
 * DependenciesModule - 依存関係モジュール（日程調整機能統合版）
 * 
 * 依存関係機能に必要な以下を提供:
 * - DependenciesController（REST APIエンドポイント）
 * - DependenciesService（ビジネスロジック・日程調整）
 * - DatabaseModule（Prismaサービス）のインポート
 * - ChangeLogModule（変更履歴記録）のインポート
 * - WebSocketModule（リアルタイム通知）のインポート
 * - SettingsModule（グローバル設定・休日管理）のインポート
 * - IssuesModule（Issue情報取得）のインポート（forwardRef使用で循環依存回避）
 */
@Module({
  imports: [
    DatabaseModule,                     // Prismaサービス
    ChangeLogModule,                   // 変更履歴記録サービス
    WebSocketModule,                   // WebSocket通知サービス
    SettingsModule,                    // グローバル設定（休日設定）サービス
    forwardRef(() => IssuesModule),    // Issue情報取得（循環依存回避）
  ],
  controllers: [DependenciesController],
  providers: [DependenciesService],
  exports: [DependenciesService], // 他のモジュールから利用可能にする
})
export class DependenciesModule {}