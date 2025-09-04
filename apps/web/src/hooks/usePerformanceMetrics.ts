'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  PerformanceMonitor, 
  GanttPerformanceMetrics, 
  PerformanceThresholds,
  ganttPerformanceMonitor 
} from '@/lib/performance'

export interface UsePerformanceMetricsOptions {
  /** Custom performance monitor instance (optional, uses global instance by default) */
  monitor?: PerformanceMonitor
  /** Auto-record metrics on measurement completion */
  autoRecord?: boolean
  /** Enable automatic performance alerts */
  enableAlerts?: boolean
  /** Callback for performance threshold violations */
  onThresholdViolation?: (metrics: GanttPerformanceMetrics) => void
}

export interface UsePerformanceMetricsReturn {
  /** Current performance metrics */
  metrics: GanttPerformanceMetrics[]
  /** Latest recorded metrics */
  latestMetrics: GanttPerformanceMetrics | null
  /** Average metrics over recent measurements */
  averageMetrics: GanttPerformanceMetrics | null
  /** Whether current performance meets acceptable thresholds */
  isAcceptable: boolean
  /** Performance report string */
  performanceReport: string
  /** Measure initial render time */
  measureRender: <T>(renderFn: () => T) => T
  /** Measure drag response time */
  measureDrag: <T>(dragFn: () => T) => T
  /** Measure zoom transition time */
  measureZoom: <T>(zoomFn: () => T) => T
  /** Record custom metrics */
  recordMetrics: (metrics: Partial<GanttPerformanceMetrics>) => void
  /** Clear all metrics */
  clearMetrics: () => void
  /** Get performance thresholds */
  getThresholds: () => PerformanceThresholds
  /** Update performance thresholds */
  updateThresholds: (thresholds: Partial<PerformanceThresholds>) => void
  /** Start a custom measurement */
  startMeasurement: (name: string, metadata?: Record<string, unknown>) => void
  /** End a custom measurement */
  endMeasurement: (name: string) => number | null
}

/**
 * React Hook for Gantt Chart Performance Metrics
 * 
 * Provides a React interface to the PerformanceMonitor class with:
 * - Automatic state management for metrics
 * - Easy-to-use measurement functions
 * - Automatic threshold monitoring
 * - Performance alerting capabilities
 * 
 * @param options Configuration options for the hook
 * @returns Performance metrics and measurement functions
 * 
 * @example
 * ```tsx
 * const { measureRender, measureDrag, isAcceptable, performanceReport } = usePerformanceMetrics({
 *   autoRecord: true,
 *   enableAlerts: true,
 *   onThresholdViolation: (metrics) => {
 *     console.warn('Performance issue detected:', metrics)
 *   }
 * })
 * 
 * // Measure initial render
 * const data = measureRender(() => {
 *   return processGanttData(tasks)
 * })
 * 
 * // Measure drag response
 * const handleDrag = measureDrag((event) => {
 *   updateTaskPosition(taskId, event.clientX)
 * })
 * ```
 */
