/**
 * Auto-Scheduling Command - Composite Command for T010 AC4 & AC5
 * 
 * This command wraps a primary operation (bar move/resize) with automatic scheduling
 * adjustments for dependent tasks. It ensures that all auto-generated changes are
 * included in a single undo operation, satisfying AC5 requirements.
 * 
 * Features:
 * - Wraps primary bar operations with dependency scheduling
 * - Creates composite commands for atomic undo/redo
 * - Integrates with existing telemetry and performance monitoring
 * - Handles cascading dependency updates
 */

import { BaseCommand, Command, CommandContext } from './BaseCommand'
import { BarMoveCommand, BarResizeCommand } from './BarOperationCommand'
import { DependencyScheduler, SchedulingContext, SchedulingResult, SchedulingOptions } from '@/lib/scheduling/dependencyScheduler'
import { GanttTask, GanttDependency } from '@/types/gantt'
import { ganttPerformanceMonitor } from '@/lib/performance'

export interface AutoSchedulingParams {
  primaryCommand: BarMoveCommand | BarResizeCommand
  tasks: GanttTask[]
  dependencies: GanttDependency[]
  onTaskUpdate: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
  schedulingOptions?: Partial<SchedulingOptions>
  context?: Partial<CommandContext>
}

/**
 * Auto-scheduling command that handles automatic scheduling of dependent tasks
 * when a predecessor task is moved or resized. Uses composite pattern for atomic undo.
 */
export class AutoSchedulingCommand extends BaseCommand {
  private primaryCommand: BarMoveCommand | BarResizeCommand
  private schedulingCommands: BarMoveCommand[] = []
  private schedulingResult: SchedulingResult | null = null
  private scheduler: DependencyScheduler
  private tasks: GanttTask[]
  private dependencies: GanttDependency[]
  private onTaskUpdate: (taskId: string, startDate: Date, endDate: Date) => Promise<void>

  constructor(params: AutoSchedulingParams) {
    const { primaryCommand, tasks, dependencies, onTaskUpdate, schedulingOptions, context } = params
    
    // Create description based on primary command
    const description = `Auto-schedule: ${primaryCommand.description} + dependencies`
    
    super('auto-scheduling', description, context)
    
    this.primaryCommand = primaryCommand
    this.tasks = tasks
    this.dependencies = dependencies
    this.onTaskUpdate = onTaskUpdate
    this.scheduler = new DependencyScheduler(schedulingOptions)
  }

