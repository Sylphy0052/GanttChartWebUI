/**
 * Progress Operation Telemetry Module
 * 
 * Implements AC7 for T015: Progress Management UI & Leaf Task Validation
 * 
 * Features:
 * - Progress change telemetry records operation timing and success metrics
 * - Comprehensive tracking of progress operations (single, batch, drag, input)
 * - Performance metrics and system health monitoring
 * - User interaction patterns and efficiency analysis
 * - Integration with audit logs and analytics systems
 */

import { ganttPerformanceMonitor } from '@/lib/performance'

/**
 * Progress operation types for telemetry tracking
 */
export type ProgressOperationType = 
  | 'single-update'
  | 'batch-update' 
  | 'drag-update'
  | 'input-update'
  | 'validation-check'
  | 'parent-computation'
  | 'undo-operation'
  | 'redo-operation'

/**
 * Interaction methods for progress operations
 */
export type ProgressInteractionType =
  | 'mouse-drag'
  | 'mouse-click'
  | 'keyboard-input'
  | 'keyboard-shortcut'
  | 'touch-gesture'
  | 'api-call'
  | 'batch-operation'

/**
 * Base telemetry data for progress operations
 */
export interface ProgressTelemetryData {
  // Operation identification
  operationId: string
  operationType: ProgressOperationType
  interactionType: ProgressInteractionType
  timestamp: string
  sessionId: string
  userId?: string
  projectId?: string
  
  // Task context
  taskId: string
  taskTitle: string
  taskType: 'leaf' | 'parent' | 'milestone'
  isLeafTask: boolean
  hasChildren: boolean
  childCount: number
  parentCount: number
  
  // Progress data
  progressChange: {
    from: number
    to: number
    delta: number
    isIncrease: boolean
    isSignificantChange: boolean
    percentageChange: number
  }
  
  // Performance metrics
  performance: {
    totalDuration: number
    validationDuration?: number
    executionDuration?: number
    renderDuration?: number
    networkDuration?: number
    success: boolean
    errorCount: number
    retryCount: number
  }
  
  // User interaction metrics
  interaction: {
    dragDistance?: number
    clickCount?: number
    keyPressCount?: number
    interactionDuration: number
    wasInterrupted: boolean
    hasGridSnapping?: boolean
    snapCount?: number
  }
  
  // System context
  system: {
    memoryUsage: number
    renderTime: number
    frameRate?: number
    viewportWidth: number
    viewportHeight: number
    deviceType: 'desktop' | 'tablet' | 'mobile'
    browserInfo: string
    connectionType?: string
  }
  
  // Validation results
  validation?: {
    isValid: boolean
    validationType: 'leaf-task' | 'range' | 'parent-computed' | 'custom'
    validationTime: number
    errorMessage?: string
    warningMessage?: string
  }
  
  // Error information
  error?: {
    type: string
    message: string
    stack?: string
    recoveryAttempted: boolean
    recoverySuccessful?: boolean
  }
}

/**
 * Batch operation telemetry data
 */
export interface BatchProgressTelemetryData extends Omit<ProgressTelemetryData, 'taskId' | 'taskTitle' | 'progressChange'> {
  batch: {
    batchId: string
    totalTasks: number
    leafTasks: number
    parentTasks: number
    successfulTasks: number
    failedTasks: number
    skippedTasks: number
    averageProgressChange: number
    totalProgressChange: number
    batchSize: 'small' | 'medium' | 'large' | 'xlarge' // <5, 5-20, 20-100, >100
  }
  
  tasks: Array<{
    taskId: string
    taskTitle: string
    progressChange: ProgressTelemetryData['progressChange']
    success: boolean
    error?: string
    duration: number
  }>
}

/**
 * Progress operation context for tracking
 */
export interface ProgressOperationContext {
  operationType: ProgressOperationType
  interactionType: ProgressInteractionType
  taskId: string
  taskTitle?: string
  isLeafTask?: boolean
  projectId?: string
  batchId?: string
  parentOperationId?: string
}

/**
 * Progress telemetry aggregation data
 */
export interface ProgressTelemetryAggregation {
  timeRange: {
    start: string
    end: string
    durationMs: number
  }
  
  operations: {
    total: number
    successful: number
    failed: number
    successRate: number
    byType: Record<ProgressOperationType, number>
    byInteraction: Record<ProgressInteractionType, number>
  }
  
  performance: {
    averageDuration: number
    medianDuration: number
    p95Duration: number
    p99Duration: number
    slowestOperation: number
    fastestOperation: number
    averageValidationTime: number
    averageExecutionTime: number
  }
  
