export class ComputedScheduleEntity {
  id: string;
  projectId: string;
  
  calculatedAt: Date;
  calculatedBy: string;
  algorithm: string;
  
  originalEndDate: Date;
  computedEndDate: Date;
  totalDuration: number;
  
  constraints: {
    workingDays: number[];
    workingHoursPerDay: number;
    startDate?: Date;
    holidays?: Date[];
  };
  
  taskSchedules: Array<{
    taskId: string;
    originalStartDate: Date;
    originalEndDate: Date;
    computedStartDate: Date;
    computedEndDate: Date;
    floatTime: number;
    criticalPath: boolean;
  }>;
  
  criticalPath: string[];
  conflicts: Array<{
    type: 'resource_conflict' | 'date_conflict' | 'dependency_conflict';
    severity: 'warning' | 'error';
    taskIds: string[];
    message: string;
  }>;
  
  applied: boolean;
  appliedAt?: Date;
  rollbackId?: string;
}

// New type definitions for scheduling service
export interface BusinessHours {
  startTime: string;
  endTime: string;
  workingDays: number[]; // 0-6 (Sunday-Saturday)
  timeZone: string;
}

export interface ScheduleConstraints {
  projectStartDate: Date;
  projectEndDate?: Date;
  resourceConstraints: ResourceConstraint[];
  fixedTasks: FixedTaskConstraint[];
  businessHours: BusinessHours;
}

export interface ResourceConstraint {
  resourceId: string;
  availability: number; // 0-100 percentage
  skills: string[];
}

export interface FixedTaskConstraint {
  taskId: string;
  startDate: string;
  endDate: string;
}

export interface TaskSchedule {
  taskId: string;
  startDate: string;
  endDate: string;
  duration: number;
  floatTime?: number;
  isCritical?: boolean;
  resourceAllocations?: ResourceAllocation[];
}

export interface ResourceAllocation {
  resourceId: string;
  allocation: number; // hours or percentage
  startDate: string;
  endDate: string;
}

export interface ConflictInfo {
  type: 'resource_conflict' | 'date_conflict' | 'dependency_conflict';
  severity: 'warning' | 'error';
  taskIds: string[];
  message: string;
  suggestions?: string[];
}

export interface ScheduleResult {
  projectStartDate: Date;
  projectEndDate: Date;
  taskSchedules: TaskSchedule[];
  criticalPath: string[];
  conflicts: ConflictInfo[];
  executionTime?: number;
  scheduleId?: string;
  optimizationApplied?: string[];
}

export interface ScheduleCalculateRequest {
  algorithm?: 'cpm' | 'simple' | 'resource_optimized';
  constraints?: ScheduleConstraints;
  optimizations?: string[];
  preserveManualChanges?: boolean;
  validateOnly?: boolean;
}

// Response DTOs
export interface ScheduleApplyResponse {
  success: boolean;
  appliedTasks: number;
  appliedChanges: TaskSchedule[];
  conflicts: ConflictInfo[];
  rollbackId: string;
}

export interface ScheduleApplyRequest {
  scheduleId: string;
  applyToTasks?: string[]; // If specified, only apply to these tasks
  resolveConflicts?: boolean;
  createBackup?: boolean;
}

export interface ConflictResolutionRequest {
  conflictIds: string[];
  resolution: 'accept_computed' | 'keep_manual' | 'negotiate';
  negotiationParams?: {
    maxDelayDays?: number;
    allowResourceReallocation?: boolean;
    prioritizeTaskIds?: string[];
  };
}