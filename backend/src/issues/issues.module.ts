import { Module, forwardRef } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { DatabaseModule } from '../database/database.module';
import { ChangeLogModule } from '../changelog/changelog.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WebSocketModule } from '../websocket/websocket.module';

/**
 * IssuesModule - Issueモジュール（ChangeLog・Uploads・WebSocket統合版）
 * 
 * Issue機能に必要な以下を提供:
 * - IssuesController（REST APIエンドポイント）
 * - IssuesService（ビジネスロジック）
 * - DatabaseModule（Prismaサービス）のインポート
 * - ChangeLogModule（変更履歴記録）のインポート
 * - UploadsModule（画像管理）のインポート（forwardRef使用で循環依存回避）
 * - WebSocketModule（リアルタイム通知）のインポート
 */
@Module({
  imports: [
    DatabaseModule,                    // Prismaサービス
    ChangeLogModule,                  // 変更履歴記録サービス
    forwardRef(() => UploadsModule),  // 画像管理サービス（循環依存回避）
    WebSocketModule,                  // WebSocket通知サービス
  ],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService], // 他のモジュールから利用可能にする
})
export class IssuesModule {}