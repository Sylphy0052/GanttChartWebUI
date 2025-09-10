import {
  Issue,
  IssueStatus,
} from '../types/issue';
import {
  GanttTask,
  GanttOptions,
  GanttDisplaySettings,
  IssueToGanttConversion,
  DEFAULT_GANTT_OPTIONS,
  DEFAULT_DISPLAY_SETTINGS,
} from '../types/gantt';

/**
 * Issue配列をGanttTask配列に変換
 */
export function convertIssuesToGanttTasks(
  issues: Issue[],
  options: Partial<GanttOptions> = {}
): IssueToGanttConversion {
  const tasks: GanttTask[] = [];
  const warnings: string[] = [];
  const dependencies: Array<{
    from: string;
    to: string;
    type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  }> = [];

  for (const issue of issues) {
    // 日付の検証と変換
    let startDate: Date;
    let endDate: Date;

    if (issue.start_date) {
      startDate = typeof issue.start_date === 'string' 
        ? new Date(issue.start_date) 
        : issue.start_date;
    } else {
      // 開始日がない場合はtoday、警告を追加
      startDate = new Date();
      warnings.push(`Issue "${issue.title}" has no start_date, using today`);
    }

    if (issue.end_date) {
      endDate = typeof issue.end_date === 'string' 
        ? new Date(issue.end_date) 
        : issue.end_date;
    } else {
      // 終了日がない場合は開始日+1日、警告を追加
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      warnings.push(`Issue "${issue.title}" has no end_date, using start_date + 1 day`);
    }

    // 日付の妥当性チェック
    if (endDate <= startDate) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      warnings.push(`Issue "${issue.title}" has end_date before start_date, adjusted to start_date + 1 day`);
    }

    // タスクタイプの決定
    const taskType = determineTaskType(issue);

    // 色の決定
    const color = getTaskColor(issue, options);

    const ganttTask: GanttTask = {
      id: issue.id,
      name: formatTaskName(issue),
      start: startDate,
      end: endDate,
      progress: issue.progress_pct,
      type: taskType,
      color: color,
      styles: {
        backgroundColor: color,
        progressColor: getProgressColor(issue.status),
        textColor: getTextColor(issue),
      },
    };

    tasks.push(ganttTask);
  }

  return {
    tasks,
    dependencies,
    warnings,
  };
}

/**
 * Issueのタスクタイプを決定
 */
function determineTaskType(issue: Issue): 'task' | 'milestone' | 'group' {
  // 子タスクがある場合はgroup
  if (issue.children && issue.children.length > 0) {
    return 'group';
  }

  // 期間が1日以下の場合はmilestone
  if (issue.start_date && issue.end_date) {
    const start = new Date(issue.start_date);
    const end = new Date(issue.end_date);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 1) {
      return 'milestone';
    }
  }

  return 'task';
}

/**
 * Issueステータスに基づいてタスクの色を決定
 */
function getTaskColor(issue: Issue, options: Partial<GanttOptions>): string {
  const colors = { ...DEFAULT_GANTT_OPTIONS.colors, ...options.colors };

  switch (issue.status) {
    case 'done':
      return '#10b981'; // green
    case 'in_progress':
      return '#3b82f6'; // blue
    case 'blocked':
      return '#ef4444'; // red
    case 'open':
    default:
      return '#6b7280'; // gray
  }
}

/**
 * 進捗バーの色を決定
 */
function getProgressColor(status: IssueStatus): string {
  switch (status) {
    case 'done':
      return '#059669'; // green-600
    case 'in_progress':
      return '#1d4ed8'; // blue-700
    case 'blocked':
      return '#dc2626'; // red-600
    case 'open':
    default:
      return '#4b5563'; // gray-600
  }
}

/**
 * テキスト色を決定
 */
function getTextColor(issue: Issue): string {
  return issue.is_blocked ? '#dc2626' : '#374151';
}

/**
 * タスク名をフォーマット（WBS番号を含む）
 */
