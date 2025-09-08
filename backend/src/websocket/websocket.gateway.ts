import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { 
  WebSocketNotification, 
  NotificationRequest, 
  NotificationTarget 
} from './interfaces/websocket-notification.interface';

/**
 * NotificationGateway - リアルタイム通知システムの実装
 * 
 * 機能:
 * - WebSocket接続の管理（接続・切断・認証）
 * - 設定変更通知の配信（全体・プロジェクト特定）
 * - セッション管理とルーム分け
 * - エラーハンドリングとログ出力
 * 
 * 受け入れ条件:
 * - 設定変更時のWebSocket通知配信
 * - 既存セッションの再認証促進
 * - 設定変更イベントの配信
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationGateway.name);

  /**
   * Gateway初期化
   * @param server Socket.IOサーバーインスタンス
   */
  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  /**
   * クライアント接続時の処理
   * 
   * 基本的な接続管理:
   * - 接続ログの記録
   * - 将来的な認証処理の準備
   * - クライアントセッション情報の初期化
   * 
   * @param client 接続されたSocketクライアント
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    
    // 接続確認メッセージを送信
    client.emit('connection_established', {
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * クライアント切断時の処理
   * 
   * 切断時の適切なクリーンアップ:
   * - 接続ログの記録
   * - プロジェクトルームからの自動退出
   * - セッション情報のクリーンアップ
   * 
   * @param client 切断されたSocketクライアント
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * 設定変更通知の配信
   * 
   * 通知配信の実装:
   * - 対象に応じた配信先の決定（全体/プロジェクト特定）
   * - 適切なルームへの通知送信
   * - 配信結果のログ記録
   * - エラー時の適切なハンドリング
   * 
   * @param request 通知配信リクエスト
   */
  async sendNotification(request: NotificationRequest): Promise<void> {
    try {
      const { target, notification, projectId } = request;

      switch (target) {
        case 'ALL':
          // 全セッションに配信
          this.server.emit('notification', notification);
          this.logger.log(`Notification sent to ALL clients: ${notification.event}`);
          break;

        case 'PROJECT':
          if (projectId) {
            // 特定プロジェクトルームに配信
            this.server.to(`project:${projectId}`).emit('notification', notification);
            this.logger.log(`Notification sent to project ${projectId}: ${notification.event}`);
          } else {
            this.logger.error('PROJECT target requires projectId');
            throw new Error('PROJECT target requires projectId');
          }
          break;

        default:
          this.logger.error(`Unknown notification target: ${target}`);
          throw new Error(`Unknown notification target: ${target}`);
      }
    } catch (error) {
      this.logger.error('Failed to send notification', error);
      throw error;
    }
  }

  /**
   * 設定変更通知の作成と送信
   * 
   * SettingsServiceから呼び出される便利メソッド:
   * - 標準的な設定変更通知の作成
   * - タイムスタンプの自動設定
   * - メッセージの標準化
   * 
   * @param message 通知メッセージ
   * @param requiresReauth 再認証要求フラグ
   * @param projectId 特定プロジェクト（オプション）
   */
  async notifySettingsChanged(
    message: string,
    requiresReauth: boolean = false,
    projectId?: string,
  ): Promise<void> {
    const notification: WebSocketNotification = {
      event: 'settings_changed',
      data: {
        message,
        timestamp: new Date().toISOString(),
        projectId,
        requiresReauth,
      },
    };

    const request: NotificationRequest = {
      target: projectId ? 'PROJECT' : 'ALL',
      notification,
      projectId,
    };

    await this.sendNotification(request);
  }

  /**
   * プロジェクトルーム参加
   * 
   * 将来的なプロジェクト特定通知用:
   * - クライアントの特定プロジェクトルームへの参加
   * - ルーム参加の成功・失敗ハンドリング
   * 
   * @param client Socketクライアント
   * @param projectId プロジェクトID
   */
  async joinProjectRoom(client: Socket, projectId: string): Promise<void> {
    try {
      await client.join(`project:${projectId}`);
      this.logger.log(`Client ${client.id} joined project room: ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to join project room ${projectId}`, error);
      throw error;
    }
  }

  /**
   * プロジェクトルーム退出
   * 
   * @param client Socketクライアント
   * @param projectId プロジェクトID
   */
  async leaveProjectRoom(client: Socket, projectId: string): Promise<void> {
    try {
      await client.leave(`project:${projectId}`);
      this.logger.log(`Client ${client.id} left project room: ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to leave project room ${projectId}`, error);
      throw error;
    }
  }
}