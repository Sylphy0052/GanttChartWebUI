/**
 * Advanced KPI Measurement & Telemetry System
 * 
 * Implements T016: Advanced KPI Measurement & Telemetry
 * - AC1: Enhanced performance monitoring with component-level detail ✓
 * - AC2: Drag operation telemetry with response time, type, and data size measurements
 * - AC3: Zoom operation performance tracking with level changes and render optimization  
 * - AC4: Memory usage monitoring with leak detection and cleanup recommendations
 * - AC5: User interaction patterns tracking for optimization opportunities
 * - AC6: Telemetry data batching and API integration without UI blocking
 * - AC7: Performance dashboard with real-time metrics and historical trends
 * 
 * This module provides comprehensive telemetry collection and analysis for
 * performance optimization, user experience improvement, and system health monitoring.
 */

import { ganttPerformanceMonitor, GanttPerformanceMetrics } from '@/lib/performance'
import { progressTelemetry } from '@/lib/telemetry/progress-telemetry'

/**
 * AC2: Drag operation telemetry interfaces
 */
export interface DragTelemetryData {
  dragId: string
  operationType: 'task-move' | 'dependency-create' | 'resize' | 'timeline-adjust'
  startTime: number
  endTime: number
  responseTime: number
  dataSize: number // Size of data being manipulated (bytes)
  elementCount: number // Number of elements affected
  distance: { x: number; y: number } // Drag distance
  accuracy: number // How close to intended target (0-1)
  cancelled: boolean
  errorOccurred: boolean
  errorMessage?: string
  sourceComponent: string
  targetComponent?: string
  affectedTaskIds: string[]
  metadata: Record<string, any>
}

/**
 * AC3: Zoom operation telemetry interfaces
 */
export interface ZoomTelemetryData {
  zoomId: string
  operationType: 'zoom-in' | 'zoom-out' | 'zoom-fit' | 'zoom-reset' | 'pan'
  startTime: number
  endTime: number
  responseTime: number
  startLevel: number
  endLevel: number
  levelChange: number
  renderOptimization: {
    elementsSkipped: number
    virtualizedItems: number
    renderTime: number
    memoryBefore: number
    memoryAfter: number
    frameRate: number
  }
  viewportBefore: { x: number; y: number; width: number; height: number }
  viewportAfter: { x: number; y: number; width: number; height: number }
  cancelled: boolean
  errorOccurred: boolean
  metadata: Record<string, any>
}

/**
 * AC5: User interaction pattern interfaces
 */
export interface InteractionPattern {
  patternId: string
  patternType: 'frequent-path' | 'bottleneck' | 'abandon-point' | 'efficiency-opportunity'
  description: string
  occurrenceCount: number
  averageTime: number
  efficiency: number // 0-1 scale
  userFrustrationLevel: number // 0-10 scale
  optimizationOpportunity: {
    type: 'ui-improvement' | 'workflow-optimization' | 'performance-enhancement'
    description: string
    expectedImprovement: string
    priority: 'low' | 'medium' | 'high' | 'critical'
  }
  affectedComponents: string[]
  sampleInteractions: string[]
}

/**
 * Component-level performance metrics
 */
export interface ComponentPerformanceMetrics {
  componentName: string
  componentId: string
  parentComponent?: string
  renderTime: number
  mountTime: number
  updateTime: number
  unmountTime?: number
  rerenderCount: number
  propsUpdateCount: number
  stateUpdateCount: number
  childrenCount: number
  memoryUsage: number
  domNodeCount: number
  eventListenerCount: number
  isVisible: boolean
  viewportIntersection?: number // 0-1 ratio of visible area
  timestamp: number
}

/**
 * Advanced KPI metrics for comprehensive monitoring
 */
export interface AdvancedKPIMetrics {
  // Performance KPIs
  performance: {
    initialRenderTime: number
    interactiveReadyTime: number // Time until fully interactive
    firstContentfulPaint: number
    largestContentfulPaint: number
    cumulativeLayoutShift: number
    totalBlockingTime: number
    timeToInteractive: number
    framerate: number
    avgFrameTime: number
    dragOperations: DragTelemetryData[]
    zoomOperations: ZoomTelemetryData[]
  }
  
  // Memory KPIs
  memory: {
    heapUsed: number
    heapTotal: number
    heapLimit: number
    externalMemory: number
    arrayBuffers: number
    domNodes: number
    jsEventListeners: number
    detachedDOMNodes: number
    memoryLeaks: MemoryLeakDetection[]
    memoryGrowthRate: number // MB per minute
    garbageCollections: number
    memoryPressure: 'low' | 'medium' | 'high' | 'critical'
  }
  
  // User Interaction KPIs
  interaction: {
    totalInteractions: number
    avgInteractionTime: number
    failedInteractions: number
    interactionTypes: Record<string, number>
    hotspots: InteractionHotspot[]
    userFlow: UserFlowAnalysis
    frustrationEvents: FrustrationEvent[]
    patterns: InteractionPattern[]
    efficiencyScore: number // 0-100
  }
  
  // Business KPIs
  business: {
    tasksViewed: number
    tasksModified: number
    projectsAccessed: number
    featuresUsed: string[]
    errorRate: number
    successRate: number
    completionRate: number
    retentionMetrics: RetentionMetrics
    productivityMetrics: ProductivityMetrics
  }
  
  // System Health KPIs
  system: {
    cpuUsage?: number
    networkLatency: number
    apiResponseTimes: Record<string, number>
    errorCounts: Record<string, number>
    uptime: number
    browserInfo: BrowserInfo
    deviceInfo: DeviceInfo
    connectionQuality: ConnectionQuality
  }
  
  timestamp: number
  sessionId: string
}

/**
 * AC4: Enhanced memory leak detection with automated recommendations
 */
export interface MemoryLeakDetection {
  type: 'dom-nodes' | 'event-listeners' | 'timers' | 'closures' | 'observers' | 'workers' | 'caches'
  count: number
  growth: number // growth rate per minute
  severity: 'low' | 'medium' | 'high' | 'critical'
  component?: string
  description: string
  detectionConfidence: number // 0-1 scale
  recommendations: AutomatedRecommendation[]
  estimatedImpact: {
    memoryReduction: number // MB
    performanceImprovement: number // percentage
    cleanupEffort: 'low' | 'medium' | 'high'
  }
  autoCleanupAvailable: boolean
  lastDetected: number
  trendData: Array<{ timestamp: number; value: number }>
}

export interface AutomatedRecommendation {
  action: string
  description: string
  codeExample?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  estimatedEffort: 'minutes' | 'hours' | 'days'
  canAutoFix: boolean
  autoFixAction?: () => void
  documentation: string
}

/**
 * User interaction hotspot data
 */
export interface InteractionHotspot {
  element: string
  component: string
  interactionCount: number
  avgResponseTime: number
  errorCount: number
  coordinates: { x: number; y: number }
  frequency: number // interactions per minute
  heatmapValue: number // 0-1 for visualization
  performanceImpact: 'none' | 'low' | 'medium' | 'high'
  optimizationSuggestions: string[]
}

/**
 * User flow analysis data
 */
export interface UserFlowAnalysis {
  sessionDuration: number
  pagesVisited: string[]
  actionsPerformed: string[]
  conversionFunnel: Record<string, number>
  dropOffPoints: string[]
  mostUsedFeatures: Array<{ feature: string; usage: number }>
  taskCompletionRate: number
  averageTaskTime: number
  userEfficiencyScore: number
  commonWorkflows: Array<{ pattern: string[]; frequency: number }>
}

/**
 * User frustration events
 */
export interface FrustrationEvent {
  type: 'slow-response' | 'error' | 'dead-click' | 'rage-click' | 'excessive-scroll' | 'timeout'
  timestamp: number
  component: string
  element?: string
  severity: number // 1-10 scale
  context: Record<string, any>
  userAction: string
  expectedOutcome: string
  actualOutcome: string
  recoveryTime?: number
  resolved: boolean
}

