import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { WebSocketModule } from '../websocket/websocket.module';

/**
 * SettingsModule - グローバル設定モジュール（WebSocket通知統合版）
 * 
 * 機能:
 * - GlobalSettings CRUD API の提供
 * - 休日設定管理（weekend_off, holiday_dates）
 * - Singletonパターンによる単一レコード管理
 * - 権限制御（Viewer/Editor）適用済み
 * - 設定変更時のWebSocket通知配信
 * 
 * 依存:
 * - DatabaseModule（PrismaService）: グローバルで利用可能
 * - WebSocketModule（WebSocketGateway）: 通知機能の提供
 * - AuthMiddleware: app.module.ts で全体適用済み
 * - RoleGuard: SettingsController で適用済み
 * 
 * エクスポート:
 * - SettingsService: 他モジュールから利用可能（将来の機能拡張用）
 */
@Module({
  imports: [WebSocketModule], // WebSocket通知機能の利用
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService], // 他モジュールから利用可能にする
})
export class SettingsModule {}