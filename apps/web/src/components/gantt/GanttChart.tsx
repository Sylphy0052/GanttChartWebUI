'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useGanttStore } from '@/stores/gantt.store'
import { useOptimizedGanttSelectors } from '@/stores/gantt-selectors'
import { GanttTimeline } from './GanttTimeline'
import { VirtualizedGanttGrid } from './VirtualizedGanttGrid'
import { VirtualizedTaskList } from './VirtualizedTaskList'
import { GanttTask } from '@/types/gantt'
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics'
import { useAdvancedTelemetry, useInteractionTracking, useMemoryMonitoring, useZoomTelemetry } from '@/hooks/useAdvancedTelemetry'
import { ScheduleCalculator } from '@/components/scheduling/ScheduleCalculator'
import { ConflictDetectionPanel } from '@/components/scheduling/ConflictDetectionPanel'
import { ConflictResolutionDialog } from '@/components/scheduling/ConflictResolutionDialog'
import { AuditLogViewer } from '@/components/scheduling/AuditLogViewer'
import { VisualizationLayer } from '@/components/scheduling/VisualizationLayer'
import { DetectedConflict, ResolutionStrategy } from '@/types/scheduling'

interface GanttChartProps {
  projectId?: string
  height?: number
  className?: string
}

export const GanttChart: React.FC<GanttChartProps> = ({ 
  projectId, 
  height = 600, 
  className = '' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 1200, height })
  
  // Scheduling panel states
  const [showScheduleCalculator, setShowScheduleCalculator] = useState(false)
  const [showConflictPanel, setShowConflictPanel] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [conflictsToResolve, setConflictsToResolve] = useState<DetectedConflict[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)

  // Advanced telemetry integration - T016 AC1
  const {
    componentMetrics,
    advancedKPIs,
    measureOperation,
    recordEvent,
    getRecommendations
  } = useAdvancedTelemetry({
    componentName: 'GanttChart',
    autoTrack: true,
    trackMemory: true,
    trackInteractions: true,
    onPerformanceIssue: (metrics) => {
      console.warn('🚨 GanttChart Performance Issue:', {
        renderTime: metrics.renderTime,
        memoryUsage: metrics.memoryUsage,
        rerenderCount: metrics.rerenderCount,
        recommendations: getRecommendations()
      })
      
      // Record performance issue event
      recordEvent('performance_issue', {
        renderTime: metrics.renderTime,
        memoryUsage: metrics.memoryUsage,
        severity: metrics.renderTime > 200 ? 'high' : 'medium'
      })
    },
    onMemoryLeak: (leaks) => {
      console.error('🚨 GanttChart Memory Leak Detected:', leaks)
      recordEvent('memory_leak', {
        leakCount: leaks.length,
        totalGrowth: leaks.reduce((sum, leak) => sum + leak.growth, 0)
      })
    }
  })

  // AC3: Enhanced zoom telemetry integration
  const {
    startZoomOperation,
    updateZoomOptimization,
    completeZoomOperation,
    getZoomPerformanceStats
  } = useZoomTelemetry('GanttChart')

  // User interaction tracking
  const { trackClick, trackDrag, trackCustomEvent } = useInteractionTracking('GanttChart')

  // Memory monitoring
  const { memoryUsage, memoryWarnings, hasMemoryIssues } = useMemoryMonitoring('GanttChart')

  // Performance monitoring
  const {
    measureRender,
    measureDrag,
    measureZoom,
    recordMetrics,
    isAcceptable,
    performanceReport
  } = usePerformanceMetrics({
    autoRecord: true,
    enableAlerts: true,
    onThresholdViolation: (metrics) => {
      console.warn('🚨 Gantt Chart performance degraded:', {
        renderTime: metrics.initialRenderTime,
        dragTime: metrics.dragResponseTime,
        zoomTime: metrics.zoomTransitionTime,
        taskCount: metrics.taskCount,
        memoryUsage: metrics.memoryUsage,
        componentMetrics: componentMetrics?.renderTime
      })
      
      // Track performance degradation
      trackCustomEvent('performance_degradation', {
        thresholdViolation: true,
        metrics: {
          render: metrics.initialRenderTime,
          drag: metrics.dragResponseTime,
          zoom: metrics.zoomTransitionTime,
          memory: metrics.memoryUsage
        }
      })
    }
  })

  // Gantt store
  const {
    tasks,
    config,
    viewport,
    selectedTaskIds,
    expandedTaskIds,
    loading,
    error,
    selectTask,
    clearSelection,
    setViewportSize,
    fetchGanttData,
    zoomIn,
    zoomOut,
    zoomToFit,
    scrollToToday
  } = useGanttStore()

  // Scheduling store
  const {
    lastCalculationResult,
  } = useGanttStore()
  
  // Local state for scheduling panels (could be moved to store later)  
  const [conflictsPanelOpen, setConflictsPanelOpen] = useState(false)
  const [auditLogVisible, setAuditLogVisible] = useState(false)
  const [detectedConflicts] = useState<DetectedConflict[]>([])
  const [isScheduleCalculating] = useState(false)

  // Visualization state
  const [showVisualization, setShowVisualization] = useState(true)

  // Computed values
  const hasConflicts = detectedConflicts.length > 0

  // Optimized selectors
  const selectorState = {
    tasks,
    config,
    viewport,
    selectedTaskIds,
    expandedTaskIds
  }
  const { visibleTasks, ganttStats } = useOptimizedGanttSelectors(selectorState)

  // AC3: Enhanced zoom operations with telemetry
  const enhancedZoomIn = useCallback(() => {
    const currentLevel = config.scale === 'day' ? 1 : config.scale === 'week' ? 2 : config.scale === 'month' ? 3 : 0
    const currentViewport = {
      x: viewport.scrollLeft || 0,
      y: viewport.scrollTop || 0,
      width: containerSize.width,
      height: containerSize.height
    }

    // Start zoom telemetry
    const zoomId = startZoomOperation('zoom-in', currentLevel, currentViewport, {
      triggeredBy: 'button',
      taskCount: visibleTasks.length,
      memoryBefore: memoryUsage
    })

    measureZoom(() => {
      const startTime = performance.now()
      const elementsBeforeOptimization = visibleTasks.length
      
      try {
        zoomIn()
        
        const renderTime = performance.now() - startTime
        
        // Update optimization metrics
        updateZoomOptimization(zoomId, {
          elementsSkipped: Math.max(0, elementsBeforeOptimization - visibleTasks.length),
          virtualizedItems: visibleTasks.length,
          renderTime,
          frameRate: 60, // Would be calculated from actual frame measurements
          memoryAfter: memoryUsage
        })
        
        // Complete zoom operation
        const newLevel = config.scale === 'day' ? 1 : config.scale === 'week' ? 2 : config.scale === 'month' ? 3 : 0
        const result = completeZoomOperation(zoomId, newLevel, currentViewport)
        
        if (process.env.NODE_ENV === 'development' && result) {
          console.log('🔍 Zoom in completed:', {
            responseTime: result.responseTime,
            levelChange: result.levelChange,
            renderOptimization: result.renderOptimization
          })
        }
        
      } catch (error) {
        completeZoomOperation(zoomId, currentLevel, currentViewport, true, error instanceof Error ? error.message : 'Zoom failed')
      }
    })
  }, [config.scale, viewport, containerSize, visibleTasks, startZoomOperation, updateZoomOptimization, completeZoomOperation, zoomIn, measureZoom, memoryUsage])

  const enhancedZoomOut = useCallback(() => {
    const currentLevel = config.scale === 'day' ? 1 : config.scale === 'week' ? 2 : config.scale === 'month' ? 3 : 0
    const currentViewport = {
      x: viewport.scrollLeft || 0,
      y: viewport.scrollTop || 0,
      width: containerSize.width,
      height: containerSize.height
    }

    // Start zoom telemetry
    const zoomId = startZoomOperation('zoom-out', currentLevel, currentViewport, {
      triggeredBy: 'button',
      taskCount: visibleTasks.length,
      memoryBefore: memoryUsage
    })

    measureZoom(() => {
      const startTime = performance.now()
      const elementsBeforeOptimization = visibleTasks.length
      
      try {
        zoomOut()
        
        const renderTime = performance.now() - startTime
        
        // Update optimization metrics
        updateZoomOptimization(zoomId, {
          elementsSkipped: Math.max(0, elementsBeforeOptimization - visibleTasks.length),
          virtualizedItems: visibleTasks.length,
          renderTime,
          frameRate: 60,
          memoryAfter: memoryUsage
        })
        
        // Complete zoom operation
        const newLevel = config.scale === 'day' ? 1 : config.scale === 'week' ? 2 : config.scale === 'month' ? 3 : 0
        completeZoomOperation(zoomId, newLevel, currentViewport)
        
      } catch (error) {
        completeZoomOperation(zoomId, currentLevel, currentViewport, true, error instanceof Error ? error.message : 'Zoom failed')
      }
    })
  }, [config.scale, viewport, containerSize, visibleTasks, startZoomOperation, updateZoomOptimization, completeZoomOperation, zoomOut, measureZoom, memoryUsage])

  const enhancedZoomToFit = useCallback(() => {
    const currentLevel = config.scale === 'day' ? 1 : config.scale === 'week' ? 2 : config.scale === 'month' ? 3 : 0
    const currentViewport = {
      x: viewport.scrollLeft || 0,
      y: viewport.scrollTop || 0,
      width: containerSize.width,
      height: containerSize.height
    }

    // Start zoom telemetry
    const zoomId = startZoomOperation('zoom-fit', currentLevel, currentViewport, {
      triggeredBy: 'button',
      taskCount: visibleTasks.length,
      memoryBefore: memoryUsage
    })

    measureZoom(() => {
      const startTime = performance.now()
      const elementsBeforeOptimization = visibleTasks.length
      
      try {
        zoomToFit()
        
        const renderTime = performance.now() - startTime
        
        // Update optimization metrics
        updateZoomOptimization(zoomId, {
          elementsSkipped: Math.max(0, elementsBeforeOptimization - visibleTasks.length),
          virtualizedItems: visibleTasks.length,
          renderTime,
          frameRate: 60,
          memoryAfter: memoryUsage
        })
        
        // Complete zoom operation
        const newLevel = config.scale === 'day' ? 1 : config.scale === 'week' ? 2 : config.scale === 'month' ? 3 : 0
        completeZoomOperation(zoomId, newLevel, currentViewport)
        
      } catch (error) {
        completeZoomOperation(zoomId, currentLevel, currentViewport, true, error instanceof Error ? error.message : 'Zoom failed')
      }
    })
  }, [config.scale, viewport, containerSize, visibleTasks, startZoomOperation, updateZoomOptimization, completeZoomOperation, zoomToFit, measureZoom, memoryUsage])

  // Handle container resize with performance tracking
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      measureOperation('container-resize', () => {
        const entry = entries[0]
        if (entry) {
          const { width } = entry.contentRect
          setContainerSize({ width, height })
          setViewportSize(width, height)
          
          // Record viewport metrics with advanced telemetry
          recordMetrics({
            viewportWidth: width,
            viewportHeight: height,
            taskCount: visibleTasks.length,
            dependencyCount: tasks.reduce((count, task) => count + task.dependencies.length, 0),
            timeScale: config.scale
          })

          // Track resize event
          recordEvent('viewport_resize', {
            newWidth: width,
            newHeight: height,
            taskCount: visibleTasks.length
          })
        }
      })
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [height, setViewportSize, recordMetrics, visibleTasks.length, tasks, config.scale, measureOperation, recordEvent])

  // Fetch data on mount with performance measurement
  useEffect(() => {
    if (projectId) {
      measureOperation('data-fetch', () => {
        measureRender(() => {
          fetchGanttData(projectId)
        })
      })
      
      // Track data loading
      recordEvent('gantt_data_fetch_start', {
        projectId,
        timestamp: Date.now()
      })
    }
  }, [projectId, fetchGanttData, measureRender, measureOperation, recordEvent])

  // Track data loading completion
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      recordEvent('gantt_data_loaded', {
        taskCount: tasks.length,
        visibleTaskCount: visibleTasks.length,
        loadTime: componentMetrics?.renderTime || 0
      })
    }
  }, [loading, tasks.length, visibleTasks.length, componentMetrics?.renderTime, recordEvent])

  // Handle task selection with performance measurement and interaction tracking
  const handleTaskClick = useCallback((task: GanttTask) => {
    measureOperation('task-selection', () => {
      measureDrag(() => {
        if (selectedTaskIds.has(task.id)) {
          clearSelection()
          trackClick('task-deselect', { taskId: task.id, taskTitle: task.title })
        } else {
          selectTask(task.id)
          trackClick('task-select', { taskId: task.id, taskTitle: task.title })
        }
      })
    })
  }, [selectedTaskIds, selectTask, clearSelection, measureDrag, measureOperation, trackClick])

  // Handle keyboard shortcuts with interaction tracking and enhanced zoom telemetry
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return

      const shortcutActions = {
        zoomIn: () => {
          measureOperation('zoom-in-keyboard', () => {
            enhancedZoomIn()
          })
          trackCustomEvent('keyboard_shortcut', { action: 'zoom_in', keys: 'Ctrl++' })
        },
        zoomOut: () => {
          measureOperation('zoom-out-keyboard', () => {
            enhancedZoomOut()
          })
          trackCustomEvent('keyboard_shortcut', { action: 'zoom_out', keys: 'Ctrl+-' })
        },
        zoomFit: () => {
          measureOperation('zoom-fit-keyboard', () => {
            enhancedZoomToFit()
          })
          trackCustomEvent('keyboard_shortcut', { action: 'zoom_fit', keys: 'Ctrl+0' })
        },
        goToToday: () => {
          measureOperation('scroll-to-today', () => {
            scrollToToday()
          })
          trackCustomEvent('keyboard_shortcut', { action: 'go_to_today', keys: 'Ctrl+T' })
        },
        clearSelection: () => {
          clearSelection()
          trackCustomEvent('keyboard_shortcut', { action: 'clear_selection', keys: 'Escape' })
        }
      }

      switch (event.key) {
        case '+':
        case '=':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            shortcutActions.zoomIn()
          }
          break
        case '-':
        case '_':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            shortcutActions.zoomOut()
          }
          break
        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            shortcutActions.zoomFit()
          }
          break
        case 't':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            shortcutActions.goToToday()
          }
          break
        case 'Escape':
          shortcutActions.clearSelection()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enhancedZoomIn, enhancedZoomOut, enhancedZoomToFit, scrollToToday, clearSelection, measureOperation, trackCustomEvent])

  if (loading) {
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading Gantt chart...</p>
          {memoryUsage > 0 && (
            <p className="text-xs text-gray-500">Memory: {memoryUsage}MB</p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    recordEvent('gantt_error', { error, timestamp: Date.now() })
    
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load Gantt chart</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              trackClick('retry-load')
              fetchGanttData(projectId)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l6-6v13M9 19c0 1.105.895 2 2 2h2c1.105 0 2-.895 2-2M9 19H7c-1.105 0-2-.895-2-2V9c0-1.105.895-2 2-2h2M9 19v-6h4v6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks to display</h3>
          <p className="text-gray-600">This project doesn't have any tasks with dates.</p>
        </div>
      </div>
    )
  }

  const taskListWidth = 300 // Fixed width for task list

  return (
    <div 
      ref={containerRef} 
      className={`gantt-chart border border-gray-200 rounded-lg overflow-hidden ${className}`} 
      style={{ height }}
      data-component-id={componentMetrics?.componentId}
    >
      {/* Toolbar */}
      <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-sm font-semibold text-gray-900">Gantt Chart</h2>
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <span>{ganttStats.totalTasks} tasks | {ganttStats.completionRate}% complete</span>
            {!isAcceptable && (
              <span className="text-red-500 font-medium" title={performanceReport}>
                ⚠️ Performance Issue
              </span>
            )}
            {hasMemoryIssues && (
              <span className="text-orange-500 font-medium" title={memoryWarnings.map(w => w.description).join(', ')}>
                🧠 Memory Warning
              </span>
            )}
            {componentMetrics && process.env.NODE_ENV === 'development' && (
              <span className="text-blue-500 font-mono text-xs" title={`Renders: ${componentMetrics.rerenderCount}, Memory: ${componentMetrics.memoryUsage}MB`}>
                📊 {Math.round(componentMetrics.renderTime)}ms
              </span>
            )}
            {/* AC3: Show zoom performance stats in dev mode */}
            {process.env.NODE_ENV === 'development' && getZoomPerformanceStats() && (
              <span className="text-purple-500 font-mono text-xs" title="Zoom Performance">
                🔍 {Math.round(getZoomPerformanceStats()?.avgResponseTime || 0)}ms zoom
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Scheduling controls */}
          <div className="flex items-center border border-gray-300 rounded bg-white">
            <button
              data-testid="gantt-schedule-button"
              onClick={() => {
                trackClick('schedule-calculator-toggle')
                setShowScheduleCalculator(!showScheduleCalculator)
              }}
              className={`px-2 py-1 text-xs border-r border-gray-300 transition-colors ${
                showScheduleCalculator || isScheduleCalculating 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'hover:bg-gray-100'
              }`}
              title="Schedule Calculator"
            >
              {isScheduleCalculating ? '⏳' : '📊'}
            </button>
            <button
              data-testid="gantt-conflict-button"
              onClick={() => {
                trackClick('conflict-panel-toggle', { conflictCount: detectedConflicts.length })
                setShowConflictPanel(!showConflictPanel)
              }}
              className={`px-2 py-1 text-xs border-r border-gray-300 transition-colors relative ${
                showConflictPanel 
                  ? 'bg-red-50 text-red-700' 
                  : 'hover:bg-gray-100'
              }`}
              title="Conflicts"
            >
              ⚠️
              {hasConflicts && detectedConflicts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {detectedConflicts.length}
                </span>
              )}
            </button>
            <button
              data-testid="gantt-audit-button"
              onClick={() => {
                trackClick('audit-log-toggle')
                setShowAuditLog(!showAuditLog)
              }}
              className={`px-2 py-1 text-xs border-r border-gray-300 transition-colors ${
                showAuditLog 
                  ? 'bg-green-50 text-green-700' 
                  : 'hover:bg-gray-100'
              }`}
              title="Audit Log"
            >
              📋
            </button>
            <button
              data-testid="gantt-visualization-button"
              onClick={() => {
                trackClick('visualization-toggle')
                setShowVisualization(!showVisualization)
              }}
              className={`px-2 py-1 text-xs transition-colors ${
                showVisualization && lastCalculationResult
                  ? 'bg-purple-50 text-purple-700' 
                  : 'hover:bg-gray-100'
              }`}
              title="Scheduling Visualization"
            >
              🎯
            </button>
          </div>

          {/* Zoom controls with enhanced telemetry */}
          <div className="flex items-center border border-gray-300 rounded">
            <button
              data-testid="gantt-zoom-out-button"
              onClick={() => {
                trackClick('zoom-out-button')
                enhancedZoomOut()
              }}
              className="px-2 py-1 text-xs hover:bg-gray-100 border-r border-gray-300"
              title="Zoom out (Ctrl + -)"
            >
              −
            </button>
            <span className="px-3 py-1 text-xs bg-white border-r border-gray-300 min-w-[60px] text-center">
              {config.scale}
            </span>
            <button
              data-testid="gantt-zoom-in-button"
              onClick={() => {
                trackClick('zoom-in-button')
                enhancedZoomIn()
              }}
              className="px-2 py-1 text-xs hover:bg-gray-100"
              title="Zoom in (Ctrl + +)"
            >
              +
            </button>
          </div>
          
          {/* Action buttons */}
          <button
            data-testid="gantt-zoom-fit-button"
            onClick={() => {
              trackClick('zoom-fit-button')
              enhancedZoomToFit()
            }}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Fit to window (Ctrl + 0)"
          >
            Fit
          </button>
          
          <button
            data-testid="gantt-today-button"
            onClick={() => {
              trackClick('today-button')
              scrollToToday()
            }}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Go to today (Ctrl + T)"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex h-full">
        {/* Task list panel */}
        <div 
          className="flex-none border-r border-gray-200 bg-gray-50 overflow-y-auto"
          style={{ width: taskListWidth }}
        >
          {/* Task list header */}
          <div className="h-12 bg-gray-100 border-b border-gray-200 flex items-center px-4">
            <div className="text-xs font-semibold text-gray-700">Task Name</div>
          </div>
          
          {/* Virtualized Task list */}
          <VirtualizedTaskList
            tasks={visibleTasks}
            selectedTaskIds={selectedTaskIds}
            onTaskClick={handleTaskClick}
            height={height - 12 - 12} // Total height - toolbar height - header height
            rowHeight={viewport.rowHeight}
            data-testid="gantt-task-list"
          />
        </div>

        {/* Gantt chart area */}
        <div className="flex-1 overflow-auto relative">
          <div style={{ minWidth: containerSize.width - taskListWidth }}>
            {/* Timeline header */}
            <GanttTimeline
              config={config}
              viewport={viewport}
              className="sticky top-0 z-10"
              data-testid="gantt-timeline-header"
            />

            {/* Gantt grid container with visualization overlay */}
            <div className="relative">
              {/* Virtualized Gantt grid */}
              <VirtualizedGanttGrid
                tasks={visibleTasks}
                config={config}
                viewport={viewport}
                selectedTaskIds={selectedTaskIds}
                onTaskClick={handleTaskClick}
                height={height - 12 - 12} // Total height - toolbar height - timeline height
                projectId={projectId}
                data-testid="gantt-grid"
              />
              
              {/* Scheduling Visualization Layer */}
              {showVisualization && lastCalculationResult && (
                <VisualizationLayer
                  tasks={visibleTasks}
                  config={config}
                  viewport={viewport}
                  schedulingResult={lastCalculationResult}
                  width={containerSize.width - taskListWidth}
                  height={height - 12 - 12}
                  className="z-20"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow opacity-75 hover:opacity-100 transition-opacity">
        Ctrl + / - : Zoom | Ctrl 0 : Fit | Ctrl T : Today | ESC : Clear selection
      </div>

      {/* Advanced telemetry debug info (development only) */}
      {process.env.NODE_ENV === 'development' && advancedKPIs && (
        <div className="absolute top-14 left-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded max-w-xs">
          <div className="font-mono">
            <div>FPS: {advancedKPIs.performance.framerate}</div>
            <div>Memory: {advancedKPIs.memory.heapUsed}MB</div>
            <div>Interactions: {advancedKPIs.interaction.totalInteractions}</div>
            <div>Components: {componentMetrics ? 1 : 0}</div>
            {getZoomPerformanceStats() && (
              <div className="pt-1 border-t border-gray-600 mt-1">
                <div>Zoom Ops: {getZoomPerformanceStats()?.totalOperations}</div>
                <div>Zoom Avg: {Math.round(getZoomPerformanceStats()?.avgResponseTime || 0)}ms</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scheduling Panels */}
      {showScheduleCalculator && projectId && (
        <div className="absolute top-12 left-4 bg-white shadow-lg rounded-lg border border-gray-200 z-40">
          <ScheduleCalculator
            projectId={projectId}
            compact={true}
            onCalculationComplete={() => {
              // Refresh Gantt data after calculation
              trackCustomEvent('schedule_calculation_completed')
              fetchGanttData(projectId)
            }}
          />
        </div>
      )}

      {showConflictPanel && projectId && (
        <div className="absolute top-12 right-4 bg-white shadow-lg rounded-lg border border-gray-200 z-40 max-w-md">
          <ConflictDetectionPanel
            projectId={projectId}
            onResolutionRequested={(conflicts: DetectedConflict[], strategy: ResolutionStrategy) => {
              trackCustomEvent('conflict_resolution_requested', {
                conflictCount: conflicts.length,
                strategy
              })
              setConflictsToResolve(conflicts)
              setShowConflictDialog(true)
            }}
          />
        </div>
      )}

      {showAuditLog && projectId && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg border border-gray-200 z-40 max-w-2xl">
          <AuditLogViewer
            projectId={projectId}
            compact={true}
          />
        </div>
      )}

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && conflictsToResolve.length > 0 && projectId && (
        <ConflictResolutionDialog
          projectId={projectId}
          conflicts={conflictsToResolve}
          isOpen={showConflictDialog}
          onClose={() => {
            trackCustomEvent('conflict_resolution_closed')
            setShowConflictDialog(false)
            setConflictsToResolve([])
          }}
          onResolved={(result) => {
            trackCustomEvent('conflict_resolution_completed', { result })
            setShowConflictDialog(false)
            setConflictsToResolve([])
            // Refresh Gantt data after conflict resolution
            fetchGanttData(projectId)
          }}
          userId="current-user" // TODO: Get actual user ID
        />
      )}
    </div>
  )
}

export default GanttChart