import { Controller, Get, Put, Body, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { HolidaySettingsResponseDto, UpdateHolidaySettingsDto } from './dto';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RoleGuard } from '../common/guards/role.guard';

/**
 * SettingsController - グローバル設定API管理コントローラー
 * 
 * エンドポイント:
 * - GET /api/settings/holidays - 休日設定取得 (Viewer権限)
 * - PUT /api/settings/holidays - 休日設定更新 (Editor権限)
 * 
 * セキュリティ:
 * - RoleGuard による権限制御適用
 * - AuthMiddleware による認証必須（app.module.ts で設定済み）
 * - バリデーション自動実行（DTOのデコレーターによる）
 * 
 * 機能:
 * - GlobalSettings の休日設定CRUD操作
 * - Singletonパターンによる単一レコード管理
 * - 初回アクセス時のデフォルト設定自動作成
 */
@Controller('api/settings')
@UseGuards(RoleGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 休日設定取得 - GET /api/settings/holidays
   * 
   * 権限要件: Viewer権限で実行可能
   * レスポンス: 現在の休日設定（weekend_off, holiday_dates）
   * 
   * 動作:
   * 1. Viewer権限チェック（RoleGuard）
   * 2. SettingsService から休日設定取得
   * 3. 初回アクセス時は自動でデフォルト設定作成
   * 4. HolidaySettingsResponseDto 形式でレスポンス
   * 
   * @returns 休日設定
   */
  @Get('holidays')
  @RequireRole('viewer')
  async getHolidaySettings(): Promise<HolidaySettingsResponseDto> {
    this.logger.log('GET /api/settings/holidays - Retrieving holiday settings');

    try {
      const settings = await this.settingsService.getHolidaySettings();
      
      this.logger.log('Holiday settings retrieved successfully', {
        weekend_off: settings.weekend_off,
        holiday_dates_count: settings.holiday_dates.length,
      });

      return settings;

    } catch (error) {
      this.logger.error('Failed to retrieve holiday settings', error);
      throw error;
    }
  }

  /**
   * 休日設定更新 - PUT /api/settings/holidays
   * 
   * 権限要件: Editor権限が必要
   * リクエスト: 更新する休日設定（部分更新対応）
   * レスポンス: 更新後の休日設定
   * 
   * 動作:
   * 1. Editor権限チェック（RoleGuard）
   * 2. リクエストボディの自動バリデーション（UpdateHolidaySettingsDto）
   * 3. SettingsService による部分更新実行
   * 4. 更新後の設定をレスポンス
   * 
   * @param updateDto 更新データ
   * @returns 更新後の休日設定
   */
  @Put('holidays')
  @RequireRole('editor')
  @HttpCode(HttpStatus.OK)
  async updateHolidaySettings(
    @Body() updateDto: UpdateHolidaySettingsDto,
  ): Promise<HolidaySettingsResponseDto> {
    this.logger.log('PUT /api/settings/holidays - Updating holiday settings', updateDto);

    try {
      const updatedSettings = await this.settingsService.updateHolidaySettings(updateDto);

      this.logger.log('Holiday settings updated successfully', {
        weekend_off: updatedSettings.weekend_off,
        holiday_dates_count: updatedSettings.holiday_dates.length,
      });

      return updatedSettings;

    } catch (error) {
      this.logger.error('Failed to update holiday settings', error);
      throw error;
    }
  }
}