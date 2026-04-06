import { IssueStatus } from '../types/issue';

/**
 * ガントチャート色管理ユーティリティ
 * Issue期間バー表示のステータス別色分けとスタイリング
 */

export interface GanttColorScheme {
  task: string;
  taskHover: string;
  taskText: string;
  progress: string;
  progressBackground: string;
  milestone: string;
  milestoneHover: string;
}

/**
 * Issueステータス別の色スキーマ定義
 */
export const GANTT_STATUS_COLORS: Record<IssueStatus, GanttColorScheme> = {
  open: {
    task: '#94a3b8',           // slate-400 - 明るいグレー（未着手感を表現）
    taskHover: '#64748b',      // slate-500
    taskText: '#1e293b',       // slate-800 - ダークグレー（読みやすい）
    progress: '#64748b',       // slate-500
    progressBackground: '#e2e8f0', // slate-200
    milestone: '#94a3b8',
    milestoneHover: '#64748b',
  },
  in_progress: {
    task: '#3b82f6',           // blue-500 - 鮮やかな青（進行中感を表現）
    taskHover: '#2563eb',      // blue-600
    taskText: '#ffffff',       // 白文字（青背景に対して最適）
    progress: '#1d4ed8',       // blue-700
    progressBackground: '#dbeafe', // blue-100
    milestone: '#3b82f6',
    milestoneHover: '#2563eb',
  },
  done: {
    task: '#22c55e',           // green-500 - 鮮やかな緑（完了感を表現）
    taskHover: '#16a34a',      // green-600
    taskText: '#ffffff',       // 白文字（緑背景に対して最適）
    progress: '#15803d',       // green-700
    progressBackground: '#dcfce7', // green-100
    milestone: '#22c55e',
    milestoneHover: '#16a34a',
  },
  blocked: {
    task: '#f97316',           // orange-500 - オレンジ（ブロック状態を強調）
    taskHover: '#ea580c',      // orange-600
    taskText: '#ffffff',       // 白文字（オレンジ背景に対して最適）
    progress: '#c2410c',       // orange-700
    progressBackground: '#fed7aa', // orange-100
    milestone: '#f97316',
    milestoneHover: '#ea580c',
  },
};

/**
 * Issueステータスに基づく色スキーマの取得
 */
export function getGanttColorScheme(status: IssueStatus): GanttColorScheme {
  return GANTT_STATUS_COLORS[status];
}

/**
 * Issueステータスに基づくタスクバー色の取得
 */
export function getTaskBarColor(status: IssueStatus, isHovered: boolean = false): string {
  const scheme = getGanttColorScheme(status);
  return isHovered ? scheme.taskHover : scheme.task;
}

/**
 * Issueステータスに基づく進捗バー色の取得
 */
export function getProgressBarColor(status: IssueStatus): string {
  return getGanttColorScheme(status).progress;
}

/**
 * Issueステータスに基づく進捗背景色の取得
 */
export function getProgressBackgroundColor(status: IssueStatus): string {
  return getGanttColorScheme(status).progressBackground;
}

/**
 * Issueステータスに基づくマイルストーン色の取得
 */
export function getMilestoneColor(status: IssueStatus, isHovered: boolean = false): string {
  const scheme = getGanttColorScheme(status);
  return isHovered ? scheme.milestoneHover : scheme.milestone;
}

/**
 * Issueステータスに基づくテキスト色の取得
 */
export function getTaskTextColor(status: IssueStatus): string {
  return getGanttColorScheme(status).taskText;
}

/**
 * CSS変数として色スキーマを生成
 */
export function generateColorCSSVariables(status: IssueStatus): Record<string, string> {
  const scheme = getGanttColorScheme(status);
  
  return {
    '--gantt-task-color': scheme.task,
    '--gantt-task-hover-color': scheme.taskHover,
    '--gantt-task-text-color': scheme.taskText,
    '--gantt-progress-color': scheme.progress,
    '--gantt-progress-bg-color': scheme.progressBackground,
    '--gantt-milestone-color': scheme.milestone,
    '--gantt-milestone-hover-color': scheme.milestoneHover,
  };
}

/**
 * ブロック状態のIssueに対する視覚的強調
 */
export function getBlockedIssueStyles(isBlocked: boolean): Record<string, string> {
  if (!isBlocked) return {};
  
  return {
    '--gantt-blocked-overlay': 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.2) 4px, rgba(239, 68, 68, 0.2) 8px)',
    '--gantt-blocked-border': '2px solid #ef4444',
    '--gantt-blocked-shadow': '0 0 0 2px rgba(239, 68, 68, 0.2)',
  };
}