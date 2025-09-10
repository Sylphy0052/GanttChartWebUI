import { Issue } from './issue';

// Gantt Chart関連の型定義

/**
 * ガントチャートタスクの基本型
 * react-gantt-svg ライブラリに対応
 */
export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number; // 0-100 (percentage)
  dependencies?: string[]; // 依存タスクのID配列
  type: 'task' | 'milestone' | 'group';
  color?: string;
  styles?: {
    backgroundColor?: string;
    progressColor?: string;
    textColor?: string;
  };
}

/**
 * ガントチャート設定オプション
 */
export interface GanttOptions {
  // 表示設定
  viewMode: 'Day' | 'Week' | 'Month' | 'Year';
  locale: string;
  
  // グリッド設定
  columnWidth: number;
  rowHeight: number;
  
  // 日付範囲
  startDate?: Date;
  endDate?: Date;
  
  // 機能設定
  allowDrag: boolean;
  allowResize: boolean;
  allowProgressChange: boolean;
  
  // スタイル設定
  barHeight: number;
  barCornerRadius: number;
  
  // 色設定
  colors: {
    task: string;
    milestone: string;
    group: string;
    progress: string;
    grid: string;
    today: string;
  };
}

/**
 * Issue から GanttTask への変換結果
 */
export interface IssueToGanttConversion {
  tasks: GanttTask[];
  dependencies: Array<{
    from: string;
    to: string;
    type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  }>;
  warnings: string[]; // 変換時の警告メッセージ
}

/**
 * ガントチャートイベントハンドラー
 */
export interface GanttEventHandlers {
  onTaskChange?: (task: GanttTask) => void;
  onTaskSelect?: (task: GanttTask) => void;
  onTaskDoubleClick?: (task: GanttTask) => void;
  onProgressChange?: (task: GanttTask, progress: number) => void;
  onDateChange?: (task: GanttTask, start: Date, end: Date) => void;
  onDependencyChange?: (taskId: string, dependencies: string[]) => void;
}

/**
 * ガントチャート表示設定
 */
export interface GanttDisplaySettings {
  // 階層表示
  showHierarchy: boolean;
  indentSize: number;
  
  // 情報表示
  showProgress: boolean;
  showDependencies: boolean;
  showMilestones: boolean;
  showCriticalPath: boolean;
  
  // 時間軸設定
  timeScale: 'hour' | 'day' | 'week' | 'month';
  workingHours: {
    start: number; // 24時間制
    end: number;
  };
  workingDays: number[]; // 0=日曜, 1=月曜...
  holidays: Date[];
}

/**
 * ガントチャートフィルター設定
 */
export interface GanttFilters {
  // 期間フィルター
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  // ステータスフィルター
  statuses?: string[];
  
  // 担当者フィルター
  assignees?: string[];
  
  // 進捗フィルター
  progressRange?: {
    min: number;
    max: number;
  };
  
  // 検索フィルター
  searchTerm?: string;
}

/**
 * Issueデータをガントチャート用に拡張した型
 */
export interface GanttIssue extends Issue {
  // ガントチャート専用フィールド
  ganttStartDate: Date;
  ganttEndDate: Date;
  ganttProgress: number;
  ganttDuration: number; // 日数
  ganttCriticalPath: boolean;
  ganttColor?: string;
  ganttLevel: number; // 階層レベル（0=ルート）
}

/**
 * ガントチャートコンポーネントのProps
 */
export interface GanttChartProps {
  // データ
  issues: Issue[];
  
  // 設定
  options?: Partial<GanttOptions>;
  displaySettings?: Partial<GanttDisplaySettings>;
  filters?: GanttFilters;
  
  // イベントハンドラー
  onTaskChange?: (issueId: string, changes: Partial<Issue>) => void;
  onTaskSelect?: (issue: Issue | null) => void;
  
  // UI設定
  height?: number;
  className?: string;
  loading?: boolean;
  readOnly?: boolean;
}

/**
 * デフォルト設定値
 */
export const DEFAULT_GANTT_OPTIONS: GanttOptions = {
  viewMode: 'Week',
  locale: 'ja-JP',
  columnWidth: 100,
  rowHeight: 40,
  allowDrag: true,
  allowResize: true,
  allowProgressChange: true,
  barHeight: 24,
  barCornerRadius: 3,
  colors: {
    task: '#3b82f6',
    milestone: '#ef4444',
    group: '#10b981',
    progress: '#1d4ed8',
    grid: '#e5e7eb',
    today: '#fbbf24',
  },
};

export const DEFAULT_DISPLAY_SETTINGS: GanttDisplaySettings = {
  showHierarchy: true,
  indentSize: 20,
  showProgress: true,
  showDependencies: true,
  showMilestones: true,
  showCriticalPath: false,
  timeScale: 'day',
  workingHours: {
    start: 9,
    end: 18,
  },
  workingDays: [1, 2, 3, 4, 5], // 月-金
  holidays: [],
};