/**
 * ガントチャート用の日付計算ユーティリティ
 * タスクバーのドラッグ&ドロップ時の日程変更計算を支援
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export interface BusinessDayConfig {
  workingDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  holidays: Date[];
}

export interface DragCalculationResult {
  newStartDate: Date;
  newEndDate: Date;
  durationDays: number;
  isValidRange: boolean;
  warnings: string[];
}

/**
 * デフォルト営業日設定（月〜金）
 */
export const DEFAULT_BUSINESS_CONFIG: BusinessDayConfig = {
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  holidays: [],
};

/**
 * 日付の基本計算
 */
export const dateCalculations = {
  /**
   * 二つの日付の差分を日数で計算
   */
  daysBetween: (startDate: Date, endDate: Date): number => {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  },

  /**
   * 指定した日数を加算
   */
  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  /**
   * 営業日のみを考慮した日数加算
   */
  addBusinessDays: (date: Date, days: number, config: BusinessDayConfig = DEFAULT_BUSINESS_CONFIG): Date => {
    let result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < Math.abs(days)) {
      result = dateCalculations.addDays(result, days > 0 ? 1 : -1);
      
      if (dateCalculations.isBusinessDay(result, config)) {
        addedDays++;
      }
    }
    
    return result;
  },

  /**
   * 営業日判定
   */
  isBusinessDay: (date: Date, config: BusinessDayConfig = DEFAULT_BUSINESS_CONFIG): boolean => {
    const dayOfWeek = date.getDay();
    
    // 営業日でない場合
    if (!config.workingDays.includes(dayOfWeek)) {
      return false;
    }
    
    // 祝日チェック
    const isHoliday = config.holidays.some(holiday => 
      dateCalculations.isSameDay(date, holiday)
    );
    
    return !isHoliday;
  },

  /**
   * 同じ日付かどうかをチェック
   */
  isSameDay: (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  },

  /**
   * 期間の妥当性チェック
   */
  isValidDateRange: (startDate: Date, endDate: Date): boolean => {
    return endDate > startDate;
  },

  /**
   * 日付をローカル日時文字列に変換（YYYY-MM-DD形式）
   */
  toLocalDateString: (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * ISO文字列から日付オブジェクトに変換
   */
  fromISOString: (isoString: string): Date => {
    return new Date(isoString);
  },

  /**
   * 今日の日付を取得（時分秒クリア）
   */
  getToday: (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  },
};

/**
 * ガントチャートドラッグ操作用の計算
 */
