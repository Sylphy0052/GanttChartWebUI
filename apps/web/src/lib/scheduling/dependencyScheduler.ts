/**
 * Dependency Scheduler - Core Auto-Scheduling Logic for T010 AC4
 * 
 * This module implements the automatic task scheduling algorithm that handles
 * Finish-to-Start (FS) dependencies with cascading updates when predecessor tasks move.
 * 
 * Features:
 * - FS constraint logic with configurable lag time
 * - Cascading dependency resolution (A→B→C chains)
 * - Efficient calculation for large dependency graphs
 * - Integration with existing command system
 */

import { GanttTask, GanttDependency } from '@/types/gantt'

export interface SchedulingContext {
  tasks: GanttTask[]
  dependencies: GanttDependency[]
  modifiedTaskId: string
  modifiedTask: {
    originalStartDate: Date
    originalEndDate: Date
    newStartDate: Date
    newEndDate: Date
  }
}

export interface SchedulingResult {
  affectedTasks: {
    taskId: string
    originalStartDate: Date
    originalEndDate: Date
    newStartDate: Date
    newEndDate: Date
    reason: string
  }[]
  dependencyChain: string[]
  totalAffectedTasks: number
  cascadingLevels: number
}

export interface SchedulingOptions {
  defaultLag: number // in hours
  maxCascadingDepth: number
  preserveTaskDuration: boolean
  enableCircularDetection: boolean
}

const DEFAULT_OPTIONS: SchedulingOptions = {
  defaultLag: 0,
  maxCascadingDepth: 10,
  preserveTaskDuration: true,
  enableCircularDetection: true
}

/**
 * Core dependency scheduler class that implements the auto-scheduling algorithm
 */
export class DependencyScheduler {
  private options: SchedulingOptions

  constructor(options: Partial<SchedulingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Calculate auto-scheduling adjustments when a predecessor task moves
   * This is the main entry point for AC4 implementation
   */
  calculateSchedulingAdjustments(context: SchedulingContext): SchedulingResult {
    const { tasks, dependencies, modifiedTaskId, modifiedTask } = context
    
    // Build task lookup map for efficient access
    const taskMap = new Map<string, GanttTask>()
    tasks.forEach(task => taskMap.set(task.id, task))

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(dependencies)
    
    // Detect circular dependencies if enabled
    if (this.options.enableCircularDetection) {
      const circularDeps = this.detectCircularDependencies(dependencyGraph)
      if (circularDeps.length > 0) {
        console.warn('Circular dependencies detected:', circularDeps)
      }
    }

    // Find all successor tasks affected by the modification
    const affectedTasks: SchedulingResult['affectedTasks'] = []
    const dependencyChain: string[] = [modifiedTaskId]
    const processed = new Set<string>()

    // Calculate cascading effects
    this.calculateCascadingEffects({
      taskId: modifiedTaskId,
      taskMap,
      dependencyGraph,
      affectedTasks,
      dependencyChain,
      processed,
      modifiedTask,
      level: 0
    })

    return {
      affectedTasks,
      dependencyChain,
      totalAffectedTasks: affectedTasks.length,
      cascadingLevels: this.calculateMaxLevel(dependencyChain, dependencyGraph)
    }
  }

  /**
   * Build a directed graph representation of dependencies
   */
  private buildDependencyGraph(dependencies: GanttDependency[]): Map<string, string[]> {
    const graph = new Map<string, string[]>()

    // Only process FS (Finish-to-Start) dependencies for now
    const fsDependencies = dependencies.filter(dep => dep.type === 'FS')

    fsDependencies.forEach(dependency => {
      const predecessorId = dependency.predecessorId || dependency.fromTaskId
      const successorId = dependency.successorId || dependency.toTaskId

      if (!graph.has(predecessorId)) {
        graph.set(predecessorId, [])
      }
      graph.get(predecessorId)!.push(successorId)
    })

    return graph
  }

  /**
   * Detect circular dependencies in the graph using DFS
   */
  private detectCircularDependencies(graph: Map<string, string[]>): string[][] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle - extract the cycle path
        const cycleStart = path.indexOf(nodeId)
        cycles.push(path.slice(cycleStart).concat(nodeId))
        return
      }

