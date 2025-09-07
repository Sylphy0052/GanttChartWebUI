/**
 * Auto-Scheduling Hook for T010 AC4 & AC5
 * 
 * This hook integrates automatic dependency scheduling with the existing
 * undo/redo system. It wraps bar operations with auto-scheduling logic
 * and ensures all changes are atomic for undo operations.
 * 
 * Features:
 * - Automatic successor task scheduling when predecessors move
 * - Integration with existing undo/redo system
 * - Performance monitoring and telemetry
 * - Configurable scheduling options
 */

'use client'

import { useCallback, useMemo } from 'react'
import { GanttTask, GanttDependency } from '@/types/gantt'
import { useUndoRedo } from './useUndoRedo'
import { useDependencies } from './useDependencies'
import { 
  AutoSchedulingCommand, 
  createAutoSchedulingCommand, 
  shouldEnableAutoScheduling,
  estimateSchedulingImpact
} from '@/lib/commands/AutoSchedulingCommand'
import { BarMoveCommand, BarResizeCommand } from '@/lib/commands/BarOperationCommand'
import { SchedulingOptions } from '@/lib/scheduling/dependencyScheduler'
import { ganttPerformanceMonitor } from '@/lib/performance'

export interface AutoSchedulingConfig {
  enabled: boolean
  schedulingOptions?: Partial<SchedulingOptions>
  performanceThreshold?: number // Max execution time in ms
  maxAffectedTasks?: number // Max number of tasks that can be auto-adjusted
  showPreview?: boolean // Show preview of affected tasks before execution
}

export interface AutoSchedulingHookResult {
  // Core functions
  executeBarMoveWithScheduling: (params: BarMoveParams) => Promise<void>
  executeBarResizeWithScheduling: (params: BarResizeParams) => Promise<void>
  
  // Configuration
  config: AutoSchedulingConfig
  updateConfig: (newConfig: Partial<AutoSchedulingConfig>) => void
  
  // Analysis functions
  analyzeSchedulingImpact: (taskId: string) => Promise<SchedulingImpactAnalysis>
  isAutoSchedulingAvailable: (taskId: string) => boolean
  
  // State
  isProcessing: boolean
  lastSchedulingResult: AutoSchedulingResult | null
}

export interface BarMoveParams {
  taskId: string
  originalStartDate: Date
  originalEndDate: Date
  newStartDate: Date
  newEndDate: Date
}

export interface BarResizeParams extends BarMoveParams {
  resizeType: 'start' | 'end'
}

export interface SchedulingImpactAnalysis {
  willTriggerScheduling: boolean
  estimatedAffectedTasks: number
  maxCascadingLevels: number
  hasCircularDependencies: boolean
  estimatedExecutionTime: number // in ms
  recommendedAction: 'proceed' | 'review' | 'abort'
}

export interface AutoSchedulingResult {
  primaryTaskId: string
  affectedTaskIds: string[]
  dependencyChain: string[]
  executionTime: number
  success: boolean
  error?: string
}

interface UseAutoSchedulingOptions {
  projectId: string
  tasks: GanttTask[]
  onTaskUpdate: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
  config?: Partial<AutoSchedulingConfig>
}

const DEFAULT_CONFIG: AutoSchedulingConfig = {
  enabled: true,
  schedulingOptions: {
    defaultLag: 0, // 0 hours lag by default
    maxCascadingDepth: 5,
    preserveTaskDuration: true,
    enableCircularDetection: true
  },
  performanceThreshold: 500, // 500ms max execution time
  maxAffectedTasks: 20, // Max 20 tasks can be auto-adjusted
  showPreview: false // Don't show preview by default for smooth UX
}

