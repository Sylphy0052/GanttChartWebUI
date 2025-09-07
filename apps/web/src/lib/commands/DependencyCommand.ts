/**
 * Dependency Command Implementation for Undo/Redo System
 * 
 * Provides undoable operations for dependency creation and deletion.
 * Integrates with the existing useDependencies hook and maintains
 * dependency state consistency during undo/redo operations.
 */

import { BaseCommand, Command, CommandContext } from './BaseCommand'
import { GanttDependency } from '@/types/gantt'

/**
 * Parameters for dependency operations
 */
interface DependencyOperationParams {
  projectId: string
  predecessorId: string
  successorId: string
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF'
  lag?: number
  
  // Dependency state management
  existingDependency?: GanttDependency
  
  // Callback functions for actual API operations
  onExecuteCreate?: (predecessorId: string, successorId: string) => Promise<void>
  onExecuteDelete?: (predecessorId: string, successorId: string) => Promise<void>
  
  // State management callbacks
  onStateUpdate?: (dependencies: GanttDependency[]) => void
}

/**
 * Command for creating a new dependency relationship
 */
export class DependencyCreateCommand extends BaseCommand {
  private params: DependencyOperationParams
  private createdDependency?: GanttDependency

  constructor(params: DependencyOperationParams, context?: Partial<CommandContext>) {
    const description = `Create dependency: ${params.predecessorId} → ${params.successorId}`
    super('dependency-create', description, context)
    this.params = params
  }

  async execute(): Promise<void> {
    if (!this.params.onExecuteCreate) {
      throw new Error('Create callback not provided')
    }

    try {
      // Validate dependency doesn't already exist
      if (this.params.existingDependency) {
        throw new Error(`Dependency already exists: ${this.params.predecessorId} → ${this.params.successorId}`)
      }

      // Execute the actual API call
      await this.params.onExecuteCreate(this.params.predecessorId, this.params.successorId)

      // Store the created dependency for undo
      this.createdDependency = {
        id: `dep_${this.params.predecessorId}_${this.params.successorId}_${Date.now()}`,
        predecessorId: this.params.predecessorId,
        successorId: this.params.successorId,
        fromTaskId: this.params.predecessorId,
        toTaskId: this.params.successorId,
        type: this.params.dependencyType || 'FS',
        lag: this.params.lag || 0,
        lagUnit: 'hours' as const
      }

      this.executed = true
      this.undone = false
      
    } catch (error) {
      console.error('Failed to create dependency:', error)
      throw error
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo() || !this.createdDependency || !this.params.onExecuteDelete) {
      return
    }

    try {
      // Delete the dependency
      await this.params.onExecuteDelete(
        this.createdDependency.predecessorId,
        this.createdDependency.successorId
      )

      this.undone = true
      
    } catch (error) {
      console.error('Failed to undo dependency creation:', error)
      throw error
    }
  }

  validate(): boolean {
    if (!this.params.projectId || !this.params.predecessorId || !this.params.successorId) {
      return false
    }

    // Prevent self-dependencies
    if (this.params.predecessorId === this.params.successorId) {
      return false
    }

    return true
  }

  getCreatedDependency(): GanttDependency | undefined {
    return this.createdDependency
  }

  getDependencyParams(): DependencyOperationParams {
    return { ...this.params }
  }
}

/**
 * Command for deleting an existing dependency relationship
 */
export class DependencyDeleteCommand extends BaseCommand {
  private params: DependencyOperationParams
  private deletedDependency?: GanttDependency

  constructor(params: DependencyOperationParams, context?: Partial<CommandContext>) {
    const description = `Delete dependency: ${params.predecessorId} → ${params.successorId}`
    super('dependency-delete', description, context)
    this.params = params
    
    // Store the existing dependency for restoration during undo
    this.deletedDependency = params.existingDependency
  }

  async execute(): Promise<void> {
    if (!this.params.onExecuteDelete || !this.deletedDependency) {
      throw new Error('Delete callback or existing dependency not provided')
    }

    try {
      // Execute the actual API call
      await this.params.onExecuteDelete(this.params.predecessorId, this.params.successorId)

      this.executed = true
      this.undone = false
      
    } catch (error) {
      console.error('Failed to delete dependency:', error)
      throw error
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo() || !this.deletedDependency || !this.params.onExecuteCreate) {
      return
    }

    try {
      // Recreate the dependency
      await this.params.onExecuteCreate(
        this.deletedDependency.predecessorId,
        this.deletedDependency.successorId
      )

      this.undone = true
      
    } catch (error) {
      console.error('Failed to undo dependency deletion:', error)
      throw error
    }
  }

