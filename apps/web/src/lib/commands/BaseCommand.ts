/**
 * Base Command Pattern Implementation for Undo/Redo System
 * 
 * This provides the foundation for all undoable operations in the Gantt chart.
 * Each operation (bar move, resize, dependency create/delete, issue edit) 
 * will implement this interface to enable undo/redo functionality.
 */

export interface CommandContext {
  timestamp: number
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
}

export interface Command {
  /** Unique identifier for the command */
  id: string
  
  /** Human-readable description of the operation */
  description: string
  
  /** Type of operation for telemetry and categorization */
  type: 'bar-move' | 'bar-resize' | 'progress-update' | 'dependency-create' | 'dependency-delete' | 'issue-edit' | 'composite' | 'auto-scheduling'
  
  /** Execute the command (do/redo) */
  execute(): Promise<void> | void
  
  /** Undo the command */
  undo(): Promise<void> | void
  
  /** Check if the command can be undone */
  canUndo(): boolean
  
  /** Check if the command can be redone */
  canRedo(): boolean
  
  /** Context information for telemetry and debugging */
  context: CommandContext
  
  /** Serialize command for persistence (optional) */
  serialize?(): string
  
  /** Validate command before execution */
  validate?(): boolean
}

/**
 * Abstract base class implementing common command functionality
 */
export abstract class BaseCommand implements Command {
  public readonly id: string
  public readonly description: string
  public readonly type: Command['type']
  public readonly context: CommandContext
  protected executed = false
  protected undone = false

  constructor(
    type: Command['type'],
    description: string,
    context?: Partial<CommandContext>
  ) {
    this.id = this.generateId()
    this.type = type
    this.description = description
    this.context = {
      timestamp: Date.now(),
      sessionId: `session-${Date.now()}`,
      ...context
    }
  }

  abstract execute(): Promise<void> | void
  abstract undo(): Promise<void> | void

  canUndo(): boolean {
    return this.executed && !this.undone
  }

  canRedo(): boolean {
    return this.executed && this.undone
  }

  validate(): boolean {
    return true
  }

  serialize(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      description: this.description,
      context: this.context,
      executed: this.executed,
      undone: this.undone
    })
  }

  private generateId(): string {
    return `cmd_${this.type}_${Math.random().toString(36).substring(2)}_${Date.now()}`
  }
}

/**
 * Composite command for operations that involve multiple sub-commands
 * This is essential for auto-scheduling where one operation may trigger multiple changes
 */
export class CompositeCommand extends BaseCommand {
  private commands: Command[] = []

  constructor(
    description: string,
    commands: Command[] = [],
    context?: Partial<CommandContext>
  ) {
    super('composite', description, context)
    this.commands = [...commands]
  }

  addCommand(command: Command): void {
    this.commands.push(command)
  }

  async execute(): Promise<void> {
    try {
      for (const command of this.commands) {
        await command.execute()
      }
      this.executed = true
      this.undone = false
    } catch (error) {
      // If any command fails, undo all previously executed commands
      await this.rollback()
      throw error
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) return

    try {
      // Undo commands in reverse order
      for (let i = this.commands.length - 1; i >= 0; i--) {
        const command = this.commands[i]
        if (command.canUndo()) {
          await command.undo()
        }
      }
      this.undone = true
    } catch (error) {
      console.error('Failed to undo composite command:', error)
      throw error
    }
  }

  private async rollback(): Promise<void> {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const command = this.commands[i]
      try {
        if (command.canUndo()) {
          await command.undo()
        }
      } catch (rollbackError) {
        console.error('Rollback failed for command:', command.id, rollbackError)
      }
    }
  }

  canUndo(): boolean {
    return this.executed && !this.undone && this.commands.some(cmd => cmd.canUndo())
  }

  canRedo(): boolean {
    return this.executed && this.undone && this.commands.some(cmd => cmd.canRedo())
  }

  validate(): boolean {
    return this.commands.every(cmd => !cmd.validate || cmd.validate())
  }

  getCommands(): Command[] {
    return [...this.commands]
  }

  getCommandCount(): number {
    return this.commands.length
  }
}

/**
 * Command execution result for telemetry and error handling
 */
export interface CommandResult {
  success: boolean
  command: Command
  executionTime: number
  error?: Error
  metadata?: Record<string, any>
}

/**
 * Command factory utility for creating typed commands
 */
export class CommandFactory {
  static createBarMoveCommand = (params: {
    taskId: string
    originalStartDate: Date
    originalEndDate: Date
    newStartDate: Date
    newEndDate: Date
    onExecute: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
  }) => {
    const { BarMoveCommand } = require('./BarOperationCommand')
    return new BarMoveCommand(params)
  }

  static createBarResizeCommand = (params: {
    taskId: string
    originalStartDate: Date
    originalEndDate: Date
    newStartDate: Date
    newEndDate: Date
    resizeType: 'start' | 'end'
    onExecute: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
  }) => {
    const { BarResizeCommand } = require('./BarOperationCommand')
    return new BarResizeCommand(params)
  }

  static createProgressUpdateCommand = (params: {
    taskId: string
    originalProgress: number
    newProgress: number
    onExecute: (taskId: string, progress: number) => Promise<void>
  }) => {
    const { ProgressUpdateCommand } = require('./BarOperationCommand')
    return new ProgressUpdateCommand(params)
  }

  static createAutoSchedulingCommand = (params: {
    primaryCommand: any // BarMoveCommand | BarResizeCommand
    tasks: any[]
    dependencies: any[]
    onTaskUpdate: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
    schedulingOptions?: any
  }) => {
    const { AutoSchedulingCommand } = require('./AutoSchedulingCommand')
    return new AutoSchedulingCommand(params)
  }

  static createCompositeCommand = (description: string, commands: Command[] = []) => {
    return new CompositeCommand(description, commands)
  }
}