      if (visited.has(nodeId)) return

      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)

      const successors = graph.get(nodeId) || []
      successors.forEach(successorId => {
        dfs(successorId, [...path])
      })

      recursionStack.delete(nodeId)
    }

    // Check all nodes for cycles
    graph.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId, [])
      }
    })

    return cycles
  }

  /**
   * Calculate cascading effects of a task modification
   */
  private calculateCascadingEffects(params: {
    taskId: string
    taskMap: Map<string, GanttTask>
    dependencyGraph: Map<string, string[]>
    affectedTasks: SchedulingResult['affectedTasks']
    dependencyChain: string[]
    processed: Set<string>
    modifiedTask?: {
      originalStartDate: Date
      originalEndDate: Date
      newStartDate: Date
      newEndDate: Date
    }
    level: number
  }): void {
    const { 
      taskId, 
      taskMap, 
      dependencyGraph, 
      affectedTasks, 
      dependencyChain, 
      processed, 
      modifiedTask,
      level 
    } = params

    // Prevent infinite recursion
    if (level > this.options.maxCascadingDepth) {
      console.warn(`Maximum cascading depth (${this.options.maxCascadingDepth}) reached for task ${taskId}`)
      return
    }

    if (processed.has(taskId)) return
    processed.add(taskId)

    const successors = dependencyGraph.get(taskId) || []
    const currentTask = taskMap.get(taskId)

    if (!currentTask) return

    // Determine the end date of the current task
    let predecessorEndDate: Date
    if (modifiedTask && taskId === dependencyChain[0]) {
      // This is the originally modified task
      predecessorEndDate = modifiedTask.newEndDate
    } else {
      // Find the affected task entry or use current task end date
      const affectedTask = affectedTasks.find(t => t.taskId === taskId)
      predecessorEndDate = affectedTask ? affectedTask.newEndDate : new Date(currentTask.endDate)
    }

    successors.forEach(successorId => {
      const successorTask = taskMap.get(successorId)
      if (!successorTask) return

      // Calculate required start date for successor (FS constraint)
      const lagTime = this.options.defaultLag * 60 * 60 * 1000 // Convert hours to milliseconds
      const requiredStartDate = new Date(predecessorEndDate.getTime() + lagTime)

      const currentStartDate = new Date(successorTask.startDate)
      const currentEndDate = new Date(successorTask.endDate)

      // Only adjust if the required start date is later than current start date
      if (requiredStartDate > currentStartDate) {
        const taskDuration = currentEndDate.getTime() - currentStartDate.getTime()
        const newStartDate = new Date(requiredStartDate)
        const newEndDate = this.options.preserveTaskDuration 
          ? new Date(requiredStartDate.getTime() + taskDuration)
          : new Date(currentEndDate)

        // Add to affected tasks
        affectedTasks.push({
          taskId: successorId,
          originalStartDate: currentStartDate,
          originalEndDate: currentEndDate,
          newStartDate,
          newEndDate,
          reason: `FS dependency from task ${taskId} (lag: ${this.options.defaultLag}h)`
        })

        // Add to dependency chain if not already present
        if (!dependencyChain.includes(successorId)) {
          dependencyChain.push(successorId)
        }

        // Recursively process successors of this task
        this.calculateCascadingEffects({
          taskId: successorId,
          taskMap,
          dependencyGraph,
          affectedTasks,
          dependencyChain,
          processed: new Set(processed), // Create new set to avoid cross-branch interference
          level: level + 1
        })
      }
    })
  }

  /**
   * Calculate the maximum dependency level in the chain
   */
  private calculateMaxLevel(chain: string[], graph: Map<string, string[]>): number {
    let maxLevel = 0
    const levels = new Map<string, number>()
    
    const calculateLevel = (taskId: string): number => {
      if (levels.has(taskId)) return levels.get(taskId)!

      const successors = graph.get(taskId) || []
      let level = 0

      successors.forEach(successorId => {
        if (chain.includes(successorId)) {
          level = Math.max(level, calculateLevel(successorId) + 1)
        }
      })

      levels.set(taskId, level)
      return level
    }

    chain.forEach(taskId => {
      maxLevel = Math.max(maxLevel, calculateLevel(taskId))
    })

    return maxLevel
  }

  /**
   * Validate scheduling result for consistency
   */
  validateSchedulingResult(result: SchedulingResult, originalTasks: GanttTask[]): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for date consistency
    result.affectedTasks.forEach(affectedTask => {
      if (affectedTask.newStartDate >= affectedTask.newEndDate) {
        errors.push(`Task ${affectedTask.taskId}: New start date is not before end date`)
      }

      if (isNaN(affectedTask.newStartDate.getTime()) || isNaN(affectedTask.newEndDate.getTime())) {
        errors.push(`Task ${affectedTask.taskId}: Invalid date values`)
      }
    })

    // Check for excessive cascading
    if (result.cascadingLevels > 5) {
      warnings.push(`High cascading depth detected: ${result.cascadingLevels} levels`)
    }

    // Check for large number of affected tasks
    if (result.totalAffectedTasks > originalTasks.length * 0.5) {
      warnings.push(`Large number of affected tasks: ${result.totalAffectedTasks}/${originalTasks.length}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

/**
 * Utility functions for scheduling operations
 */
export const SchedulingUtils = {
  /**
   * Create a new scheduler instance with default options
   */
  createDefaultScheduler(): DependencyScheduler {
    return new DependencyScheduler()
  },

  /**
   * Create a scheduler with custom options
   */
  createScheduler(options: Partial<SchedulingOptions>): DependencyScheduler {
    return new DependencyScheduler(options)
  },

  /**
   * Calculate the working days between two dates (simple implementation)
   */
  calculateWorkingDays(startDate: Date, endDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay)
    
    // Simple approximation: 5 working days per 7 calendar days
    return Math.round(daysDiff * (5/7))
  },

  /**
   * Add working days to a date (simple implementation)
   */
  addWorkingDays(date: Date, days: number): Date {
    const msPerDay = 24 * 60 * 60 * 1000
    // Simple approximation: multiply by 7/5 to account for weekends
    const calendarDays = Math.round(days * (7/5))
    return new Date(date.getTime() + (calendarDays * msPerDay))
  },

  /**
   * Format scheduling result for debugging
   */
  formatSchedulingResult(result: SchedulingResult): string {
    const lines = [
      `Scheduling Result:`,
      `  Affected Tasks: ${result.totalAffectedTasks}`,
      `  Cascading Levels: ${result.cascadingLevels}`,
      `  Dependency Chain: ${result.dependencyChain.join(' → ')}`,
      `  Affected Tasks Details:`
    ]

    result.affectedTasks.forEach((task, index) => {
      lines.push(`    ${index + 1}. ${task.taskId}`)
      lines.push(`       ${task.originalStartDate.toISOString().split('T')[0]} → ${task.newStartDate.toISOString().split('T')[0]} (start)`)
      lines.push(`       ${task.originalEndDate.toISOString().split('T')[0]} → ${task.newEndDate.toISOString().split('T')[0]} (end)`)
      lines.push(`       Reason: ${task.reason}`)
    })

    return lines.join('\n')
  }
}