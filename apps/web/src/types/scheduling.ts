import { GanttTask, GanttDependency } from './gantt';

// Scheduling calculation types
export interface SchedulingRequest {
  projectId: string;
  options: SchedulingOptions;
}

export interface SchedulingOptions {
  algorithm: 'CPM' | 'PERT' | 'CRITICAL_CHAIN';
  workingHours: WorkingHoursConfig;
  holidays: Date[];
  resourceConstraints: boolean;
  bufferPercentage: number;
  maxIterations: number;
}

export interface WorkingHoursConfig {
  workingDaysPerWeek: number;
  hoursPerDay: number;
  workingDays: number[]; // 0-6 (Sunday to Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export interface SlackInfo {
  totalSlack: number; // in hours
  freeSlack: number; // in hours
  criticalityIndex: number; // 0-1
}

export interface SchedulingResult {
  success: boolean;
  projectId: string;
  algorithm: string;
  calculatedAt: Date;
  tasks: ScheduledTask[];
  dependencies: GanttDependency[];
  criticalPath: CriticalPathResult;
  metrics: SchedulingMetrics;
  warnings: SchedulingWarning[];
  taskSlacks: Map<string, SlackInfo>;
  performanceMetrics: PerformanceMetrics;
  etag: string;
}

export interface ScheduledTask extends GanttTask {
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  totalSlack: number; // in hours
  freeSlack: number; // in hours
  isCritical: boolean;
  originalStartDate: Date;
  originalEndDate: Date;
  scheduleStatus: 'ON_SCHEDULE' | 'DELAYED' | 'AHEAD' | 'CRITICAL';
}

export interface CriticalPathSegment {
  taskId: string;
  startDate: Date;
  endDate: Date;
  duration: number; // in hours
  slackTime: number; // in hours
  isCritical: boolean;
}

export interface CriticalPathResult extends Array<CriticalPathSegment> {
  totalDuration: number; // in hours
  startDate: Date;
  endDate: Date;
  bufferTime: number; // in hours
}

export interface SchedulingMetrics {
  totalTasks: number;
  criticalTasks: number;
  totalProjectDuration: number; // in hours
  resourceUtilization: ResourceUtilization[];
  performanceMetrics: PerformanceMetrics;
}

export interface ResourceUtilization {
  resourceId: string;
  resourceName: string;
  utilizationPercentage: number;
  overallocatedHours: number;
  availableHours: number;
  allocatedHours: number;
}

export interface PerformanceMetrics {
  calculationTime: number; // in milliseconds
  memoryUsage: number; // in bytes
  iterations: number;
  convergenceStatus: 'CONVERGED' | 'MAX_ITERATIONS' | 'FAILED';
}

export interface SchedulingWarning {
  type: 'RESOURCE_CONFLICT' | 'DATE_CONSTRAINT' | 'CIRCULAR_DEPENDENCY' | 'UNREALISTIC_DURATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  taskId?: string;
  resourceId?: string;
  message: string;
  suggestedAction?: string;
}

// Conflict detection types
export interface ConflictDetectionRequest {
  projectId: string;
  etag: string;
  context: ConflictContext;
}

export interface ConflictContext {
  operation: 'SCHEDULE_UPDATE' | 'TASK_MODIFICATION' | 'DEPENDENCY_CHANGE' | 'RESOURCE_ALLOCATION';
  triggeredBy: string; // user ID
  timestamp: Date;
  affectedEntities: string[]; // entity IDs
}

export interface DetectedConflict {
  id: string;
  type: ConflictType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType: 'TASK' | 'DEPENDENCY' | 'RESOURCE' | 'PROJECT';
  entityId: string;
  conflictingEntityId?: string;
  description: string;
  currentValue: any;
  conflictingValue: any;
  detectedAt: Date;
  suggestedResolution: ConflictResolution[];
}

export type ConflictType = 
  | 'OPTIMISTIC_LOCKING'
  | 'SCHEDULING_CONFLICT' 
  | 'RESOURCE_OVERALLOCATION'
  | 'CIRCULAR_DEPENDENCY'
  | 'DATE_CONSTRAINT_VIOLATION'
  | 'DEPENDENCY_MISMATCH'
  | 'DATA_INTEGRITY';

export interface ConflictResolution {
  strategy: 'CURRENT' | 'INCOMING' | 'MANUAL' | 'MERGE';
  description: string;
  impact: ConflictImpact;
  autoApplicable: boolean;
}

export interface ConflictImpact {
  affectedTasks: number;
  scheduleChange: number; // in hours
  resourceReallocation: boolean;
  criticalPathChange: boolean;
  estimatedEffort: number; // in hours
}

// Conflict resolution types
export interface ConflictResolutionRequest {
  conflictIds: string[];
  strategy: ResolutionStrategy;
  options: ResolutionOptions;
  userId: string;
}

