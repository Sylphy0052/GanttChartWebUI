export enum ConflictType {
  RESOURCE = 'resource',
  DEPENDENCY = 'dependency',
  CONSTRAINT = 'constraint',
  SCHEDULING = 'scheduling',
  CALENDAR_CONFLICT = 'calendar_conflict',    // AC5: Calendar conflicts
  DEADLINE_CONFLICT = 'deadline_conflict',    // AC6: Deadline conflicts
  RESOURCE_CONFLICT = 'resource_conflict'     // AC6: Resource allocation conflicts
}

export enum ConflictSeverity {
  WARNING = 'warning',
  ERROR = 'error'
}

// AC3: Enhanced TaskSchedule with complete CPM data
export class TaskSchedule {
  taskId: string;
  originalStartDate: Date;
  originalEndDate: Date;
  computedStartDate: Date;
  computedEndDate: Date;
  floatTime: number;          // AC3: Total float time
  criticalPath: boolean;      // AC3: Critical path indicator
  
  // AC2: Additional backward pass data
  latestStart?: Date;         // Latest start time
  latestFinish?: Date;        // Latest finish time
  freeFloat?: number;         // Free float time
  
  // Additional task metadata
  priority?: 'high' | 'medium' | 'low';
  resourceAllocation?: number; // 0-100% allocation
  riskLevel?: 'low' | 'medium' | 'high';
}

export class ConflictInfo {
  id: string;
  type: ConflictType | string;
  severity: ConflictSeverity | string;
  description: string;
  affectedTasks: string[];
  suggestedActions: string[];
  
  // AC6: Enhanced conflict information
  estimatedImpact?: string;   // Impact assessment
  resolutionComplexity?: 'low' | 'medium' | 'high';
  autoResolvable?: boolean;   // Whether this can be auto-resolved
  relatedConflicts?: string[]; // IDs of related conflicts
}

// AC3: Critical path statistics
export class CriticalPathStats {
  length: number;             // Number of critical path tasks
  totalTasks: number;         // Total tasks in project
  criticalRatio: number;      // Ratio of critical to total tasks
  avgFloatTime: number;       // Average float time for non-critical tasks
}

// AC2 & AC3: Enhanced ComputedSchedule with backward pass results
export class ComputedSchedule {
  taskSchedules: TaskSchedule[];
  projectEndDate: Date;
  totalDuration: number;
  criticalPathTasks: string[];
  
  // AC3: Critical path analysis results
  criticalPathStats?: CriticalPathStats;
  
  // AC5: Calendar-aware scheduling data
  workingDaysUsed?: number;
  holidaysImpacted?: number;
  
  // AC6: Schedule health metrics
  scheduleHealth?: {
    riskLevel: 'low' | 'medium' | 'high';
    confidenceScore: number;    // 0-100
    potentialDelays: number;    // Days
    resourceUtilization: number; // Percentage
  };
}

export class ScheduleMetrics {
  calculationTime: number;
  tasksProcessed: number;
  optimizationSuggestions: string[];
  
  // AC4: Performance metrics for incremental updates
  incrementalOptimization?: {
    tasksRecalculated: number;
    optimizationRatio: number;
    performanceGain: number;    // Percentage improvement
  };
  
  // AC6: Advanced metrics
  conflictMetrics?: {
    totalConflicts: number;
    criticalConflicts: number;
    autoResolvableConflicts: number;
    estimatedResolutionTime: number; // Hours
  };
}

export class ScheduleCalculateResponse {
  computedSchedule: ComputedSchedule;
  conflicts: ConflictInfo[];
  metrics: ScheduleMetrics;
  
  // AC5: Calendar impact summary
  calendarImpact?: {
    workingDaysAdjustment: number;
    holidayConflicts: number;
    weekendAdjustments: number;
  };
}

export class ScheduleApplyResponse {
  success: boolean;
  appliedChanges: number;
  conflicts: ConflictInfo[];
  rollbackId: string;
  
