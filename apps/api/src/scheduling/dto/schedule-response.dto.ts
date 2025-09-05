export enum ConflictType {
  RESOURCE = 'resource',
  DEPENDENCY = 'dependency',
  CONSTRAINT = 'constraint'
}

export enum ConflictSeverity {
  WARNING = 'warning',
  ERROR = 'error'
}

export class TaskSchedule {
  taskId: string;
  originalStartDate: Date;
  originalEndDate: Date;
  computedStartDate: Date;
  computedEndDate: Date;
  floatTime: number;
  criticalPath: boolean;
}

export class ConflictInfo {
  type: ConflictType;
  taskId: string;
  description: string;
  severity: ConflictSeverity;
}

export class ComputedSchedule {
  taskSchedules: TaskSchedule[];
  projectEndDate: Date;
  totalDuration: number;
  criticalPathTasks: string[];
}

export class ScheduleMetrics {
  calculationTime: number;
  tasksProcessed: number;
  optimizationSuggestions: string[];
}

export class ScheduleCalculateResponse {
  computedSchedule: ComputedSchedule;
  conflicts: ConflictInfo[];
  metrics: ScheduleMetrics;
}

export class ScheduleApplyResponse {
  success: boolean;
  appliedChanges: number;
  conflicts: ConflictInfo[];
  rollbackId: string;
}

export class SchedulePreviewResponse {
  computedSchedule: ComputedSchedule;
  changedTasks: TaskSchedule[];
  affectedTasks: number;
  estimatedSavingsHours: number;
}