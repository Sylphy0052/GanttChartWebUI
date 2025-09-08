import { IsBoolean, IsArray, IsString, Matches, IsDateString } from 'class-validator';

/**
 * HolidaySettingsResponseDto - 休日設定レスポンス用DTO
 * 
 * GlobalSettings の休日関連設定を表現するレスポンス形式
 * GET /api/settings/holidays での返却に使用
 */
export class HolidaySettingsResponseDto {
  /**
   * 土日休みON/OFF
   * true: 土日を休日として扱う
   * false: 土日は営業日として扱う
   */
  @IsBoolean()
  weekend_off: boolean;

  /**
   * 固定休日配列
   * YYYY-MM-DD形式の日付文字列の配列
   * 例: ['2024-01-01', '2024-12-31']
   */
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { 
    each: true, 
    message: 'holiday_dates must be in YYYY-MM-DD format' 
  })
  holiday_dates: string[];
}