  validate(): boolean {
    if (!this.params.projectId || !this.params.predecessorId || !this.params.successorId) {
      return false
    }

    // Must have existing dependency to delete
    if (!this.deletedDependency) {
      return false
    }

    return true
  }

  getDeletedDependency(): GanttDependency | undefined {
    return this.deletedDependency
  }

  getDependencyParams(): DependencyOperationParams {
    return { ...this.params }
  }
}

/**
 * Factory for creating dependency commands
 */
export class DependencyCommandFactory {
  /**
   * Create a dependency create command
   */
  static createDependencyCreateCommand(params: DependencyOperationParams): DependencyCreateCommand {
    return new DependencyCreateCommand(params, {
      metadata: {
        operationType: 'create',
        dependencyType: params.dependencyType || 'FS',
        lag: params.lag || 0
      }
    })
  }

  /**
   * Create a dependency delete command
   */
  static createDependencyDeleteCommand(params: DependencyOperationParams): DependencyDeleteCommand {
    if (!params.existingDependency) {
      throw new Error('Existing dependency required for delete command')
    }

    return new DependencyDeleteCommand(params, {
      metadata: {
        operationType: 'delete',
        dependencyId: params.existingDependency.id,
        dependencyType: params.existingDependency.type,
        lag: params.existingDependency.lag
      }
    })
  }
}

/**
 * Utility functions for dependency command operations
 */
export class DependencyCommandUtils {
  /**
   * Check if two tasks can have a dependency relationship
   */
  static canCreateDependency(
    predecessorId: string, 
    successorId: string, 
    existingDependencies: GanttDependency[]
  ): { canCreate: boolean; reason?: string } {
    // Check for self-dependency
    if (predecessorId === successorId) {
      return { canCreate: false, reason: 'Cannot create dependency from task to itself' }
    }

    // Check if dependency already exists
    const existing = existingDependencies.find(
      dep => dep.predecessorId === predecessorId && dep.successorId === successorId
    )
    if (existing) {
      return { canCreate: false, reason: 'Dependency already exists' }
    }

    // Check for circular dependency (basic check - would create direct reverse)
    const reverse = existingDependencies.find(
      dep => dep.predecessorId === successorId && dep.successorId === predecessorId
    )
    if (reverse) {
      return { canCreate: false, reason: 'Would create circular dependency' }
    }

    // More complex circular dependency checking would require graph traversal
    // This is a simplified check for the most obvious cases

    return { canCreate: true }
  }

  /**
   * Find existing dependency between two tasks
   */
  static findDependency(
    predecessorId: string,
    successorId: string,
    dependencies: GanttDependency[]
  ): GanttDependency | undefined {
    return dependencies.find(
      dep => dep.predecessorId === predecessorId && dep.successorId === successorId
    )
  }

  /**
   * Get all dependencies involving a specific task
   */
  static getTaskDependencies(
    taskId: string,
    dependencies: GanttDependency[]
  ): { predecessors: GanttDependency[]; successors: GanttDependency[] } {
    const predecessors = dependencies.filter(dep => dep.successorId === taskId)
    const successors = dependencies.filter(dep => dep.predecessorId === taskId)
    
    return { predecessors, successors }
  }

  /**
   * Validate command parameters
   */
  static validateParams(params: DependencyOperationParams): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!params.projectId?.trim()) {
      errors.push('Project ID is required')
    }

    if (!params.predecessorId?.trim()) {
      errors.push('Predecessor ID is required')
    }

    if (!params.successorId?.trim()) {
      errors.push('Successor ID is required')
    }

    if (params.predecessorId === params.successorId) {
      errors.push('Predecessor and successor cannot be the same task')
    }

    if (params.dependencyType && !['FS', 'SS', 'FF', 'SF'].includes(params.dependencyType)) {
      errors.push('Invalid dependency type')
    }

    if (params.lag && (isNaN(params.lag) || params.lag < 0)) {
      errors.push('Lag must be a non-negative number')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}