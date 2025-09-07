/**
 * Gantt Chart Performance Monitoring System
 * 
 * Provides comprehensive performance measurement and monitoring for the Gantt Chart component.
 * Tracks rendering time, interaction responsiveness, and resource usage to ensure optimal UX.
 * 
 * Performance Targets:
 * - Initial render time: < 1.5 seconds (1,000 tasks)
 * - Drag response time: < 100ms
 * - Zoom transition time: < 150ms
 * - Memory usage: monitored and bounded
 */

export interface GanttPerformanceMetrics {
  /** Initial render time in milliseconds */
  initialRenderTime: number
  /** Drag operation response time in milliseconds */
  dragResponseTime: number
  /** Zoom/scale transition time in milliseconds */
  zoomTransitionTime: number
  /** Current memory usage in MB (Chrome only) */
  memoryUsage: number
  /** Number of tasks being rendered */
  taskCount: number
  /** Number of dependencies being drawn */
  dependencyCount: number
  /** Timestamp when measurement was taken */
  timestamp: number
  /** Current viewport width in pixels */
  viewportWidth: number
  /** Current viewport height in pixels */
  viewportHeight: number
  /** Time scale being used (day, week, month, quarter) */
  timeScale: string
}

export interface PerformanceThresholds {
  initialRenderTime: number
  dragResponseTime: number
  zoomTransitionTime: number
  memoryUsageLimit: number
}

export interface PerformanceMeasurement {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, unknown>
}

/**
 * Performance Monitor Class for Gantt Chart
 * 
 * Provides comprehensive performance measurement capabilities including:
 * - Time-based measurements with high precision
 * - Memory usage tracking (Chrome only)
 * - Performance threshold validation
 * - Metric collection and history
 * - Automatic alerting for performance degradation
 */
export class PerformanceMonitor {
  private metrics: GanttPerformanceMetrics[] = []
  private activeMeasurements = new Map<string, PerformanceMeasurement>()
  private maxHistorySize = 100
  private lastRenderTime = 0
  
  private readonly thresholds: PerformanceThresholds = {
    initialRenderTime: 1500,    // 1.5 seconds
    dragResponseTime: 100,      // 100ms
    zoomTransitionTime: 150,    // 150ms
    memoryUsageLimit: 512       // 512MB
  }

  /**
   * Start a performance measurement
   * @param name Unique identifier for the measurement
   * @param metadata Optional metadata to store with the measurement
   */
  startMeasurement(name: string, metadata?: Record<string, unknown>): void {
    performance.mark(`${name}-start`)
    this.activeMeasurements.set(name, {
      name,
      startTime: performance.now(),
      metadata
    })
  }

