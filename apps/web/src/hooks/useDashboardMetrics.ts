'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProjectMetrics } from '@/components/dashboard/ProjectMetricsDashboard'
import { ResourceData } from '@/components/dashboard/ResourceUtilizationChart'
import { PerformanceDataPoint, PerformanceMetric } from '@/components/dashboard/PerformanceAnalytics'

export interface DashboardDataFilters {
  timeRange: 'week' | 'month' | 'quarter' | 'year'
  resourceFilter?: string[]
  taskStatusFilter?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface DashboardMetricsOptions {
  projectId: string
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds
  filters?: DashboardDataFilters
}

export interface UseDashboardMetricsReturn {
  // Data
  projectMetrics: ProjectMetrics | null
  resourceData: ResourceData[]
  performanceData: PerformanceDataPoint[]
  performanceMetrics: PerformanceMetric[]
  
  // Loading states
  loading: boolean
  refreshing: boolean
  error: string | null
  
  // Actions
  refresh: () => Promise<void>
  exportData: (format: 'csv' | 'json' | 'excel') => Promise<void>
  updateFilters: (filters: Partial<DashboardDataFilters>) => void
  
  // Computed metrics
  summary: DashboardSummary
  trends: TrendAnalysis
  
  // Meta
  lastUpdated: number | null
  filters: DashboardDataFilters
}

export interface DashboardSummary {
  totalTasks: number
  completedPercentage: number
  avgVelocity: number
  resourceUtilization: number
  riskScore: number
  trendsDirection: 'improving' | 'declining' | 'stable'
}

export interface TrendAnalysis {
  velocity: { current: number, change: number, trend: 'up' | 'down' | 'stable' }
  completion: { current: number, change: number, trend: 'up' | 'down' | 'stable' }
  quality: { current: number, change: number, trend: 'up' | 'down' | 'stable' }
  efficiency: { current: number, change: number, trend: 'up' | 'down' | 'stable' }
}

const defaultFilters: DashboardDataFilters = {
  timeRange: 'month'
}

export const useDashboardMetrics = (options: DashboardMetricsOptions): UseDashboardMetricsReturn => {
  const { 
    projectId, 
    autoRefresh = false, 
    refreshInterval = 300000, // 5 minutes
    filters: initialFilters = defaultFilters 
  } = options

  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<DashboardDataFilters>(initialFilters)
  const [refreshing, setRefreshing] = useState(false)

  // Project Metrics Query
  const {
    data: projectMetrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useQuery({
    queryKey: ['dashboard-metrics', projectId, filters],
    queryFn: async () => fetchProjectMetrics(projectId, filters),
    staleTime: 60000, // 1 minute
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  // Resource Data Query
  const {
    data: resourceData,
    isLoading: resourceLoading,
    error: resourceError,
    refetch: refetchResources
  } = useQuery({
    queryKey: ['dashboard-resources', projectId, filters],
    queryFn: async () => fetchResourceData(projectId, filters),
    staleTime: 120000, // 2 minutes
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  // Performance Data Query
  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
    refetch: refetchPerformance
  } = useQuery({
    queryKey: ['dashboard-performance', projectId, filters],
    queryFn: async () => fetchPerformanceData(projectId, filters),
    staleTime: 180000, // 3 minutes
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  // Performance Metrics Query
  const {
    data: performanceMetrics,
    refetch: refetchPerformanceMetrics
  } = useQuery({
    queryKey: ['dashboard-performance-metrics', projectId, filters],
    queryFn: async () => fetchPerformanceMetrics(projectId, filters),
    staleTime: 300000, // 5 minutes
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  // Export Data Mutation
  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'json' | 'excel') => 
      exportDashboardData(projectId, filters, format)
  })

  // Computed values
  const loading = metricsLoading || resourceLoading || performanceLoading
  const error = metricsError?.message || resourceError?.message || performanceError?.message || null

  // Summary calculations
  const summary: DashboardSummary = useMemo(() => {
    if (!projectMetrics || !resourceData || !performanceData) {
      return {
        totalTasks: 0,
        completedPercentage: 0,
        avgVelocity: 0,
        resourceUtilization: 0,
        riskScore: 0,
        trendsDirection: 'stable'
      }
    }

    const avgVelocity = performanceData.reduce((sum, d) => sum + d.velocity, 0) / performanceData.length
    const avgResourceUtilization = resourceData.reduce((sum, r) => sum + r.utilizationRate, 0) / resourceData.length
    
    // Simple risk score calculation (0-100, higher is riskier)
    let riskScore = 0
    if (projectMetrics.overdueTasks > 0) riskScore += 20
    if (projectMetrics.scheduleVariance > 10) riskScore += 15
    if (projectMetrics.conflictsCount > 5) riskScore += 25
    if (avgResourceUtilization > 90) riskScore += 20
    if (projectMetrics.velocityTrend === 'down') riskScore += 20

    // Trends analysis
    const recentVelocity = performanceData.slice(-7).reduce((sum, d) => sum + d.velocity, 0) / 7
    const olderVelocity = performanceData.slice(-14, -7).reduce((sum, d) => sum + d.velocity, 0) / 7
    const velocityTrend = recentVelocity > olderVelocity * 1.05 ? 'improving' : 
                         recentVelocity < olderVelocity * 0.95 ? 'declining' : 'stable'

    return {
      totalTasks: projectMetrics.totalTasks,
      completedPercentage: projectMetrics.completionPercentage,
      avgVelocity: Math.round(avgVelocity),
      resourceUtilization: Math.round(avgResourceUtilization),
      riskScore: Math.min(riskScore, 100),
      trendsDirection: velocityTrend
    }
  }, [projectMetrics, resourceData, performanceData])

  // Trends analysis
  const trends: TrendAnalysis = useMemo(() => {
    if (!performanceData || !performanceMetrics) {
      return {
        velocity: { current: 0, change: 0, trend: 'stable' },
        completion: { current: 0, change: 0, trend: 'stable' },
        quality: { current: 0, change: 0, trend: 'stable' },
        efficiency: { current: 0, change: 0, trend: 'stable' }
      }
    }

    const velocityMetric = performanceMetrics.find(m => m.name === 'Velocity')
    const throughputMetric = performanceMetrics.find(m => m.name === 'Throughput')
    const defectMetric = performanceMetrics.find(m => m.name === 'Defect Rate')
    const cycleTimeMetric = performanceMetrics.find(m => m.name === 'Cycle Time')

    return {
      velocity: velocityMetric ? {
        current: velocityMetric.current,
        change: ((velocityMetric.current - velocityMetric.previous) / velocityMetric.previous) * 100,
        trend: velocityMetric.trend
      } : { current: 0, change: 0, trend: 'stable' },
      
      completion: throughputMetric ? {
        current: throughputMetric.current,
        change: ((throughputMetric.current - throughputMetric.previous) / throughputMetric.previous) * 100,
        trend: throughputMetric.trend
      } : { current: 0, change: 0, trend: 'stable' },
      
      quality: defectMetric ? {
        current: 100 - defectMetric.current, // Invert defect rate for quality score
        change: -((defectMetric.current - defectMetric.previous) / defectMetric.previous) * 100,
        trend: defectMetric.trend === 'up' ? 'down' : defectMetric.trend === 'down' ? 'up' : 'stable'
      } : { current: 100, change: 0, trend: 'stable' },
      
      efficiency: cycleTimeMetric ? {
        current: 100 / cycleTimeMetric.current, // Convert cycle time to efficiency score
        change: -((cycleTimeMetric.current - cycleTimeMetric.previous) / cycleTimeMetric.previous) * 100,
        trend: cycleTimeMetric.trend === 'up' ? 'down' : cycleTimeMetric.trend === 'down' ? 'up' : 'stable'
      } : { current: 100, change: 0, trend: 'stable' }
    }
  }, [performanceData, performanceMetrics])

  // Actions
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refetchMetrics(),
        refetchResources(),
        refetchPerformance(),
        refetchPerformanceMetrics()
      ])
    } finally {
      setRefreshing(false)
    }
  }, [refetchMetrics, refetchResources, refetchPerformance, refetchPerformanceMetrics])

  const exportData = useCallback(async (format: 'csv' | 'json' | 'excel') => {
    await exportMutation.mutateAsync(format)
  }, [exportMutation])

  const updateFilters = useCallback((newFilters: Partial<DashboardDataFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Get last updated timestamp
  const lastUpdated = useMemo(() => {
    const timestamps = [
      projectMetrics?.lastUpdated,
      resourceData?.[0] && Date.now(), // Approximate for resource data
      performanceData?.[0] && Date.now() // Approximate for performance data
    ].filter(Boolean) as number[]
    
    return timestamps.length > 0 ? Math.min(...timestamps) : null
  }, [projectMetrics?.lastUpdated, resourceData, performanceData])

  return {
    // Data
    projectMetrics: projectMetrics || null,
    resourceData: resourceData || [],
    performanceData: performanceData || [],
    performanceMetrics: performanceMetrics || [],
    
    // Loading states
    loading,
    refreshing,
    error,
    
    // Actions
    refresh,
    exportData,
    updateFilters,
    
    // Computed metrics
    summary,
    trends,
    
    // Meta
    lastUpdated,
    filters
  }
}

// API functions (these would be implemented to call actual APIs)
async function fetchProjectMetrics(
  projectId: string, 
  filters: DashboardDataFilters
): Promise<ProjectMetrics> {
  // Mock implementation - replace with actual API call
  await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API delay
  
  return {
    projectId,
    projectName: `Project ${projectId}`,
    lastUpdated: Date.now(),
    totalTasks: 125,
    completedTasks: 87,
    overdueTasks: 8,
    upcomingTasks: 30,
    plannedDuration: 60,
    actualDuration: 45,
    remainingDuration: 18,
    scheduleVariance: 5.2,
    totalResources: 8,
    activeResources: 6,
    utilizationRate: 78,
    conflictsCount: 3,
    riskLevel: 'medium',
    completionPercentage: 69.6,
    velocityTrend: 'up'
  }
}

async function fetchResourceData(
  projectId: string,
  filters: DashboardDataFilters
): Promise<ResourceData[]> {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 300))
  
  return [
    {
      id: '1',
      name: 'John Smith',
      role: 'Senior Developer',
      totalCapacity: 40,
      allocatedHours: 45,
      utilizationRate: 112,
      assignedTasks: 8,
      overdueAssignments: 1,
      availability: 'overallocated'
    },
    {
      id: '2', 
      name: 'Sarah Johnson',
      role: 'UX Designer',
      totalCapacity: 40,
      allocatedHours: 32,
      utilizationRate: 80,
      assignedTasks: 5,
      overdueAssignments: 0,
      availability: 'busy'
    }
  ]
}

async function fetchPerformanceData(
  projectId: string,
  filters: DashboardDataFilters
): Promise<PerformanceDataPoint[]> {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 400))
  
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    
    return {
      date: date.toISOString().split('T')[0],
      completedTasks: Math.floor(Math.random() * 8) + 2,
      plannedTasks: Math.floor(Math.random() * 10) + 5,
      velocity: Math.floor(Math.random() * 15) + 10,
      burndownActual: 100 - (i * 3) - Math.random() * 10,
      burndownIdeal: 100 - (i * 3.33),
      cumulativeFlow: {
        todo: Math.max(0, 50 - i * 1.5 + Math.random() * 5),
        inProgress: Math.min(20, i * 0.5 + Math.random() * 3),
        done: i * 1.8 + Math.random() * 2
      }
    }
  })
}

