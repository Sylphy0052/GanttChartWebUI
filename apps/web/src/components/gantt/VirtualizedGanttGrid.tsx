'use client'

import React, { memo, useMemo, useCallback, useState, useRef } from 'react'
// @ts-ignore - react-window v2.0.2 has type definition issues
import { List } from 'react-window'
import { GanttTask, GanttTimelineConfig, GanttViewport, GanttDependency } from '@/types/gantt'
import { GanttBar } from './GanttBar'
import { DependencyLines } from './DependencyLines'
import { CircularDependencyWarning } from './CircularDependencyWarning'
import { useDependencies } from '@/hooks/useDependencies'
import { detectCircularDependency, CircularDependencyResult } from '@/lib/dependency-validation'

interface VirtualizedGanttGridProps {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
  height: number
  projectId?: string
  className?: string
  'data-testid'?: string
}

interface TaskRowData {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
  visibleRowRange: { startIndex: number; endIndex: number }
  dataTestId?: string
  // New props for dependency functionality
  onTaskUpdate?: (taskId: string, updates: { startDate: Date; endDate: Date }) => void
  onDependencyCreate?: (fromTaskId: string, toTaskId: string, connectionPoint?: 'start' | 'end') => Promise<void>
  dependencyCreationMode?: boolean
  showConnectionPoints?: boolean
  // New props for target detection
  dragState?: DragState | null
  hoveredTargetTask?: string | null
}

interface GridLine {
  type: 'vertical' | 'horizontal'
  x?: number
  y?: number
  width?: number
  height?: number
  isWeekend?: boolean
  isToday?: boolean
}

// Enhanced drag state for dependency creation with target detection
interface DragState {
  isActive: boolean
  fromTaskId: string
  connectionPoint: 'start' | 'end'
  currentX: number
  currentY: number
  startTime: number
}

/**
 * Individual Task Row Component for Virtualization
 */
const TaskRow: React.FC<{
  index: number
  style: React.CSSProperties
  data: TaskRowData
}> = memo(({ index, style, data }) => {
  const { 
    tasks, 
    config,
    viewport, 
    selectedTaskIds, 
    onTaskClick, 
    dataTestId,
    onTaskUpdate,
    onDependencyCreate,
    dependencyCreationMode,
    showConnectionPoints,
    dragState,
    hoveredTargetTask
  } = data
  const task = tasks[index]

  if (!task) return null

  // Calculate task bar properties
  const startX = viewport.timeScale(task.startDate) || 0
  const endX = viewport.timeScale(task.endDate) || 0
  const width = Math.max(endX - startX, 4) // Minimum width of 4px
  const y = (viewport.rowHeight - viewport.taskHeight) / 2
  const isSelected = selectedTaskIds.has(task.id)

  // Check if this task is a valid target during dependency drag
  const isValidTarget = dragState?.isActive && 
    dragState.fromTaskId !== task.id && 
    hoveredTargetTask === task.id

  // Check if this task is hovered as a target
  const isTargetHighlighted = isValidTarget

  return (
    <div style={style} className="relative">
      {/* Row background */}
      <div className={`absolute inset-0 border-b border-gray-200 transition-colors duration-200 ${
        isTargetHighlighted 
          ? 'bg-blue-50 border-blue-200' 
          : 'hover:bg-gray-50'
      }`} />

      {/* Target drop zone indicator */}
      {isTargetHighlighted && (
        <div className="absolute inset-0 border-2 border-blue-400 border-dashed bg-blue-50 opacity-70 rounded-md animate-pulse" />
      )}

      {/* Task bar */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: viewport.rowHeight }}
      >
        <GanttBar
          task={task}
          x={startX}
          y={y}
          width={width}
          height={viewport.taskHeight}
          isSelected={isSelected}
          onClick={onTaskClick}
          pixelsPerDay={30} // Default 30 pixels per day
          onTaskUpdate={onTaskUpdate}
          timelineStartDate={config.startDate}
          onDependencyCreate={onDependencyCreate}
          dependencyCreationMode={dependencyCreationMode}
          showConnectionPoints={showConnectionPoints || isTargetHighlighted}
          data-testid={dataTestId ? `${dataTestId}-task-${task.id}` : "task-bar"}
        />
      </svg>

      {/* Target connection points overlay (enhanced visibility during drag) */}
      {isTargetHighlighted && (
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: viewport.rowHeight }}
        >
          {/* Enhanced start connection point */}
          <circle
            cx={startX - 8}
            cy={y + viewport.taskHeight / 2}
            r={6}
            fill="#3B82F6"
            stroke="#1D4ED8"
            strokeWidth={2}
            opacity={0.9}
            className="animate-pulse"
          />
          <circle
            cx={startX - 8}
            cy={y + viewport.taskHeight / 2}
            r={10}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={1}
            opacity={0.5}
            className="animate-ping"
          />
          
          {/* Enhanced end connection point */}
          <circle
            cx={startX + width + 8}
            cy={y + viewport.taskHeight / 2}
            r={6}
            fill="#10B981"
            stroke="#047857"
            strokeWidth={2}
            opacity={0.9}
            className="animate-pulse"
          />
          <circle
            cx={startX + width + 8}
            cy={y + viewport.taskHeight / 2}
            r={10}
            fill="none"
            stroke="#10B981"
            strokeWidth={1}
            opacity={0.5}
            className="animate-ping"
          />
        </svg>
      )}
    </div>
  )
})