  /**
   * End a performance measurement and return the duration
   * @param name Identifier of the measurement to end
   * @returns Duration in milliseconds, or null if measurement not found
   */
  endMeasurement(name: string): number | null {
    const measurement = this.activeMeasurements.get(name)
    if (!measurement) {
      console.warn(`Performance measurement '${name}' not found`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - measurement.startTime

    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)

    measurement.endTime = endTime
    measurement.duration = duration

    this.activeMeasurements.delete(name)
    return duration
  }

  /**
   * Measure initial render time for Gantt Chart
   * @param renderFn Function that performs the initial render
   * @returns Result of the render function and measured duration
   */
  measureInitialRender<T>(renderFn: () => T): { result: T; duration: number } {
    this.startMeasurement('initial-render')
    const result = renderFn()
    const duration = this.endMeasurement('initial-render') || 0
    this.lastRenderTime = duration
    
    return { result, duration }
  }

  /**
   * Measure drag response time
   * @param dragFn Function that handles the drag operation
   * @returns Result of the drag function and measured duration
   */
  measureDragResponse<T>(dragFn: () => T): { result: T; duration: number } {
    this.startMeasurement('drag-response')
    const result = dragFn()
    const duration = this.endMeasurement('drag-response') || 0
    
    return { result, duration }
  }

  /**
   * Measure zoom/scale transition time
   * @param zoomFn Function that handles the zoom operation
   * @returns Result of the zoom function and measured duration
   */
  measureZoomTransition<T>(zoomFn: () => T): { result: T; duration: number } {
    this.startMeasurement('zoom-transition')
    const result = zoomFn()
    const duration = this.endMeasurement('zoom-transition') || 0
    
    return { result, duration }
  }

  /**
   * Get current memory usage in MB (Chrome only)
   * @returns Memory usage in MB, or 0 if not available
   */
  getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100
    }
    return 0
  }

  /**
   * Get last recorded render time
   * @returns Last render time in milliseconds
   */
  getLastRenderTime(): number {
    return this.lastRenderTime
  }

  /**
   * Record a complete set of performance metrics
   * @param metrics Partial metrics object (missing values will be calculated)
   */
  recordMetrics(metrics: Partial<GanttPerformanceMetrics>): void {
    const completeMetrics: GanttPerformanceMetrics = {
      initialRenderTime: metrics.initialRenderTime || 0,
      dragResponseTime: metrics.dragResponseTime || 0,
      zoomTransitionTime: metrics.zoomTransitionTime || 0,
      memoryUsage: metrics.memoryUsage || this.getMemoryUsage(),
      taskCount: metrics.taskCount || 0,
      dependencyCount: metrics.dependencyCount || 0,
      timestamp: metrics.timestamp || Date.now(),
      viewportWidth: metrics.viewportWidth || window.innerWidth,
      viewportHeight: metrics.viewportHeight || window.innerHeight,
      timeScale: metrics.timeScale || 'day'
    }

    this.metrics.push(completeMetrics)

    // Maintain history size limit
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift()
    }

    // Check for performance issues
    this.checkPerformanceThresholds(completeMetrics)
  }

  /**
   * Check if current performance meets acceptable thresholds
   * @param metrics Optional specific metrics to check, otherwise uses latest
   * @returns True if performance is acceptable, false otherwise
   */
  isPerformanceAcceptable(metrics?: GanttPerformanceMetrics): boolean {
    const targetMetrics = metrics || this.getLatestMetrics()
    if (!targetMetrics) return true

    const issues: string[] = []

    if (targetMetrics.initialRenderTime > this.thresholds.initialRenderTime) {
      issues.push(`Initial render time: ${targetMetrics.initialRenderTime}ms > ${this.thresholds.initialRenderTime}ms`)
    }

    if (targetMetrics.dragResponseTime > this.thresholds.dragResponseTime) {
      issues.push(`Drag response time: ${targetMetrics.dragResponseTime}ms > ${this.thresholds.dragResponseTime}ms`)
    }

    if (targetMetrics.zoomTransitionTime > this.thresholds.zoomTransitionTime) {
      issues.push(`Zoom transition time: ${targetMetrics.zoomTransitionTime}ms > ${this.thresholds.zoomTransitionTime}ms`)
    }

    if (targetMetrics.memoryUsage > this.thresholds.memoryUsageLimit) {
      issues.push(`Memory usage: ${targetMetrics.memoryUsage}MB > ${this.thresholds.memoryUsageLimit}MB`)
    }

    if (issues.length > 0) {
      console.warn('Performance thresholds exceeded:', issues)
      return false
    }

    return true
  }

  /**
   * Get the latest recorded metrics
   * @returns Latest metrics or null if none recorded
   */
  getLatestMetrics(): GanttPerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  /**
   * Get all recorded metrics
   * @returns Array of all metrics
   */
  getAllMetrics(): GanttPerformanceMetrics[] {
    return [...this.metrics]
  }

  /**
   * Get average performance metrics over specified number of recent measurements
   * @param count Number of recent measurements to average (default: 5)
   * @returns Averaged metrics or null if insufficient data
   */
  getAverageMetrics(count: number = 5): GanttPerformanceMetrics | null {
    if (this.metrics.length === 0) return null

    const recentMetrics = this.metrics.slice(-count)
    const averages = recentMetrics.reduce(
      (acc, metric) => ({
        initialRenderTime: acc.initialRenderTime + metric.initialRenderTime,
        dragResponseTime: acc.dragResponseTime + metric.dragResponseTime,
        zoomTransitionTime: acc.zoomTransitionTime + metric.zoomTransitionTime,
        memoryUsage: acc.memoryUsage + metric.memoryUsage,
        taskCount: acc.taskCount + metric.taskCount,
        dependencyCount: acc.dependencyCount + metric.dependencyCount,
        viewportWidth: acc.viewportWidth + metric.viewportWidth,
        viewportHeight: acc.viewportHeight + metric.viewportHeight
      }),
      {
        initialRenderTime: 0,
        dragResponseTime: 0,
        zoomTransitionTime: 0,
        memoryUsage: 0,
        taskCount: 0,
        dependencyCount: 0,
        viewportWidth: 0,
        viewportHeight: 0
      }
    )

    const length = recentMetrics.length
    const latest = recentMetrics[recentMetrics.length - 1]

    return {
      initialRenderTime: Math.round(averages.initialRenderTime / length),
      dragResponseTime: Math.round(averages.dragResponseTime / length),
      zoomTransitionTime: Math.round(averages.zoomTransitionTime / length),
      memoryUsage: Math.round((averages.memoryUsage / length) * 100) / 100,
      taskCount: Math.round(averages.taskCount / length),
      dependencyCount: Math.round(averages.dependencyCount / length),
      timestamp: latest.timestamp,
      viewportWidth: Math.round(averages.viewportWidth / length),
      viewportHeight: Math.round(averages.viewportHeight / length),
      timeScale: latest.timeScale
    }
  }

  /**
   * Clear all recorded metrics and active measurements
   */
  clearMetrics(): void {
    this.metrics = []
    this.activeMeasurements.clear()
    
    // Clear performance marks and measures
    try {
      performance.clearMarks()
      performance.clearMeasures()
    } catch (error) {
      // Ignore errors if browser doesn't support clearing
    }
  }

  /**
   * Get performance summary report
   * @returns Human-readable performance summary
   */
  getPerformanceReport(): string {
    if (this.metrics.length === 0) {
      return 'No performance metrics recorded yet.'
    }

    const latest = this.getLatestMetrics()!
    const average = this.getAverageMetrics()!

    const formatTime = (ms: number) => `${ms}ms`
    const formatMemory = (mb: number) => `${mb}MB`
    const formatStatus = (value: number, threshold: number) => 
      value <= threshold ? '✅' : '❌'

    return `
📊 Gantt Chart Performance Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Performance Targets vs Current:
  Initial Render:  ${formatStatus(latest.initialRenderTime, this.thresholds.initialRenderTime)} ${formatTime(latest.initialRenderTime)} (target: ≤ ${formatTime(this.thresholds.initialRenderTime)})
  Drag Response:   ${formatStatus(latest.dragResponseTime, this.thresholds.dragResponseTime)} ${formatTime(latest.dragResponseTime)} (target: ≤ ${formatTime(this.thresholds.dragResponseTime)})
  Zoom Transition: ${formatStatus(latest.zoomTransitionTime, this.thresholds.zoomTransitionTime)} ${formatTime(latest.zoomTransitionTime)} (target: ≤ ${formatTime(this.thresholds.zoomTransitionTime)})
  Memory Usage:    ${formatStatus(latest.memoryUsage, this.thresholds.memoryUsageLimit)} ${formatMemory(latest.memoryUsage)} (limit: ≤ ${formatMemory(this.thresholds.memoryUsageLimit)})

📈 Average Performance (last ${Math.min(5, this.metrics.length)} measurements):
  Initial Render:  ${formatTime(average.initialRenderTime)}
  Drag Response:   ${formatTime(average.dragResponseTime)}  
  Zoom Transition: ${formatTime(average.zoomTransitionTime)}
  Memory Usage:    ${formatMemory(average.memoryUsage)}

📋 Current Load:
  Tasks: ${latest.taskCount}
  Dependencies: ${latest.dependencyCount}
  Viewport: ${latest.viewportWidth}×${latest.viewportHeight}
  Time Scale: ${latest.timeScale}

📊 Metrics Collected: ${this.metrics.length}
📅 Last Measurement: ${new Date(latest.timestamp).toLocaleString()}

Overall Status: ${this.isPerformanceAcceptable() ? '✅ GOOD' : '❌ NEEDS ATTENTION'}
`.trim()
  }

  /**
   * Update performance thresholds
   * @param newThresholds Partial thresholds to update
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    Object.assign(this.thresholds, newThresholds)
  }

  /**
   * Get current performance thresholds
   * @returns Current threshold configuration
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds }
  }

  /**
   * Get Web Vitals metrics if available
   * @returns Web Vitals data or null if not available
   */
  getWebVitals(): Record<string, number> | null {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')
      
      return {
        domContentLoaded: (navigation?.domContentLoadedEventEnd || 0) - (navigation?.fetchStart || 0),
        loadComplete: (navigation?.loadEventEnd || 0) - (navigation?.fetchStart || 0),
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        domInteractive: (navigation?.domInteractive || 0) - (navigation?.fetchStart || 0)
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Get frame rate estimation
   * @returns Estimated frame rate in fps
   */
  getFrameRate(): number {
    if (this.lastRenderTime > 0) {
      return Math.min(60, Math.round(1000 / this.lastRenderTime))
    }
    return 60 // Assume 60fps if no render time recorded
  }

  /**
   * Check for performance regression compared to baseline
   * @param baselineMetrics Previous metrics to compare against
   * @returns Regression analysis or null if no regression
   */
  checkPerformanceRegression(baselineMetrics: GanttPerformanceMetrics): {
    hasRegression: boolean
    regressions: Array<{
      metric: string
      baseline: number
      current: number
      percentageIncrease: number
    }>
  } | null {
    const current = this.getLatestMetrics()
    if (!current) return null

    const regressions: Array<{
      metric: string
      baseline: number
      current: number
      percentageIncrease: number
    }> = []

    const checks = [
      { key: 'initialRenderTime', baseline: baselineMetrics.initialRenderTime, current: current.initialRenderTime },
      { key: 'dragResponseTime', baseline: baselineMetrics.dragResponseTime, current: current.dragResponseTime },
      { key: 'zoomTransitionTime', baseline: baselineMetrics.zoomTransitionTime, current: current.zoomTransitionTime },
      { key: 'memoryUsage', baseline: baselineMetrics.memoryUsage, current: current.memoryUsage }
    ]

    checks.forEach(check => {
      if (check.baseline > 0 && check.current > check.baseline * 1.2) { // 20% regression threshold
        const percentageIncrease = ((check.current - check.baseline) / check.baseline) * 100
        regressions.push({
          metric: check.key,
          baseline: check.baseline,
          current: check.current,
          percentageIncrease: Math.round(percentageIncrease * 100) / 100
        })
      }
    })

    return {
      hasRegression: regressions.length > 0,
      regressions
    }
  }

  /**
   * Internal method to check performance thresholds and log warnings
   * @param metrics Metrics to check
   */
  private checkPerformanceThresholds(metrics: GanttPerformanceMetrics): void {
    if (!this.isPerformanceAcceptable(metrics)) {
      const report = this.getPerformanceReport()
      console.group('🚨 Gantt Chart Performance Warning')
      console.warn('Performance degraded: exceeding target thresholds')
      console.log(report)
      console.groupEnd()
    }
  }
}

// Global instance for easy access across the application
export const ganttPerformanceMonitor = new PerformanceMonitor()