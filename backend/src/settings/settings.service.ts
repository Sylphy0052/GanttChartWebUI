import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HolidaySettingsResponseDto, UpdateHolidaySettingsDto } from './dto';
import { NotificationGateway } from '../websocket/websocket.gateway';

/**
 * SettingsService - グローバル設定管理サービス（WebSocket通知統合版）
 * 
 * 機能:
 * - GlobalSettings のSingletonパターンによる管理
 * - 初回アクセス時にデフォルト設定を自動作成
 * - 休日設定の取得・更新CRUD操作
 * - 設定変更時のWebSocket通知配信
 * - 単一レコード管理（IDは常に最初のレコードを使用）
 * 
 * デザインパターン: Singletonパターン適用
 * - データベースレベルでの単一レコード制御
 * - 複数レコード作成を防止する安全措置
 * - 設定変更時の自動通知機能
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * 休日設定取得
   * 
   * Singletonパターン実装:
   * 1. 既存のGlobalSettingsレコードを検索
   * 2. レコードが存在しない場合は、デフォルト設定で新規作成
   * 3. レスポンス形式に変換して返却
   * 
   * @returns 休日設定
   */
  async getHolidaySettings(): Promise<HolidaySettingsResponseDto> {
    this.logger.log('Retrieving holiday settings');

    try {
      // 既存のGlobalSettingsレコードを検索（最初のレコードを取得）
      let settings = await this.prisma.globalSettings.findFirst({
        orderBy: { created_at: 'asc' }, // 最初に作成されたレコードを優先
      });

      // レコードが存在しない場合はデフォルト設定で作成
      if (!settings) {
        this.logger.log('No existing settings found, creating default settings');
        settings = await this.createDefaultSettings();
      }

      const response: HolidaySettingsResponseDto = {
        weekend_off: settings.weekend_off,
        holiday_dates: settings.holiday_dates,
      };

      this.logger.log('Holiday settings retrieved successfully');
      return response;

    } catch (error) {
      this.logger.error('Failed to retrieve holiday settings', error);
      throw error;
    }
  }

  /**
   * 休日設定更新（WebSocket通知統合版）
   * 
   * 実装機能:
   * 1. 既存のGlobalSettingsレコードを検索
   * 2. レコードが存在しない場合は、デフォルト設定で新規作成
   * 3. 部分更新（指定されたフィールドのみ更新）
   * 4. WebSocket通知の送信（設定変更イベント）
   * 5. 更新後の設定を返却
   * 
   * 受け入れ条件:
   * - 設定変更時のWebSocket通知配信
   * - 既存セッションの再認証促進
   * - 設定変更イベントの配信
   * 
   * @param updateDto 更新データ
   * @returns 更新後の休日設定
   */
  async updateHolidaySettings(
    updateDto: UpdateHolidaySettingsDto,
  ): Promise<HolidaySettingsResponseDto> {
    this.logger.log('Updating holiday settings', updateDto);

    try {
      // 既存のGlobalSettingsレコードを検索
      let settings = await this.prisma.globalSettings.findFirst({
        orderBy: { created_at: 'asc' },
      });

      // レコードが存在しない場合はデフォルト設定で作成
      if (!settings) {
        this.logger.log('No existing settings found, creating default settings before update');
        settings = await this.createDefaultSettings();
      }

      // 部分更新データの準備（undefinedフィールドは既存値を保持）
      const updateData: any = {};
      
      if (updateDto.weekend_off !== undefined) {
        updateData.weekend_off = updateDto.weekend_off;
      }
      
      if (updateDto.holiday_dates !== undefined) {
        updateData.holiday_dates = updateDto.holiday_dates;
      }

      // データベース更新実行
      const updatedSettings = await this.prisma.globalSettings.update({
        where: { id: settings.id },
        data: updateData,
      });

      // WebSocket通知の送信（設定変更イベント）
      try {
        await this.sendSettingsChangeNotification(updateDto);
        this.logger.log('WebSocket notification sent successfully');
      } catch (notificationError) {
        // 通知失敗はログに記録するが、設定更新は成功とする
        this.logger.error('Failed to send WebSocket notification', notificationError);
      }

      const response: HolidaySettingsResponseDto = {
        weekend_off: updatedSettings.weekend_off,
        holiday_dates: updatedSettings.holiday_dates,
      };

      this.logger.log('Holiday settings updated successfully');
      return response;

    } catch (error) {
      this.logger.error('Failed to update holiday settings', error);
      throw error;
    }
  }

  /**
   * 設定変更WebSocket通知送信（プライベートメソッド）
   * 
   * 機能:
   * - 設定変更の内容に応じた通知メッセージの作成
   * - NotificationGatewayを使用した通知送信
   * - 再認証要求の判定（将来拡張用）
   * 
   * @param updateDto 更新された設定内容
   */
  private async sendSettingsChangeNotification(
    updateDto: UpdateHolidaySettingsDto,
  ): Promise<void> {
    // 変更内容の分析とメッセージ生成
    const changedFields: string[] = [];
    
    if (updateDto.weekend_off !== undefined) {
      changedFields.push(`土日休み: ${updateDto.weekend_off ? 'ON' : 'OFF'}`);
    }
    
    if (updateDto.holiday_dates !== undefined) {
      changedFields.push(`固定休日: ${updateDto.holiday_dates.length}件`);
    }

    const message = `休日設定が更新されました。変更内容: ${changedFields.join(', ')}`;

    // WebSocket通知の送信（全セッションに配信）
    await this.notificationGateway.notifySettingsChanged(
      message,
      false, // 現在は再認証不要（将来拡張用）
      undefined, // 全体通知のためprojectIdは不要
    );

    this.logger.log('Settings change notification sent', {
      changes: changedFields,
      message,
    });
  }

  /**
   * デフォルト設定作成（プライベートメソッド）
   * 
   * Singleton制御:
   * - レコード作成前に再度存在確認を行い、競合状態を防止
   * - デフォルト値: weekend_off=true, holiday_dates=[]
   * 
   * @returns 作成されたGlobalSettingsレコード
   */
  private async createDefaultSettings() {
    this.logger.log('Creating default GlobalSettings');

    try {
      // 競合状態防止のため、再度存在確認
      const existingSettings = await this.prisma.globalSettings.findFirst();
      
      if (existingSettings) {
        this.logger.log('Settings already exists, returning existing record');
        return existingSettings;
      }

      // デフォルト設定でレコード作成
      const defaultSettings = await this.prisma.globalSettings.create({
        data: {
          weekend_off: true,    // デフォルト: 土日休み ON
          holiday_dates: [],    // デフォルト: 固定休日なし
        },
      });

      this.logger.log('Default GlobalSettings created successfully', {
        id: defaultSettings.id,
        weekend_off: defaultSettings.weekend_off,
        holiday_dates_count: defaultSettings.holiday_dates.length,
      });

      return defaultSettings;

    } catch (error) {
      this.logger.error('Failed to create default settings', error);
      throw error;
    }
  }
}