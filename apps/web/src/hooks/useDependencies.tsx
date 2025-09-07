'use client'

import { useState, useEffect, useCallback } from 'react'
import { GanttDependency } from '@/types/gantt'

export interface DependencyApiResponse {
  id: string
  projectId: string
  predecessorId: string
  successorId: string
  type: 'FS' | 'SS' | 'FF' | 'SF'
  lag: number
  createdAt: string
  updatedAt: string
}

interface UseDependenciesResult {
  dependencies: GanttDependency[]
  loading: boolean
  error: string | null
  fetchDependencies: (projectId?: string) => Promise<void>
  createDependency: (predecessorId: string, successorId: string) => Promise<void>
  deleteDependency: (predecessorId: string, successorId: string) => Promise<void>
}

const DEPENDENCIES_CACHE_KEY = 'gantt-dependencies'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

interface CachedDependencies {
  data: GanttDependency[]
  timestamp: number
  projectId?: string
}

/**
 * Hook to manage dependencies data with API integration
 */
export const useDependencies = (projectId?: string): UseDependenciesResult => {
  const [dependencies, setDependencies] = useState<GanttDependency[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Transform API response to GanttDependency format
   */
  const transformDependency = useCallback((apiDep: DependencyApiResponse): GanttDependency => ({
    id: apiDep.id,
    predecessorId: apiDep.predecessorId,
    successorId: apiDep.successorId,
    fromTaskId: apiDep.predecessorId, // alias for compatibility
    toTaskId: apiDep.successorId,     // alias for compatibility
    type: apiDep.type,
    lag: apiDep.lag,
    lagUnit: 'hours' as const
  }), [])

  /**
   * Check if cached data is valid
   */
  const isCacheValid = useCallback((cached: CachedDependencies | null): boolean => {
    if (!cached) return false
    
    const now = Date.now()
    const isExpired = (now - cached.timestamp) > CACHE_EXPIRY_MS
    const isProjectMatched = !projectId || cached.projectId === projectId
    
    return !isExpired && isProjectMatched
  }, [projectId])

  /**
   * Get cached dependencies if valid
   */
  const getCachedDependencies = useCallback((): GanttDependency[] | null => {
    try {
      const cached = localStorage.getItem(DEPENDENCIES_CACHE_KEY)
      if (!cached) return null
      
      const parsedCache: CachedDependencies = JSON.parse(cached)
      return isCacheValid(parsedCache) ? parsedCache.data : null
    } catch (error) {
      console.warn('Failed to parse cached dependencies:', error)
      return null
    }
  }, [isCacheValid])

  /**
   * Cache dependencies
   */
  const cacheDependencies = useCallback((deps: GanttDependency[]) => {
    try {
      const cacheData: CachedDependencies = {
        data: deps,
        timestamp: Date.now(),
        projectId
      }
      localStorage.setItem(DEPENDENCIES_CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to cache dependencies:', error)
    }
  }, [projectId])

  /**
   * Fetch dependencies from API
   */
  const fetchDependencies = useCallback(async (targetProjectId?: string) => {
    const effectiveProjectId = targetProjectId || projectId
    if (!effectiveProjectId) {
      setDependencies([])
      return
    }

    // Check cache first
    const cached = getCachedDependencies()
    if (cached) {
      setDependencies(cached)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch Gantt data which includes dependencies
      const response = await fetch(
        `/api/issues/projects/${effectiveProjectId}/gantt?includeDependencies=true`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch dependencies: ${response.status} ${response.statusText}`)
      }

      const ganttData = await response.json()
      const apiDependencies: DependencyApiResponse[] = ganttData.dependencies || []
      
      // Transform to GanttDependency format
      const transformedDependencies = apiDependencies.map(transformDependency)
      
      setDependencies(transformedDependencies)
      cacheDependencies(transformedDependencies)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Failed to fetch dependencies: ${errorMessage}`)
      console.error('Error fetching dependencies:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, getCachedDependencies, transformDependency, cacheDependencies])

  /**
   * Create a new dependency
   */
  const createDependency = useCallback(async (predecessorId: string, successorId: string) => {
    if (!projectId) {
      throw new Error('Project ID is required to create dependencies')
    }

    setError(null)

    try {
      const response = await fetch(`/api/issues/${predecessorId}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          predecessorId,
          successorId,
          type: 'FS',
          lag: 0
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to create dependency: ${response.status}`)
      }

      const newDependency: DependencyApiResponse = await response.json()
      const transformedDependency = transformDependency(newDependency)
      
      // Update local state
      setDependencies(prev => [...prev, transformedDependency])
      
      // Invalidate cache
      localStorage.removeItem(DEPENDENCIES_CACHE_KEY)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Failed to create dependency: ${errorMessage}`)
      throw err
    }
  }, [projectId, transformDependency])

  /**
   * Delete a dependency
   */
  const deleteDependency = useCallback(async (predecessorId: string, successorId: string) => {
    if (!projectId) {
      throw new Error('Project ID is required to delete dependencies')
    }

    setError(null)

    try {
      const response = await fetch(`/api/issues/${predecessorId}/dependencies`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successorId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to delete dependency: ${response.status}`)
      }

      // Update local state
      setDependencies(prev => 
        prev.filter(dep => !(dep.predecessorId === predecessorId && dep.successorId === successorId))
      )
      
      // Invalidate cache
      localStorage.removeItem(DEPENDENCIES_CACHE_KEY)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Failed to delete dependency: ${errorMessage}`)
      throw err
    }
  }, [projectId])

  /**
   * Auto-fetch dependencies when projectId changes
   */
  useEffect(() => {
    if (projectId) {
      fetchDependencies(projectId)
    }
  }, [projectId, fetchDependencies])

  return {
    dependencies,
    loading,
    error,
    fetchDependencies,
    createDependency,
    deleteDependency
  }
}