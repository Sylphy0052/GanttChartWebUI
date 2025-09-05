'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useGanttStore } from '@/stores/gantt.store'
import { useOptimizedGanttSelectors } from '@/stores/gantt-selectors'
import { GanttTimeline } from './GanttTimeline'
import { VirtualizedGanttGrid } from './VirtualizedGanttGrid'
import { VirtualizedTaskList } from './VirtualizedTaskList'
import { GanttTask } from '@/types/gantt'
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics'
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
        memoryUsage: metrics.memoryUsage
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

  // Handle container resize with performance tracking
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width } = entry.contentRect
        setContainerSize({ width, height })
        setViewportSize(width, height)
        
        // Record viewport metrics
        recordMetrics({
          viewportWidth: width,
          viewportHeight: height,
          taskCount: visibleTasks.length,
          dependencyCount: tasks.reduce((count, task) => count + task.dependencies.length, 0),
          timeScale: config.scale
        })
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [height, setViewportSize, recordMetrics, visibleTasks.length, tasks, config.scale])

  // Fetch data on mount with performance measurement
  useEffect(() => {
    if (projectId) {
      measureRender(() => {
        fetchGanttData(projectId)
      })
    }
  }, [projectId, fetchGanttData, measureRender])

  // Handle task selection with performance measurement
  const handleTaskClick = useCallback((task: GanttTask) => {
    measureDrag(() => {
      if (selectedTaskIds.has(task.id)) {
        clearSelection()
      } else {
        selectTask(task.id)
      }
    })
  }, [selectedTaskIds, selectTask, clearSelection, measureDrag])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return

      switch (event.key) {
        case '+':
        case '=':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            measureZoom(() => zoomIn())
          }
          break
        case '-':
        case '_':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            measureZoom(() => zoomOut())
          }
          break
        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            measureZoom(() => zoomToFit())
          }
          break
        case 't':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            scrollToToday()
          }
          break
        case 'Escape':
          clearSelection()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut, zoomToFit, scrollToToday, clearSelection, measureZoom])

  if (loading) {
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading Gantt chart...</p>
        </div>
      </div>
    )
  }

  if (error) {
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
            onClick={() => fetchGanttData(projectId)}
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
    <div ref={containerRef} className={`gantt-chart border border-gray-200 rounded-lg overflow-hidden ${className}`} style={{ height }}>
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
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Scheduling controls */}
          <div className="flex items-center border border-gray-300 rounded bg-white">
            <button
              data-testid="gantt-schedule-button"
              onClick={() => setShowScheduleCalculator(!showScheduleCalculator)}
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
              onClick={() => setShowConflictPanel(!showConflictPanel)}
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
              onClick={() => setShowAuditLog(!showAuditLog)}
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
              onClick={() => setShowVisualization(!showVisualization)}
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

          {/* Zoom controls */}
          <div className="flex items-center border border-gray-300 rounded">
            <button
              data-testid="gantt-zoom-out-button"
              onClick={() => measureZoom(() => zoomOut())}
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
              onClick={() => measureZoom(() => zoomIn())}
              className="px-2 py-1 text-xs hover:bg-gray-100"
              title="Zoom in (Ctrl + +)"
            >
              +
            </button>
          </div>
          
          {/* Action buttons */}
          <button
            data-testid="gantt-zoom-fit-button"
            onClick={() => measureZoom(() => zoomToFit())}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Fit to window (Ctrl + 0)"
          >
            Fit
          </button>
          
          <button
            data-testid="gantt-today-button"
            onClick={scrollToToday}
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
                data-testid=""
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

      {/* Scheduling Panels */}
      {showScheduleCalculator && projectId && (
        <div className="absolute top-12 left-4 bg-white shadow-lg rounded-lg border border-gray-200 z-40">
          <ScheduleCalculator
            projectId={projectId}
            compact={true}
            onCalculationComplete={() => {
              // Refresh Gantt data after calculation
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
            setShowConflictDialog(false)
            setConflictsToResolve([])
          }}
          onResolved={(result) => {
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