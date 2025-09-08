import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { DatabaseModule } from '../database/database.module';
import { ChangeLogModule } from '../changelog/changelog.module';
import { WebSocketModule } from '../websocket/websocket.module';

/**
 * CommentsModule - Commentモジュール（ChangeLog・WebSocket統合版）
 * 
 * Comment機能に必要な以下を提供:
 * - CommentsService（ビジネスロジック）
 * - CommentsController（REST API エンドポイント）
 * - DatabaseModule（Prismaサービス）のインポート
 * - ChangeLogModule（変更履歴記録）のインポート
 * - WebSocketModule（リアルタイム通知）のインポート
 * 
 * エンドポイント:
 * - GET /issues/:issueId/comments - コメント一覧取得
 * - POST /issues/:issueId/comments - コメント作成
 * - PUT /comments/:id - コメント編集
 * - DELETE /comments/:id - コメント削除
 */
@Module({
  imports: [
    DatabaseModule,     // Prismaサービス
    ChangeLogModule,    // 変更履歴記録サービス
    WebSocketModule,    // WebSocket通知サービス
  ],
  providers: [CommentsService],
  controllers: [CommentsController],
  exports: [CommentsService], // 他のモジュールから利用可能にする
})
export class CommentsModule {}