  productivity: {
    tasksUpdated: number
    totalProgressChange: number
    averageProgressChange: number
    progressIncreases: number
    progressDecreases: number
    leafTaskUpdates: number
    parentTaskComputations: number
  }
  
  userBehavior: {
    preferredInteractionType: ProgressInteractionType
    averageInteractionDuration: number
    interruptionRate: number
    retryRate: number
    batchOperationUsage: number
    dragVsInputRatio: number
  }
  
  systemHealth: {
    averageMemoryUsage: number
    averageRenderTime: number
    performanceIssues: number
    errorRate: number
    mostCommonErrors: Array<{ error: string; count: number }>
  }
}

/**
 * Progress Telemetry Collector
 */
export class ProgressTelemetryCollector {
  private operationHistory: ProgressTelemetryData[] = []
  private batchHistory: BatchProgressTelemetryData[] = []
  private activeOperations = new Map<string, { startTime: number; context: ProgressOperationContext }>()
  private readonly maxHistorySize = 1000
  private readonly batchFlushSize = 10
  private sessionId: string
  
  constructor() {
    this.sessionId = `progress-session-${Date.now()}-${Math.random().toString(36).substring(2)}`
  }

  /**
   * Start tracking a progress operation
   */
  startOperation(context: ProgressOperationContext): string {
    const operationId = `${context.operationType}-${Date.now()}-${Math.random().toString(36).substring(2)}`
    
    this.activeOperations.set(operationId, {
      startTime: performance.now(),
      context
    })
    
    return operationId
  }

