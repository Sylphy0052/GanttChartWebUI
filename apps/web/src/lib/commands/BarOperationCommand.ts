/**
 * Bar Operation Commands for Gantt Chart Undo/Redo System
 * 
 * These commands handle bar move, resize, and progress update operations
 * that are performed in the GanttBar component. They integrate with the 
 * existing telemetry system and provide full undo/redo capabilities.
 */

import { BaseCommand, CommandContext } from './BaseCommand'
import { ganttPerformanceMonitor } from '@/lib/performance'

/**
 * Command for moving a task bar (changing both start and end dates)
 */
export class BarMoveCommand extends BaseCommand {
  private taskId: string
  private originalStartDate: Date
  private originalEndDate: Date
  private newStartDate: Date
  private newEndDate: Date
  private onExecute: (taskId: string, startDate: Date, endDate: Date) => Promise<void>

  constructor(params: {
    taskId: string
    originalStartDate: Date
    originalEndDate: Date
    newStartDate: Date
    newEndDate: Date
    onExecute: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
    context?: Partial<CommandContext>
  }) {
    const { taskId, originalStartDate, originalEndDate, newStartDate, newEndDate } = params
    
    const daysDelta = Math.round((newStartDate.getTime() - originalStartDate.getTime()) / (24 * 60 * 60 * 1000))
    const description = `Move task ${taskId}: ${daysDelta > 0 ? '+' : ''}${daysDelta} days`
    
    super('bar-move', description, params.context)
    
    this.taskId = taskId
    this.originalStartDate = new Date(originalStartDate)
    this.originalEndDate = new Date(originalEndDate)
    this.newStartDate = new Date(newStartDate)
    this.newEndDate = new Date(newEndDate)
    this.onExecute = params.onExecute
  }

