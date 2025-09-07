/**
 * Advanced Telemetry React Hook
 * 
 * Implements T016 AC2-AC7: Comprehensive telemetry integration for React components
 * - AC2: Drag operation telemetry with response time, type, and data size measurements
 * - AC3: Zoom operation performance tracking with level changes and render optimization
 * - AC4: Memory usage monitoring with leak detection and cleanup recommendations
 * - AC5: User interaction patterns tracking for optimization opportunities
 * - AC6: Telemetry data batching and API integration without UI blocking
 * - AC7: Performance dashboard with real-time metrics and historical trends
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { 
  advancedTelemetry, 
  ComponentPerformanceMetrics, 
  AdvancedKPIMetrics,
  MemoryLeakDetection,
  DragTelemetryData,
  ZoomTelemetryData,
  InteractionPattern
} from '@/lib/advanced-telemetry'

export interface UseAdvancedTelemetryOptions {
  /** Component name for tracking */
  componentName: string
  /** Optional parent component name */
  parentComponent?: string
  /** Enable automatic performance tracking */
  autoTrack?: boolean
  /** Enable memory leak detection for this component */
  trackMemory?: boolean
  /** Enable user interaction tracking */
  trackInteractions?: boolean
  /** Enable drag operation telemetry */
  trackDragOperations?: boolean
  /** Enable zoom operation telemetry */
  trackZoomOperations?: boolean
  /** Callback for performance issues */
  onPerformanceIssue?: (metrics: ComponentPerformanceMetrics) => void
  /** Callback for memory leaks */
  onMemoryLeak?: (leaks: MemoryLeakDetection[]) => void
  /** Callback for interaction patterns */
  onInteractionPattern?: (patterns: InteractionPattern[]) => void
  /** Custom data size calculator for drag operations */
  calculateDataSize?: (data: any) => number
}

export interface UseAdvancedTelemetryReturn {
  /** Component ID for this instance */
  componentId: string
  /** Current component performance metrics */
  componentMetrics: ComponentPerformanceMetrics | null
  /** Advanced KPI metrics */
  advancedKPIs: AdvancedKPIMetrics | null
  /** Drag operation metrics */
  dragOperations: DragTelemetryData[]
  /** Zoom operation metrics */
  zoomOperations: ZoomTelemetryData[]
  /** User interaction patterns */
  interactionPatterns: InteractionPattern[]
  /** Memory leak warnings */
  memoryLeaks: MemoryLeakDetection[]
  
  // AC2: Drag operation tracking functions
  /** Start tracking a drag operation */
  startDragOperation: (
    operationType: DragTelemetryData['operationType'],
    data?: any,
    affectedTaskIds?: string[],
    metadata?: Record<string, any>
  ) => string
  /** Update drag operation progress */
  updateDragOperation: (
    dragId: string,
    distance: { x: number; y: number },
    accuracy?: number,
    targetComponent?: string
  ) => void
  /** Complete drag operation tracking */
  completeDragOperation: (
    dragId: string,
    cancelled?: boolean,
    error?: string
  ) => DragTelemetryData | null
  
  // AC3: Zoom operation tracking functions
  /** Start tracking a zoom operation */
  startZoomOperation: (
    operationType: ZoomTelemetryData['operationType'],
    startLevel: number,
    viewport?: { x: number; y: number; width: number; height: number },
    metadata?: Record<string, any>
  ) => string
  /** Update zoom optimization data */
  updateZoomOptimization: (
    zoomId: string,
    optimization: Partial<ZoomTelemetryData['renderOptimization']>
  ) => void
  /** Complete zoom operation tracking */
  completeZoomOperation: (
    zoomId: string,
    endLevel: number,
    endViewport?: { x: number; y: number; width: number; height: number },
    cancelled?: boolean,
    error?: string
  ) => ZoomTelemetryData | null
  
