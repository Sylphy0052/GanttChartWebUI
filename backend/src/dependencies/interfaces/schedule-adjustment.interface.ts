/**
 * 日程調整関連のインターフェース定義
 * 
 * 機能:
 * - FS依存関係による日程調整の型定義
 * - Critical Path計算結果の型定義
 * - 営業日計算設定の型定義
 * - 調整結果・制約違反の型定義
 */

/**
 * 営業日計算設定
 */
export interface BusinessDayConfig {
  /** 土日休みの有効/無効 */
  weekend_off: boolean;
  /** 固定休日日付配列 (YYYY-MM-DD形式) */
  holiday_dates: string[];
}

/**
 * 日程調整対象のIssue情報
 */
export interface ScheduleIssue {
  id: string;
  title: string;
  start_date: Date | null;
  end_date: Date | null;
  effort_hours: number | null;
}

/**
 * 依存関係情報
 */
export interface ScheduleDependency {
  id: string;
  predecessor_issue_id: string;
  successor_issue_id: string;
  type: 'FS'; // MVPではFSのみ
}

/**
 * 日程調整結果
 */
export interface ScheduleAdjustmentResult {
  /** 調整が成功したかどうか */
  success: boolean;
  /** 調整されたIssue一覧 */
  adjusted_issues: AdjustedIssue[];
  /** 制約違反一覧 */
  constraint_violations: ConstraintViolation[];
  /** Critical Path情報 */
  critical_path: CriticalPathInfo | null;
  /** エラーメッセージ（調整失敗時） */
  error_message?: string;
}

/**
 * 調整されたIssue情報
 */
export interface AdjustedIssue {
  issue_id: string;
  old_start_date: Date | null;
  old_end_date: Date | null;
  new_start_date: Date | null;
  new_end_date: Date | null;
  /** 調整理由 */
  adjustment_reason: string;
}

/**
 * 制約違反情報
 */
export interface ConstraintViolation {
  /** 違反タイプ */
  type: 'DEPENDENCY_CONFLICT' | 'SCHEDULE_CONFLICT' | 'RESOURCE_CONFLICT' | 'adjustment_error';
  /** 違反メッセージ */
  description: string;
  /** 関連するIssue ID一覧 */
  affected_issue_ids: string[];
  /** 関連する依存関係ID（該当する場合） */
  related_dependency_id?: string;
}

/**
 * Critical Path情報
 */
export interface CriticalPathInfo {
  /** Critical Pathに含まれるIssue ID一覧（順序付き） */
  critical_issue_ids: string[];
  /** Critical Pathの総日数 */
  total_duration_days: number;
  /** プロジェクト全体の最短完了予定日 */
  project_earliest_finish: Date;
}

/**
 * Critical Path計算用のノード
 */
export interface CriticalPathNode {
  issue_id: string;
  /** 最早開始日（Early Start） */
  early_start: Date;
  /** 最早終了日（Early Finish） */
  early_finish: Date;
  /** 最遅開始日（Late Start） */
  late_start: Date;
  /** 最遅終了日（Late Finish） */
  late_finish: Date;
  /** 総フロート（余裕日数） */
  total_float: number;
  /** Critical Pathに含まれるかどうか */
  is_critical: boolean;
}

/**
 * 日程調整パラメータ
 */
export interface ScheduleAdjustmentParams {
  /** 対象プロジェクトID */
  project_id: string;
  /** 調整トリガーとなったIssue ID（オプション） */
  trigger_issue_id?: string;
  /** 営業日計算設定 */
  business_day_config: BusinessDayConfig;
  /** Critical Path計算を実行するかどうか */
  calculate_critical_path?: boolean;
}