import { BusinessDayConfig } from '../interfaces/schedule-adjustment.interface';

/**
 * 日程計算ユーティリティ
 * 
 * 機能:
 * - 営業日計算（休日除外）
 * - FS依存関係に基づく日程調整
 * - 日付操作・バリデーション
 * 
 * GlobalSettings休日設定考慮:
 * - weekend_off: 土日休みの有効/無効
 * - holiday_dates: 固定休日日付配列
 */
export class ScheduleCalculatorUtil {
  /**
   * 指定日が営業日かどうかを判定
   * 
   * @param date 判定対象の日付
   * @param config 営業日計算設定
   * @returns 営業日の場合true
   */
  static isBusinessDay(date: Date, config: BusinessDayConfig): boolean {
    // 土日休みが有効な場合のチェック
    if (config.weekend_off) {
      const dayOfWeek = date.getDay(); // 0=日曜, 6=土曜
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
      }
    }

    // 固定休日のチェック
    const dateString = this.formatDateToString(date);
    if (config.holiday_dates.includes(dateString)) {
      return false;
    }

    return true;
  }

  /**
   * 指定した営業日数後の日付を計算
   * 
   * @param startDate 開始日
   * @param businessDays 営業日数
   * @param config 営業日計算設定
   * @returns 営業日数後の日付
   */
  static addBusinessDays(
    startDate: Date,
    businessDays: number,
    config: BusinessDayConfig,
  ): Date {
    if (businessDays <= 0) {
      return new Date(startDate);
    }

    const result = new Date(startDate);
    let remainingDays = businessDays;

    while (remainingDays > 0) {
      result.setDate(result.getDate() + 1);
      
      if (this.isBusinessDay(result, config)) {
        remainingDays--;
      }
    }

    return result;
  }

  /**
   * 2つの日付間の営業日数を計算
   * 
   * @param startDate 開始日（含む）
   * @param endDate 終了日（含む）
   * @param config 営業日計算設定
   * @returns 営業日数
   */
  static calculateBusinessDays(
    startDate: Date,
    endDate: Date,
    config: BusinessDayConfig,
  ): number {
    if (startDate > endDate) {
      return 0;
    }

    let businessDays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (this.isBusinessDay(current, config)) {
        businessDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * 工数（時間）から営業日数を計算
   * 
   * @param effortHours 工数（時間）
   * @param workHoursPerDay 1日の作業時間（デフォルト8時間）
   * @returns 営業日数（小数点以下切り上げ）
   */
  static calculateDurationFromEffort(
    effortHours: number,
    workHoursPerDay: number = 8,
  ): number {
    if (effortHours <= 0) {
      return 0;
    }

    return Math.ceil(effortHours / workHoursPerDay);
  }

  /**
   * FS依存関係に基づく最早開始日を計算
   * 
   * @param predecessorEndDate 先行タスクの終了日
   * @param config 営業日計算設定
   * @returns 後続タスクの最早開始日
   */
  static calculateEarliestStartForFS(
    predecessorEndDate: Date,
    config: BusinessDayConfig,
  ): Date {
    // FS（Finish-to-Start）: 先行タスクの終了日の翌営業日が後続タスクの開始日
    const nextDay = new Date(predecessorEndDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 翌日が営業日でない場合は、次の営業日を探す
    while (!this.isBusinessDay(nextDay, config)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
  }

  /**
   * Issue開始日から終了日を計算
   * 
   * @param startDate 開始日
   * @param effortHours 工数（時間）
   * @param config 営業日計算設定
   * @param workHoursPerDay 1日の作業時間（デフォルト8時間）
   * @returns 終了日
   */
  static calculateEndDateFromStart(
    startDate: Date,
    effortHours: number,
    config: BusinessDayConfig,
    workHoursPerDay: number = 8,
  ): Date {
    const duration = this.calculateDurationFromEffort(effortHours, workHoursPerDay);
    
    if (duration <= 0) {
      return new Date(startDate);
    }

    // 開始日から duration-1 営業日後が終了日
    // （開始日を1日目として計算するため）
    return this.addBusinessDays(startDate, duration - 1, config);
  }

  /**
   * 日付を YYYY-MM-DD 形式の文字列に変換
   * 
   * @param date 日付オブジェクト
   * @returns YYYY-MM-DD 形式の文字列
   */
  static formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * YYYY-MM-DD 形式の文字列を日付オブジェクトに変換
   * 
   * @param dateString YYYY-MM-DD 形式の文字列
   * @returns 日付オブジェクト
   */
  static parseStringToDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * 日付の妥当性をチェック
   * 
   * @param date チェック対象の日付
   * @returns 有効な日付の場合true
   */
  static isValidDate(date: Date | null | undefined): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 現在日付を営業日基準で取得
   * 今日が営業日でない場合は次の営業日を返す
   * 
   * @param config 営業日計算設定
   * @returns 現在の営業日
   */
  static getCurrentBusinessDay(config: BusinessDayConfig): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 時間部分をリセット

    if (this.isBusinessDay(today, config)) {
      return today;
    }

    // 今日が営業日でない場合は次の営業日を探す
    return this.addBusinessDays(today, 1, config);
  }
}