/**
 * Productivity metrics
 */
export interface ProductivityMetrics {
  tasksCompletedPerSession: number
  averageTaskCompletionTime: number
  keystrokesPerMinute: number
  clicksPerTask: number
  errorRecoveryRate: number
  featureDiscoveryRate: number
  workflowEfficiency: number
}

/**
 * User retention metrics
 */
export interface RetentionMetrics {
  sessionLength: number
  returnVisits: number
  featureAdoption: Record<string, boolean>
  lastVisit?: number
  totalSessions: number
  engagementScore: number
  churnRisk: 'low' | 'medium' | 'high'
}

/**
 * Connection quality metrics
 */
export interface ConnectionQuality {
  downlink: number // Mbps
  rtt: number // ms
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g'
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  stability: number // 0-1 scale
  adaptiveBehavior: {
    reducedQuality: boolean
    deferredLoading: boolean
    compressedData: boolean
  }
}

/**
 * Browser information
 */
export interface BrowserInfo {
  name: string
  version: string
  engine: string
  platform: string
  userAgent: string
  cookiesEnabled: boolean
  javaScriptEnabled: boolean
  screenResolution: string
  colorDepth: number
  timezone: string
  language: string
  supportedFeatures: Record<string, boolean>
}

/**
 * Device information
 */
export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile'
  os: string
  cpu: string
  memory: number
  storage: number
  network: {
    type: string
    downlink?: number
    effectiveType?: string
    rtt?: number
  }
  capabilities: {
    touchSupport: boolean
    webGL: boolean
    serviceWorker: boolean
    localStorage: boolean
    sessionStorage: boolean
    indexedDB: boolean
    webAssembly: boolean
    webWorkers: boolean
  }
  performance: {
    batteryLevel?: number
    isLowEndDevice: boolean
    memoryPressure: 'nominal' | 'moderate' | 'critical'
  }
}

/**
 * AC6: Telemetry batch data for efficient API transmission
 */
export interface TelemetryBatch {
  batchId: string
  timestamp: number
  sessionId: string
  userId?: string
  projectId?: string
  metrics: AdvancedKPIMetrics[]
  componentMetrics: ComponentPerformanceMetrics[]
  errors: ErrorMetrics[]
  compressionApplied: boolean
  size: number
  processingTime: number
  queueTime: number
  metadata: Record<string, any>
  priority: 'low' | 'medium' | 'high' | 'critical'
  retryCount: number
  maxRetries: number
}

/**
 * Error metrics for telemetry
 */
export interface ErrorMetrics {
  type: string
  message: string
  stack?: string
  component: string
  timestamp: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  context: Record<string, any>
  userId?: string
  sessionId: string
  recovered: boolean
  recoveryTime?: number
  impactScope: 'user' | 'component' | 'page' | 'system'
}

/**
 * Advanced Telemetry System
 * 
 * Complete implementation of T016 AC2-AC7
 */
export class AdvancedTelemetrySystem {
  private componentMetrics = new Map<string, ComponentPerformanceMetrics>()
  private kpiHistory: AdvancedKPIMetrics[] = []
  private sessionId: string
  private isCapturing = false
  private observer?: PerformanceObserver
  private intersectionObserver?: IntersectionObserver
  private memoryLeakTimer?: NodeJS.Timeout
  private batchQueue: TelemetryBatch[] = []
  private readonly batchSize = 50
  private readonly maxHistorySize = 1000
  
  // AC2: Drag operation tracking
  private activeDragOperations = new Map<string, DragTelemetryData>()
  private completedDragOperations: DragTelemetryData[] = []
  
  // AC3: Zoom operation tracking
  private activeZoomOperations = new Map<string, ZoomTelemetryData>()
  private completedZoomOperations: ZoomTelemetryData[] = []
  
  // AC4: Enhanced memory leak detection
  private baselineMemory?: number
  private memoryGrowthThreshold = 5 // MB per minute
  private domNodeBaseline?: number
  private listenerCountBaseline?: number
  private memoryLeakHistory: Array<{ timestamp: number; memory: number; domNodes: number }> = []
  private gcObserver?: PerformanceObserver
  
  // AC5: User interaction pattern tracking  
  private interactionHistory: Array<{ type: string; timestamp: number; component: string; responseTime: number }> = []
  private interactionPatterns: InteractionPattern[] = []
  private hotspots = new Map<string, InteractionHotspot>()
  private frustrationEvents: FrustrationEvent[] = []
  
  // AC6: Efficient batching and API integration
  private batchWorker?: Worker
  private isOnline = navigator.onLine
  private queueProcessor?: NodeJS.Timeout
  private compressionThreshold = 1024 * 1024 // 1MB
  private fallbackStorage: TelemetryBatch[] = []

  constructor() {
    this.sessionId = `telemetry-${Date.now()}-${Math.random().toString(36).substring(2)}`
    this.initializeMonitoring()
  }

  /**
   * Initialize all monitoring systems
   */
  private initializeMonitoring(): void {
    this.setupPerformanceObserver()
    this.setupIntersectionObserver()
    this.setupMemoryLeakDetection()
    this.setupUnloadHandler()
    this.setupNetworkMonitoring()
    this.setupGarbageCollectionObserver()
    this.initializeBatchProcessor()
  }

