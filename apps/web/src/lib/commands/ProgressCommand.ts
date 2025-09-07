/**
 * Progress Update Command Implementation for Undo/Redo System
 * 
 * Implements AC2-AC7 for T015: Progress Management UI & Leaf Task Validation
 * 
 * Features:
 * - Progress update operations with validation
 * - Leaf task validation (parent tasks cannot be edited)
 * - Batch progress updates for multiple tasks
 * - Integration with undo/redo system
 * - Comprehensive telemetry recording
 */

import { BaseCommand, Command, CommandContext, CompositeCommand } from './BaseCommand'
import { ganttPerformanceMonitor } from '@/lib/performance'

/**
 * Parameters for single progress update operation
 */
interface ProgressUpdateParams {
  taskId: string
  originalProgress: number
  newProgress: number
  isLeafTask?: boolean
  parentTaskIds?: string[] // For validation
  childTaskIds?: string[] // For parent progress computation
  
  // Validation settings
  skipLeafValidation?: boolean
  allowParentTaskUpdate?: boolean
  
  // Callback functions
  onExecute?: (taskId: string, progress: number) => Promise<void>
  onValidateLeafTask?: (taskId: string) => Promise<boolean>
  onComputeParentProgress?: (parentId: string, childIds: string[]) => Promise<number>
  
  // Metadata for telemetry
  source?: 'drag' | 'input' | 'batch' | 'api'
  interactionType?: 'mouse' | 'keyboard' | 'touch'
  duration?: number // Duration of interaction in ms
}

/**
 * Parameters for batch progress update operation
 */
interface BatchProgressUpdateParams {
  updates: ProgressUpdateParams[]
  batchId?: string
  description?: string
  
  // Validation options
  validateAllLeafTasks?: boolean
  stopOnFirstError?: boolean
  
  // Callback functions
  onBatchExecute?: (updates: ProgressUpdateParams[]) => Promise<void>
  onBatchValidate?: (updates: ProgressUpdateParams[]) => Promise<{ valid: boolean; errors: string[] }>
  onProgressCallback?: (completed: number, total: number) => void
}

/**
 * Command for updating a single task's progress
 */
export class ProgressUpdateCommand extends BaseCommand {
  private params: ProgressUpdateParams
  private validationResult?: { isLeaf: boolean; canUpdate: boolean; reason?: string }
  private executionMetrics: {
    startTime: number
    endTime?: number
    validationTime?: number
    executionTime?: number
    success: boolean
    errorMessage?: string
  }

  constructor(params: ProgressUpdateParams, context?: Partial<CommandContext>) {
    const description = `Update progress: ${params.taskId} (${params.originalProgress}% → ${params.newProgress}%)`
    super('progress-update', description, context)
    this.params = params
    this.executionMetrics = {
      startTime: performance.now(),
      success: false
    }
  }

  async execute(): Promise<void> {
    const validationStart = performance.now()
    
    try {
      // Validate leaf task constraint (AC4)
      if (!this.params.skipLeafValidation) {
        this.validationResult = await this.validateLeafTask()
        if (!this.validationResult.canUpdate) {
          throw new Error(this.validationResult.reason || 'Cannot update progress for non-leaf task')
        }
      }

      this.executionMetrics.validationTime = performance.now() - validationStart

      // Execute the progress update
      if (this.params.onExecute) {
        await this.params.onExecute(this.params.taskId, this.params.newProgress)
      }

      // Update parent task progress if needed (AC3)
      if (this.params.parentTaskIds && this.params.onComputeParentProgress) {
        for (const parentId of this.params.parentTaskIds) {
          const parentProgress = await this.params.onComputeParentProgress(
            parentId, 
            this.params.childTaskIds || []
          )
          if (this.params.onExecute) {
            await this.params.onExecute(parentId, parentProgress)
          }
        }
      }

      this.executed = true
      this.undone = false
      this.executionMetrics.success = true
      this.executionMetrics.endTime = performance.now()
      this.executionMetrics.executionTime = this.executionMetrics.endTime - this.executionMetrics.startTime

      // Record telemetry (AC7)
      await this.recordTelemetry()
      
    } catch (error) {
      this.executionMetrics.success = false
      this.executionMetrics.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.executionMetrics.endTime = performance.now()
      this.executionMetrics.executionTime = this.executionMetrics.endTime - this.executionMetrics.startTime
      
      // Record failure telemetry
      await this.recordTelemetry()
      
      console.error('Failed to update progress:', error)
      throw error
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) return

    const undoStartTime = performance.now()

    try {
      // Restore original progress
      if (this.params.onExecute) {
        await this.params.onExecute(this.params.taskId, this.params.originalProgress)
      }

      // Update parent task progress if needed
      if (this.params.parentTaskIds && this.params.onComputeParentProgress) {
        for (const parentId of this.params.parentTaskIds) {
          const parentProgress = await this.params.onComputeParentProgress(
            parentId,
            this.params.childTaskIds || []
          )
          if (this.params.onExecute) {
            await this.params.onExecute(parentId, parentProgress)
          }
        }
      }

      this.undone = true

      // Record undo telemetry
      await this.recordTelemetry('undo', performance.now() - undoStartTime)
      
    } catch (error) {
      console.error('Failed to undo progress update:', error)
      throw error
    }
  }