  async execute(): Promise<void> {
    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('auto-scheduling-command')

    try {
      // First, calculate what the scheduling adjustments would be
      this.calculateSchedulingAdjustments()

      // Create commands for auto-scheduling adjustments
      this.createSchedulingCommands()

      // Record telemetry before execution
      await this.recordPreExecutionTelemetry(startTime)

      // Execute primary command first
      await this.primaryCommand.execute()

      // Then execute all scheduling commands
      for (const schedulingCommand of this.schedulingCommands) {
        await schedulingCommand.execute()
      }

      this.executed = true
      this.undone = false

      // Record success telemetry
      await this.recordTelemetry('execute', startTime, true)

    } catch (error) {
      // Rollback any executed commands
      await this.rollback()
      await this.recordTelemetry('execute', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('auto-scheduling-command')
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      throw new Error('Cannot undo auto-scheduling command')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('auto-scheduling-undo')

    try {
      // Undo scheduling commands in reverse order first
      for (let i = this.schedulingCommands.length - 1; i >= 0; i--) {
        const command = this.schedulingCommands[i]
        if (command.canUndo()) {
          await command.undo()
        }
      }

      // Then undo the primary command
      if (this.primaryCommand.canUndo()) {
        await this.primaryCommand.undo()
      }

      this.undone = true

      // Record success telemetry
      await this.recordTelemetry('undo', startTime, true)

    } catch (error) {
      await this.recordTelemetry('undo', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('auto-scheduling-undo')
    }
  }

  /**
   * Rollback any partially executed commands
   */
  private async rollback(): Promise<void> {
    // Undo scheduling commands in reverse order
    for (let i = this.schedulingCommands.length - 1; i >= 0; i--) {
      const command = this.schedulingCommands[i]
      try {
        if (command.canUndo()) {
          await command.undo()
        }
      } catch (rollbackError) {
        console.error('Rollback failed for scheduling command:', command.id, rollbackError)
      }
    }

    // Undo primary command
    try {
      if (this.primaryCommand.canUndo()) {
        await this.primaryCommand.undo()
      }
    } catch (rollbackError) {
      console.error('Rollback failed for primary command:', this.primaryCommand.id, rollbackError)
    }
  }

  /**
   * Calculate what scheduling adjustments need to be made
   */
  private calculateSchedulingAdjustments(): void {
    // Get the task being modified from the primary command
    const taskId = this.primaryCommand.getTaskId()
    const originalDates = this.primaryCommand.getOriginalDates()
    const newDates = this.primaryCommand.getNewDates()

    // Create scheduling context
    const schedulingContext: SchedulingContext = {
      tasks: this.tasks,
      dependencies: this.dependencies,
      modifiedTaskId: taskId,
      modifiedTask: {
        originalStartDate: originalDates.startDate,
        originalEndDate: originalDates.endDate,
        newStartDate: newDates.startDate,
        newEndDate: newDates.endDate
      }
    }

    // Calculate scheduling adjustments
    this.schedulingResult = this.scheduler.calculateSchedulingAdjustments(schedulingContext)

    // Validate the result
    const validation = this.scheduler.validateSchedulingResult(this.schedulingResult, this.tasks)
    if (!validation.isValid) {
      throw new Error(`Auto-scheduling validation failed: ${validation.errors.join(', ')}`)
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Auto-scheduling warnings:', validation.warnings)
    }
  }

  /**
   * Create commands for the automatic scheduling adjustments
   */
  private createSchedulingCommands(): void {
    if (!this.schedulingResult || this.schedulingResult.affectedTasks.length === 0) {
      return
    }

    // Create a bar move command for each affected task
    this.schedulingCommands = this.schedulingResult.affectedTasks.map((affectedTask, index) => {
      return new BarMoveCommand({
        taskId: affectedTask.taskId,
        originalStartDate: affectedTask.originalStartDate,
        originalEndDate: affectedTask.originalEndDate,
        newStartDate: affectedTask.newStartDate,
        newEndDate: affectedTask.newEndDate,
        onExecute: this.onTaskUpdate,
        context: {
          ...this.context,
          metadata: {
            ...this.context.metadata,
            autoScheduled: true,
            reason: affectedTask.reason,
            primaryCommandId: this.primaryCommand.id,
            schedulingIndex: index
          }
        }
      })
    })
  }

  /**
   * Record telemetry before execution to capture planning metrics
   */
  private async recordPreExecutionTelemetry(startTime: number): Promise<void> {
    if (!this.schedulingResult) return

    const planningTime = performance.now() - startTime

    const telemetryData = {
      commandId: this.id,
      commandType: this.type,
      operation: 'planning',
      primaryCommandId: this.primaryCommand.id,
      primaryCommandType: this.primaryCommand.type,
      planningTime,
      schedulingResult: {
        totalAffectedTasks: this.schedulingResult.totalAffectedTasks,
        cascadingLevels: this.schedulingResult.cascadingLevels,
        dependencyChainLength: this.schedulingResult.dependencyChain.length,
        affectedTaskIds: this.schedulingResult.affectedTasks.map(t => t.taskId)
      },
      context: this.context,
      timestamp: new Date().toISOString()
    }

    console.log('📊 Auto-Scheduling Planning Telemetry:', telemetryData)
  }

  /**
   * Record detailed telemetry for auto-scheduling operations
   */
  private async recordTelemetry(
    operation: 'execute' | 'undo',
    startTime: number,
    success: boolean,
    error?: any
  ): Promise<void> {
    const endTime = performance.now()
    const duration = endTime - startTime

    const telemetryData = {
      commandId: this.id,
      commandType: this.type,
      operation,
      primaryCommandId: this.primaryCommand.id,
      primaryCommandType: this.primaryCommand.type,
      duration,
      success,
      error: error?.message,
      totalCommands: 1 + this.schedulingCommands.length,
      schedulingMetrics: this.schedulingResult ? {
        totalAffectedTasks: this.schedulingResult.totalAffectedTasks,
        cascadingLevels: this.schedulingResult.cascadingLevels,
        dependencyChainLength: this.schedulingResult.dependencyChain.length,
        maxDependencyChain: this.schedulingResult.dependencyChain.join(' → '),
        affectedTaskSummary: this.schedulingResult.affectedTasks.map(t => ({
          taskId: t.taskId,
          startShift: Math.round((t.newStartDate.getTime() - t.originalStartDate.getTime()) / (24 * 60 * 60 * 1000)),
          endShift: Math.round((t.newEndDate.getTime() - t.originalEndDate.getTime()) / (24 * 60 * 60 * 1000))
        }))
      } : null,
      performance: {
        commandExecutionTime: duration,
        averageCommandTime: duration / (1 + this.schedulingCommands.length),
        taskUpdatesPerSecond: this.schedulingResult ? (this.schedulingResult.totalAffectedTasks + 1) / (duration / 1000) : 0
      },
      context: this.context,
      timestamp: new Date().toISOString()
    }

    console.log(`📊 Auto-Scheduling Command ${operation.toUpperCase()} Telemetry:`, telemetryData)

    // Record performance metrics
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: duration,
      taskCount: (this.schedulingResult?.totalAffectedTasks || 0) + 1,
      timestamp: Date.now()
    })
  }

  /**
   * Enhanced validation that includes scheduling validation
   */
  validate(): boolean {
    // Validate primary command
    if (!this.primaryCommand.validate()) {
      return false
    }

    // If we have scheduling result, validate it
    if (this.schedulingResult) {
      const validation = this.scheduler.validateSchedulingResult(this.schedulingResult, this.tasks)
      return validation.isValid
    }

    return true
  }

  /**
   * Get the scheduling result (for debugging and testing)
   */
  getSchedulingResult(): SchedulingResult | null {
    return this.schedulingResult
  }

  /**
   * Get the primary command that triggered the auto-scheduling
   */
  getPrimaryCommand(): BarMoveCommand | BarResizeCommand {
    return this.primaryCommand
  }

  /**
   * Get affected task IDs from the scheduling result
   */
  getAffectedTaskIds(): string[] {
    if (!this.schedulingResult) return []
    return this.schedulingResult.affectedTasks.map(t => t.taskId)
  }

  /**
   * Get the dependency chain that was affected
   */
  getDependencyChain(): string[] {
    if (!this.schedulingResult) return []
    return this.schedulingResult.dependencyChain
  }

  /**
   * Get all commands involved in this auto-scheduling operation
   */
  getAllCommands(): Command[] {
    return [this.primaryCommand, ...this.schedulingCommands]
  }

  /**
   * Get count of total commands (primary + scheduling)
   */
  getCommandCount(): number {
    return 1 + this.schedulingCommands.length
  }
}

/**
 * Factory function to create auto-scheduling commands
 */
export const createAutoSchedulingCommand = (params: AutoSchedulingParams): AutoSchedulingCommand => {
  return new AutoSchedulingCommand(params)
}

/**
 * Utility function to check if auto-scheduling is needed for a task operation
 */
export const shouldEnableAutoScheduling = (
  taskId: string,
  dependencies: GanttDependency[]
): boolean => {
  // Check if this task has any successors that would be affected
  return dependencies.some(dep => 
    (dep.predecessorId === taskId || dep.fromTaskId === taskId) && 
    dep.type === 'FS'
  )
}

/**
 * Utility function to estimate the impact of auto-scheduling
 */
export const estimateSchedulingImpact = (
  taskId: string,
  tasks: GanttTask[],
  dependencies: GanttDependency[]
): {
  estimatedAffectedTasks: number
  maxCascadingLevels: number
  hasCircularDependencies: boolean
} => {
  const scheduler = new DependencyScheduler({ enableCircularDetection: true })
  
  // Create a mock scheduling context for estimation
  const mockContext: SchedulingContext = {
    tasks,
    dependencies,
    modifiedTaskId: taskId,
    modifiedTask: {
      originalStartDate: new Date(),
      originalEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day later
      newStartDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Shifted 1 day
      newEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Shifted 1 day
    }
  }

  try {
    const result = scheduler.calculateSchedulingAdjustments(mockContext)
    return {
      estimatedAffectedTasks: result.totalAffectedTasks,
      maxCascadingLevels: result.cascadingLevels,
      hasCircularDependencies: false // Would throw error if circular deps found
    }
  } catch (error) {
    return {
      estimatedAffectedTasks: 0,
      maxCascadingLevels: 0,
      hasCircularDependencies: error?.message?.includes('circular') || false
    }
  }
}