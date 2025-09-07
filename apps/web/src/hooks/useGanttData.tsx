'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useGanttStore } from '@/stores/gantt.store'
import { useOptimizedGanttSelectors } from '@/stores/gantt-selectors'
import { GanttTask, GanttDependency } from '@/types/gantt'

interface UseGanttDataOptions {
  projectId?: string
  autoFetch?: boolean
  refreshInterval?: number
  includeCompleted?: boolean
  includeDependencies?: boolean
}

interface UseGanttDataReturn {
  // Data
  tasks: GanttTask[]
  dependencies: GanttDependency[]
  visibleTasks: GanttTask[]
  selectedTasks: GanttTask[]
  
  // Stats
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  completionRate: number
  
  // State
  loading: boolean
  error: string | undefined
  lastUpdated: Date | null
  
  // Actions
  fetchData: () => Promise<void>
  refreshData: () => Promise<void>
  clearError: () => void
  
  // Selectors (optimized)
  ganttStats: any
  taskPositions: any
  criticalPath: any
  dependencyMap: any
}

/**
 * Hook for managing Gantt chart data fetching and state
 * Provides a clean interface over the Gantt store with additional utilities
 */
export const useGanttData = ({
  projectId,
  autoFetch = true,
  refreshInterval,
  includeCompleted = true,
  includeDependencies = true
}: UseGanttDataOptions = {}): UseGanttDataReturn => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Get store state and actions
  const {
    tasks,
    dependencies,
    loading,
    error,
    fetchGanttData,
    selectedTaskIds,
    expandedTaskIds,
    config,
    viewport
  } = useGanttStore()

  // Use optimized selectors for computed values
  const selectorState = useMemo(() => ({
    tasks,
    config,
    viewport,
    selectedTaskIds,
    expandedTaskIds
  }), [tasks, config, viewport, selectedTaskIds, expandedTaskIds])
  
  const {
    visibleTasks,
    selectedTasks,
    ganttStats,
    taskPositions,
    criticalPath,
    dependencyMap
  } = useOptimizedGanttSelectors(selectorState)

  // Enhanced fetch function with options
  const fetchData = useCallback(async () => {
    if (!projectId) return
    
    try {
      await fetchGanttData(projectId)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch Gantt data:', err)
    }
  }, [projectId, fetchGanttData])

  // Refresh data (same as fetch but with explicit refresh semantics)
  const refreshData = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // Clear error state
  const clearError = useCallback(() => {
    // Error is managed in the store, but we can provide a local clear mechanism
    // This would need to be implemented in the store if needed
  }, [])

  // Auto-fetch on mount and projectId change
  useEffect(() => {
    if (autoFetch && projectId) {
      fetchData()
    }
  }, [autoFetch, projectId, fetchData])

  // Optional refresh interval
  useEffect(() => {
    if (!refreshInterval || !projectId) return

    const interval = setInterval(() => {
      if (!loading) {
        refreshData()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, projectId, loading, refreshData])

  return {
    // Raw data
    tasks,
    dependencies,
    visibleTasks,
    selectedTasks,
    
    // Computed stats
    totalTasks: ganttStats.totalTasks,
    completedTasks: ganttStats.completedTasks,
    inProgressTasks: ganttStats.inProgressTasks,
    overdueTasks: ganttStats.overdueTasks,
    completionRate: ganttStats.completionRate,
    
    // State
    loading,
    error,
    lastUpdated,
    
    // Actions
    fetchData,
    refreshData,
    clearError,
    
    // Advanced selectors
    ganttStats,
    taskPositions,
    criticalPath,
    dependencyMap
  }
}

/**
 * Lightweight hook for just fetching and basic Gantt data
 * Useful when you don't need all the computed selectors
 */
export const useGanttDataSimple = (projectId?: string) => {
  const { tasks, dependencies, loading, error, fetchGanttData } = useGanttStore()
  
  useEffect(() => {
    if (projectId) {
      fetchGanttData(projectId)
    }
  }, [projectId, fetchGanttData])
  
  return {
    tasks,
    dependencies,
    loading,
    error,
    refresh: () => projectId && fetchGanttData(projectId)
  }
}