  validate(): boolean {
    if (!this.params.taskId) return false
    if (this.params.newProgress < 0 || this.params.newProgress > 100) return false
    if (this.params.originalProgress < 0 || this.params.originalProgress > 100) return false
    return true
  }

  /**
   * Validate leaf task constraint
   */
  private async validateLeafTask(): Promise<{ isLeaf: boolean; canUpdate: boolean; reason?: string }> {
    // Use provided validation function if available
    if (this.params.onValidateLeafTask) {
      const isLeaf = await this.params.onValidateLeafTask(this.params.taskId)
      if (!isLeaf && !this.params.allowParentTaskUpdate) {
        return {
          isLeaf: false,
          canUpdate: false,
          reason: 'Cannot edit progress of parent tasks. Progress is computed from children.'
        }
      }
      return { isLeaf, canUpdate: true }
    }

    // Fallback validation using provided flags
    if (this.params.isLeafTask === false && !this.params.allowParentTaskUpdate) {
      return {
        isLeaf: false,
        canUpdate: false,
        reason: 'This task has subtasks. Progress is automatically calculated from children.'
      }
    }

    return { isLeaf: this.params.isLeafTask !== false, canUpdate: true }
  }

  /**
   * Record comprehensive telemetry (AC7)
   */
  private async recordTelemetry(operation: 'execute' | 'undo' = 'execute', operationTime?: number): Promise<void> {
    try {
      const telemetryData = {
        // Command identification
        commandId: this.id,
        commandType: this.type,
        operation,
        taskId: this.params.taskId,
        
        // Progress data
        progressChange: {
          from: this.params.originalProgress,
          to: this.params.newProgress,
          delta: this.params.newProgress - this.params.originalProgress,
          isIncrease: this.params.newProgress > this.params.originalProgress
        },
        
        // Validation results
        validation: this.validationResult,
        
        // Performance metrics
        performance: {
          totalTime: operationTime || this.executionMetrics.executionTime || 0,
          validationTime: this.executionMetrics.validationTime || 0,
          executionTime: (this.executionMetrics.executionTime || 0) - (this.executionMetrics.validationTime || 0),
          success: operation === 'undo' ? true : this.executionMetrics.success,
          errorMessage: this.executionMetrics.errorMessage
        },
        
        // Interaction context
        interaction: {
          source: this.params.source || 'unknown',
          type: this.params.interactionType || 'unknown',
          duration: this.params.duration || 0,
          timestamp: new Date().toISOString()
        },
        
        // System metrics
        system: {
          memoryUsage: ganttPerformanceMonitor.getMemoryUsage(),
          renderTime: ganttPerformanceMonitor.getLastRenderTime(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        },
        
        // Context metadata
        context: {
          ...this.context,
          parentTaskCount: this.params.parentTaskIds?.length || 0,
          childTaskCount: this.params.childTaskIds?.length || 0,
          hasValidation: !!this.params.onValidateLeafTask,
          batchOperation: false
        }
      }

      // Record to performance monitor
      ganttPerformanceMonitor.recordMetrics({
        progressUpdateTime: telemetryData.performance.totalTime,
        progressValidationTime: telemetryData.performance.validationTime,
        taskCount: 1,
        operationType: 'progress-update',
        success: telemetryData.performance.success,
        timestamp: Date.now()
      })

      // Log telemetry (in production, this would be sent to analytics service)
      console.log('📊 Progress Update Telemetry:', telemetryData)

      // TODO: Send to audit logs API
      // await auditLogsApi.recordProgressOperation(telemetryData)

    } catch (error) {
      console.warn('Failed to record progress update telemetry:', error)
    }
  }

  getParams(): ProgressUpdateParams {
    return { ...this.params }
  }

  getValidationResult() {
    return this.validationResult
  }

  getExecutionMetrics() {
    return { ...this.executionMetrics }
  }
}

/**
 * Command for batch progress updates (AC6)
 */
export class BatchProgressUpdateCommand extends CompositeCommand {
  private batchParams: BatchProgressUpdateParams
  private batchMetrics: {
    startTime: number
    endTime?: number
    totalTasks: number
    successfulTasks: number
    failedTasks: number
    validationTime?: number
    executionTime?: number
    errors: string[]
  }