async function fetchPerformanceMetrics(
  projectId: string,
  filters: DashboardDataFilters
): Promise<PerformanceMetric[]> {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 200))
  
  return [
    {
      name: 'Velocity',
      current: 24,
      previous: 19,
      target: 25,
      unit: 'story points',
      trend: 'up',
      status: 'good'
    },
    {
      name: 'Cycle Time',
      current: 3.2,
      previous: 4.1,
      target: 3.0,
      unit: 'days',
      trend: 'down',
      status: 'good'
    }
  ]
}

async function exportDashboardData(
  projectId: string,
  filters: DashboardDataFilters,
  format: 'csv' | 'json' | 'excel'
): Promise<void> {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const filename = `dashboard-${projectId}-${Date.now()}.${format}`
  console.log(`Exporting dashboard data to ${filename}`)
  
  // In real implementation, this would:
  // 1. Fetch all required data
  // 2. Format it according to the specified format
  // 3. Trigger a download or send to a service
}

// Utility hook for real-time dashboard updates
export const useRealTimeDashboard = (projectId: string) => {
  const dashboardData = useDashboardMetrics({ 
    projectId, 
    autoRefresh: true, 
    refreshInterval: 60000 // 1 minute
  })

  // Additional real-time functionality could be added here
  // such as WebSocket connections, server-sent events, etc.

  return dashboardData
}

export default useDashboardMetrics