export const useAutoScheduling = (options: UseAutoSchedulingOptions): AutoSchedulingHookResult => {
  const { projectId, tasks, onTaskUpdate, config: userConfig = {} } = options
  
  // Merge user config with defaults
  const config = useMemo<AutoSchedulingConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
    schedulingOptions: {
      ...DEFAULT_CONFIG.schedulingOptions,
      ...userConfig.schedulingOptions
    }
  }), [userConfig])

  // Get dependencies and undo/redo functionality
  const { dependencies, loading: dependenciesLoading } = useDependencies(projectId)
  const { executeCommand, isUndoing, isRedoing } = useUndoRedo({
    maxHistorySize: 50,
    enableKeyboardShortcuts: true,
    telemetryEnabled: true
  })

  // State management
  const isProcessing = useMemo(() => 
    isUndoing || isRedoing || dependenciesLoading, 
    [isUndoing, isRedoing, dependenciesLoading]
  )

  const lastSchedulingResult = useMemo<AutoSchedulingResult | null>(() => {
    // This would be managed by a state if we need to track it
    // For now, returning null as this is a demo implementation
    return null
  }, [])

  /**
   * Execute bar move operation with auto-scheduling
   */
  const executeBarMoveWithScheduling = useCallback(async (params: BarMoveParams) => {
    if (!config.enabled || isProcessing) {
      // Fall back to regular bar move without scheduling
      const regularCommand = new BarMoveCommand({
        ...params,
        onExecute: onTaskUpdate
      })
      await executeCommand(regularCommand)
      return
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('auto-scheduling-bar-move')

    try {
      // Check if auto-scheduling is needed
      if (!shouldEnableAutoScheduling(params.taskId, dependencies)) {
        // No dependencies to schedule, use regular command
        const regularCommand = new BarMoveCommand({
          ...params,
          onExecute: onTaskUpdate
        })
        await executeCommand(regularCommand)
        return
      }

      // Analyze impact before proceeding
      const impact = await analyzeSchedulingImpact(params.taskId)
      
      // Check if we should proceed based on impact analysis
      if (impact.recommendedAction === 'abort') {
        console.warn('Auto-scheduling aborted due to impact analysis:', impact)
        throw new Error(`Auto-scheduling aborted: ${impact.estimatedAffectedTasks} tasks would be affected`)
      }

      // Create primary bar move command
      const primaryCommand = new BarMoveCommand({
        ...params,
        onExecute: onTaskUpdate
      })

      // Create auto-scheduling command that wraps the primary command
      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks,
        dependencies,
        onTaskUpdate,
        schedulingOptions: config.schedulingOptions,
        context: {
          metadata: {
            autoSchedulingEnabled: true,
            impactAnalysis: impact,
            userInitiated: true
          }
        }
      })

      // Execute the composite command
      await executeCommand(autoSchedulingCommand)

      console.log('✅ Auto-scheduling completed successfully:', {
        primaryTaskId: params.taskId,
        affectedTasks: autoSchedulingCommand.getAffectedTaskIds(),
        dependencyChain: autoSchedulingCommand.getDependencyChain(),
        executionTime: performance.now() - startTime
      })

    } catch (error) {
      console.error('❌ Auto-scheduling failed:', error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('auto-scheduling-bar-move')
    }
  }, [config, isProcessing, dependencies, tasks, onTaskUpdate, executeCommand])

  /**
   * Execute bar resize operation with auto-scheduling
   */
  const executeBarResizeWithScheduling = useCallback(async (params: BarResizeParams) => {
    if (!config.enabled || isProcessing) {
      // Fall back to regular bar resize without scheduling
      const regularCommand = new BarResizeCommand({
        ...params,
        onExecute: onTaskUpdate
      })
      await executeCommand(regularCommand)
      return
    }

    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement('auto-scheduling-bar-resize')

    try {
      // Check if auto-scheduling is needed
      if (!shouldEnableAutoScheduling(params.taskId, dependencies)) {
        // No dependencies to schedule, use regular command
        const regularCommand = new BarResizeCommand({
          ...params,
          onExecute: onTaskUpdate
        })
        await executeCommand(regularCommand)
        return
      }

      // Analyze impact before proceeding
      const impact = await analyzeSchedulingImpact(params.taskId)
      
      // Check if we should proceed based on impact analysis
      if (impact.recommendedAction === 'abort') {
        console.warn('Auto-scheduling aborted due to impact analysis:', impact)
        throw new Error(`Auto-scheduling aborted: ${impact.estimatedAffectedTasks} tasks would be affected`)
      }

      // Create primary bar resize command
      const primaryCommand = new BarResizeCommand({
        ...params,
        onExecute: onTaskUpdate
      })

      // Create auto-scheduling command that wraps the primary command
      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks,
        dependencies,
        onTaskUpdate,
        schedulingOptions: config.schedulingOptions,
        context: {
          metadata: {
            autoSchedulingEnabled: true,
            impactAnalysis: impact,
            userInitiated: true,
            resizeType: params.resizeType
          }
        }
      })

      // Execute the composite command
      await executeCommand(autoSchedulingCommand)

      console.log('✅ Auto-scheduling resize completed successfully:', {
        primaryTaskId: params.taskId,
        resizeType: params.resizeType,
        affectedTasks: autoSchedulingCommand.getAffectedTaskIds(),
        dependencyChain: autoSchedulingCommand.getDependencyChain(),
        executionTime: performance.now() - startTime
      })

    } catch (error) {
      console.error('❌ Auto-scheduling resize failed:', error)
      throw error
    } finally {
      ganttPerformanceMonitor.endMeasurement('auto-scheduling-bar-resize')
    }
  }, [config, isProcessing, dependencies, tasks, onTaskUpdate, executeCommand])

  /**
   * Analyze the potential impact of auto-scheduling for a task
   */
  const analyzeSchedulingImpact = useCallback(async (taskId: string): Promise<SchedulingImpactAnalysis> => {
    const startTime = performance.now()

    try {
      // Get impact estimation
      const impact = estimateSchedulingImpact(taskId, tasks, dependencies)
      
      // Calculate estimated execution time based on number of affected tasks
      const baseExecutionTime = 50 // Base 50ms for the primary operation
      const taskExecutionTime = impact.estimatedAffectedTasks * 25 // 25ms per additional task
      const estimatedExecutionTime = baseExecutionTime + taskExecutionTime

      // Determine recommended action
      let recommendedAction: SchedulingImpactAnalysis['recommendedAction'] = 'proceed'
      
      if (impact.hasCircularDependencies) {
        recommendedAction = 'abort'
      } else if (
        impact.estimatedAffectedTasks > (config.maxAffectedTasks || DEFAULT_CONFIG.maxAffectedTasks!) ||
        estimatedExecutionTime > (config.performanceThreshold || DEFAULT_CONFIG.performanceThreshold!)
      ) {
        recommendedAction = 'review'
      }

      const analysis: SchedulingImpactAnalysis = {
        willTriggerScheduling: shouldEnableAutoScheduling(taskId, dependencies),
        estimatedAffectedTasks: impact.estimatedAffectedTasks,
        maxCascadingLevels: impact.maxCascadingLevels,
        hasCircularDependencies: impact.hasCircularDependencies,
        estimatedExecutionTime,
        recommendedAction
      }

      console.log(`📊 Auto-scheduling impact analysis for task ${taskId}:`, {
        ...analysis,
        analysisTime: performance.now() - startTime
      })

      return analysis

    } catch (error) {
      console.error('Failed to analyze scheduling impact:', error)
      return {
        willTriggerScheduling: false,
        estimatedAffectedTasks: 0,
        maxCascadingLevels: 0,
        hasCircularDependencies: true, // Assume the worst
        estimatedExecutionTime: 0,
        recommendedAction: 'abort'
      }
    }
  }, [taskId, tasks, dependencies, config])

  /**
   * Check if auto-scheduling is available for a task
   */
  const isAutoSchedulingAvailable = useCallback((taskId: string): boolean => {
    return config.enabled && 
           !isProcessing && 
           shouldEnableAutoScheduling(taskId, dependencies)
  }, [config.enabled, isProcessing, dependencies])

  /**
   * Update configuration
   */
  const updateConfig = useCallback((newConfig: Partial<AutoSchedulingConfig>) => {
    // In a real implementation, this would update state
    console.log('Auto-scheduling config update requested:', newConfig)
  }, [])

  return {
    // Core functions
    executeBarMoveWithScheduling,
    executeBarResizeWithScheduling,
    
    // Configuration
    config,
    updateConfig,
    
    // Analysis functions
    analyzeSchedulingImpact,
    isAutoSchedulingAvailable,
    
    // State
    isProcessing,
    lastSchedulingResult
  }
}

/**
 * Utility hook for simpler integration with existing components
 */
export const useAutoSchedulingOperations = (
  projectId: string,
  tasks: GanttTask[],
  onTaskUpdate: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
) => {
  const autoScheduling = useAutoScheduling({
    projectId,
    tasks,
    onTaskUpdate,
    config: {
      enabled: true,
      showPreview: false // Keep it simple for existing integrations
    }
  })

  return {
    executeBarMove: autoScheduling.executeBarMoveWithScheduling,
    executeBarResize: autoScheduling.executeBarResizeWithScheduling,
    isProcessing: autoScheduling.isProcessing
  }
}

/**
 * Hook for components that need scheduling impact analysis
 */
export const useSchedulingAnalysis = (
  tasks: GanttTask[],
  dependencies: GanttDependency[]
) => {
  return useCallback((taskId: string) => {
    return estimateSchedulingImpact(taskId, tasks, dependencies)
  }, [tasks, dependencies])
}