  /**
   * Record a completed progress operation
   */
  recordOperation(
    operationId: string,
    progressFrom: number,
    progressTo: number,
    success: boolean,
    additionalData?: Partial<ProgressTelemetryData>
  ): void {
    const operation = this.activeOperations.get(operationId)
    if (!operation) {
      console.warn('ProgressTelemetry: Operation not found:', operationId)
      return
    }

    const endTime = performance.now()
    const totalDuration = endTime - operation.startTime
    const progressDelta = progressTo - progressFrom
    
    const telemetryData: ProgressTelemetryData = {
      // Operation identification
      operationId,
      operationType: operation.context.operationType,
      interactionType: operation.context.interactionType,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      projectId: operation.context.projectId,
      
      // Task context
      taskId: operation.context.taskId,
      taskTitle: operation.context.taskTitle || 'Unknown Task',
      taskType: additionalData?.taskType || (additionalData?.isLeafTask ? 'leaf' : 'parent'),
      isLeafTask: additionalData?.isLeafTask ?? true,
      hasChildren: additionalData?.hasChildren ?? false,
      childCount: additionalData?.childCount ?? 0,
      parentCount: additionalData?.parentCount ?? 0,
      
      // Progress data
      progressChange: {
        from: progressFrom,
        to: progressTo,
        delta: progressDelta,
        isIncrease: progressDelta > 0,
        isSignificantChange: Math.abs(progressDelta) >= 1,
        percentageChange: progressFrom > 0 ? (progressDelta / progressFrom) * 100 : 0
      },
      
      // Performance metrics
      performance: {
        totalDuration,
        validationDuration: additionalData?.performance?.validationDuration,
        executionDuration: additionalData?.performance?.executionDuration,
        renderDuration: ganttPerformanceMonitor.getLastRenderTime(),
        networkDuration: additionalData?.performance?.networkDuration,
        success,
        errorCount: success ? 0 : 1,
        retryCount: additionalData?.performance?.retryCount ?? 0
      },
      
      // User interaction metrics
      interaction: {
        dragDistance: additionalData?.interaction?.dragDistance,
        clickCount: additionalData?.interaction?.clickCount ?? 1,
        keyPressCount: additionalData?.interaction?.keyPressCount,
        interactionDuration: totalDuration,
        wasInterrupted: additionalData?.interaction?.wasInterrupted ?? false,
        hasGridSnapping: additionalData?.interaction?.hasGridSnapping,
        snapCount: additionalData?.interaction?.snapCount
      },
      
      // System context
      system: {
        memoryUsage: ganttPerformanceMonitor.getMemoryUsage(),
        renderTime: ganttPerformanceMonitor.getLastRenderTime(),
        frameRate: this.estimateFrameRate(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        deviceType: this.detectDeviceType(),
        browserInfo: navigator.userAgent,
        connectionType: this.getConnectionType()
      },
      
      // Validation results
      validation: additionalData?.validation,
      
      // Error information
      error: additionalData?.error,
      
      // Merge any additional data
      ...additionalData
    }

    // Add to history
    this.operationHistory.push(telemetryData)
    this.cleanupHistory()

    // Remove from active operations
    this.activeOperations.delete(operationId)

    // Send telemetry
    this.sendTelemetry(telemetryData)
  }

  /**
   * Record a batch progress operation
   */
  recordBatchOperation(
    batchId: string,
    batchData: Omit<BatchProgressTelemetryData, 'operationId' | 'timestamp' | 'sessionId'>
  ): void {
    const telemetryData: BatchProgressTelemetryData = {
      operationId: `batch-${batchId}`,
      operationType: 'batch-update',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...batchData
    }

    this.batchHistory.push(telemetryData)
    this.sendBatchTelemetry(telemetryData)
  }

  /**
   * Get operation statistics for the current session
   */
  getOperationStats(): ProgressTelemetryAggregation {
    const operations = this.operationHistory
    const now = new Date().toISOString()
    const sessionStart = operations.length > 0 ? operations[0].timestamp : now
    
    return {
      timeRange: {
        start: sessionStart,
        end: now,
        durationMs: Date.now() - new Date(sessionStart).getTime()
      },
      
      operations: {
        total: operations.length,
        successful: operations.filter(op => op.performance.success).length,
        failed: operations.filter(op => !op.performance.success).length,
        successRate: operations.length > 0 ? (operations.filter(op => op.performance.success).length / operations.length) * 100 : 0,
        byType: this.countByProperty(operations, 'operationType'),
        byInteraction: this.countByProperty(operations, 'interactionType')
      },
      
      performance: {
        averageDuration: this.average(operations.map(op => op.performance.totalDuration)),
        medianDuration: this.median(operations.map(op => op.performance.totalDuration)),
        p95Duration: this.percentile(operations.map(op => op.performance.totalDuration), 95),
        p99Duration: this.percentile(operations.map(op => op.performance.totalDuration), 99),
        slowestOperation: Math.max(...operations.map(op => op.performance.totalDuration), 0),
        fastestOperation: Math.min(...operations.map(op => op.performance.totalDuration), Infinity),
        averageValidationTime: this.average(operations.map(op => op.performance.validationDuration).filter((val): val is number => val !== undefined)),
        averageExecutionTime: this.average(operations.map(op => op.performance.executionDuration).filter((val): val is number => val !== undefined))
      },
      
      productivity: {
        tasksUpdated: operations.length,
        totalProgressChange: operations.reduce((sum, op) => sum + Math.abs(op.progressChange.delta), 0),
        averageProgressChange: this.average(operations.map(op => Math.abs(op.progressChange.delta))),
        progressIncreases: operations.filter(op => op.progressChange.isIncrease).length,
        progressDecreases: operations.filter(op => !op.progressChange.isIncrease).length,
        leafTaskUpdates: operations.filter(op => op.isLeafTask).length,
        parentTaskComputations: operations.filter(op => !op.isLeafTask).length
      },
      
      userBehavior: {
        preferredInteractionType: this.mostCommon(operations.map(op => op.interactionType)) || 'mouse-click',
        averageInteractionDuration: this.average(operations.map(op => op.interaction.interactionDuration)),
        interruptionRate: operations.filter(op => op.interaction.wasInterrupted).length / operations.length * 100,
        retryRate: operations.filter(op => op.performance.retryCount > 0).length / operations.length * 100,
        batchOperationUsage: this.batchHistory.length,
        dragVsInputRatio: this.calculateDragVsInputRatio(operations)
      },
      
      systemHealth: {
        averageMemoryUsage: this.average(operations.map(op => op.system.memoryUsage)),
        averageRenderTime: this.average(operations.map(op => op.system.renderTime)),
        performanceIssues: operations.filter(op => op.performance.totalDuration > 500).length,
        errorRate: operations.filter(op => !op.performance.success).length / operations.length * 100,
        mostCommonErrors: this.getMostCommonErrors(operations)
      }
    }
  }

  /**
   * Clear telemetry history
   */
  clearHistory(): void {
    this.operationHistory = []
    this.batchHistory = []
    this.activeOperations.clear()
  }

  /**
   * Export telemetry data for analysis
   */
  exportData(): {
    operations: ProgressTelemetryData[]
    batches: BatchProgressTelemetryData[]
    stats: ProgressTelemetryAggregation
  } {
    return {
      operations: [...this.operationHistory],
      batches: [...this.batchHistory],
      stats: this.getOperationStats()
    }
  }

  // Private helper methods

  private cleanupHistory(): void {
    if (this.operationHistory.length > this.maxHistorySize) {
      const excess = this.operationHistory.length - this.maxHistorySize
      this.operationHistory.splice(0, excess)
    }
  }

  private sendTelemetry(data: ProgressTelemetryData): void {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Progress Operation Telemetry:', data)
    }
    
    // In production, send to analytics service
    // this.sendToAnalyticsService(data)
    
    // Send to audit logs if available
    // this.sendToAuditLogs(data)
  }