  // General tracking functions
  /** Start measuring a custom operation */
  measureOperation: <T>(name: string, operation: () => T) => T
  /** Record a custom event */
  recordEvent: (eventName: string, data?: Record<string, any>) => void
  /** Record user interaction */
  recordInteraction: (type: string, element?: string, data?: Record<string, any>) => void
  /** Force refresh of metrics */
  refreshMetrics: () => void
  /** Get performance recommendations */
  getRecommendations: () => string[]
  /** Export component telemetry data */
  exportData: () => any
  
  // AC4: Memory monitoring functions
  /** Get current memory usage for this component */
  getMemoryUsage: () => number
  /** Check for memory leaks */
  checkMemoryLeaks: () => MemoryLeakDetection[]
  /** Apply automated cleanup recommendations */
  applyCleanupRecommendations: () => Promise<void>
  
  // AC5: Interaction pattern analysis
  /** Get interaction patterns for optimization */
  getOptimizationOpportunities: () => InteractionPattern[]
  /** Report user frustration event */
  reportFrustration: (
    type: 'slow-response' | 'error' | 'dead-click' | 'rage-click' | 'excessive-scroll' | 'timeout',
    severity: number,
    context?: Record<string, any>
  ) => void
}

/**
 * Hook for advanced component-level telemetry tracking
 */