function formatTaskName(issue: Issue): string {
  const wbsPrefix = issue.wbs_number ? `${issue.wbs_number} ` : '';
  const blockedSuffix = issue.is_blocked ? ' [BLOCKED]' : '';
  
  return `${wbsPrefix}${issue.title}${blockedSuffix}`;
}

/**
 * ガントチャート用の設定をマージ
 */
export function mergeGanttOptions(
  userOptions: Partial<GanttOptions> = {}
): GanttOptions {
  return {
    ...DEFAULT_GANTT_OPTIONS,
    ...userOptions,
    colors: {
      ...DEFAULT_GANTT_OPTIONS.colors,
      ...userOptions.colors,
    },
  };
}

/**
 * 表示設定をマージ
 */
export function mergeDisplaySettings(
  userSettings: Partial<GanttDisplaySettings> = {}
): GanttDisplaySettings {
  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...userSettings,
    workingHours: {
      ...DEFAULT_DISPLAY_SETTINGS.workingHours,
      ...userSettings.workingHours,
    },
    workingDays: userSettings.workingDays || DEFAULT_DISPLAY_SETTINGS.workingDays,
    holidays: userSettings.holidays || DEFAULT_DISPLAY_SETTINGS.holidays,
  };
}

/**
 * 日付範囲を自動計算
 */
export function calculateDateRange(issues: Issue[]): { start: Date; end: Date } {
  if (issues.length === 0) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    return { start: now, end: endDate };
  }

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const issue of issues) {
    if (issue.start_date) {
      const startDate = typeof issue.start_date === 'string' 
        ? new Date(issue.start_date) 
        : issue.start_date;
      
      if (!minDate || startDate < minDate) {
        minDate = startDate;
      }
    }

    if (issue.end_date) {
      const endDate = typeof issue.end_date === 'string' 
        ? new Date(issue.end_date) 
        : issue.end_date;
      
      if (!maxDate || endDate > maxDate) {
        maxDate = endDate;
      }
    }
  }

  // デフォルト値の設定
  if (!minDate) minDate = new Date();
  if (!maxDate) {
    maxDate = new Date(minDate);
    maxDate.setMonth(maxDate.getMonth() + 1);
  }

  // 表示範囲を少し広げる
  const paddedStart = new Date(minDate);
  paddedStart.setDate(paddedStart.getDate() - 7); // 1週間前から

  const paddedEnd = new Date(maxDate);
  paddedEnd.setDate(paddedEnd.getDate() + 7); // 1週間後まで

  return { start: paddedStart, end: paddedEnd };
}

/**
 * 階層構造を考慮したIssue並び替え
 */
export function sortIssuesForGantt(issues: Issue[]): Issue[] {
  // WBS番号でソート、なければsort_order、なければcreated_at
  return [...issues].sort((a, b) => {
    // WBS番号での比較
    if (a.wbs_number && b.wbs_number) {
      return a.wbs_number.localeCompare(b.wbs_number, undefined, { numeric: true });
    }
    
    if (a.wbs_number) return -1;
    if (b.wbs_number) return 1;

    // sort_orderでの比較
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    // created_atでの比較
    const aDate = typeof a.created_at === 'string' ? new Date(a.created_at) : a.created_at;
    const bDate = typeof b.created_at === 'string' ? new Date(b.created_at) : b.created_at;
    
    return aDate.getTime() - bDate.getTime();
  });
}

/**
 * ガントチャート用のCSS変数を生成
 */
export function generateGanttCSSVariables(options: GanttOptions): Record<string, string> {
  return {
    '--gantt-row-height': `${options.rowHeight}px`,
    '--gantt-column-width': `${options.columnWidth}px`,
    '--gantt-bar-height': `${options.barHeight}px`,
    '--gantt-bar-radius': `${options.barCornerRadius}px`,
    '--gantt-task-color': options.colors.task,
    '--gantt-milestone-color': options.colors.milestone,
    '--gantt-group-color': options.colors.group,
    '--gantt-progress-color': options.colors.progress,
    '--gantt-grid-color': options.colors.grid,
    '--gantt-today-color': options.colors.today,
  };
}