  async execute(): Promise<void> {
    if (!this.validate()) {
      throw new Error('Invalid bar move command: new dates are invalid')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('bar-move-command')

    try {
      await this.onExecute(this.taskId, this.newStartDate, this.newEndDate)
      
      this.executed = true
      this.undone = false

      // Record telemetry
      await this.recordTelemetry('execute', startTime, true)
      
    } catch (error) {
      await this.recordTelemetry('execute', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('bar-move-command')
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      throw new Error('Cannot undo bar move command')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('bar-move-undo')

    try {
      await this.onExecute(this.taskId, this.originalStartDate, this.originalEndDate)
      
      this.undone = true

      // Record telemetry
      await this.recordTelemetry('undo', startTime, true)
      
    } catch (error) {
      await this.recordTelemetry('undo', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('bar-move-undo')
    }
  }

  validate(): boolean {
    // Ensure dates are valid and in correct order
    return this.newStartDate < this.newEndDate && 
           this.originalStartDate < this.originalEndDate &&
           !isNaN(this.newStartDate.getTime()) &&
           !isNaN(this.newEndDate.getTime())
  }

  private async recordTelemetry(operation: 'execute' | 'undo', startTime: number, success: boolean, error?: any) {
    const endTime = performance.now()
    const duration = endTime - startTime

    const telemetryData = {
      commandId: this.id,
      commandType: this.type,
      operation,
      taskId: this.taskId,
      duration,
      success,
      error: error?.message,
      originalDates: {
        startDate: this.originalStartDate.toISOString(),
        endDate: this.originalEndDate.toISOString()
      },
      newDates: {
        startDate: this.newStartDate.toISOString(),
        endDate: this.newEndDate.toISOString()
      },
      metadata: {
        daysDelta: Math.round((this.newStartDate.getTime() - this.originalStartDate.getTime()) / (24 * 60 * 60 * 1000)),
        durationChange: Math.round((this.newEndDate.getTime() - this.newStartDate.getTime() - (this.originalEndDate.getTime() - this.originalStartDate.getTime())) / (24 * 60 * 60 * 1000))
      },
      context: this.context,
      timestamp: new Date().toISOString()
    }

    console.log(`📊 Bar Move Command ${operation.toUpperCase()} Telemetry:`, telemetryData)
    
    // Record performance metrics
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: duration,
      taskCount: 1,
      timestamp: Date.now()
    })
  }

  // Getters for command introspection
  getTaskId(): string { return this.taskId }
  getOriginalDates(): { startDate: Date, endDate: Date } {
    return { startDate: this.originalStartDate, endDate: this.originalEndDate }
  }
  getNewDates(): { startDate: Date, endDate: Date } {
    return { startDate: this.newStartDate, endDate: this.newEndDate }
  }
}

/**
 * Command for resizing a task bar (changing either start or end date)
 */
export class BarResizeCommand extends BaseCommand {
  private taskId: string
  private originalStartDate: Date
  private originalEndDate: Date
  private newStartDate: Date
  private newEndDate: Date
  private resizeType: 'start' | 'end'
  private onExecute: (taskId: string, startDate: Date, endDate: Date) => Promise<void>

  constructor(params: {
    taskId: string
    originalStartDate: Date
    originalEndDate: Date
    newStartDate: Date
    newEndDate: Date
    resizeType: 'start' | 'end'
    onExecute: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
    context?: Partial<CommandContext>
  }) {
    const { taskId, originalStartDate, originalEndDate, newStartDate, newEndDate, resizeType } = params
    
    const originalDuration = Math.round((originalEndDate.getTime() - originalStartDate.getTime()) / (24 * 60 * 60 * 1000))
    const newDuration = Math.round((newEndDate.getTime() - newStartDate.getTime()) / (24 * 60 * 60 * 1000))
    const durationChange = newDuration - originalDuration
    
    const description = `Resize task ${taskId} (${resizeType}): ${durationChange > 0 ? '+' : ''}${durationChange} days`
    
    super('bar-resize', description, params.context)
    
    this.taskId = taskId
    this.originalStartDate = new Date(originalStartDate)
    this.originalEndDate = new Date(originalEndDate)
    this.newStartDate = new Date(newStartDate)
    this.newEndDate = new Date(newEndDate)
    this.resizeType = resizeType
    this.onExecute = params.onExecute
  }

  async execute(): Promise<void> {
    if (!this.validate()) {
      throw new Error('Invalid bar resize command: new dates are invalid')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('bar-resize-command')

    try {
      await this.onExecute(this.taskId, this.newStartDate, this.newEndDate)
      
      this.executed = true
      this.undone = false

      // Record telemetry
      await this.recordTelemetry('execute', startTime, true)
      
    } catch (error) {
      await this.recordTelemetry('execute', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('bar-resize-command')
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      throw new Error('Cannot undo bar resize command')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('bar-resize-undo')

    try {
      await this.onExecute(this.taskId, this.originalStartDate, this.originalEndDate)
      
      this.undone = true

      // Record telemetry
      await this.recordTelemetry('undo', startTime, true)
      
    } catch (error) {
      await this.recordTelemetry('undo', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('bar-resize-undo')
    }
  }

  validate(): boolean {
    return this.newStartDate < this.newEndDate && 
           this.originalStartDate < this.originalEndDate &&
           !isNaN(this.newStartDate.getTime()) &&
           !isNaN(this.newEndDate.getTime())
  }

  private async recordTelemetry(operation: 'execute' | 'undo', startTime: number, success: boolean, error?: any) {
    const endTime = performance.now()
    const duration = endTime - startTime

    const originalDuration = Math.round((this.originalEndDate.getTime() - this.originalStartDate.getTime()) / (24 * 60 * 60 * 1000))
    const newDuration = Math.round((this.newEndDate.getTime() - this.newStartDate.getTime()) / (24 * 60 * 60 * 1000))

    const telemetryData = {
      commandId: this.id,
      commandType: this.type,
      operation,
      taskId: this.taskId,
      resizeType: this.resizeType,
      duration,
      success,
      error: error?.message,
      originalDates: {
        startDate: this.originalStartDate.toISOString(),
        endDate: this.originalEndDate.toISOString(),
        duration: originalDuration
      },
      newDates: {
        startDate: this.newStartDate.toISOString(),
        endDate: this.newEndDate.toISOString(),
        duration: newDuration
      },
      metadata: {
        durationChange: newDuration - originalDuration,
        startDateChange: this.resizeType === 'start' ? Math.round((this.newStartDate.getTime() - this.originalStartDate.getTime()) / (24 * 60 * 60 * 1000)) : 0,
        endDateChange: this.resizeType === 'end' ? Math.round((this.newEndDate.getTime() - this.originalEndDate.getTime()) / (24 * 60 * 60 * 1000)) : 0
      },
      context: this.context,
      timestamp: new Date().toISOString()
    }

    console.log(`📊 Bar Resize Command ${operation.toUpperCase()} Telemetry:`, telemetryData)
    
    // Record performance metrics
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: duration,
      taskCount: 1,
      timestamp: Date.now()
    })
  }

  // Getters for command introspection
  getTaskId(): string { return this.taskId }
  getResizeType(): 'start' | 'end' { return this.resizeType }
  getOriginalDates(): { startDate: Date, endDate: Date } {
    return { startDate: this.originalStartDate, endDate: this.originalEndDate }
  }
  getNewDates(): { startDate: Date, endDate: Date } {
    return { startDate: this.newStartDate, endDate: this.newEndDate }
  }
}

/**
 * Command for updating task progress
 */
export class ProgressUpdateCommand extends BaseCommand {
  private taskId: string
  private originalProgress: number
  private newProgress: number
  private onExecute: (taskId: string, progress: number) => Promise<void>

  constructor(params: {
    taskId: string
    originalProgress: number
    newProgress: number
    onExecute: (taskId: string, progress: number) => Promise<void>
    context?: Partial<CommandContext>
  }) {
    const { taskId, originalProgress, newProgress } = params
    
    const progressChange = newProgress - originalProgress
    const description = `Update task ${taskId} progress: ${originalProgress}% → ${newProgress}% (${progressChange > 0 ? '+' : ''}${progressChange}%)`
    
    super('progress-update', description, params.context)
    
    this.taskId = taskId
    this.originalProgress = originalProgress
    this.newProgress = newProgress
    this.onExecute = params.onExecute
  }

  async execute(): Promise<void> {
    if (!this.validate()) {
      throw new Error('Invalid progress update command: progress values are invalid')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('progress-update-command')

    try {
      await this.onExecute(this.taskId, this.newProgress)
      
      this.executed = true
      this.undone = false

      // Record telemetry
      await this.recordTelemetry('execute', startTime, true)
      
    } catch (error) {
      await this.recordTelemetry('execute', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('progress-update-command')
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      throw new Error('Cannot undo progress update command')
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('progress-update-undo')

    try {
      await this.onExecute(this.taskId, this.originalProgress)
      
      this.undone = true

      // Record telemetry
      await this.recordTelemetry('undo', startTime, true)
      
    } catch (error) {
      await this.recordTelemetry('undo', startTime, false, error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('progress-update-undo')
    }
  }

  validate(): boolean {
    return this.newProgress >= 0 && this.newProgress <= 100 &&
           this.originalProgress >= 0 && this.originalProgress <= 100 &&
           !isNaN(this.newProgress) && !isNaN(this.originalProgress)
  }

  private async recordTelemetry(operation: 'execute' | 'undo', startTime: number, success: boolean, error?: any) {
    const endTime = performance.now()
    const duration = endTime - startTime

    const telemetryData = {
      commandId: this.id,
      commandType: this.type,
      operation,
      taskId: this.taskId,
      duration,
      success,
      error: error?.message,
      originalProgress: this.originalProgress,
      newProgress: this.newProgress,
      metadata: {
        progressChange: this.newProgress - this.originalProgress,
        progressDirection: this.newProgress > this.originalProgress ? 'increase' : 'decrease'
      },
      context: this.context,
      timestamp: new Date().toISOString()
    }

    console.log(`📊 Progress Update Command ${operation.toUpperCase()} Telemetry:`, telemetryData)
    
    // Record performance metrics
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: duration,
      taskCount: 1,
      timestamp: Date.now()
    })
  }

  // Getters for command introspection
  getTaskId(): string { return this.taskId }
  getOriginalProgress(): number { return this.originalProgress }
  getNewProgress(): number { return this.newProgress }
  getProgressChange(): number { return this.newProgress - this.originalProgress }
}