export const useAdvancedTelemetry = (
  options: UseAdvancedTelemetryOptions
): UseAdvancedTelemetryReturn => {
  const {
    componentName,
    parentComponent,
    autoTrack = true,
    trackMemory = true,
    trackInteractions = true,
    trackDragOperations = false,
    trackZoomOperations = false,
    onPerformanceIssue,
    onMemoryLeak,
    onInteractionPattern,
    calculateDataSize = (data: any) => JSON.stringify(data).length
  } = options

  // Generate unique component ID
  const componentId = useRef(`${componentName}-${Date.now()}-${Math.random().toString(36).substring(2)}`)
  
  // State for metrics
  const [componentMetrics, setComponentMetrics] = useState<ComponentPerformanceMetrics | null>(null)
  const [advancedKPIs, setAdvancedKPIs] = useState<AdvancedKPIMetrics | null>(null)
  const [dragOperations, setDragOperations] = useState<DragTelemetryData[]>([])
  const [zoomOperations, setZoomOperations] = useState<ZoomTelemetryData[]>([])
  const [interactionPatterns, setInteractionPatterns] = useState<InteractionPattern[]>([])
  const [memoryLeaks, setMemoryLeaks] = useState<MemoryLeakDetection[]>([])
  
  // Refs for tracking
  const renderStartTime = useRef<number>()
  const mountTime = useRef<number>()
  const interactionCounts = useRef<Record<string, number>>({})
  const lastMemoryCheck = useRef<number>(0)
  const activeDragOperations = useRef<Map<string, DragTelemetryData>>(new Map())
  const activeZoomOperations = useRef<Map<string, ZoomTelemetryData>>(new Map())

  /**
   * AC2: Start drag operation telemetry
   */
  const startDragOperation = useCallback((
    operationType: DragTelemetryData['operationType'],
    data?: any,
    affectedTaskIds: string[] = [],
    metadata: Record<string, any> = {}
  ): string => {
    if (!trackDragOperations) return ''
    
    const dataSize = data ? calculateDataSize(data) : 0
    const dragId = advancedTelemetry.startDragOperation(
      operationType,
      componentName,
      dataSize,
      affectedTaskIds,
      {
        ...metadata,
        componentId: componentId.current,
        data: data ? JSON.stringify(data).substring(0, 1000) : undefined // Store sample of data
      }
    )
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 ${componentName} started drag operation:`, {
        dragId,
        operationType,
        dataSize,
        affectedTaskIds
      })
    }
    
    return dragId
  }, [trackDragOperations, componentName, calculateDataSize])

  /**
   * AC2: Update drag operation progress
   */
  const updateDragOperation = useCallback((
    dragId: string,
    distance: { x: number; y: number },
    accuracy?: number,
    targetComponent?: string
  ): void => {
    if (!trackDragOperations || !dragId) return
    
    advancedTelemetry.updateDragOperation(dragId, distance, accuracy, targetComponent)
  }, [trackDragOperations])

  /**
   * AC2: Complete drag operation telemetry
   */
  const completeDragOperation = useCallback((
    dragId: string,
    cancelled: boolean = false,
    error?: string
  ): DragTelemetryData | null => {
    if (!trackDragOperations || !dragId) return null
    
    const result = advancedTelemetry.completeDragOperation(dragId, cancelled, error)
    
    if (result && process.env.NODE_ENV === 'development') {
      console.log(`✅ ${componentName} completed drag operation:`, {
        dragId,
        responseTime: result.responseTime,
        cancelled,
        error
      })
    }
    
    // Update local state
    refreshMetrics()
    
    return result
  }, [trackDragOperations, componentName])

  /**
   * AC3: Start zoom operation telemetry
   */
  const startZoomOperation = useCallback((
    operationType: ZoomTelemetryData['operationType'],
    startLevel: number,
    viewport: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 },
    metadata: Record<string, any> = {}
  ): string => {
    if (!trackZoomOperations) return ''
    
    const zoomId = advancedTelemetry.startZoomOperation(
      operationType,
      startLevel,
      viewport,
      {
        ...metadata,
        componentId: componentId.current,
        componentName
      }
    )
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${componentName} started zoom operation:`, {
        zoomId,
        operationType,
        startLevel,
        viewport
      })
    }
    
    return zoomId
  }, [trackZoomOperations, componentName])

  /**
   * AC3: Update zoom optimization data
   */
  const updateZoomOptimization = useCallback((
    zoomId: string,
    optimization: Partial<ZoomTelemetryData['renderOptimization']>
  ): void => {
    if (!trackZoomOperations || !zoomId) return
    
    advancedTelemetry.updateZoomOptimization(zoomId, optimization)
  }, [trackZoomOperations])

  /**
   * AC3: Complete zoom operation telemetry
   */
  const completeZoomOperation = useCallback((
    zoomId: string,
    endLevel: number,
    endViewport: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 },
    cancelled: boolean = false,
    error?: string
  ): ZoomTelemetryData | null => {
    if (!trackZoomOperations || !zoomId) return null
    
    const result = advancedTelemetry.completeZoomOperation(zoomId, endLevel, endViewport, cancelled, error)
    
    if (result && process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${componentName} completed zoom operation:`, {
        zoomId,
        responseTime: result.responseTime,
        levelChange: result.levelChange,
        cancelled,
        error
      })
    }
    
    // Update local state
    refreshMetrics()
    
    return result
  }, [trackZoomOperations, componentName])

  /**
   * Measure a custom operation
   */
  const measureOperation = useCallback(<T,>(name: string, operation: () => T): T => {
    const startTime = performance.now()
    const result = operation()
    const duration = performance.now() - startTime
    
    // Record the operation
    advancedTelemetry.recordComponentUpdate(componentId.current, 'state', duration)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 ${componentName} operation "${name}" took ${duration.toFixed(2)}ms`)
    }
    
    return result
  }, [componentName])

  /**
   * Record a custom event
   */
  const recordEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    const eventData = {
      componentId: componentId.current,
      componentName,
      eventName,
      timestamp: Date.now(),
      ...data
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Component event recorded:', eventData)
    }
    
    // In a real implementation, this would be sent to the telemetry system
  }, [componentName])

  /**
   * Record user interaction
   */
  const recordInteraction = useCallback((type: string, element?: string, data?: Record<string, any>) => {
    if (!trackInteractions) return
    
    // Update interaction counts
    interactionCounts.current[type] = (interactionCounts.current[type] || 0) + 1
    
    const interactionData = {
      componentId: componentId.current,
      componentName,
      interactionType: type,
      element,
      count: interactionCounts.current[type],
      timestamp: Date.now(),
      ...data
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('👆 User interaction recorded:', interactionData)
    }
  }, [componentName, trackInteractions])

  /**
   * AC4: Get current memory usage for this component
   */
  const getMemoryUsage = useCallback((): number => {
    const metrics = advancedTelemetry.getComponentMetrics()
      .find(m => m.componentId === componentId.current)
    return metrics?.memoryUsage || 0
  }, [])

  /**
   * AC4: Check for memory leaks
   */
  const checkMemoryLeaks = useCallback((): MemoryLeakDetection[] => {
    const kpis = advancedTelemetry.getAdvancedKPIs()
    return kpis.memory.memoryLeaks
  }, [])

  /**
   * AC4: Apply automated cleanup recommendations
   */
  const applyCleanupRecommendations = useCallback(async (): Promise<void> => {
    const leaks = checkMemoryLeaks()
    const autoCleanupLeaks = leaks.filter(leak => leak.autoCleanupAvailable)
    
    for (const leak of autoCleanupLeaks) {
      for (const rec of leak.recommendations) {
        if (rec.canAutoFix && rec.autoFixAction) {
          try {
            await rec.autoFixAction()
            console.log(`🧹 Auto-fixed: ${rec.action}`)
          } catch (error) {
            console.warn(`Failed to auto-fix ${rec.action}:`, error)
          }
        }
      }
    }
  }, [checkMemoryLeaks])

  /**
   * AC5: Get interaction patterns for optimization
   */
  const getOptimizationOpportunities = useCallback((): InteractionPattern[] => {
    const patterns = advancedTelemetry.getInteractionPatterns()
    return patterns.filter(pattern => 
      pattern.affectedComponents.includes(componentName) ||
      pattern.optimizationOpportunity.priority === 'high' ||
      pattern.optimizationOpportunity.priority === 'critical'
    )
  }, [componentName])

  /**
   * AC5: Report user frustration event
   */
  const reportFrustration = useCallback((
    type: 'slow-response' | 'error' | 'dead-click' | 'rage-click' | 'excessive-scroll' | 'timeout',
    severity: number,
    context: Record<string, any> = {}
  ): void => {
    const frustrationEvent = {
      type,
      timestamp: Date.now(),
      component: componentName,
      severity: Math.max(1, Math.min(10, severity)),
      context: {
        ...context,
        componentId: componentId.current,
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      userAction: context.userAction || 'unknown',
      expectedOutcome: context.expectedOutcome || 'unknown',
      actualOutcome: context.actualOutcome || 'unknown',
      recoveryTime: context.recoveryTime,
      resolved: false
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('😤 User frustration reported:', frustrationEvent)
    }
    
    // This would be sent to the advanced telemetry system
  }, [componentName])

  /**
   * Refresh metrics
   */
  const refreshMetrics = useCallback(() => {
    const metrics = advancedTelemetry.getComponentMetrics()
      .find(m => m.componentId === componentId.current)
    
    const kpis = advancedTelemetry.getAdvancedKPIs()
    const dragOps = advancedTelemetry.getDragOperationMetrics()
    const zoomOps = advancedTelemetry.getZoomOperationMetrics()
    const patterns = advancedTelemetry.getInteractionPatterns()
    const leaks = checkMemoryLeaks()
    
    setComponentMetrics(metrics || null)
    setAdvancedKPIs(kpis)
    setDragOperations(dragOps.slice(-10)) // Keep last 10 operations
    setZoomOperations(zoomOps.slice(-10))
    setInteractionPatterns(patterns.slice(-20)) // Keep last 20 patterns
    setMemoryLeaks(leaks)
    
    // Check for performance issues
    if (metrics && onPerformanceIssue) {
      if (metrics.renderTime > 100 || metrics.memoryUsage > 50) {
        onPerformanceIssue(metrics)
      }
    }
    
    // Check for memory leaks
    if (trackMemory && onMemoryLeak && leaks.length > 0) {
      const currentTime = Date.now()
      if (currentTime - lastMemoryCheck.current > 30000) { // Check every 30 seconds
        onMemoryLeak(leaks)
        lastMemoryCheck.current = currentTime
      }
    }
    
    // Check for interaction patterns
    if (onInteractionPattern && patterns.length > 0) {
      const relevantPatterns = patterns.filter(p => 
        p.affectedComponents.includes(componentName)
      )
      if (relevantPatterns.length > 0) {
        onInteractionPattern(relevantPatterns)
      }
    }
  }, [onPerformanceIssue, onMemoryLeak, onInteractionPattern, trackMemory, componentName, checkMemoryLeaks])

  /**
   * Get performance recommendations
   */
  const getRecommendations = useCallback((): string[] => {
    if (!componentMetrics) return []
    
    const recommendations: string[] = []
    
    if (componentMetrics.renderTime > 100) {
      recommendations.push('Consider optimizing render performance - render time is over 100ms')
    }
    
    if (componentMetrics.rerenderCount > 50) {
      recommendations.push('High rerender count detected - consider memoization with React.memo or useMemo')
    }
    
    if (componentMetrics.memoryUsage > 50) {
      recommendations.push('High memory usage detected - check for memory leaks')
    }
    
    if (componentMetrics.domNodeCount > 1000) {
      recommendations.push('High DOM node count - consider virtualization for large lists')
    }
    
    if (componentMetrics.eventListenerCount > 20) {
      recommendations.push('Many event listeners detected - ensure proper cleanup in useEffect')
    }
    
    // Add drag operation recommendations
    if (trackDragOperations && dragOperations.length > 0) {
      const avgDragTime = dragOperations.reduce((sum, op) => sum + op.responseTime, 0) / dragOperations.length
      if (avgDragTime > 200) {
        recommendations.push('Drag operations are slow - consider optimizing drag handlers or reducing data payload')
      }
      
      const errorRate = dragOperations.filter(op => op.errorOccurred).length / dragOperations.length
      if (errorRate > 0.1) {
        recommendations.push('High drag operation error rate - review drag validation and error handling')
      }
    }
    
    // Add zoom operation recommendations
    if (trackZoomOperations && zoomOperations.length > 0) {
      const avgZoomTime = zoomOperations.reduce((sum, op) => sum + op.responseTime, 0) / zoomOperations.length
      if (avgZoomTime > 150) {
        recommendations.push('Zoom operations are slow - consider improving render optimization')
      }
      
      const avgMemoryIncrease = zoomOperations.reduce((sum, op) => 
        sum + (op.renderOptimization.memoryAfter - op.renderOptimization.memoryBefore), 0
      ) / zoomOperations.length
      if (avgMemoryIncrease > 5) {
        recommendations.push('Zoom operations cause high memory usage - implement better cleanup')
      }
    }
    
    // Add interaction pattern recommendations
    const optimizationOpportunities = getOptimizationOpportunities()
    optimizationOpportunities.forEach(pattern => {
      if (pattern.optimizationOpportunity.priority === 'high' || pattern.optimizationOpportunity.priority === 'critical') {
        recommendations.push(pattern.optimizationOpportunity.description)
      }
    })
    
    return recommendations
  }, [componentMetrics, trackDragOperations, trackZoomOperations, dragOperations, zoomOperations, getOptimizationOpportunities])

  /**
   * Export component telemetry data
   */
  const exportData = useCallback(() => {
    return {
      componentId: componentId.current,
      componentName,
      metrics: componentMetrics,
      advancedKPIs,
      dragOperations,
      zoomOperations,
      interactionPatterns: getOptimizationOpportunities(),
      memoryLeaks,
      interactionCounts: interactionCounts.current,
      recommendations: getRecommendations()
    }
  }, [componentName, componentMetrics, advancedKPIs, dragOperations, zoomOperations, memoryLeaks, getOptimizationOpportunities, getRecommendations])

  // Setup component tracking on mount
  useEffect(() => {
    if (!autoTrack) return
    
    mountTime.current = performance.now()
    
    // Start component tracking
    advancedTelemetry.startComponentTracking(
      componentName,
      componentId.current,
      parentComponent
    )
    
    // Add component ID to DOM element for tracking
    const addComponentIdToElement = () => {
      // Look for the component's root element and add data attribute
      // This is a simplified approach - in practice, you might need more sophisticated element detection
      const potentialElements = document.querySelectorAll(`[class*="${componentName}"], [data-testid*="${componentName}"]`)
      if (potentialElements.length > 0) {
        potentialElements[0].setAttribute('data-component-id', componentId.current)
      }
    }
    
    // Add component ID after a short delay to ensure DOM is ready
    setTimeout(addComponentIdToElement, 100)
    
    // Initial metrics refresh
    refreshMetrics()
    
    return () => {
      // Stop component tracking on unmount
      advancedTelemetry.stopComponentTracking(componentId.current)
    }
  }, [componentName, parentComponent, autoTrack, refreshMetrics])

  // Track renders
  useEffect(() => {
    if (!autoTrack) return
    
    if (renderStartTime.current) {
      const renderDuration = performance.now() - renderStartTime.current
      advancedTelemetry.recordComponentRender(componentId.current, renderDuration)
      refreshMetrics()
    }
    
    renderStartTime.current = performance.now()
  })

  // Periodic metrics update
  useEffect(() => {
    if (!autoTrack) return
    
    const interval = setInterval(() => {
      refreshMetrics()
    }, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [autoTrack, refreshMetrics])

  return {
    componentId: componentId.current,
    componentMetrics,
    advancedKPIs,
    dragOperations,
    zoomOperations,
    interactionPatterns,
    memoryLeaks,
    
    // AC2: Drag operation functions
    startDragOperation,
    updateDragOperation,
    completeDragOperation,
    
    // AC3: Zoom operation functions
    startZoomOperation,
    updateZoomOptimization,
    completeZoomOperation,
    
    // General functions
    measureOperation,
    recordEvent,
    recordInteraction,
    refreshMetrics,
    getRecommendations,
    exportData,
    
    // AC4: Memory monitoring functions
    getMemoryUsage,
    checkMemoryLeaks,
    applyCleanupRecommendations,
    
    // AC5: Interaction pattern analysis
    getOptimizationOpportunities,
    reportFrustration
  }
}

/**
 * Simplified hook for basic performance tracking
 */
export const useComponentPerformance = (componentName: string) => {
  const { componentMetrics, getRecommendations } = useAdvancedTelemetry({
    componentName,
    autoTrack: true,
    trackMemory: false,
    trackInteractions: false
  })
  
  return {
    componentName,
    renderTime: componentMetrics?.renderTime || 0,
    rerenderCount: componentMetrics?.rerenderCount || 0,
    isPerformant: (componentMetrics?.renderTime || 0) < 16.67, // 60fps target
    recommendations: getRecommendations()
  }
}

/**
 * Hook for tracking user interactions with advanced pattern analysis
 */
export const useInteractionTracking = (componentName: string) => {
  const { 
    recordInteraction, 
    recordEvent, 
    getOptimizationOpportunities, 
    reportFrustration,
    interactionPatterns
  } = useAdvancedTelemetry({
    componentName,
    autoTrack: false,
    trackMemory: false,
    trackInteractions: true
  })
  
  return {
    // Basic interaction tracking
    trackClick: useCallback((element?: string, data?: Record<string, any>) => {
      recordInteraction('click', element, data)
    }, [recordInteraction]),
    
    trackDrag: useCallback((element?: string, data?: Record<string, any>) => {
      recordInteraction('drag', element, data)
    }, [recordInteraction]),
    
    trackHover: useCallback((element?: string, data?: Record<string, any>) => {
      recordInteraction('hover', element, data)
    }, [recordInteraction]),
    
    trackCustomEvent: useCallback((eventName: string, data?: Record<string, any>) => {
      recordEvent(eventName, data)
    }, [recordEvent]),
    
    // Advanced features
    reportFrustration,
    getOptimizationOpportunities,
    interactionPatterns: interactionPatterns.filter(p => 
      p.affectedComponents.includes(componentName)
    )
  }
}

/**
 * Hook for comprehensive drag operation tracking
 */
export const useDragTelemetry = (componentName: string, calculateDataSize?: (data: any) => number) => {
  const {
    startDragOperation,
    updateDragOperation,
    completeDragOperation,
    dragOperations
  } = useAdvancedTelemetry({
    componentName,
    autoTrack: false,
    trackDragOperations: true,
    calculateDataSize
  })
  
  return {
    startDragOperation,
    updateDragOperation,
    completeDragOperation,
    dragOperations,
    
    // Helper functions
    getDragPerformanceStats: useCallback(() => {
      if (dragOperations.length === 0) return null
      
      const avgResponseTime = dragOperations.reduce((sum, op) => sum + op.responseTime, 0) / dragOperations.length
      const errorRate = dragOperations.filter(op => op.errorOccurred).length / dragOperations.length
      const cancelRate = dragOperations.filter(op => op.cancelled).length / dragOperations.length
      
      return {
        totalOperations: dragOperations.length,
        avgResponseTime,
        errorRate: errorRate * 100,
        cancelRate: cancelRate * 100,
        slowOperations: dragOperations.filter(op => op.responseTime > 200).length
      }
    }, [dragOperations])
  }
}

/**
 * Hook for comprehensive zoom operation tracking
 */
export const useZoomTelemetry = (componentName: string) => {
  const {
    startZoomOperation,
    updateZoomOptimization,
    completeZoomOperation,
    zoomOperations
  } = useAdvancedTelemetry({
    componentName,
    autoTrack: false,
    trackZoomOperations: true
  })
  
  return {
    startZoomOperation,
    updateZoomOptimization,
    completeZoomOperation,
    zoomOperations,
    
    // Helper functions
    getZoomPerformanceStats: useCallback(() => {
      if (zoomOperations.length === 0) return null
      
      const avgResponseTime = zoomOperations.reduce((sum, op) => sum + op.responseTime, 0) / zoomOperations.length
      const avgMemoryIncrease = zoomOperations.reduce((sum, op) => 
        sum + (op.renderOptimization.memoryAfter - op.renderOptimization.memoryBefore), 0
      ) / zoomOperations.length
      const avgElementsSkipped = zoomOperations.reduce((sum, op) => 
        sum + op.renderOptimization.elementsSkipped, 0
      ) / zoomOperations.length
      
      return {
        totalOperations: zoomOperations.length,
        avgResponseTime,
        avgMemoryIncrease,
        avgElementsSkipped,
        optimizationEffectiveness: avgElementsSkipped / (avgElementsSkipped + avgMemoryIncrease)
      }
    }, [zoomOperations])
  }
}

/**
 * Hook for memory monitoring with automated recommendations
 */
export const useMemoryMonitoring = (componentName: string) => {
  const [memoryWarnings, setMemoryWarnings] = useState<MemoryLeakDetection[]>([])
  
  const { 
    advancedKPIs, 
    getMemoryUsage, 
    checkMemoryLeaks, 
    applyCleanupRecommendations 
  } = useAdvancedTelemetry({
    componentName,
    autoTrack: true,
    trackMemory: true,
    trackInteractions: false,
    onMemoryLeak: (leaks) => {
      setMemoryWarnings(leaks)
    }
  })
  
  const runMemoryAnalysis = useCallback(async () => {
    const leaks = checkMemoryLeaks()
    const currentMemory = getMemoryUsage()
    
    return {
      currentMemoryUsage: currentMemory,
      memoryLeaks: leaks,
      recommendations: leaks.flatMap(leak => leak.recommendations),
      canAutoFix: leaks.some(leak => leak.autoCleanupAvailable),
      severity: leaks.length > 0 ? Math.max(...leaks.map(l => {
        switch (l.severity) {
          case 'critical': return 4
          case 'high': return 3
          case 'medium': return 2
          case 'low': return 1
          default: return 0
        }
      })) : 0
    }
  }, [checkMemoryLeaks, getMemoryUsage])
  
  return {
    memoryUsage: advancedKPIs?.memory.heapUsed || 0,
    memoryWarnings,
    hasMemoryIssues: memoryWarnings.length > 0,
    clearWarnings: () => setMemoryWarnings([]),
    applyCleanupRecommendations,
    runMemoryAnalysis
  }
}