export const ganttDragCalculations = {
  /**
   * ピクセル移動量から日付変更を計算
   */
  calculateDateChange: (
    originalStart: Date,
    originalEnd: Date,
    deltaPixels: number,
    pixelsPerDay: number = 14
  ): DragCalculationResult => {
    const warnings: string[] = [];
    
    // ピクセルを日数に変換
    const daysDelta = Math.round(deltaPixels / pixelsPerDay);
    
    // 期間を保持したまま移動
    const newStartDate = dateCalculations.addDays(originalStart, daysDelta);
    const originalDuration = dateCalculations.daysBetween(originalStart, originalEnd);
    const newEndDate = dateCalculations.addDays(newStartDate, originalDuration);
    
    // 妥当性チェック
    const isValidRange = dateCalculations.isValidDateRange(newStartDate, newEndDate);
    if (!isValidRange) {
      warnings.push('終了日が開始日より前になっています');
    }
    
    // 過去日程チェック
    const today = dateCalculations.getToday();
    if (newStartDate < today) {
      warnings.push('開始日を過去の日付に設定しようとしています');
    }
    
    return {
      newStartDate,
      newEndDate,
      durationDays: originalDuration,
      isValidRange: isValidRange && newStartDate >= today,
      warnings,
    };
  },

  /**
   * 営業日ベースでの日付変更計算
   */
  calculateBusinessDateChange: (
    originalStart: Date,
    originalEnd: Date,
    deltaDays: number,
    config: BusinessDayConfig = DEFAULT_BUSINESS_CONFIG
  ): DragCalculationResult => {
    const warnings: string[] = [];
    
    // 営業日ベースで移動
    const newStartDate = dateCalculations.addBusinessDays(originalStart, deltaDays, config);
    
    // 元の営業日期間を計算
    const originalBusinessDays = ganttDragCalculations.countBusinessDays(
      originalStart, 
      originalEnd, 
      config
    );
    
    // 同じ営業日期間で終了日を計算
    const newEndDate = dateCalculations.addBusinessDays(newStartDate, originalBusinessDays, config);
    
    // 妥当性チェック
    const isValidRange = dateCalculations.isValidDateRange(newStartDate, newEndDate);
    if (!isValidRange) {
      warnings.push('終了日が開始日より前になっています');
    }
    
    return {
      newStartDate,
      newEndDate,
      durationDays: originalBusinessDays,
      isValidRange,
      warnings,
    };
  },

  /**
   * 期間内の営業日数をカウント
   */
  countBusinessDays: (
    startDate: Date, 
    endDate: Date, 
    config: BusinessDayConfig = DEFAULT_BUSINESS_CONFIG
  ): number => {
    let count = 0;
    let current = new Date(startDate);
    
    while (current < endDate) {
      if (dateCalculations.isBusinessDay(current, config)) {
        count++;
      }
      current = dateCalculations.addDays(current, 1);
    }
    
    return count;
  },

  /**
   * 日程調整時のスナップ処理
   */
  snapToGrid: (
    date: Date, 
    snapUnit: 'day' | 'week' | 'month' = 'day'
  ): Date => {
    const result = new Date(date);
    
    switch (snapUnit) {
      case 'day':
        // 時分秒をクリア
        result.setHours(0, 0, 0, 0);
        break;
        
      case 'week':
        // 週の始まり（月曜日）にスナップ
        const dayOfWeek = result.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0の場合-6、他は1-dayOfWeek
        result.setDate(result.getDate() + daysToMonday);
        result.setHours(0, 0, 0, 0);
        break;
        
      case 'month':
        // 月の初日にスナップ
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
    }
    
    return result;
  },

  /**
   * 複数タスクの日程一括調整計算
   */
  calculateBulkDateAdjustment: (
    tasks: Array<{ id: string; startDate: Date; endDate: Date }>,
    baseDelta: number,
    pixelsPerDay: number = 14
  ): Array<{ id: string; newStartDate: Date; newEndDate: Date; warnings: string[] }> => {
    return tasks.map(task => {
      const result = ganttDragCalculations.calculateDateChange(
        task.startDate,
        task.endDate,
        baseDelta * pixelsPerDay,
        pixelsPerDay
      );
      
      return {
        id: task.id,
        newStartDate: result.newStartDate,
        newEndDate: result.newEndDate,
        warnings: result.warnings,
      };
    });
  },
};

/**
 * マイルストーン専用の日付計算
 */
export const milestoneCalculations = {
  /**
   * マイルストーンの日程変更（開始日=終了日）
   */
  adjustMilestoneDate: (
    originalDate: Date,
    deltaPixels: number,
    pixelsPerDay: number = 14
  ): { newDate: Date; isValid: boolean; warnings: string[] } => {
    const warnings: string[] = [];
    const daysDelta = Math.round(deltaPixels / pixelsPerDay);
    const newDate = dateCalculations.addDays(originalDate, daysDelta);
    
    const today = dateCalculations.getToday();
    const isValid = newDate >= today;
    
    if (!isValid) {
      warnings.push('マイルストーンを過去の日付に設定することはできません');
    }
    
    return {
      newDate,
      isValid,
      warnings,
    };
  },

  /**
   * 営業日ベースのマイルストーン調整
   */
  adjustMilestoneBusinessDate: (
    originalDate: Date,
    deltaDays: number,
    config: BusinessDayConfig = DEFAULT_BUSINESS_CONFIG
  ): { newDate: Date; isValid: boolean; warnings: string[] } => {
    const warnings: string[] = [];
    const newDate = dateCalculations.addBusinessDays(originalDate, deltaDays, config);
    
    const today = dateCalculations.getToday();
    const isValid = newDate >= today;
    
    if (!isValid) {
      warnings.push('マイルストーンを過去の営業日に設定することはできません');
    }
    
    // 営業日でない場合の警告
    if (!dateCalculations.isBusinessDay(newDate, config)) {
      warnings.push('マイルストーンが非営業日に設定されます');
    }
    
    return {
      newDate,
      isValid,
      warnings,
    };
  },
};