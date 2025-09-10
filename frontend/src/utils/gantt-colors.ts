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
    task: '#6b7280',           // gray-500
    taskHover: '#4b5563',      // gray-600
    taskText: '#ffffff',
    progress: '#4b5563',       // gray-600
    progressBackground: '#e5e7eb', // gray-200
    milestone: '#6b7280',
    milestoneHover: '#4b5563',
  },
  in_progress: {
    task: '#3b82f6',           // blue-500
    taskHover: '#2563eb',      // blue-600
    taskText: '#ffffff',
    progress: '#1d4ed8',       // blue-700
    progressBackground: '#dbeafe', // blue-100
    milestone: '#3b82f6',
    milestoneHover: '#2563eb',
  },
  done: {
    task: '#10b981',           // green-500
    taskHover: '#059669',      // green-600
    taskText: '#ffffff',
    progress: '#047857',       // green-700
    progressBackground: '#d1fae5', // green-100
    milestone: '#10b981',
    milestoneHover: '#059669',
  },
  blocked: {
    task: '#ef4444',           // red-500
    taskHover: '#dc2626',      // red-600
    taskText: '#ffffff',
    progress: '#b91c1c',       // red-700
    progressBackground: '#fee2e2', // red-100
    milestone: '#ef4444',
    milestoneHover: '#dc2626',
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