TaskRow.displayName = 'TaskRow'

/**
 * Virtualized Gantt Grid Component
 *
 * High-performance grid implementation using react-window for virtualization.
 * Only renders visible rows to handle large datasets (1000+ tasks) efficiently.
 * Integrates with Dependencies API for real-time dependency visualization.
 * Supports target detection and circular dependency validation (AC4, AC6).
 */
export const VirtualizedGanttGrid = memo<VirtualizedGanttGridProps>(
  ({ tasks, config, viewport, selectedTaskIds, onTaskClick, height, projectId, className = '', 'data-testid': dataTestId }) => {
    
    // Hook to manage dependencies from API
    const { dependencies, loading: dependenciesLoading, error: dependenciesError, createDependency, deleteDependency } = useDependencies(projectId)
    
    // State for dependency creation mode and target detection
    const [dependencyCreationMode, setDependencyCreationMode] = useState(false)
    const [showConnectionPoints, setShowConnectionPoints] = useState(false)
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [hoveredTargetTask, setHoveredTargetTask] = useState<string | null>(null)
    const [circularWarning, setCircularWarning] = useState<{
      isOpen: boolean
      circularResult: CircularDependencyResult
      fromTaskId: string
      toTaskId: string
      fromTaskTitle: string
      toTaskTitle: string
    } | null>(null)

    const gridRef = useRef<HTMLDivElement>(null)

    /**
     * Generate optimized grid lines for visible area
     */
    const gridLines = useMemo((): GridLine[] => {
      const lines: GridLine[] = []
      const { timeScale } = viewport

      // Generate vertical grid lines (time-based)
      const startDate = new Date(config.startDate)
      const endDate = new Date(config.endDate)
      const today = new Date()

      const currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        const x = timeScale(currentDate) || 0
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6
        const isToday = currentDate.toDateString() === today.toDateString()

        lines.push({
          type: 'vertical',
          x,
          y: 0,
          width: 1,
          height: tasks.length * viewport.rowHeight,
          isWeekend,
          isToday,
        })

        // Advance to next grid line based on scale
        switch (config.scale) {
          case 'day':
            currentDate.setDate(currentDate.getDate() + 1)
            break
          case 'week':
            currentDate.setDate(currentDate.getDate() + 7)
            break
          case 'month':
            currentDate.setMonth(currentDate.getMonth() + 1)
            break
          case 'quarter':
            currentDate.setMonth(currentDate.getMonth() + 3)
            break
        }
      }

      return lines
    }, [tasks.length, config, viewport])

    /**
     * Generate weekend background bands
     */
    const weekendBands = useMemo(() => {
      if (config.scale !== 'day') return []

      const bands: { x: number; width: number }[] = []
      const { timeScale } = viewport

      const currentDate = new Date(config.startDate)
      const endDate = config.endDate

      while (currentDate <= endDate) {
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          const x = timeScale(currentDate) || 0
          const nextDay = new Date(currentDate)
          nextDay.setDate(nextDay.getDate() + 1)
          const nextX = timeScale(Math.min(nextDay.getTime(), endDate.getTime())) || viewport.width
          const width = nextX - x

          if (width > 0) {
            bands.push({ x, width })
          }
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      return bands
    }, [config.startDate, config.endDate, config.scale, viewport])

    /**
     * Detect target task under cursor position
     */
    const detectTargetTask = useCallback((clientX: number, clientY: number): string | null => {
      if (!gridRef.current) return null

      const gridRect = gridRef.current.getBoundingClientRect()
      const relativeY = clientY - gridRect.top
      const rowIndex = Math.floor(relativeY / viewport.rowHeight)

      if (rowIndex >= 0 && rowIndex < tasks.length) {
        return tasks[rowIndex].id
      }
      return null
    }, [tasks, viewport.rowHeight])

    /**
     * Handle mouse move during dependency creation drag
     */
    const handleDependencyDragMove = useCallback((event: MouseEvent) => {
      if (!dragState?.isActive) return

      const targetTaskId = detectTargetTask(event.clientX, event.clientY)
      setHoveredTargetTask(targetTaskId)

      // Update drag state with current position
      setDragState(prev => prev ? {
        ...prev,
        currentX: event.clientX,
        currentY: event.clientY
      } : null)
    }, [dragState?.isActive, detectTargetTask])

    /**
     * Handle mouse up during dependency creation drag
     */
    const handleDependencyDragEnd = useCallback(async (event: MouseEvent) => {
      if (!dragState?.isActive) return

      const targetTaskId = detectTargetTask(event.clientX, event.clientY)
      
      if (targetTaskId && targetTaskId !== dragState.fromTaskId) {
        // Check for circular dependency before creating
        const circularResult = detectCircularDependency(dependencies, dragState.fromTaskId, targetTaskId)
        
        if (circularResult.hasCircularDependency) {
          // Show circular dependency warning
          const fromTask = tasks.find(t => t.id === dragState.fromTaskId)
          const toTask = tasks.find(t => t.id === targetTaskId)
          
          setCircularWarning({
            isOpen: true,
            circularResult,
            fromTaskId: dragState.fromTaskId,
            toTaskId: targetTaskId,
            fromTaskTitle: fromTask?.title || dragState.fromTaskId,
            toTaskTitle: toTask?.title || targetTaskId
          })
        } else {
          // Create dependency directly
          await handleDependencyCreate(dragState.fromTaskId, targetTaskId)
        }
      }

      // Clean up drag state
      setDragState(null)
      setHoveredTargetTask(null)
    }, [dragState, detectTargetTask, dependencies, tasks])

    /**
     * Handle task updates (dates/progress)
     */
    const handleTaskUpdate = useCallback(async (taskId: string, updates: { startDate: Date; endDate: Date }) => {
      console.log('Task update requested:', taskId, updates)
      // TODO: Implement task update API call
      // For now, this is handled by the individual GanttBar components through the issues store
    }, [])

    /**
     * Enhanced dependency creation with circular dependency validation (AC4 + AC6)
     */
    const handleDependencyCreate = useCallback(async (fromTaskId: string, toTaskId: string) => {
      try {
        console.log('Creating dependency:', { fromTaskId, toTaskId })
        
        // Validate dependency before creation (includes circular dependency check)
        const circularResult = detectCircularDependency(dependencies, fromTaskId, toTaskId)
        
        if (circularResult.hasCircularDependency) {
          // This shouldn't happen if we validated earlier, but double-check
          console.warn('Circular dependency detected during creation:', circularResult.message)
          return
        }

        await createDependency(fromTaskId, toTaskId)
        
        // Show success notification (placeholder)
        console.log('Dependency created successfully')
        // TODO: Show success toast notification
        
      } catch (error) {
        console.error('Failed to create dependency:', error)
        // TODO: Show error toast notification
      }
    }, [createDependency, dependencies])

    /**
     * Handle dependency creation start (from connection points)
     */
    const handleDependencyDragStart = useCallback((fromTaskId: string, connectionPoint: 'start' | 'end') => {
      const newDragState: DragState = {
        isActive: true,
        fromTaskId,
        connectionPoint,
        currentX: 0,
        currentY: 0,
        startTime: performance.now()
      }
      
      setDragState(newDragState)
      console.log('Dependency drag started:', { fromTaskId, connectionPoint })
    }, [])

    /**
     * Set up global mouse event listeners for dependency drag
     */
    React.useEffect(() => {
      if (dragState?.isActive) {
        document.addEventListener('mousemove', handleDependencyDragMove)
        document.addEventListener('mouseup', handleDependencyDragEnd)
        document.body.style.cursor = 'crosshair'

        return () => {
          document.removeEventListener('mousemove', handleDependencyDragMove)
          document.removeEventListener('mouseup', handleDependencyDragEnd)
          document.body.style.cursor = 'default'
        }
      }
    }, [dragState?.isActive, handleDependencyDragMove, handleDependencyDragEnd])

    /**
     * Enhanced dependency creation callback that includes drag start capability
     */
    const enhancedDependencyCreate = useCallback(async (fromTaskId: string, toTaskId: string, connectionPoint?: 'start' | 'end') => {
      if (connectionPoint && !toTaskId) {
        // This is a drag start, not a complete dependency creation
        handleDependencyDragStart(fromTaskId, connectionPoint)
        return
      }
      
      // Complete dependency creation
      await handleDependencyCreate(fromTaskId, toTaskId)
    }, [handleDependencyCreate, handleDependencyDragStart])

    /**
     * Data for virtualized list
     */
    const listData: TaskRowData = useMemo(
      () => ({
        tasks,
        config,
        viewport,
        selectedTaskIds,
        onTaskClick,
        visibleRowRange: { startIndex: 0, endIndex: tasks.length },
        dataTestId,
        onTaskUpdate: handleTaskUpdate,
        onDependencyCreate: enhancedDependencyCreate,
        dependencyCreationMode,
        showConnectionPoints: showConnectionPoints || dependencyCreationMode,
        dragState,
        hoveredTargetTask,
      }),
      [tasks, config, viewport, selectedTaskIds, onTaskClick, dataTestId, handleTaskUpdate, enhancedDependencyCreate, dependencyCreationMode, showConnectionPoints, dragState, hoveredTargetTask]
    )

    /**
     * T020 AC3: Enhanced Today indicator position with improved visibility
     */
    const todayIndicator = useMemo(() => {
      const today = new Date()
      const todayX = viewport.timeScale(today)
      if (todayX && todayX >= 0 && todayX <= viewport.width) {
        return {
          x: todayX,
          date: today,
          isVisible: true
        }
      }
      return {
        x: 0,
        date: today,
        isVisible: false
      }
    }, [viewport])

    /**
     * Handle dependency click events
     */
    const handleDependencyClick = useCallback((dependency: GanttDependency, event: React.MouseEvent) => {
      console.log('Dependency clicked:', dependency)
      // TODO: Implement dependency detail view or selection
    }, [])

    /**
     * Handle dependency context menu events - AC5 implementation
     */
    const handleDependencyContextMenu = useCallback(async (dependency: GanttDependency, event: React.MouseEvent) => {
      event.preventDefault()
      console.log('Dependency context menu:', dependency, { x: event.clientX, y: event.clientY })
      
      // Simple confirmation dialog for now
      const shouldDelete = window.confirm(`Delete dependency between "${dependency.predecessorId}" and "${dependency.successorId}"?`)
      
      if (shouldDelete) {
        try {
          await deleteDependency(dependency.predecessorId, dependency.successorId)
          console.log('Dependency deleted successfully')
          // TODO: Show success notification
        } catch (error) {
          console.error('Failed to delete dependency:', error)
          // TODO: Show error notification
          alert('Failed to delete dependency. Please try again.')
        }
      }
    }, [deleteDependency])

    /**
     * Toggle dependency creation mode
     */
    const toggleDependencyCreationMode = useCallback(() => {
      setDependencyCreationMode(prev => !prev)
      setShowConnectionPoints(prev => !prev)
    }, [])

    /**
     * Handle circular dependency warning modal actions
     */
    const handleCircularWarningClose = useCallback(() => {
      setCircularWarning(null)
    }, [])

    const handleCircularWarningConfirm = useCallback(async () => {
      if (!circularWarning) return
      
      try {
        // Force create dependency despite circular warning
        await createDependency(circularWarning.fromTaskId, circularWarning.toTaskId)
        console.log('Dependency force created despite circular warning')
        // TODO: Show success notification with warning
      } catch (error) {
        console.error('Failed to force create dependency:', error)
        // TODO: Show error notification
      } finally {
        setCircularWarning(null)
      }
    }, [circularWarning, createDependency])

    return (
      <div 
        ref={gridRef}
        className={`virtualized-gantt-grid relative bg-white ${className}`} 
        style={{ height }} 
        data-testid={dataTestId}
      >
        
        {/* Dependency creation mode toggle */}
        <div className="absolute top-2 left-2 z-40">
          <button
            onClick={toggleDependencyCreationMode}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              dependencyCreationMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={dependencyCreationMode ? 'Exit dependency creation mode' : 'Enable dependency creation mode'}
          >
            {dependencyCreationMode ? '✓ Dependency Mode' : '⚡ Create Dependencies'}
          </button>
        </div>

        {/* Background grid lines */}
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          style={{ width: '100%', height: '100%' }}
        >
          {gridLines.map((line, index) => (
            <line
              key={index}
              x1={line.type === 'vertical' ? line.x : line.x}
              y1={line.type === 'vertical' ? line.y : line.y}
              x2={line.type === 'vertical' ? line.x : (line.x || 0) + (line.width || 0)}
              y2={line.type === 'vertical' ? (line.y || 0) + (line.height || 0) : line.y}
              stroke={
                line.isToday
                  ? '#ef4444'
                  : line.isWeekend
                    ? '#e5e7eb'
                    : line.type === 'horizontal'
                      ? '#f3f4f6'
                      : '#e5e7eb'
              }
              strokeWidth={line.isToday ? 2 : 1}
              strokeOpacity={line.isToday ? 0.8 : line.type === 'horizontal' ? 0.5 : 0.3}
            />
          ))}
        </svg>

        {/* Weekend background bands */}
        {weekendBands.map((band, index) => (
          <div
            key={`weekend-${index}`}
            className="absolute top-0 bg-gray-50 pointer-events-none z-0"
            style={{
              left: band.x,
              width: band.width,
              height: '100%',
              opacity: 0.3,
            }}
          />
        ))}

        {/* Dependency creation drag line */}
        {dragState?.isActive && (
          <svg
            className="absolute inset-0 pointer-events-none z-25"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <marker
                id="drag-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#3B82F6" />
              </marker>
            </defs>
            
            {/* Find source task position */}
            {(() => {
              const sourceTask = tasks.find(t => t.id === dragState.fromTaskId)
              if (!sourceTask) return null
              
              const sourceIndex = tasks.indexOf(sourceTask)
              const sourceStartX = viewport.timeScale(sourceTask.startDate) || 0
              const sourceEndX = viewport.timeScale(sourceTask.endDate) || 0
              const sourceWidth = Math.max(sourceEndX - sourceStartX, 4)
              const sourceY = sourceIndex * viewport.rowHeight + (viewport.rowHeight - viewport.taskHeight) / 2 + viewport.taskHeight / 2

              const sourceX = dragState.connectionPoint === 'start' ? sourceStartX - 8 : sourceStartX + sourceWidth + 8
              
              return (
                <line
                  x1={sourceX}
                  y1={sourceY}
                  x2={dragState.currentX - gridRef.current!.getBoundingClientRect().left}
                  y2={dragState.currentY - gridRef.current!.getBoundingClientRect().top}
                  stroke="#3B82F6"
                  strokeWidth={3}
                  strokeDasharray="8,4"
                  markerEnd="url(#drag-arrow)"
                  className="animate-pulse"
                  opacity={0.8}
                />
              )
            })()}
          </svg>
        )}

        {/* Virtualized task rows */}
        <div className="relative z-10">
          {/* react-window v2.0.2 has TypeScript compatibility issues - using createElement to bypass JSX type checking */}
          {React.createElement(
            List as any,
            {
              height,
              itemCount: tasks.length,
              itemSize: viewport.rowHeight,
              itemData: listData,
              overscanCount: 5,
            },
            TaskRow as any
          )}
        </div>

        {/* Dependency lines overlay (from API) */}
        {dependencies.length > 0 && (
          <DependencyLines
            tasks={tasks}
            dependencies={dependencies}
            viewport={viewport}
            width={viewport.width}
            height={height}
            onDependencyClick={handleDependencyClick}
            onDependencyContextMenu={handleDependencyContextMenu}
            className="z-20"
          />
        )}

        {/* Dependencies loading indicator */}
        {dependenciesLoading && (
          <div className="absolute top-2 right-2 z-30">
            <div className="flex items-center space-x-2 bg-white rounded-lg shadow px-3 py-2 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading dependencies...</span>
            </div>
          </div>
        )}

        {/* Dependencies error indicator */}
        {dependenciesError && (
          <div className="absolute top-2 right-2 z-30">
            <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
              <div className="text-red-500">⚠️</div>
              <span className="text-red-700">Failed to load dependencies</span>
            </div>
          </div>
        )}

        {/* Dependency creation mode indicator */}
        {dependencyCreationMode && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
              {dragState?.isActive ? 'Drag to target task to create dependency' : 'Click connection points to create dependencies'}
            </div>
          </div>
        )}

        {/* Target detection feedback */}
        {dragState?.isActive && hoveredTargetTask && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Drop to create dependency</span>
            </div>
          </div>
        )}

        {/* T020 AC3: Enhanced Today indicator line with improved visibility */}
        {todayIndicator.isVisible && (
          <div className="absolute top-0 bottom-0 pointer-events-none z-30" style={{ left: todayIndicator.x }}>
            {/* Main today line */}
            <div className="w-0.5 h-full bg-red-500 relative">
              {/* Top marker with date label */}
              <div className="absolute -top-1 -left-8 w-16 h-6 bg-red-500 rounded-md flex items-center justify-center shadow-lg">
                <div className="text-white text-xs font-bold">TODAY</div>
              </div>
              
              {/* Arrow pointing down */}
              <div 
                className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-red-500"
                style={{ top: '24px' }}
              />
              
              {/* Pulsing dot at various heights for visibility */}
              <div className="absolute left-1/2 transform -translate-x-1/2 top-16 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <div className="absolute left-1/2 transform -translate-x-1/2 top-32 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <div className="absolute left-1/2 transform -translate-x-1/2 top-48 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              
              {/* Bottom marker */}
              <div className="absolute -bottom-1 -left-6 w-12 h-4 bg-red-500 rounded-sm flex items-center justify-center shadow-lg">
                <div className="text-white text-xs font-bold">NOW</div>
              </div>
            </div>
          </div>
        )}

        {/* T020 AC3: Today date information overlay (top-right corner) */}
        {todayIndicator.isVisible && (
          <div className="absolute top-2 right-4 z-35">
            <div className="bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>Today: {todayIndicator.date.toLocaleDateString()}</span>
            </div>
          </div>
        )}

        {/* Circular Dependency Warning Modal (AC6) */}
        {circularWarning && (
          <CircularDependencyWarning
            isOpen={circularWarning.isOpen}
            onClose={handleCircularWarningClose}
            onConfirm={handleCircularWarningConfirm}
            circularResult={circularWarning.circularResult}
            fromTaskTitle={circularWarning.fromTaskTitle}
            toTaskTitle={circularWarning.toTaskTitle}
          />
        )}
      </div>
    )
  }
)

VirtualizedGanttGrid.displayName = 'VirtualizedGanttGrid'