  private sendBatchTelemetry(data: BatchProgressTelemetryData): void {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Batch Progress Operation Telemetry:', data)
    }
    
    // In production, send to analytics service
    // this.sendBatchToAnalyticsService(data)
  }

  private estimateFrameRate(): number {
    // Simple frame rate estimation based on render time
    const renderTime = ganttPerformanceMonitor.getLastRenderTime()
    return renderTime > 0 ? Math.min(60, 1000 / renderTime) : 60
  }

  private detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
    const width = window.innerWidth
    if (width >= 1024) return 'desktop'
    if (width >= 768) return 'tablet'
    return 'mobile'
  }

  private getConnectionType(): string | undefined {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    return connection?.effectiveType
  }

  private countByProperty<T>(items: T[], property: keyof T): Record<string, number> {
    return items.reduce((counts, item) => {
      const key = String(item[property])
      counts[key] = (counts[key] || 0) + 1
      return counts
    }, {} as Record<string, number>)
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0
  }

  private median(numbers: number[]): number {
    const sorted = numbers.sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  private percentile(numbers: number[], p: number): number {
    const sorted = numbers.sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)] || 0
  }

  private mostCommon<T>(items: T[]): T | null {
    const counts = items.reduce((acc, item) => {
      acc.set(item, (acc.get(item) || 0) + 1)
      return acc
    }, new Map<T, number>())

    let maxCount = 0
    let mostCommonItem: T | null = null
    
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonItem = item
      }
    })
    
    return mostCommonItem
  }

  private calculateDragVsInputRatio(operations: ProgressTelemetryData[]): number {
    const dragOps = operations.filter(op => op.interactionType.includes('drag')).length
    const inputOps = operations.filter(op => op.interactionType.includes('input')).length
    return inputOps > 0 ? dragOps / inputOps : dragOps > 0 ? Infinity : 0
  }

  private getMostCommonErrors(operations: ProgressTelemetryData[]): Array<{ error: string; count: number }> {
    const errorCounts = new Map<string, number>()
    
    operations.forEach(op => {
      if (op.error) {
        const error = op.error.message || op.error.type
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1)
      }
    })
    
    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }
}

// Global progress telemetry instance
export const progressTelemetry = new ProgressTelemetryCollector()

/**
 * Convenience functions for common telemetry operations
 */
export const trackProgressOperation = {
  /**
   * Track a single progress update operation
   */
  single: (
    taskId: string,
    interactionType: ProgressInteractionType,
    progressFrom: number,
    progressTo: number,
    success: boolean,
    additionalData?: Partial<ProgressTelemetryData>
  ) => {
    const operationId = progressTelemetry.startOperation({
      operationType: 'single-update',
      interactionType,
      taskId
    })
    
    progressTelemetry.recordOperation(operationId, progressFrom, progressTo, success, additionalData)
  },

  /**
   * Track a drag progress update operation
   */
  drag: (
    taskId: string,
    progressFrom: number,
    progressTo: number,
    dragDistance: number,
    success: boolean,
    snapCount?: number
  ) => {
    const operationId = progressTelemetry.startOperation({
      operationType: 'drag-update',
      interactionType: 'mouse-drag',
      taskId
    })
    
    progressTelemetry.recordOperation(operationId, progressFrom, progressTo, success, {
      interaction: {
        dragDistance,
        interactionDuration: 0, // Will be calculated automatically
        wasInterrupted: false,
        hasGridSnapping: (snapCount ?? 0) > 0,
        snapCount
      }
    })
  },

  /**
   * Track a batch progress update operation
   */
  batch: (batchData: Omit<BatchProgressTelemetryData, 'operationId' | 'timestamp' | 'sessionId'>) => {
    progressTelemetry.recordBatchOperation(`batch-${Date.now()}`, batchData)
  },

  /**
   * Track a validation operation
   */
  validation: (taskId: string, isValid: boolean, validationType: string, duration: number) => {
    const operationId = progressTelemetry.startOperation({
      operationType: 'validation-check',
      interactionType: 'api-call',
      taskId
    })
    
    progressTelemetry.recordOperation(operationId, 0, 0, isValid, {
      validation: {
        isValid,
        validationType: validationType as any,
        validationTime: duration
      }
    })
  }
}

/**
 * React hook for progress telemetry
 */
export function useProgressTelemetry() {
  return {
    trackOperation: trackProgressOperation,
    getStats: () => progressTelemetry.getOperationStats(),
    exportData: () => progressTelemetry.exportData(),
    clearHistory: () => progressTelemetry.clearHistory()
  }
}