  constructor(params: BatchProgressUpdateParams, context?: Partial<CommandContext>) {
    const description = params.description || `Batch update progress: ${params.updates.length} tasks`
    super(description, [], context)
    this.batchParams = params
    this.batchMetrics = {
      startTime: performance.now(),
      totalTasks: params.updates.length,
      successfulTasks: 0,
      failedTasks: 0,
      errors: []
    }

    // Generate batch ID if not provided
    if (!this.batchParams.batchId) {
      this.batchParams.batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2)}`
    }
  }

  async execute(): Promise<void> {
    const validationStart = performance.now()

    try {
      // Validate batch if validator provided
      if (this.batchParams.onBatchValidate) {
        const validationResult = await this.batchParams.onBatchValidate(this.batchParams.updates)
        if (!validationResult.valid) {
          throw new Error(`Batch validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      this.batchMetrics.validationTime = performance.now() - validationStart

      // Create individual progress commands
      const commands: ProgressUpdateCommand[] = []
      for (let i = 0; i < this.batchParams.updates.length; i++) {
        const update = this.batchParams.updates[i]
        
        // Mark as batch operation for telemetry
        const batchUpdate = {
          ...update,
          source: 'batch' as const
        }
        
        const command = new ProgressUpdateCommand(batchUpdate, {
          ...this.context,
          metadata: {
            ...this.context.metadata,
            batchId: this.batchParams.batchId,
            batchIndex: i,
            batchSize: this.batchParams.updates.length
          }
        })

        commands.push(command)
        this.addCommand(command)
      }

      // Execute with progress callback
      for (let i = 0; i < commands.length; i++) {
        try {
          await commands[i].execute()
          this.batchMetrics.successfulTasks++
          
          // Call progress callback
          if (this.batchParams.onProgressCallback) {
            this.batchParams.onProgressCallback(i + 1, commands.length)
          }
          
        } catch (error) {
          this.batchMetrics.failedTasks++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          this.batchMetrics.errors.push(`Task ${commands[i].getParams().taskId}: ${errorMsg}`)
          
          if (this.batchParams.stopOnFirstError) {
            throw error
          }
        }
      }

      // Execute batch callback if provided
      if (this.batchParams.onBatchExecute) {
        await this.batchParams.onBatchExecute(this.batchParams.updates)
      }

      this.executed = true
      this.undone = false
      this.batchMetrics.endTime = performance.now()
      this.batchMetrics.executionTime = this.batchMetrics.endTime - this.batchMetrics.startTime

      // Record batch telemetry
      await this.recordBatchTelemetry()

