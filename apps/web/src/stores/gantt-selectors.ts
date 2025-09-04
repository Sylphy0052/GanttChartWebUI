/**
 * Optimized Gantt Chart Selectors
 * 
 * Provides memoized selectors for expensive Gantt calculations.
 * Replaces the direct computation in useGanttSelectors with optimized,
 * cached versions to improve performance with large datasets.
 */

import { useMemo } from 'react'
import { GanttTask, GanttTimelineConfig, GanttViewport } from '@/types/gantt'
import { GanttUtils } from '@/lib/gantt-utils'

interface GanttState {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskIds: Set<string>
  expandedTaskIds: Set<string>
}

interface GanttStats {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  notStartedTasks: number
  overdueTasks: number
  completionRate: number
}

interface TaskPosition {
  task: GanttTask
  position: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Create optimized task index for O(1) lookups
 */
const useTaskIndex = (tasks: GanttTask[]) => {
  return useMemo(() => {
    const taskById = new Map<string, GanttTask>()
    const tasksByParent = new Map<string | null, GanttTask[]>()
    const taskIndexMap = new Map<string, number>()
    
    tasks.forEach((task, index) => {
      taskById.set(task.id, task)
      taskIndexMap.set(task.id, index)
      
      const parentId = task.parentId || null
      if (!tasksByParent.has(parentId)) {
        tasksByParent.set(parentId, [])
      }
      tasksByParent.get(parentId)!.push(task)
    })
    
    return { taskById, tasksByParent, taskIndexMap }
  }, [tasks])
}

/**
 * Optimized visible tasks selector with memoization
 */
export const useVisibleTasksSelector = (state: GanttState) => {
  const taskIndex = useTaskIndex(state.tasks)
  
  return useMemo(() => {
    const { tasks, config, expandedTaskIds } = state
    
    // Pre-filter by date range for better performance
    const tasksInDateRange = tasks.filter(task => 
      task.endDate >= config.startDate && task.startDate <= config.endDate
    )
    
    // Apply hierarchy filtering
    const visibleTasks = tasksInDateRange.filter(task => {
      // Root tasks are always visible (if in date range)
      if (!task.parentId) return true
      
      // Child tasks are visible only if parent is expanded
      return expandedTaskIds.has(task.parentId)
    })
    
    // Sort by order only once
    return visibleTasks.sort((a, b) => a.order - b.order)
  }, [state.tasks, state.config.startDate, state.config.endDate, state.expandedTaskIds, taskIndex])
}

/**
 * Optimized selected tasks selector
 */
export const useSelectedTasksSelector = (state: GanttState) => {
  const taskIndex = useTaskIndex(state.tasks)
  
  return useMemo(() => {
    const selectedTasks: GanttTask[] = []
    const { taskById } = taskIndex
    
    // O(1) lookup for each selected task ID
    state.selectedTaskIds.forEach(taskId => {
      const task = taskById.get(taskId)
      if (task) {
        selectedTasks.push(task)
      }
    })
    
    return selectedTasks
  }, [state.selectedTaskIds, taskIndex])
}

/**
 * Optimized Gantt statistics with caching
 */
export const useGanttStatsSelector = (state: GanttState) => {
  return useMemo((): GanttStats => {
    const { tasks } = state
    const today = new Date()
    
    let completedTasks = 0
    let inProgressTasks = 0
    let notStartedTasks = 0
    let overdueTasks = 0
    
    // Single pass through tasks for all statistics
    for (const task of tasks) {
      const progress = task.progress
      
      if (progress >= 100) {
        completedTasks++
      } else if (progress > 0) {
        inProgressTasks++
      } else {
        notStartedTasks++
      }
      
      // Check for overdue tasks
      if (task.endDate < today && progress < 100) {
        overdueTasks++
      }
    }
    
    const totalTasks = tasks.length
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    
    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      notStartedTasks,
      overdueTasks,
      completionRate
    }
  }, [state.tasks])
}

/**
 * Optimized task positions with caching
 */
export const useTaskPositionsSelector = (state: GanttState) => {
  return useMemo((): TaskPosition[] => {
    const { tasks, viewport } = state
    
    // Filter tasks in viewport range only
    const visibleTasks = tasks.filter(task => 
      task.endDate >= viewport.startDate && task.startDate <= viewport.endDate
    )
    
    return visibleTasks.map(task => ({
      task,
      position: GanttUtils.calculateTaskBarPosition(
        task,
        viewport.timeScale,
        viewport.taskScale,
        viewport.rowHeight
      )
    }))
  }, [state.tasks, state.viewport])
}

/**
 * Optimized critical path calculation with caching
 */
export const useCriticalPathSelector = (state: GanttState) => {
  const taskIndex = useTaskIndex(state.tasks)
  
  return useMemo(() => {
    return GanttUtils.calculateCriticalPath(state.tasks)
  }, [state.tasks, taskIndex])
}

/**
 * Optimized timeline grid lines
 */
export const useTimelineGridLinesSelector = (state: GanttState) => {
  return useMemo(() => {
    const { config, viewport } = state
    return GanttUtils.generateTimeGridLines(
      viewport.timeScale,
      config.scale,
      config.startDate,
      config.endDate
    )
  }, [state.config, state.viewport.timeScale])
}

/**
 * Optimized dependency map for faster lookups
 */
export const useDependencyMapSelector = (state: GanttState) => {
  return useMemo(() => {
    const dependencyMap = new Map<string, Array<{
      successorId: string
      type: string
      lag: number
    }>>()
    
    state.tasks.forEach(task => {
      if (task.dependencies && task.dependencies.length > 0) {
        dependencyMap.set(task.id, task.dependencies)
      }
    })
    
    return dependencyMap
  }, [state.tasks])
}

/**
 * Main optimized selectors hook
 * 
 * Replaces useGanttSelectors with performance-optimized versions
 * using proper memoization and O(1) lookup strategies.
 */
export const useOptimizedGanttSelectors = (state: GanttState) => {
  const visibleTasks = useVisibleTasksSelector(state)
  const selectedTasks = useSelectedTasksSelector(state)
  const ganttStats = useGanttStatsSelector(state)
  const taskPositions = useTaskPositionsSelector(state)
  const criticalPath = useCriticalPathSelector(state)
  const timelineGridLines = useTimelineGridLinesSelector(state)
  const dependencyMap = useDependencyMapSelector(state)
  
  return {
    visibleTasks,
    selectedTasks,
    ganttStats,
    taskPositions,
    criticalPath,
    timelineGridLines,
    dependencyMap
  }
}