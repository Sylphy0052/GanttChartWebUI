import { Module } from '@nestjs/common';
import { NotificationGateway } from './websocket.gateway';

/**
 * WebSocketModule - WebSocket機能の提供モジュール
 * 
 * 機能:
 * - NotificationGatewayの提供とエクスポート
 * - 他モジュールからの通知機能利用のサポート
 * - Socket.IOサーバーの設定管理
 * 
 * エクスポート:
 * - NotificationGateway: 他モジュール（SettingsServiceなど）から利用可能
 * 
 * 依存関係:
 * - @nestjs/websockets パッケージ
 * - @nestjs/platform-socket.io パッケージ
 * - socket.io パッケージ
 */
@Module({
  providers: [NotificationGateway],
  exports: [NotificationGateway], // 他モジュールから利用可能にする
})
export class WebSocketModule {}