export interface ResolutionStrategy {
  type: 'CURRENT' | 'INCOMING' | 'MANUAL' | 'MERGE';
  bulkApply: boolean;
  preserveUserChanges: boolean;
}

export interface ResolutionOptions {
  validateAfterResolution: boolean;
  recalculateSchedule: boolean;
  notifyStakeholders: boolean;
  createBackup: boolean;
  mergeRules?: MergeRules;
}

export interface MergeRules {
  startDate: DateResolutionRule;
  endDate: DateResolutionRule;
  progress: ProgressResolutionRule;
  assignee: AssigneeResolutionRule;
  priority: PriorityResolutionRule;
}

export enum DateResolutionRule {
  CURRENT = 'current',
  INCOMING = 'incoming',
  EARLIEST = 'earliest',
  LATEST = 'latest',
  AVERAGE = 'average',
  MANUAL = 'manual'
}

export enum ProgressResolutionRule {
  CURRENT = 'current',
  INCOMING = 'incoming',
  MAX = 'max',
  MIN = 'min',
  AVERAGE = 'average',
  MANUAL = 'manual'
}

export enum AssigneeResolutionRule {
  CURRENT = 'current',
  INCOMING = 'incoming',
  MERGE = 'merge',
  MANUAL = 'manual'
}

export enum PriorityResolutionRule {
  CURRENT = 'current',
  INCOMING = 'incoming',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
  MANUAL = 'manual'
}

export interface ConflictResolutionResult {
  success: boolean;
  resolvedConflicts: string[];
  remainingConflicts: string[];
  newSchedule?: SchedulingResult;
  warnings: SchedulingWarning[];
  appliedChanges: AppliedChange[];
}

export interface AppliedChange {
  entityType: 'TASK' | 'DEPENDENCY' | 'RESOURCE';
  entityId: string;
  field: string;
  oldValue: any;
  newValue: any;
  strategy: string;
}

// Audit log types
export interface AuditLogQuery {
  projectId?: string;
  operation?: AuditOperation;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  limit?: number;
  offset?: number;
}

export type AuditOperation = 
  | 'calculate' 
  | 'apply' 
  | 'resolve' 
  | 'bulk_resolve'
  | 'preview'
  | 'integrity_check';

export interface AuditLogEntry {
  id: string;
  projectId: string;
  operation: AuditOperation;
  userId: string;
  userName: string;
  timestamp: Date;
  metadata: AuditMetadata;
  performanceData: PerformanceData;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  changes: ChangeRecord[];
}

export interface AuditMetadata {
  operation?: AuditOperation;
  algorithm?: string;
  conflictsDetected?: number;
  conflictsResolved?: number;
  tasksAffected?: number;
  scheduleChangeHours?: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface PerformanceData {
  calculationTime: number;
  memoryUsage: number;
  apiResponseTime: number;
  databaseQueryTime: number;
  cpuUsage?: number;
}

export interface ChangeRecord {
  entityType: 'TASK' | 'DEPENDENCY' | 'PROJECT' | 'SCHEDULE';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  field?: string;
  oldValue?: any;
  newValue?: any;
}

export interface AuditLogSummary {
  totalEntries: number;
  operationCounts: Record<AuditOperation, number>;
  averagePerformance: PerformanceData;
  topUsers: Array<{ userId: string; userName: string; operations: number }>;
  trends: AuditTrend[];
}

export interface AuditTrend {
  date: Date;
  operations: number;
  averageResponseTime: number;
  successRate: number;
}

// UI state types
export interface SchedulingUIState {
  isCalculating: boolean;
  calculationProgress: number;
  lastCalculation?: SchedulingResult;
  conflictsPanelOpen: boolean;
  detectedConflicts: DetectedConflict[];
  resolutionInProgress: boolean;
  auditLogVisible: boolean;
  selectedConflicts: string[];
  previewMode: boolean;
}

// Real-time notification types
export interface SchedulingNotification {
  id: string;
  type: 'CALCULATION_COMPLETE' | 'CONFLICT_DETECTED' | 'RESOLUTION_APPLIED' | 'ERROR';
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  timestamp: Date;
  projectId: string;
  userId?: string;
  metadata?: any;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'danger';
}

// Export utility types
export interface SchedulingExportOptions {
  format: 'CSV' | 'JSON' | 'EXCEL' | 'PDF';
  includeMetrics: boolean;
  includeWarnings: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SchedulingPreferences {
  autoRecalculate: boolean;
  notificationPreferences: NotificationPreferences;
  defaultAlgorithm: 'CPM' | 'PERT' | 'CRITICAL_CHAIN';
  defaultBufferPercentage: number;
  workingHours: WorkingHoursConfig;
}

export interface NotificationPreferences {
  calculations: boolean;
  conflicts: boolean;
  resolutions: boolean;
  errors: boolean;
  email: boolean;
  browser: boolean;
  slack: boolean;
}