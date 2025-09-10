import { Issue, UpdateIssueDto } from '@/types/issue';
import { issuesApi, ApiError } from './issues';

export interface GanttUpdateDto {
  start_date?: string; // ISO date string
  end_date?: string;   // ISO date string
  progress_pct?: number;
}

export interface BulkDateUpdateItem {
  id: string;
  start_date?: string;
  end_date?: string;
  version: number;
}

export interface BulkDateUpdateDto {
  updates: BulkDateUpdateItem[];
}

/**
 * ガントチャート専用API関数群
 * タスクバーのドラッグ&ドロップ、日程一括変更に対応
 */
export const ganttApi = {
  /**
   * 単一タスクの日程更新（ドラッグ&ドロップ用）
   */
  updateTaskDates: async (
    projectId: string, 
    issueId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<Issue> => {
    const updateData: UpdateIssueDto = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    };

    try {
      return await issuesApi.update(projectId, issueId, updateData);
    } catch (error) {
      if (error instanceof ApiError) {
        // Backend APIエラーのラップ
        throw new Error(`タスク日程更新に失敗: ${error.message}`);
      }
      throw error;
    }
  },

  /**
   * タスクの進捗更新（プログレスバードラッグ用）
   */
  updateTaskProgress: async (
    projectId: string, 
    issueId: string, 
    progress: number
  ): Promise<Issue> => {
    if (progress < 0 || progress > 100) {
      throw new Error('進捗値は0-100の範囲で入力してください');
    }

    const updateData: UpdateIssueDto = {
      progress_pct: progress,
    };

    try {
      return await issuesApi.update(projectId, issueId, updateData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`タスク進捗更新に失敗: ${error.message}`);
      }
      throw error;
    }
  },

  /**
   * マイルストーン日程調整（依存先の自動調整）
   */
  updateMilestoneDates: async (
    projectId: string, 
    issueId: string, 
    newDate: Date
  ): Promise<Issue> => {
    // マイルストーンは開始日=終了日
    const updateData: UpdateIssueDto = {
      start_date: newDate.toISOString(),
      end_date: newDate.toISOString(),
    };

    try {
      return await issuesApi.update(projectId, issueId, updateData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`マイルストーン日程更新に失敗: ${error.message}`);
      }
      throw error;
    }
  },

  /**
   * 日程変更の妥当性検証（実際の更新前チェック）
   */
  validateDateChange: async (
    projectId: string,
    issueId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ isValid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    // 基本的な日程チェック
    if (endDate <= startDate) {
      errors.push('終了日は開始日より後に設定してください');
    }

    // 過去日程チェック（設定により無効化可能）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      errors.push('開始日を過去の日付に設定することはできません');
    }

    // 期間制限チェック（例: 最大1年）
    const maxDurationDays = 365;
    const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > maxDurationDays) {
      errors.push(`タスクの期間は最大${maxDurationDays}日まで設定可能です`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * ドラッグ操作のロールバック用（元の日程に戻す）
   */
  rollbackTaskDates: async (
    projectId: string, 
    issueId: string, 
    originalStartDate: Date, 
    originalEndDate: Date
  ): Promise<Issue> => {
    const updateData: UpdateIssueDto = {
      start_date: originalStartDate.toISOString(),
      end_date: originalEndDate.toISOString(),
    };

    try {
      return await issuesApi.update(projectId, issueId, updateData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`タスク日程ロールバックに失敗: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * 日程計算ユーティリティ関数群
 */
export const dateUtils = {
  /**
   * ピクセル移動量を日数に変換
   */
  pixelsToDays: (pixels: number, pixelsPerDay: number = 14): number => {
    return Math.round(pixels / pixelsPerDay);
  },

  /**
   * 日数をピクセル移動量に変換
   */
  daysToPixels: (days: number, pixelsPerDay: number = 14): number => {
    return days * pixelsPerDay;
  },

  /**
   * 営業日ベースの日程計算（土日祝日を除外）
   */
  addBusinessDays: (startDate: Date, days: number): Date => {
    const result = new Date(startDate);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // 土曜日(6)と日曜日(0)を除外
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }
    
    return result;
  },

  /**
   * 日付を週の最初（月曜日）に調整
   */
  snapToWeekStart: (date: Date): Date => {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    result.setDate(result.getDate() + daysToMonday);
    return result;
  },

  /**
   * 日付をグリッドにスナップ（日/週/月単位）
   */
  snapToGrid: (date: Date, gridUnit: 'day' | 'week' | 'month' = 'day'): Date => {
    const result = new Date(date);
    
    switch (gridUnit) {
      case 'day':
        // 時分秒をクリア
        result.setHours(0, 0, 0, 0);
        break;
      case 'week':
        return dateUtils.snapToWeekStart(result);
      case 'month':
        // 月の最初に調整
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
    }
    
    return result;
  },
};