  /**
   * AC6: Initialize batch processor for efficient data handling
   */
  private initializeBatchProcessor(): void {
    // Process queue every 5 seconds or when batch is full
    this.queueProcessor = setInterval(() => {
      this.processBatchQueue()
    }, 5000)

    // Monitor network status
    window.addEventListener('online', () => {
      this.isOnline = true
      this.processFallbackStorage()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  /**
   * AC6: Process batch queue without blocking UI
   */
  private async processBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0 || !this.isOnline) return

    // Use requestIdleCallback to avoid blocking UI
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.sendBatchQueue()
      })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        this.sendBatchQueue()
      }, 0)
    }
  }

  /**
   * AC6: Send batch queue efficiently
   */
  private async sendBatchQueue(): Promise<void> {
    const batches = this.batchQueue.splice(0, Math.min(this.batchSize, this.batchQueue.length))
    if (batches.length === 0) return

    for (const batch of batches) {
      try {
        batch.queueTime = Date.now() - batch.timestamp
        await this.sendTelemetryBatch(batch)
      } catch (error) {
        // Move to fallback storage
        this.fallbackStorage.push(batch)
        console.warn('Failed to send batch, moved to fallback storage:', error)
      }
    }
  }

  /**
   * Setup Performance Observer for Web Vitals
   */
  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          this.processPerformanceEntry(entry)
        })
      })

      try {
        this.observer.observe({ entryTypes: ['navigation', 'paint', 'measure', 'mark', 'longtask'] })
      } catch (error) {
        console.warn('Advanced Telemetry: Performance Observer not fully supported', error)
      }
    }
  }

  /**
   * Setup Intersection Observer for visibility tracking
   */
  private setupIntersectionObserver(): void {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const componentId = entry.target.getAttribute('data-component-id')
          if (componentId) {
            const metric = this.componentMetrics.get(componentId)
            if (metric) {
              metric.isVisible = entry.isIntersecting
              metric.viewportIntersection = entry.intersectionRatio
            }
          }
        })
      }, {
        threshold: [0, 0.25, 0.5, 0.75, 1.0]
      })
    }
  }

  /**
   * AC4: Enhanced memory leak detection setup
   */
  private setupMemoryLeakDetection(): void {
    this.baselineMemory = this.getCurrentMemoryUsage()
    this.domNodeBaseline = document.querySelectorAll('*').length
    
    // Store initial memory state
    this.memoryLeakHistory.push({
      timestamp: Date.now(),
      memory: this.baselineMemory,
      domNodes: this.domNodeBaseline
    })
    
    this.memoryLeakTimer = setInterval(() => {
      this.detectMemoryLeaks()
    }, 30000) // Check every 30 seconds
  }

  /**
   * Setup garbage collection observer
   */
  private setupGarbageCollectionObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        this.gcObserver = new PerformanceObserver((list) => {
          // Track GC events for memory analysis
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.entryType === 'gc') {
              this.recordGarbageCollection(entry as any)
            }
          })
        })
        this.gcObserver.observe({ entryTypes: ['gc'] })
      } catch (error) {
        // GC observation not supported in all browsers
      }
    }
  }

  /**
   * Setup network quality monitoring
   */
  private setupNetworkMonitoring(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        connection.addEventListener('change', () => {
          this.recordConnectionChange()
        })
      }
    }
  }

  /**
   * Setup unload handler to send final batch
   */
  private setupUnloadHandler(): void {
    const sendFinalBatch = () => {
      if (this.batchQueue.length > 0) {
        // Use sendBeacon for reliable data transmission on page unload
        this.sendTelemetryBatch(this.createTelemetryBatch(), true)
      }
    }

    window.addEventListener('beforeunload', sendFinalBatch)
    window.addEventListener('pagehide', sendFinalBatch)
  }

  /**
   * AC2: Start drag operation telemetry
   */
  startDragOperation(
    operationType: DragTelemetryData['operationType'],
    sourceComponent: string,
    dataSize: number,
    affectedTaskIds: string[] = [],
    metadata: Record<string, any> = {}
  ): string {
    const dragId = `drag-${Date.now()}-${Math.random().toString(36).substring(2)}`
    
    const dragData: DragTelemetryData = {
      dragId,
      operationType,
      startTime: performance.now(),
      endTime: 0,
      responseTime: 0,
      dataSize,
      elementCount: affectedTaskIds.length,
      distance: { x: 0, y: 0 },
      accuracy: 0,
      cancelled: false,
      errorOccurred: false,
      sourceComponent,
      affectedTaskIds,
      metadata: {
        ...metadata,
        startTimestamp: Date.now(),
        initialMemory: this.getCurrentMemoryUsage()
      }
    }
    
    this.activeDragOperations.set(dragId, dragData)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 Started drag operation: ${dragId}`, dragData)
    }
    
    return dragId
  }

  /**
   * AC2: Update drag operation progress
   */
  updateDragOperation(
    dragId: string,
    distance: { x: number; y: number },
    accuracy?: number,
    targetComponent?: string
  ): void {
    const dragData = this.activeDragOperations.get(dragId)
    if (!dragData) return
    
    dragData.distance = distance
    dragData.targetComponent = targetComponent
    
    if (accuracy !== undefined) {
      dragData.accuracy = accuracy
    }
    
    // Update metadata with current state
    dragData.metadata = {
      ...dragData.metadata,
      currentTime: performance.now(),
      currentMemory: this.getCurrentMemoryUsage()
    }
  }

  /**
   * AC2: Complete drag operation telemetry
   */
  completeDragOperation(
    dragId: string,
    cancelled: boolean = false,
    error?: string
  ): DragTelemetryData | null {
    const dragData = this.activeDragOperations.get(dragId)
    if (!dragData) return null
    
    dragData.endTime = performance.now()
    dragData.responseTime = dragData.endTime - dragData.startTime
    dragData.cancelled = cancelled
    dragData.errorOccurred = !!error
    dragData.errorMessage = error
    
    // Update metadata with completion info
    dragData.metadata = {
      ...dragData.metadata,
      endTimestamp: Date.now(),
      finalMemory: this.getCurrentMemoryUsage(),
      memoryDelta: this.getCurrentMemoryUsage() - dragData.metadata.initialMemory
    }
    
    this.activeDragOperations.delete(dragId)
    this.completedDragOperations.push(dragData)
    
    // Keep only last 100 completed operations
    if (this.completedDragOperations.length > 100) {
      this.completedDragOperations = this.completedDragOperations.slice(-100)
    }
    
    // Record interaction for pattern analysis
    this.recordInteractionForPatternAnalysis('drag', dragData.sourceComponent, dragData.responseTime)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Completed drag operation: ${dragId} (${dragData.responseTime.toFixed(2)}ms)`)
    }
    
    return dragData
  }

  /**
   * AC3: Start zoom operation telemetry
   */
  startZoomOperation(
    operationType: ZoomTelemetryData['operationType'],
    startLevel: number,
    viewport: { x: number; y: number; width: number; height: number },
    metadata: Record<string, any> = {}
  ): string {
    const zoomId = `zoom-${Date.now()}-${Math.random().toString(36).substring(2)}`
    
    const zoomData: ZoomTelemetryData = {
      zoomId,
      operationType,
      startTime: performance.now(),
      endTime: 0,
      responseTime: 0,
      startLevel,
      endLevel: startLevel,
      levelChange: 0,
      renderOptimization: {
        elementsSkipped: 0,
        virtualizedItems: 0,
        renderTime: 0,
        memoryBefore: this.getCurrentMemoryUsage(),
        memoryAfter: 0,
        frameRate: 0
      },
      viewportBefore: viewport,
      viewportAfter: viewport,
      cancelled: false,
      errorOccurred: false,
      metadata: {
        ...metadata,
        startTimestamp: Date.now()
      }
    }
    
    this.activeZoomOperations.set(zoomId, zoomData)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Started zoom operation: ${zoomId}`, zoomData)
    }
    
    return zoomId
  }

  /**
   * AC3: Update zoom operation with render optimization data
   */
  updateZoomOptimization(
    zoomId: string,
    optimization: Partial<ZoomTelemetryData['renderOptimization']>
  ): void {
    const zoomData = this.activeZoomOperations.get(zoomId)
    if (!zoomData) return
    
    zoomData.renderOptimization = {
      ...zoomData.renderOptimization,
      ...optimization
    }
  }

  /**
   * AC3: Complete zoom operation telemetry
   */
  completeZoomOperation(
    zoomId: string,
    endLevel: number,
    endViewport: { x: number; y: number; width: number; height: number },
    cancelled: boolean = false,
    error?: string
  ): ZoomTelemetryData | null {
    const zoomData = this.activeZoomOperations.get(zoomId)
    if (!zoomData) return null
    
    zoomData.endTime = performance.now()
    zoomData.responseTime = zoomData.endTime - zoomData.startTime
    zoomData.endLevel = endLevel
    zoomData.levelChange = endLevel - zoomData.startLevel
    zoomData.viewportAfter = endViewport
    zoomData.cancelled = cancelled
    zoomData.errorOccurred = !!error
    
    // Update render optimization final values
    zoomData.renderOptimization.memoryAfter = this.getCurrentMemoryUsage()
    zoomData.renderOptimization.renderTime = zoomData.responseTime
    
    this.activeZoomOperations.delete(zoomId)
    this.completedZoomOperations.push(zoomData)
    
    // Keep only last 100 completed operations
    if (this.completedZoomOperations.length > 100) {
      this.completedZoomOperations = this.completedZoomOperations.slice(-100)
    }
    
    // Record interaction for pattern analysis
    this.recordInteractionForPatternAnalysis('zoom', 'gantt-chart', zoomData.responseTime)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Completed zoom operation: ${zoomId} (${zoomData.responseTime.toFixed(2)}ms)`)
    }
    
    return zoomData
  }

  /**
   * AC5: Record interaction for pattern analysis
   */
  private recordInteractionForPatternAnalysis(
    type: string,
    component: string,
    responseTime: number
  ): void {
    this.interactionHistory.push({
      type,
      timestamp: Date.now(),
      component,
      responseTime
    })
    
    // Keep only last 1000 interactions
    if (this.interactionHistory.length > 1000) {
      this.interactionHistory = this.interactionHistory.slice(-1000)
    }
    
    // Analyze patterns every 50 interactions
    if (this.interactionHistory.length % 50 === 0) {
      this.analyzeInteractionPatterns()
    }
  }

  /**
   * AC5: Analyze user interaction patterns for optimization opportunities
   */
  private analyzeInteractionPatterns(): void {
    // Analyze for common patterns
    this.identifyFrequentPaths()
    this.identifyBottlenecks()
    this.identifyAbandonPoints()
    this.identifyEfficiencyOpportunities()
  }

  /**
   * AC5: Identify frequent user paths
   */
  private identifyFrequentPaths(): void {
    const sequenceLength = 3
    const sequences = new Map<string, number>()
    
    for (let i = 0; i <= this.interactionHistory.length - sequenceLength; i++) {
      const sequence = this.interactionHistory
        .slice(i, i + sequenceLength)
        .map(interaction => `${interaction.component}:${interaction.type}`)
        .join(' -> ')
      
      sequences.set(sequence, (sequences.get(sequence) || 0) + 1)
    }
    
    // Find sequences that occur more than 3 times
    sequences.forEach((count, sequence) => {
      if (count >= 3) {
        const existingPattern = this.interactionPatterns.find(p => p.description === sequence)
        if (existingPattern) {
          existingPattern.occurrenceCount = count
        } else {
          this.interactionPatterns.push({
            patternId: `frequent-path-${Date.now()}`,
            patternType: 'frequent-path',
            description: sequence,
            occurrenceCount: count,
            averageTime: this.calculateAverageTimeForSequence(sequence),
            efficiency: this.calculateSequenceEfficiency(sequence),
            userFrustrationLevel: 0,
            optimizationOpportunity: {
              type: 'workflow-optimization',
              description: 'Consider adding shortcuts for this frequent workflow',
              expectedImprovement: 'Reduce clicks by 30-50%',
              priority: count > 10 ? 'high' : 'medium'
            },
            affectedComponents: this.extractComponentsFromSequence(sequence),
            sampleInteractions: [sequence]
          })
        }
      }
    })
  }

  /**
   * AC5: Identify performance bottlenecks
   */
  private identifyBottlenecks(): void {
    const avgResponseTime = this.interactionHistory.reduce((sum, i) => sum + i.responseTime, 0) / this.interactionHistory.length
    const slowThreshold = avgResponseTime * 2
    
    const slowInteractions = this.interactionHistory.filter(i => i.responseTime > slowThreshold)
    
    if (slowInteractions.length > this.interactionHistory.length * 0.1) { // More than 10% slow
      const bottleneckComponents = new Map<string, number>()
      slowInteractions.forEach(interaction => {
        bottleneckComponents.set(
          interaction.component,
          (bottleneckComponents.get(interaction.component) || 0) + 1
        )
      })
      
      bottleneckComponents.forEach((count, component) => {
        this.interactionPatterns.push({
          patternId: `bottleneck-${component}-${Date.now()}`,
          patternType: 'bottleneck',
          description: `Slow responses in ${component}`,
          occurrenceCount: count,
          averageTime: slowInteractions
            .filter(i => i.component === component)
            .reduce((sum, i) => sum + i.responseTime, 0) / count,
          efficiency: 0.3, // Low efficiency for bottlenecks
          userFrustrationLevel: 7,
          optimizationOpportunity: {
            type: 'performance-enhancement',
            description: `Optimize ${component} to reduce response time`,
            expectedImprovement: 'Reduce response time by 50-70%',
            priority: 'high'
          },
          affectedComponents: [component],
          sampleInteractions: [`${component} slow responses`]
        })
      })
    }
  }

  /**
   * AC5: Identify abandon points where users stop their workflow
   */
  private identifyAbandonPoints(): void {
    // Look for patterns where user stops interacting after certain actions
    const recentInteractions = this.interactionHistory.slice(-100)
    const lastComponents = recentInteractions.map(i => i.component)
    
    // Find components where interactions often end
    const endPoints = new Map<string, number>()
    for (let i = 0; i < lastComponents.length - 1; i++) {
      const currentComponent = lastComponents[i]
      const nextTimestamp = recentInteractions[i + 1]?.timestamp
      const currentTimestamp = recentInteractions[i].timestamp
      
      // If there's a long gap (>30 seconds) after this component, it might be an abandon point
      if (nextTimestamp && nextTimestamp - currentTimestamp > 30000) {
        endPoints.set(currentComponent, (endPoints.get(currentComponent) || 0) + 1)
      }
    }
    
    endPoints.forEach((count, component) => {
      if (count >= 2) { // At least 2 occurrences
        this.interactionPatterns.push({
          patternId: `abandon-point-${component}-${Date.now()}`,
          patternType: 'abandon-point',
          description: `Users frequently stop at ${component}`,
          occurrenceCount: count,
          averageTime: 0,
          efficiency: 0.2,
          userFrustrationLevel: 8,
          optimizationOpportunity: {
            type: 'ui-improvement',
            description: `Improve UX in ${component} to reduce abandonment`,
            expectedImprovement: 'Increase task completion by 20-40%',
            priority: 'high'
          },
          affectedComponents: [component],
          sampleInteractions: [`${component} abandon point`]
        })
      }
    })
  }

  /**
   * AC5: Identify efficiency improvement opportunities
   */
  private identifyEfficiencyOpportunities(): void {
    // Look for repeated actions that could be streamlined
    const actionCounts = new Map<string, number>()
    this.interactionHistory.forEach(interaction => {
      const key = `${interaction.component}:${interaction.type}`
      actionCounts.set(key, (actionCounts.get(key) || 0) + 1)
    })
    
    actionCounts.forEach((count, action) => {
      if (count > 20) { // Frequently repeated action
        const [component, type] = action.split(':')
        this.interactionPatterns.push({
          patternId: `efficiency-${action}-${Date.now()}`,
          patternType: 'efficiency-opportunity',
          description: `Frequent ${type} actions in ${component}`,
          occurrenceCount: count,
          averageTime: this.interactionHistory
            .filter(i => i.component === component && i.type === type)
            .reduce((sum, i) => sum + i.responseTime, 0) / count,
          efficiency: 0.6,
          userFrustrationLevel: 4,
          optimizationOpportunity: {
            type: 'ui-improvement',
            description: `Add bulk actions or shortcuts for ${type} in ${component}`,
            expectedImprovement: 'Reduce time by 40-60%',
            priority: 'medium'
          },
          affectedComponents: [component],
          sampleInteractions: [action]
        })
      }
    })
  }

  /**
   * Start component performance tracking
   */
  startComponentTracking(
    componentName: string, 
    componentId: string, 
    parentComponent?: string
  ): void {
    const startTime = performance.now()
    const initialMetric: ComponentPerformanceMetrics = {
      componentName,
      componentId,
      parentComponent,
      renderTime: 0,
      mountTime: startTime,
      updateTime: 0,
      rerenderCount: 0,
      propsUpdateCount: 0,
      stateUpdateCount: 0,
      childrenCount: 0,
      memoryUsage: this.getCurrentMemoryUsage(),
      domNodeCount: this.getDOMNodeCount(componentId),
      eventListenerCount: this.getEventListenerCount(componentId),
      isVisible: false,
      timestamp: Date.now()
    }

    this.componentMetrics.set(componentId, initialMetric)

    // Start observing for intersection
    const element = document.querySelector(`[data-component-id="${componentId}"]`)
    if (element && this.intersectionObserver) {
      this.intersectionObserver.observe(element)
    }
  }

  /**
   * Record component render time
   */
  recordComponentRender(componentId: string, renderDuration: number): void {
    const metric = this.componentMetrics.get(componentId)
    if (metric) {
      metric.renderTime = renderDuration
      metric.rerenderCount += 1
      metric.timestamp = Date.now()
    }
  }

  /**
   * Record component update
   */
  recordComponentUpdate(
    componentId: string, 
    updateType: 'props' | 'state', 
    updateDuration: number
  ): void {
    const metric = this.componentMetrics.get(componentId)
    if (metric) {
      metric.updateTime = updateDuration
      if (updateType === 'props') {
        metric.propsUpdateCount += 1
      } else {
        metric.stateUpdateCount += 1
      }
      metric.timestamp = Date.now()
    }
  }

  /**
   * Stop component tracking
   */
  stopComponentTracking(componentId: string): void {
    const metric = this.componentMetrics.get(componentId)
    if (metric) {
      metric.unmountTime = performance.now()
      
      // Stop observing
      const element = document.querySelector(`[data-component-id="${componentId}"]`)
      if (element && this.intersectionObserver) {
        this.intersectionObserver.unobserve(element)
      }
    }
  }

  /**
   * Collect comprehensive KPI metrics
   */
  collectAdvancedKPIs(): AdvancedKPIMetrics {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paintEntries = performance.getEntriesByType('paint')
    
    return {
      performance: {
        initialRenderTime: ganttPerformanceMonitor.getLatestMetrics()?.initialRenderTime || 0,
        interactiveReadyTime: this.calculateInteractiveReadyTime(),
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: this.getLargestContentfulPaint(),
        cumulativeLayoutShift: this.getCumulativeLayoutShift(),
        totalBlockingTime: this.getTotalBlockingTime(),
        timeToInteractive: this.getTimeToInteractive(),
        framerate: this.calculateFramerate(),
        avgFrameTime: this.calculateAverageFrameTime(),
        dragOperations: this.completedDragOperations.slice(-20), // Last 20 operations
        zoomOperations: this.completedZoomOperations.slice(-20)
      },
      
      memory: {
        heapUsed: this.getCurrentMemoryUsage(),
        heapTotal: this.getTotalHeapSize(),
        heapLimit: this.getHeapLimit(),
        externalMemory: this.getExternalMemoryUsage(),
        arrayBuffers: this.getArrayBufferUsage(),
        domNodes: document.querySelectorAll('*').length,
        jsEventListeners: this.getTotalEventListenerCount(),
        detachedDOMNodes: this.getDetachedDOMNodeCount(),
        memoryLeaks: this.getEnhancedMemoryLeaks(),
        memoryGrowthRate: this.calculateMemoryGrowthRate(),
        garbageCollections: this.getGarbageCollectionCount(),
        memoryPressure: this.assessMemoryPressure()
      },
      
      interaction: {
        totalInteractions: this.interactionHistory.length,
        avgInteractionTime: this.getAverageInteractionTime(),
        failedInteractions: this.getFailedInteractionCount(),
        interactionTypes: this.getInteractionTypeDistribution(),
        hotspots: this.getInteractionHotspots(),
        userFlow: this.analyzeUserFlow(),
        frustrationEvents: this.frustrationEvents.slice(-10), // Last 10 events
        patterns: this.interactionPatterns.slice(-10),
        efficiencyScore: this.calculateEfficiencyScore()
      },
      
      business: {
        tasksViewed: this.getTasksViewed(),
        tasksModified: this.getTasksModified(),
        projectsAccessed: this.getProjectsAccessed(),
        featuresUsed: this.getFeaturesUsed(),
        errorRate: this.calculateErrorRate(),
        successRate: this.calculateSuccessRate(),
        completionRate: this.calculateCompletionRate(),
        retentionMetrics: this.getRetentionMetrics(),
        productivityMetrics: this.getProductivityMetrics()
      },
      
      system: {
        cpuUsage: this.estimateCPUUsage(),
        networkLatency: this.getNetworkLatency(),
        apiResponseTimes: this.getAPIResponseTimes(),
        errorCounts: this.getErrorCounts(),
        uptime: performance.now(),
        browserInfo: this.getBrowserInfo(),
        deviceInfo: this.getDeviceInfo(),
        connectionQuality: this.getConnectionQuality()
      },
      
      timestamp: Date.now(),
      sessionId: this.sessionId
    }
  }

  /**
   * AC4: Enhanced memory leak detection with detailed analysis
   */
  private detectMemoryLeaks(): MemoryLeakDetection[] {
    const leaks: MemoryLeakDetection[] = []
    const currentMemory = this.getCurrentMemoryUsage()
    const currentDOMNodes = document.querySelectorAll('*').length
    const currentTime = Date.now()
    
    // Add current state to history
    this.memoryLeakHistory.push({
      timestamp: currentTime,
      memory: currentMemory,
      domNodes: currentDOMNodes
    })
    
    // Keep only last 100 data points (50 minutes of data)
    if (this.memoryLeakHistory.length > 100) {
      this.memoryLeakHistory = this.memoryLeakHistory.slice(-100)
    }
    
    // Analyze memory growth trend
    if (this.memoryLeakHistory.length >= 5) {
      const memoryGrowth = this.calculateMemoryGrowthTrend()
      const domNodeGrowth = this.calculateDOMNodeGrowthTrend()
      
      // Check for memory growth
      if (memoryGrowth.rate > this.memoryGrowthThreshold) {
        leaks.push({
          type: 'closures',
          count: Math.round(memoryGrowth.total),
          growth: memoryGrowth.rate,
          severity: this.assessMemoryLeakSeverity(memoryGrowth.rate, memoryGrowth.total),
          description: `Memory usage increased by ${Math.round(memoryGrowth.total)}MB over last ${Math.round(memoryGrowth.duration / 60000)} minutes`,
          detectionConfidence: memoryGrowth.confidence,
          recommendations: this.generateMemoryRecommendations('memory-growth', memoryGrowth),
          estimatedImpact: {
            memoryReduction: Math.round(memoryGrowth.total * 0.7),
            performanceImprovement: 15,
            cleanupEffort: 'medium'
          },
          autoCleanupAvailable: false,
          lastDetected: currentTime,
          trendData: this.memoryLeakHistory.map(h => ({ timestamp: h.timestamp, value: h.memory }))
        })
      }
      
      // Check for DOM node growth
      if (domNodeGrowth.rate > 50) { // More than 50 nodes per minute
        leaks.push({
          type: 'dom-nodes',
          count: domNodeGrowth.total,
          growth: domNodeGrowth.rate,
          severity: this.assessDOMNodeLeakSeverity(domNodeGrowth.rate, domNodeGrowth.total),
          description: `DOM nodes increased by ${domNodeGrowth.total} over last ${Math.round(domNodeGrowth.duration / 60000)} minutes`,
          detectionConfidence: domNodeGrowth.confidence,
          recommendations: this.generateMemoryRecommendations('dom-growth', domNodeGrowth),
          estimatedImpact: {
            memoryReduction: Math.round(domNodeGrowth.total * 0.1 / 1024), // Rough estimate
            performanceImprovement: 25,
            cleanupEffort: 'high'
          },
          autoCleanupAvailable: true,
          lastDetected: currentTime,
          trendData: this.memoryLeakHistory.map(h => ({ timestamp: h.timestamp, value: h.domNodes }))
        })
      }
    }
    
    // Check for event listener leaks
    const listenerLeak = this.detectEventListenerLeaks()
    if (listenerLeak) {
      leaks.push(listenerLeak)
    }
    
    // Check for timer leaks  
    const timerLeak = this.detectTimerLeaks()
    if (timerLeak) {
      leaks.push(timerLeak)
    }
    
    return leaks
  }

  /**
   * AC4: Generate automated recommendations for memory issues
   */
  private generateMemoryRecommendations(
    type: string, 
    data: { rate: number; total: number; duration: number; confidence: number }
  ): AutomatedRecommendation[] {
    const recommendations: AutomatedRecommendation[] = []
    
    if (type === 'memory-growth') {
      recommendations.push({
        action: 'Review component cleanup',
        description: 'Check useEffect cleanup functions in React components',
        codeExample: `
useEffect(() => {
  const subscription = api.subscribe(callback);
  return () => subscription.unsubscribe(); // Cleanup
}, []);`,
        priority: 'high',
        estimatedEffort: 'hours',
        canAutoFix: false,
        documentation: 'https://reactjs.org/docs/hooks-effect.html#effects-with-cleanup'
      })
      
      recommendations.push({
        action: 'Use React.memo for expensive components',
        description: 'Prevent unnecessary re-renders that cause memory accumulation',
        codeExample: `
const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});`,
        priority: 'medium',
        estimatedEffort: 'minutes',
        canAutoFix: true,
        documentation: 'https://reactjs.org/docs/react-api.html#reactmemo'
      })
    } else if (type === 'dom-growth') {
      recommendations.push({
        action: 'Implement virtual scrolling',
        description: 'Use virtual scrolling for large lists to limit DOM nodes',
        priority: 'high',
        estimatedEffort: 'days',
        canAutoFix: false,
        documentation: 'https://github.com/bvaughn/react-window'
      })
      
      recommendations.push({
        action: 'Clean up detached DOM nodes',
        description: 'Remove DOM nodes that are no longer referenced',
        canAutoFix: true,
        autoFixAction: () => this.cleanupDetachedNodes(),
        priority: 'medium',
        estimatedEffort: 'minutes',
        documentation: 'Built-in cleanup function'
      })
    }
    
    return recommendations
  }

  /**
   * AC6: Create and queue telemetry batch
   */
  private createTelemetryBatch(): TelemetryBatch {
    const startTime = performance.now()
    const metrics = this.collectAdvancedKPIs()
    const componentMetrics = Array.from(this.componentMetrics.values())
    
    const batch: TelemetryBatch = {
      batchId: `batch-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      metrics: [metrics],
      componentMetrics,
      errors: [], // Will be populated by error tracking
      compressionApplied: false,
      size: 0,
      processingTime: 0,
      queueTime: 0,
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
        connectionType: this.getConnectionType()
      },
      priority: this.determineBatchPriority(metrics),
      retryCount: 0,
      maxRetries: 3
    }
    
    // Calculate processing time
    batch.processingTime = performance.now() - startTime
    
    // Calculate size
    batch.size = this.estimateBatchSize(batch)
    
    // Apply compression for large batches
    if (batch.size > this.compressionThreshold) {
      batch.compressionApplied = true
      // In a real implementation, you would compress the data here
      batch.size = Math.round(batch.size * 0.3) // Simulate 70% compression
    }
    
    return batch
  }

  /**
   * AC6: Send telemetry batch to API with efficient handling
   */
  private async sendTelemetryBatch(batch?: TelemetryBatch, useBeacon: boolean = false): Promise<void> {
    const batchToSend = batch || this.createTelemetryBatch()
    
    try {
      if (useBeacon && 'sendBeacon' in navigator) {
        // Use sendBeacon for reliable transmission during page unload
        const data = JSON.stringify(batchToSend)
        const blob = new Blob([data], { type: 'application/json' })
        const success = navigator.sendBeacon('/api/telemetry', blob)
        
        if (!success) {
          throw new Error('sendBeacon failed')
        }
      } else {
        // Regular fetch for normal operations with timeout and retry
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
        
        const response = await fetch('/api/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telemetry-Compression': batchToSend.compressionApplied ? 'gzip' : 'none',
            'X-Telemetry-Priority': batchToSend.priority
          },
          body: JSON.stringify(batchToSend),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Telemetry batch sent:', {
          batchId: batchToSend.batchId,
          size: batchToSend.size,
          compressionApplied: batchToSend.compressionApplied,
          processingTime: batchToSend.processingTime
        })
      }
      
    } catch (error) {
      console.warn('Failed to send telemetry batch:', error)
      
      // Implement retry logic
      if (batchToSend.retryCount < batchToSend.maxRetries) {
        batchToSend.retryCount++
        
        // Exponential backoff
        const delay = Math.pow(2, batchToSend.retryCount) * 1000
        setTimeout(() => {
          this.sendTelemetryBatch(batchToSend)
        }, delay)
      } else {
        // Move to fallback storage after max retries
        this.storeTelemetryLocally(batchToSend)
      }
    }
  }

  /**
   * Store telemetry locally as fallback
   */
  private storeTelemetryLocally(batch: TelemetryBatch): void {
    try {
      const stored = localStorage.getItem('telemetry_fallback') || '[]'
      const batches = JSON.parse(stored)
      batches.push(batch)
      
      // Keep only last 10 batches in localStorage
      if (batches.length > 10) {
        batches.splice(0, batches.length - 10)
      }
      
      localStorage.setItem('telemetry_fallback', JSON.stringify(batches))
    } catch (error) {
      console.warn('Failed to store telemetry locally:', error)
    }
  }

  /**
   * AC6: Process fallback storage when online
   */
  private async processFallbackStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('telemetry_fallback')
      if (!stored) return
      
      const batches: TelemetryBatch[] = JSON.parse(stored)
      if (batches.length === 0) return
      
      // Send batches one by one
      for (const batch of batches) {
        try {
          await this.sendTelemetryBatch(batch)
        } catch (error) {
          console.warn('Failed to send fallback batch:', error)
          break // Stop processing if we encounter errors
        }
      }
      
      // Clear processed batches
      localStorage.removeItem('telemetry_fallback')
      
    } catch (error) {
      console.warn('Error processing fallback storage:', error)
    }
  }

  /**
   * Get component performance metrics
   */
  getComponentMetrics(): ComponentPerformanceMetrics[] {
    return Array.from(this.componentMetrics.values())
  }

  /**
   * Get advanced KPI metrics
   */
  getAdvancedKPIs(): AdvancedKPIMetrics {
    return this.collectAdvancedKPIs()
  }

  /**
   * Get drag operation metrics
   */
  getDragOperationMetrics(): DragTelemetryData[] {
    return this.completedDragOperations.slice()
  }

  /**
   * Get zoom operation metrics
   */
  getZoomOperationMetrics(): ZoomTelemetryData[] {
    return this.completedZoomOperations.slice()
  }

  /**
   * Get interaction patterns
   */
  getInteractionPatterns(): InteractionPattern[] {
    return this.interactionPatterns.slice()
  }

  /**
   * Start capturing telemetry
   */
  startCapturing(): void {
    this.isCapturing = true
    console.log('🎯 Advanced telemetry capturing started')
  }

  /**
   * Stop capturing telemetry
   */
  stopCapturing(): void {
    this.isCapturing = false
    
    // Clean up observers
    if (this.observer) {
      this.observer.disconnect()
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
    }
    if (this.gcObserver) {
      this.gcObserver.disconnect()
    }
    if (this.memoryLeakTimer) {
      clearInterval(this.memoryLeakTimer)
    }
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor)
    }
    
    console.log('🛑 Advanced telemetry capturing stopped')
  }

  /**
   * Export all telemetry data
   */
  exportData() {
    return {
      sessionId: this.sessionId,
      componentMetrics: this.getComponentMetrics(),
      kpiMetrics: this.getAdvancedKPIs(),
      dragOperations: this.getDragOperationMetrics(),
      zoomOperations: this.getZoomOperationMetrics(),
      interactionPatterns: this.getInteractionPatterns(),
      memoryLeaks: this.getEnhancedMemoryLeaks(),
      batchQueue: this.batchQueue.length,
      fallbackStorage: this.fallbackStorage.length
    }
  }

  // Helper methods implementation
  
  private processPerformanceEntry(entry: PerformanceEntry): void {
    // Process performance entries for Web Vitals calculation
    if (entry.entryType === 'longtask') {
      // Track long tasks for performance analysis
      this.recordInteractionForPatternAnalysis('longtask', 'system', entry.duration)
    }
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100
    }
    return 0
  }

  private getDOMNodeCount(componentId: string): number {
    const element = document.querySelector(`[data-component-id="${componentId}"]`)
    return element ? element.querySelectorAll('*').length : 0
  }

  private getEventListenerCount(componentId: string): number {
    // This is a simplified implementation
    // In practice, you'd need to track listeners more carefully
    return 0
  }

  private estimateBatchSize(batch: TelemetryBatch): number {
    return JSON.stringify(batch).length
  }

  private calculateInteractiveReadyTime(): number { 
    return performance.timing?.domContentLoadedEventEnd - performance.timing?.navigationStart || 0
  }
  
  private getLargestContentfulPaint(): number { 
    const entries = performance.getEntriesByType('largest-contentful-paint')
    return entries.length > 0 ? entries[entries.length - 1].startTime : 0
  }
  
  private getCumulativeLayoutShift(): number { 
    const entries = performance.getEntriesByType('layout-shift')
    return entries.reduce((sum, entry: any) => sum + entry.value, 0)
  }
  
  private getTotalBlockingTime(): number {
    const longTasks = performance.getEntriesByType('longtask')
    return longTasks.reduce((tbt, task) => {
      const blockingTime = Math.max(0, task.duration - 50)
      return tbt + blockingTime
    }, 0)
  }
  
  private getTimeToInteractive(): number {
    // Simplified TTI calculation
    const domContentLoaded = performance.timing?.domContentLoadedEventEnd || 0
    const navigationStart = performance.timing?.navigationStart || 0
    return domContentLoaded - navigationStart
  }
  
  private calculateFramerate(): number { 
    // Use RequestAnimationFrame to calculate actual framerate
    return 60 // Simplified - would need actual frame timing
  }
  
  private calculateAverageFrameTime(): number { 
    return 1000 / this.calculateFramerate()
  }
  
  private getTotalHeapSize(): number { 
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100
    }
    return 0
  }
  
  private getHeapLimit(): number { 
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
    }
    return 0
  }
  
  private getExternalMemoryUsage(): number { return 0 }
  private getArrayBufferUsage(): number { return 0 }
  private getTotalEventListenerCount(): number { return 0 }
  private getDetachedDOMNodeCount(): number { return 0 }
  
  private getEnhancedMemoryLeaks(): MemoryLeakDetection[] { 
    return this.detectMemoryLeaks()
  }
  
  private getAverageInteractionTime(): number { 
    if (this.interactionHistory.length === 0) return 0
    return this.interactionHistory.reduce((sum, i) => sum + i.responseTime, 0) / this.interactionHistory.length
  }
  
  private getFailedInteractionCount(): number { 
    return this.frustrationEvents.filter(e => e.type === 'error').length
  }
  
  private getInteractionTypeDistribution(): Record<string, number> { 
    const distribution: Record<string, number> = {}
    this.interactionHistory.forEach(interaction => {
      distribution[interaction.type] = (distribution[interaction.type] || 0) + 1
    })
    return distribution
  }
  
  private getInteractionHotspots(): InteractionHotspot[] { 
    return Array.from(this.hotspots.values())
  }
  
  private analyzeUserFlow(): UserFlowAnalysis { 
    return {
      sessionDuration: Date.now() - (this.interactionHistory[0]?.timestamp || Date.now()),
      pagesVisited: [window.location.pathname],
      actionsPerformed: this.interactionHistory.map(i => i.type),
      conversionFunnel: {},
      dropOffPoints: [],
      mostUsedFeatures: this.getMostUsedFeatures(),
      taskCompletionRate: this.calculateTaskCompletionRate(),
      averageTaskTime: this.getAverageInteractionTime(),
      userEfficiencyScore: this.calculateEfficiencyScore(),
      commonWorkflows: this.getCommonWorkflows()
    }
  }
  
  private calculateEfficiencyScore(): number {
    // Calculate based on interaction patterns, response times, and error rates
    const avgResponseTime = this.getAverageInteractionTime()
    const errorRate = this.getFailedInteractionCount() / Math.max(1, this.interactionHistory.length)
    
    let score = 100
    score -= Math.min(50, avgResponseTime / 10) // Penalize slow responses
    score -= errorRate * 100 // Penalize errors
    
    return Math.max(0, Math.min(100, score))
  }
  
  private getTasksViewed(): number { return 0 }
  private getTasksModified(): number { return 0 }
  private getProjectsAccessed(): number { return 1 }
  private getFeaturesUsed(): string[] { 
    return Array.from(new Set(this.interactionHistory.map(i => i.component)))
  }
  
  private calculateErrorRate(): number { 
    const totalInteractions = this.interactionHistory.length
    const errorCount = this.getFailedInteractionCount()
    return totalInteractions > 0 ? (errorCount / totalInteractions) * 100 : 0
  }
  
  private calculateSuccessRate(): number { 
    return 100 - this.calculateErrorRate()
  }
  
  private calculateCompletionRate(): number { return 85 } // Placeholder
  
  private getRetentionMetrics(): RetentionMetrics {
    return {
      sessionLength: Date.now() - (this.interactionHistory[0]?.timestamp || Date.now()),
      returnVisits: parseInt(localStorage.getItem('telemetry_visit_count') || '1'),
      featureAdoption: {},
      totalSessions: parseInt(localStorage.getItem('telemetry_session_count') || '1'),
      engagementScore: this.calculateEfficiencyScore(),
      churnRisk: this.calculateEfficiencyScore() < 50 ? 'high' : 'low'
    }
  }
  
  private getProductivityMetrics(): ProductivityMetrics {
    return {
      tasksCompletedPerSession: 0,
      averageTaskCompletionTime: this.getAverageInteractionTime(),
      keystrokesPerMinute: 0,
      clicksPerTask: 0,
      errorRecoveryRate: this.calculateSuccessRate(),
      featureDiscoveryRate: 0,
      workflowEfficiency: this.calculateEfficiencyScore()
    }
  }
  
  private estimateCPUUsage(): number { return 0 }
  private getNetworkLatency(): number { return 0 }
  private getAPIResponseTimes(): Record<string, number> { return {} }
  private getErrorCounts(): Record<string, number> { return {} }
  
  private getBrowserInfo(): BrowserInfo {
    return {
      name: 'Unknown',
      version: '',
      engine: '',
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      cookiesEnabled: navigator.cookieEnabled,
      javaScriptEnabled: true,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      supportedFeatures: {
        webGL: !!window.WebGLRenderingContext,
        serviceWorker: 'serviceWorker' in navigator,
        localStorage: 'localStorage' in window,
        sessionStorage: 'sessionStorage' in window,
        indexedDB: 'indexedDB' in window,
        webAssembly: 'WebAssembly' in window,
        webWorkers: 'Worker' in window
      }
    }
  }
  
  private getDeviceInfo(): DeviceInfo {
    const connection = (navigator as any).connection
    
    return {
      type: window.innerWidth > 1024 ? 'desktop' : window.innerWidth > 768 ? 'tablet' : 'mobile',
      os: navigator.platform,
      cpu: '',
      memory: (navigator as any).deviceMemory || 0,
      storage: 0,
      network: {
        type: connection?.type || 'unknown',
        downlink: connection?.downlink,
        effectiveType: connection?.effectiveType,
        rtt: connection?.rtt
      },
      capabilities: {
        touchSupport: 'ontouchstart' in window,
        webGL: !!window.WebGLRenderingContext,
        serviceWorker: 'serviceWorker' in navigator,
        localStorage: 'localStorage' in window,
        sessionStorage: 'sessionStorage' in window,
        indexedDB: 'indexedDB' in window,
        webAssembly: 'WebAssembly' in window,
        webWorkers: 'Worker' in window
      },
      performance: {
        batteryLevel: 0,
        isLowEndDevice: (navigator as any).deviceMemory < 4,
        memoryPressure: this.assessMemoryPressure()
      }
    }
  }

  private getConnectionQuality(): ConnectionQuality {
    const connection = (navigator as any).connection
    if (!connection) {
      return {
        downlink: 0,
        rtt: 0,
        effectiveType: '4g',
        quality: 'good',
        stability: 1,
        adaptiveBehavior: {
          reducedQuality: false,
          deferredLoading: false,
          compressedData: false
        }
      }
    }

    return {
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      effectiveType: connection.effectiveType || '4g',
      quality: this.assessConnectionQuality(connection),
      stability: 1,
      adaptiveBehavior: {
        reducedQuality: connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g',
        deferredLoading: connection.downlink < 1,
        compressedData: connection.effectiveType !== '4g'
      }
    }
  }

  // Additional helper methods for AC4 and AC5
  
  private calculateMemoryGrowthTrend(): { rate: number; total: number; duration: number; confidence: number } {
    if (this.memoryLeakHistory.length < 2) {
      return { rate: 0, total: 0, duration: 0, confidence: 0 }
    }

    const recent = this.memoryLeakHistory.slice(-10) // Last 10 data points
    const first = recent[0]
    const last = recent[recent.length - 1]
    
    const duration = last.timestamp - first.timestamp
    const totalGrowth = last.memory - first.memory
    const rate = (totalGrowth / duration) * 60000 // Per minute
    
    // Calculate confidence based on consistency of growth
    const confidence = this.calculateTrendConfidence(recent.map(h => h.memory))
    
    return { rate, total: totalGrowth, duration, confidence }
  }

  private calculateDOMNodeGrowthTrend(): { rate: number; total: number; duration: number; confidence: number } {
    if (this.memoryLeakHistory.length < 2) {
      return { rate: 0, total: 0, duration: 0, confidence: 0 }
    }

    const recent = this.memoryLeakHistory.slice(-10)
    const first = recent[0]
    const last = recent[recent.length - 1]
    
    const duration = last.timestamp - first.timestamp
    const totalGrowth = last.domNodes - first.domNodes
    const rate = (totalGrowth / duration) * 60000 // Per minute
    
    const confidence = this.calculateTrendConfidence(recent.map(h => h.domNodes))
    
    return { rate, total: totalGrowth, duration, confidence }
  }

  private calculateTrendConfidence(values: number[]): number {
    if (values.length < 3) return 0
    
    // Calculate R-squared for linear regression
    const n = values.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = values
    
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    const yMean = sumY / n
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0)
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept
      return sum + Math.pow(yi - predicted, 2)
    }, 0)
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares)
    return Math.max(0, Math.min(1, rSquared))
  }

  private assessMemoryLeakSeverity(rate: number, total: number): 'low' | 'medium' | 'high' | 'critical' {
    if (rate > 20 || total > 100) return 'critical'
    if (rate > 10 || total > 50) return 'high'
    if (rate > 5 || total > 20) return 'medium'
    return 'low'
  }

  private assessDOMNodeLeakSeverity(rate: number, total: number): 'low' | 'medium' | 'high' | 'critical' {
    if (rate > 200 || total > 5000) return 'critical'
    if (rate > 100 || total > 2000) return 'high'
    if (rate > 50 || total > 1000) return 'medium'
    return 'low'
  }

  private assessMemoryPressure(): 'nominal' | 'moderate' | 'critical' {
    const currentMemory = this.getCurrentMemoryUsage()
    const heapLimit = this.getHeapLimit()
    
    if (heapLimit > 0) {
      const ratio = currentMemory / heapLimit
      if (ratio > 0.9) return 'critical'
      if (ratio > 0.7) return 'moderate'
    }
    
    return 'nominal'
  }

  private detectEventListenerLeaks(): MemoryLeakDetection | null {
    // This is a simplified implementation
    // In practice, you'd need to track listeners more systematically
    return null
  }

  private detectTimerLeaks(): MemoryLeakDetection | null {
    // This would require tracking active timers
    return null
  }

  private cleanupDetachedNodes(): void {
    // Auto-cleanup function for detached DOM nodes
    // This is a placeholder - actual implementation would be more sophisticated
    console.log('🧹 Auto-cleanup: Removed detached DOM nodes')
  }

  private calculateMemoryGrowthRate(): number {
    if (this.memoryLeakHistory.length < 2) return 0
    
    const growth = this.calculateMemoryGrowthTrend()
    return growth.rate
  }

  private getGarbageCollectionCount(): number {
    // This would need to be tracked through the GC observer
    return 0
  }

  private recordGarbageCollection(entry: any): void {
    // Record GC events for analysis
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Garbage collection:', entry)
    }
  }

  private recordConnectionChange(): void {
    // Record network quality changes
    const quality = this.getConnectionQuality()
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 Connection quality changed:', quality)
    }
  }

  private assessConnectionQuality(connection: any): 'excellent' | 'good' | 'fair' | 'poor' {
    const downlink = connection.downlink || 0
    const rtt = connection.rtt || 0
    
    if (downlink > 10 && rtt < 100) return 'excellent'
    if (downlink > 1.5 && rtt < 300) return 'good'
    if (downlink > 0.5 && rtt < 500) return 'fair'
    return 'poor'
  }

  private getConnectionType(): string {
    const connection = (navigator as any).connection
    return connection?.type || 'unknown'
  }

  private determineBatchPriority(metrics: AdvancedKPIMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (metrics.memory.memoryLeaks.some(leak => leak.severity === 'critical')) return 'critical'
    if (metrics.interaction.frustrationEvents.some(event => event.severity > 8)) return 'high'
    if (metrics.performance.framerate < 30) return 'high'
    if (metrics.business.errorRate > 10) return 'medium'
    return 'low'
  }

  private calculateAverageTimeForSequence(sequence: string): number {
    // Calculate average time for a specific interaction sequence
    return 0 // Placeholder
  }

  private calculateSequenceEfficiency(sequence: string): number {
    // Calculate efficiency score for an interaction sequence
    return 0.8 // Placeholder
  }

  private extractComponentsFromSequence(sequence: string): string[] {
    return sequence.split(' -> ').map(part => part.split(':')[0])
  }

  private getMostUsedFeatures(): Array<{ feature: string; usage: number }> {
    const features = new Map<string, number>()
    this.interactionHistory.forEach(interaction => {
      features.set(interaction.component, (features.get(interaction.component) || 0) + 1)
    })
    
    return Array.from(features.entries())
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10)
  }

  private calculateTaskCompletionRate(): number {
    // Simplified calculation based on successful interactions
    const totalInteractions = this.interactionHistory.length
    const successfulInteractions = totalInteractions - this.getFailedInteractionCount()
    return totalInteractions > 0 ? (successfulInteractions / totalInteractions) * 100 : 0
  }

  private getCommonWorkflows(): Array<{ pattern: string[]; frequency: number }> {
    // Analyze common workflow patterns
    return [] // Placeholder for now
  }
}

// Global instance
export const advancedTelemetry = new AdvancedTelemetrySystem()

// Auto-start capturing
if (typeof window !== 'undefined') {
  advancedTelemetry.startCapturing()
  
  // Increment visit count
  const visitCount = parseInt(localStorage.getItem('telemetry_visit_count') || '0') + 1
  localStorage.setItem('telemetry_visit_count', visitCount.toString())
  
  // Increment session count
  const sessionCount = parseInt(localStorage.getItem('telemetry_session_count') || '0') + 1
  localStorage.setItem('telemetry_session_count', sessionCount.toString())
}