      // Throw error if any tasks failed and we haven't stopped already
      if (this.batchMetrics.failedTasks > 0) {
        console.warn(`Batch progress update completed with ${this.batchMetrics.failedTasks} failures:`, this.batchMetrics.errors)
      }

    } catch (error) {
      this.batchMetrics.endTime = performance.now()
      this.batchMetrics.executionTime = this.batchMetrics.endTime - this.batchMetrics.startTime
      
      await this.recordBatchTelemetry(false, error)
      throw error
    }
  }

  /**
   * Record comprehensive batch telemetry
   */
  private async recordBatchTelemetry(success: boolean = true, error?: any): Promise<void> {
    try {
      const telemetryData = {
        // Batch identification
        batchId: this.batchParams.batchId,
        commandId: this.id,
        commandType: this.type,
        operation: 'batch-execute',
        
        // Batch statistics
        batch: {
          totalTasks: this.batchMetrics.totalTasks,
          successfulTasks: this.batchMetrics.successfulTasks,
          failedTasks: this.batchMetrics.failedTasks,
          successRate: (this.batchMetrics.successfulTasks / this.batchMetrics.totalTasks) * 100,
          errors: this.batchMetrics.errors
        },
        
        // Performance metrics
        performance: {
          totalTime: this.batchMetrics.executionTime || 0,
          validationTime: this.batchMetrics.validationTime || 0,
          averageTimePerTask: (this.batchMetrics.executionTime || 0) / this.batchMetrics.totalTasks,
          success,
          errorMessage: error instanceof Error ? error.message : undefined
        },
        
        // Progress data analysis
        progressAnalysis: {
          totalProgressChange: this.batchParams.updates.reduce((sum, update) => 
            sum + (update.newProgress - update.originalProgress), 0
          ),
          averageProgressChange: this.batchParams.updates.reduce((sum, update) => 
            sum + (update.newProgress - update.originalProgress), 0
          ) / this.batchParams.updates.length,
          progressIncreases: this.batchParams.updates.filter(update => 
            update.newProgress > update.originalProgress
          ).length,
          progressDecreases: this.batchParams.updates.filter(update => 
            update.newProgress < update.originalProgress
          ).length
        },
        
        // System metrics
        system: {
          memoryUsage: ganttPerformanceMonitor.getMemoryUsage(),
          renderTime: ganttPerformanceMonitor.getLastRenderTime(),
          timestamp: new Date().toISOString()
        },
        
        // Context
        context: this.context
      }

      // Record to performance monitor
      ganttPerformanceMonitor.recordMetrics({
        batchProgressUpdateTime: telemetryData.performance.totalTime,
        batchValidationTime: telemetryData.performance.validationTime,
        taskCount: telemetryData.batch.totalTasks,
        operationType: 'batch-progress-update',
        success: telemetryData.performance.success,
        successRate: telemetryData.batch.successRate,
        timestamp: Date.now()
      })

      // Log batch telemetry
      console.log('📊 Batch Progress Update Telemetry:', telemetryData)

      // TODO: Send to audit logs API
      // await auditLogsApi.recordBatchProgressOperation(telemetryData)

    } catch (telemetryError) {
      console.warn('Failed to record batch progress update telemetry:', telemetryError)
    }
  }

  getBatchParams(): BatchProgressUpdateParams {
    return { ...this.batchParams }
  }

  getBatchMetrics() {
    return { ...this.batchMetrics }
  }

  getBatchId(): string {
    return this.batchParams.batchId!
  }
}

/**
 * Factory for creating progress commands
 */
export class ProgressCommandFactory {
  /**
   * Create single progress update command
   */
  static createProgressUpdateCommand(params: ProgressUpdateParams): ProgressUpdateCommand {
    return new ProgressUpdateCommand(params, {
      metadata: {
        operationType: 'single-progress-update',
        source: params.source || 'unknown',
        interactionType: params.interactionType || 'unknown'
      }
    })
  }

  /**
   * Create batch progress update command
   */
  static createBatchProgressUpdateCommand(params: BatchProgressUpdateParams): BatchProgressUpdateCommand {
    return new BatchProgressUpdateCommand(params, {
      metadata: {
        operationType: 'batch-progress-update',
        batchSize: params.updates.length,
        batchId: params.batchId
      }
    })
  }
}

/**
 * Utility functions for progress operations
 */
export class ProgressUtils {
  /**
   * Validate progress value
   */
  static validateProgress(progress: number): { valid: boolean; error?: string } {
    if (typeof progress !== 'number' || isNaN(progress)) {
      return { valid: false, error: 'Progress must be a valid number' }
    }
    if (progress < 0) {
      return { valid: false, error: 'Progress cannot be negative' }
    }
    if (progress > 100) {
      return { valid: false, error: 'Progress cannot exceed 100%' }
    }
    return { valid: true }
  }

  /**
   * Calculate parent progress from children
   */
  static calculateParentProgress(childProgresses: number[]): number {
    if (childProgresses.length === 0) return 0
    const sum = childProgresses.reduce((total, progress) => total + progress, 0)
    return Math.round(sum / childProgresses.length)
  }

  /**
   * Format progress change for display
   */
  static formatProgressChange(from: number, to: number): string {
    const delta = to - from
    if (delta === 0) return `${to}% (no change)`
    const sign = delta > 0 ? '+' : ''
    return `${to}% (${sign}${delta}%)`
  }

  /**
   * Check if progress change is significant
   */
  static isSignificantChange(from: number, to: number, threshold: number = 1): boolean {
    return Math.abs(to - from) >= threshold
  }
}