export const usePerformanceMetrics = (options: UsePerformanceMetricsOptions = {}): UsePerformanceMetricsReturn => {
  const {
    monitor = ganttPerformanceMonitor,
    autoRecord = true,
    enableAlerts = true,
    onThresholdViolation
  } = options

  // State for metrics and derived values
  const [metrics, setMetrics] = useState<GanttPerformanceMetrics[]>([])
  const [latestMetrics, setLatestMetrics] = useState<GanttPerformanceMetrics | null>(null)
  const [averageMetrics, setAverageMetrics] = useState<GanttPerformanceMetrics | null>(null)
  const [isAcceptable, setIsAcceptable] = useState<boolean>(true)
  const [performanceReport, setPerformanceReport] = useState<string>('')

  // Store the monitor instance to avoid recreating
  const monitorRef = useRef(monitor)

  // Update state from monitor
  const updateMetricsState = useCallback(() => {
    const allMetrics = monitorRef.current.getAllMetrics()
    const latest = monitorRef.current.getLatestMetrics()
    const average = monitorRef.current.getAverageMetrics()
    const acceptable = monitorRef.current.isPerformanceAcceptable()
    const report = monitorRef.current.getPerformanceReport()

    setMetrics(allMetrics)
    setLatestMetrics(latest)
    setAverageMetrics(average)
    setIsAcceptable(acceptable)
    setPerformanceReport(report)

    // Handle threshold violations
    if (!acceptable && latest && onThresholdViolation) {
      onThresholdViolation(latest)
    }
  }, [onThresholdViolation])

  // Initialize state on mount
  useEffect(() => {
    updateMetricsState()
  }, [updateMetricsState])

  /**
   * Measure render performance
   */
  const measureRender = useCallback(<T,>(renderFn: () => T): T => {
    const { result, duration } = monitorRef.current.measureInitialRender(renderFn)
    
    if (autoRecord) {
      monitorRef.current.recordMetrics({ initialRenderTime: duration })
      updateMetricsState()
    }
    
    return result
  }, [autoRecord, updateMetricsState])

  /**
   * Measure drag response performance
   */
  const measureDrag = useCallback(<T,>(dragFn: () => T): T => {
    const { result, duration } = monitorRef.current.measureDragResponse(dragFn)
    
    if (autoRecord) {
      monitorRef.current.recordMetrics({ dragResponseTime: duration })
      updateMetricsState()
    }
    
    return result
  }, [autoRecord, updateMetricsState])

  /**
   * Measure zoom transition performance
   */
  const measureZoom = useCallback(<T,>(zoomFn: () => T): T => {
    const { result, duration } = monitorRef.current.measureZoomTransition(zoomFn)
    
    if (autoRecord) {
      monitorRef.current.recordMetrics({ zoomTransitionTime: duration })
      updateMetricsState()
    }
    
    return result
  }, [autoRecord, updateMetricsState])

  /**
   * Record custom metrics
   */
  const recordMetrics = useCallback((customMetrics: Partial<GanttPerformanceMetrics>) => {
    monitorRef.current.recordMetrics(customMetrics)
    updateMetricsState()
  }, [updateMetricsState])

  /**
   * Clear all metrics
   */
  const clearMetrics = useCallback(() => {
    monitorRef.current.clearMetrics()
    updateMetricsState()
  }, [updateMetricsState])

  /**
   * Get current performance thresholds
   */
  const getThresholds = useCallback(() => {
    return monitorRef.current.getThresholds()
  }, [])

  /**
   * Update performance thresholds
   */
  const updateThresholds = useCallback((thresholds: Partial<PerformanceThresholds>) => {
    monitorRef.current.updateThresholds(thresholds)
    updateMetricsState()
  }, [updateMetricsState])

  /**
   * Start a custom measurement
   */
  const startMeasurement = useCallback((name: string, metadata?: Record<string, unknown>) => {
    monitorRef.current.startMeasurement(name, metadata)
  }, [])

  /**
   * End a custom measurement
   */
  const endMeasurement = useCallback((name: string): number | null => {
    return monitorRef.current.endMeasurement(name)
  }, [])

  return {
    metrics,
    latestMetrics,
    averageMetrics,
    isAcceptable,
    performanceReport,
    measureRender,
    measureDrag,
    measureZoom,
    recordMetrics,
    clearMetrics,
    getThresholds,
    updateThresholds,
    startMeasurement,
    endMeasurement
  }
}

/**
 * Performance Monitoring Context Hook
 * 
 * A simplified version of usePerformanceMetrics that provides basic monitoring
 * without automatic recording. Useful for components that only need to check
 * performance status.
 */
export const usePerformanceStatus = () => {
  const [isAcceptable, setIsAcceptable] = useState(true)
  const [performanceReport, setPerformanceReport] = useState('')

  useEffect(() => {
    const updateStatus = () => {
      setIsAcceptable(ganttPerformanceMonitor.isPerformanceAcceptable())
      setPerformanceReport(ganttPerformanceMonitor.getPerformanceReport())
    }

    updateStatus()
    
    // Update every 5 seconds
    const interval = setInterval(updateStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  return {
    isAcceptable,
    performanceReport
  }
}