  // Enhanced apply response
  appliedTasksCount?: number;
  skippedTasksCount?: number;
  backupCreated?: boolean;
  estimatedProjectImpact?: {
    timelineSaving: number;     // Days saved
    resourceOptimization: number; // Percentage
    riskReduction: number;      // Percentage
  };
}

export class SchedulePreviewResponse {
  computedSchedule: ComputedSchedule;
  changedTasks: TaskSchedule[];
  affectedTasks: number;
  estimatedSavingsHours: number;
  
  // AC3: Preview with critical path impact
  criticalPathImpact?: {
    newCriticalTasks: string[];
    removedCriticalTasks: string[];
    criticalPathLengthChange: number;
  };
  
  // AC5: Calendar-aware preview
  calendarAdjustments?: {
    tasksMovedForHolidays: number;
    weekendAdjustments: number;
    workingTimeOptimization: number;
  };
}

// AC4: Incremental update response
export class IncrementalUpdateResponse {
  affectedTaskIds: string[];
  updatedTaskSchedules: TaskSchedule[];
  newCriticalPath: string[];
  performanceMetrics: {
    tasksRecalculated: number;
    calculationTime: number;
    optimizationRatio: number;
  };
  
  // Additional incremental update data
  dependencyChainLength?: number;
  cascadeEffects?: {
    upstreamTasks: number;
    downstreamTasks: number;
  };
  optimizationOpportunities?: Array<{
    taskId: string;
    opportunity: string;
    potentialSaving: number;
  }>;
}

// AC5: Calendar configuration response
export class CalendarConfigurationResponse {
  workingDays: number[];
  workingHoursPerDay: number;
  holidays: Date[];
  workingTimeSlots: Array<{
    startTime: string;
    endTime: string;
  }>;
  timezone: string;
  
  // Calendar validation results
  validation?: {
    isValid: boolean;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      suggestion: string;
    }>;
    warnings: Array<{
      type: string;
      description: string;
      recommendation: string;
    }>;
  };
}

// AC6: Comprehensive conflict analysis
export class ConflictAnalysisResponse {
  conflictSummary: {
    totalConflicts: number;
    criticalConflicts: number;
    warningConflicts: number;
    conflictsByType: Record<string, number>;
  };
  
  topConflicts: Array<{
    conflictId: string;
    severity: string;
    description: string;
    affectedTasks: string[];
    estimatedImpact: string;
    suggestedActions: string[];
    resolutionComplexity: 'low' | 'medium' | 'high';
    autoResolvable: boolean;
  }>;
  
  resolutionRecommendations: Array<{
    strategy: string;
    confidence: number;
    expectedOutcome: string;
    effort: string;
    pros: string[];
    cons: string[];
  }>;
  
  // Resource conflict analysis
  resourceConflicts?: Array<{
    resourceId: string;
    overallocation: number;
    conflictingTasks: string[];
    suggestedRebalancing: Array<{
      taskId: string;
      recommendedChange: string;
    }>;
  }>;
}

// AC6: Enhanced optimization suggestions
export class OptimizationSuggestion {
  id: string;
  type: 'resource' | 'scheduling' | 'dependency' | 'calendar';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedBenefit: string;
  implementationEffort: 'low' | 'medium' | 'high';
  affectedTasks: string[];
  
  // Quantified benefits
  quantifiedBenefits?: {
    timeSaving: number;         // Days
    costSaving?: number;        // Currency units
    riskReduction: number;      // Percentage
    resourceEfficiency: number; // Percentage improvement
  };
}

// AC7: API response for batch operations
export class BatchOperationResponse<T> {
  totalOperations: number;
  successful: number;
  failed: number;
  results: Array<{
    success: boolean;
    data?: T;
    error?: string;
  }>;
  
  summary?: {
    executionTime: number;
    averageOperationTime: number;
    errorRate: number;
  };
}