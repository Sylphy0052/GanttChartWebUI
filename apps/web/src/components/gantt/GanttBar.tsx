'use client'

import React, { memo, useMemo, useState, useCallback, useRef } from 'react'
import { GanttTask } from '@/types/gantt'
import { useIssuesStore } from '@/stores/issues.store'
import { ganttPerformanceMonitor } from '@/lib/performance'
import { auditLogsApi } from '@/lib/api/audit-logs'
import { useDragTelemetry } from '@/hooks/useAdvancedTelemetry' // AC2: Enhanced drag telemetry
import { StatusTooltip } from './StatusTooltip' // T020 AC2 & AC5: Status tooltips

interface SchedulingInfo {
  isCriticalPath?: boolean
  slackDays?: number
  isDelayed?: boolean
}

interface GanttBarProps {
  task: GanttTask
  x: number
  y: number
  width: number
  height: number
  isSelected: boolean
  onClick: (task: GanttTask) => void
  schedulingInfo?: SchedulingInfo
  'data-testid'?: string
  // New props for drag functionality
  pixelsPerDay?: number
  onTaskUpdate?: (taskId: string, updates: { startDate: Date; endDate: Date }) => void
  timelineStartDate?: Date
  // Enhanced dependency creation props
  onDependencyCreate?: (fromTaskId: string, toTaskId: string, connectionPoint?: 'start' | 'end') => Promise<void>
  dependencyCreationMode?: boolean
  showConnectionPoints?: boolean
}

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  originalStartDate: Date
  originalEndDate: Date
  currentStartDate: Date
  currentEndDate: Date
  dragType: 'move' | 'resize-left' | 'resize-right' | 'progress-update'
  // Progress-specific fields
  originalProgress?: number
  currentProgress?: number
  // Enhanced feedback fields
  startTimestamp: number
  snapToGrid?: boolean
  gridAlignmentX?: number
  // AC2: Advanced telemetry fields
  telemetryId?: string
  dataSize?: number
}

interface EnhancedTooltipData {
  operationType: string
  primaryText: string
  secondaryText: string
  deltaText?: string
  progressIndicator?: {
    current: number
    original: number
    change: number
  }
  timeInfo?: {
    duration: number
    originalDuration: number
    change: number
  }
  snapInfo?: {
    isSnapped: boolean
    snapType: string
  }
}

export const GanttBar = memo<GanttBarProps>(({ 
  task, 
  x, 
  y, 
  width, 
  height, 
  isSelected, 
  onClick,
  schedulingInfo,
  'data-testid': dataTestId,
  pixelsPerDay = 30, // Default pixels per day for date calculation
  onTaskUpdate,
  timelineStartDate,
  onDependencyCreate,
  dependencyCreationMode = false,
  showConnectionPoints = false
}) => {
  
  const updateIssue = useIssuesStore(state => state.updateIssue)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [enhancedTooltipData, setEnhancedTooltipData] = useState<EnhancedTooltipData | null>(null)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  const [hoveredProgress, setHoveredProgress] = useState(false)
  const [showGridGuides, setShowGridGuides] = useState(false)
  const [snapAlignmentGuides, setSnapAlignmentGuides] = useState<{x: number; type: string}[]>([])
  const [hoveredConnectionPoint, setHoveredConnectionPoint] = useState<'start' | 'end' | null>(null)
  const [isBarHovered, setIsBarHovered] = useState(false)
  
  // T020 AC2 & AC5: Status tooltip state
  const [showStatusTooltip, setShowStatusTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  
  const dragRef = useRef<SVGGElement>(null)

  // AC2: Enhanced drag telemetry integration
  const {
    startDragOperation,
    updateDragOperation,
    completeDragOperation,
    getDragPerformanceStats
  } = useDragTelemetry('GanttBar', (data) => {
    // Custom data size calculator for task operations
    return JSON.stringify({
      taskId: task.id,
      startDate: task.startDate,
      endDate: task.endDate,
      progress: task.progress,
      ...data
    }).length
  })

  // Check if this is a milestone (zero duration or marked as milestone)
  const isMilestone = useMemo(() => {
    const duration = task.endDate.getTime() - task.startDate.getTime()
    return duration <= 24 * 60 * 60 * 1000 || task.type === 'milestone' // <= 1 day
  }, [task.startDate, task.endDate, task.type])

  // Check for missing dates
  const hasDates = useMemo(() => {
    const now = Date.now()
    const defaultStart = new Date(now).toDateString()
    const defaultEnd = new Date(now + 7 * 24 * 60 * 60 * 1000).toDateString()
    
    return !(task.startDate.toDateString() === defaultStart && 
             task.endDate.toDateString() === defaultEnd)
  }, [task.startDate, task.endDate])

  // Check if task is a leaf (not a summary task) - only leaf tasks can have progress updated
  const isLeafTask = useMemo(() => {
    // Summary tasks (parent tasks) cannot have their progress updated directly
    // Their progress is calculated from children
    return task.type !== 'summary'
  }, [task.type])

  // Task metrics for progress and status analysis - T020 AC1: Enhanced overdue detection
  const taskMetrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day for accurate comparison
    
    const taskEndDate = new Date(task.endDate)
    taskEndDate.setHours(23, 59, 59, 999) // Set to end of day for accurate comparison
    
    const taskStartDate = new Date(task.startDate)
    taskStartDate.setHours(0, 0, 0, 0) // Normalize to start of day
    
    // T020 AC1: Enhanced overdue logic
    const isOverdue = taskEndDate < today && task.progress < 100
    const isAtRisk = taskEndDate > today && task.progress < 50 && 
      (taskEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 7
    
    const totalDays = Math.ceil((taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.max(0, Math.ceil((today.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)))
    const expectedProgress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0
    
    // T020 AC1: Calculate overdue days for severity
    const overdueDays = isOverdue ? Math.ceil((today.getTime() - taskEndDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
    
    // T020 AC2: Blocked status detection
    const isBlocked = task.status === 'TODO' && task.startDate < today && task.progress === 0
    
    return {
      isOverdue,
      isAtRisk,
      isBlocked,
      expectedProgress,
      progressDelta: task.progress - expectedProgress,
      totalDays,
      elapsedDays,
      overdueDays // T020 AC1: New field for overdue severity
    }
  }, [task.startDate, task.endDate, task.progress, task.status])

  // T020 AC6: Responsive zoom level calculations
  const zoomLevel = useMemo(() => {
    // Calculate zoom level based on task bar width
    if (width < 20) return 'micro' // Very small tasks
    if (width < 60) return 'small' // Small tasks
    if (width < 120) return 'medium' // Medium tasks
    return 'large' // Large tasks
  }, [width])

  // Use current progress from drag state if dragging, otherwise use task progress
  const currentProgress = dragState?.dragType === 'progress-update' ? 
    (dragState.currentProgress ?? task.progress) : task.progress
  const progressWidth = (width * currentProgress) / 100
  
  // Enhanced status color mapping
  const getStatusColor = (status: string) => {
    const colors = {
      TODO: '#9CA3AF',       // gray-400 (lighter than before)
      IN_PROGRESS: '#3B82F6', // blue-500
      DONE: '#10B981',       // emerald-500
      CANCELLED: '#EF4444'   // red-500
    }
    return colors[status as keyof typeof colors] || colors.TODO
  }

  // T020 AC1 & AC4: Dynamic color based on task state with overdue indicators
  const getBarColor = () => {
    // Priority: Critical Path > Overdue > Blocked > Scheduling State > Custom Color > Status Color
    if (schedulingInfo?.isCriticalPath) {
      return '#DC2626' // red-600 - T020 AC4: Critical path highlighting
    }
    if (taskMetrics.isOverdue) {
      return '#EF4444' // red-500 - T020 AC1: Overdue tasks
    }
    if (taskMetrics.isBlocked) {
      return '#F59E0B' // amber-500 - T020 AC2: Blocked tasks
    }
    if (schedulingInfo?.isDelayed || taskMetrics.isAtRisk) {
      return '#F97316' // orange-500
    }
    if (task.color) {
      return task.color
    }
    return getStatusColor(task.status)
  }

  // Progress bar color based on performance
  const getProgressColor = () => {
    if (task.status === 'DONE') return '#10B981' // emerald-500
    if (task.status === 'CANCELLED') return '#EF4444' // red-500
    if (taskMetrics.isOverdue) return '#DC2626' // red-600
    if (taskMetrics.isAtRisk) return '#F59E0B' // amber-500
    if (taskMetrics.progressDelta > 10) return '#10B981' // ahead - green
    return '#3B82F6' // on track - blue
  }

  // Convert pixel movement to date changes
  const calculateDateFromPixelDelta = useCallback((pixelDelta: number): number => {
    const daysDelta = pixelDelta / pixelsPerDay
    return Math.round(daysDelta) * 24 * 60 * 60 * 1000 // Convert to milliseconds
  }, [pixelsPerDay])

  // Calculate progress percentage from mouse position
  const calculateProgressFromMouseX = useCallback((mouseX: number): number => {
    const relativeX = mouseX - x
    const progressPercent = Math.max(0, Math.min(100, (relativeX / width) * 100))
    return Math.round(progressPercent) // Round to nearest integer
  }, [x, width])

  // Grid snapping calculation
  const calculateGridSnapping = useCallback((currentX: number): {x: number; snapped: boolean; type: string} => {
    const gridSize = pixelsPerDay // Snap to day boundaries
    const snappedX = Math.round(currentX / gridSize) * gridSize
    const snapDistance = Math.abs(currentX - snappedX)
    
    if (snapDistance <= 8) { // 8px snap threshold
      return { x: snappedX, snapped: true, type: 'day-boundary' }
    }
    
    return { x: currentX, snapped: false, type: '' }
  }, [pixelsPerDay])

  // Generate enhanced tooltip data
  const generateEnhancedTooltipData = useCallback((
    dragType: string, 
    currentState: any, 
    originalState: any
  ): EnhancedTooltipData => {
    const operationNames = {
      'move': 'Moving Task',
      'resize-left': 'Adjusting Start Date',
      'resize-right': 'Adjusting End Date',
      'progress-update': 'Updating Progress'
    }

    const baseData: EnhancedTooltipData = {
      operationType: operationNames[dragType as keyof typeof operationNames] || 'Modifying Task',
      primaryText: task.title,
      secondaryText: ''
    }

    if (dragType === 'progress-update') {
      const current = currentState.currentProgress ?? task.progress
      const original = currentState.originalProgress ?? task.progress
      const change = current - original
      
      baseData.progressIndicator = {
        current,
        original,
        change
      }
      baseData.secondaryText = `Progress: ${current}%`
      baseData.deltaText = change >= 0 ? `+${change}%` : `${change}%`
    } else {
      const currentDuration = Math.ceil((currentState.currentEndDate.getTime() - currentState.currentStartDate.getTime()) / (24 * 60 * 60 * 1000))
      const originalDuration = Math.ceil((originalState.originalEndDate.getTime() - originalState.originalStartDate.getTime()) / (24 * 60 * 60 * 1000))
      const durationChange = currentDuration - originalDuration

      baseData.timeInfo = {
        duration: currentDuration,
        originalDuration,
        change: durationChange
      }

      if (dragType === 'move') {
        baseData.secondaryText = `${currentState.currentStartDate.toLocaleDateString()} - ${currentState.currentEndDate.toLocaleDateString()}`
        const daysDelta = Math.round((currentState.currentStartDate.getTime() - originalState.originalStartDate.getTime()) / (24 * 60 * 60 * 1000))
        baseData.deltaText = daysDelta >= 0 ? `+${daysDelta} days` : `${daysDelta} days`
      } else if (dragType === 'resize-left') {
        baseData.secondaryText = `Start: ${currentState.currentStartDate.toLocaleDateString()}`
        baseData.deltaText = durationChange >= 0 ? `+${durationChange} days` : `${durationChange} days`
      } else if (dragType === 'resize-right') {
        baseData.secondaryText = `End: ${currentState.currentEndDate.toLocaleDateString()}`
        baseData.deltaText = durationChange >= 0 ? `+${durationChange} days` : `${durationChange} days`
      }
    }

    return baseData
  }, [task.title, task.progress])

  // T020 AC2 & AC5: Handle status tooltip hover
  const handleStatusTooltipShow = useCallback((event: React.MouseEvent) => {
    if (taskMetrics.isOverdue || taskMetrics.isBlocked || taskMetrics.isAtRisk) {
      const rect = event.currentTarget.getBoundingClientRect()
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      })
      setShowStatusTooltip(true)
    }
  }, [taskMetrics])

  const handleStatusTooltipHide = useCallback(() => {
    setShowStatusTooltip(false)
  }, [])

  // AC2: Enhanced dependency connection point click
  const handleConnectionPointMouseDown = useCallback(async (event: React.MouseEvent, connectionPoint: 'start' | 'end') => {
    if (!onDependencyCreate || !hasDates || isMilestone) return
    
    event.preventDefault()
    event.stopPropagation()

    // AC2: Start drag operation telemetry
    const telemetryId = startDragOperation(
      'dependency-create',
      { taskId: task.id, connectionPoint },
      [task.id],
      { connectionPoint, fromTask: task.title }
    )

    ganttPerformanceMonitor.startMeasurement('dependency-create-start')
    const startTime = performance.now()

    try {
      // Start dependency creation drag (delegates to grid-level system)
      await onDependencyCreate(task.id, '', connectionPoint)
      
      // AC2: Complete successful drag telemetry
      completeDragOperation(telemetryId, false)
      
    } catch (error) {
      console.error('Failed to start dependency creation:', error)
      
      // AC2: Complete failed drag telemetry
      completeDragOperation(telemetryId, true, error instanceof Error ? error.message : 'Unknown error')
    }
  }, [task, onDependencyCreate, hasDates, isMilestone, startDragOperation, completeDragOperation])

  // AC2: Handle progress bar click/drag start with advanced telemetry
  const handleProgressMouseDown = useCallback((event: React.MouseEvent) => {
    if (!isLeafTask || !hasDates || isMilestone) return
    
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const newProgress = calculateProgressFromMouseX(startX)

    // AC2: Start drag operation telemetry
    const telemetryId = startDragOperation(
      'task-move',
      { 
        taskId: task.id,
        originalProgress: task.progress,
        newProgress,
        progressDelta: newProgress - task.progress
      },
      [task.id],
      { operationType: 'progress-update', taskTitle: task.title }
    )

    ganttPerformanceMonitor.startMeasurement('progress-drag-start')
    const startTime = performance.now()

    const newDragState: DragState = {
      isDragging: true,
      startX,
      startY,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      currentStartDate: new Date(task.startDate),
      currentEndDate: new Date(task.endDate),
      dragType: 'progress-update',
      originalProgress: task.progress,
      currentProgress: newProgress,
      startTimestamp: startTime,
      telemetryId,
      dataSize: JSON.stringify({ taskId: task.id, progress: newProgress }).length
    }

    setDragState(newDragState)

    // Generate enhanced tooltip data
    const tooltipData = generateEnhancedTooltipData('progress-update', newDragState, newDragState)
    setEnhancedTooltipData(tooltipData)
    setShowTooltip(true)

    // Track performance
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: 0, // Start time, will be updated on completion
      taskCount: 1
    })
  }, [task, isLeafTask, hasDates, isMilestone, calculateProgressFromMouseX, generateEnhancedTooltipData, startDragOperation])

  // AC2: Handle resize start with advanced telemetry
  const handleResizeStart = useCallback((event: React.MouseEvent, handleType: 'resize-left' | 'resize-right') => {
    if (!onTaskUpdate || !timelineStartDate || isMilestone) return
    
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY

    // AC2: Start drag operation telemetry
    const telemetryId = startDragOperation(
      'resize',
      { 
        taskId: task.id,
        resizeType: handleType,
        originalDuration: task.endDate.getTime() - task.startDate.getTime()
      },
      [task.id],
      { operationType: handleType, taskTitle: task.title }
    )

    ganttPerformanceMonitor.startMeasurement('bar-resize-start')
    const startTime = performance.now()

    const newDragState: DragState = {
      isDragging: true,
      startX,
      startY,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      currentStartDate: new Date(task.startDate),
      currentEndDate: new Date(task.endDate),
      dragType: handleType,
      startTimestamp: startTime,
      telemetryId,
      dataSize: JSON.stringify({ taskId: task.id, startDate: task.startDate, endDate: task.endDate }).length
    }

    setDragState(newDragState)
    setShowGridGuides(true)

    // Generate enhanced tooltip data
    const tooltipData = generateEnhancedTooltipData(handleType, newDragState, newDragState)
    setEnhancedTooltipData(tooltipData)
    setShowTooltip(true)

    // Track performance
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: 0, // Start time, will be updated on completion
      taskCount: 1
    })
  }, [task, onTaskUpdate, timelineStartDate, isMilestone, generateEnhancedTooltipData, startDragOperation])

  // AC2: Handle main bar drag start with advanced telemetry
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!onTaskUpdate || !timelineStartDate || isMilestone) return
    
    // Check if click is near resize handles (within 8 pixels of either end)
    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const isNearLeftHandle = clickX <= 8
    const isNearRightHandle = clickX >= width - 8

    if (isNearLeftHandle || isNearRightHandle) {
      // Handle resize instead of move
      return
    }
    
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY

    // AC2: Start drag operation telemetry
    const telemetryId = startDragOperation(
      'task-move',
      { 
        taskId: task.id,
        originalStartDate: task.startDate,
        originalEndDate: task.endDate,
        duration: task.endDate.getTime() - task.startDate.getTime()
      },
      [task.id],
      { operationType: 'move', taskTitle: task.title }
    )

    ganttPerformanceMonitor.startMeasurement('bar-drag-start')
    const startTime = performance.now()

    const newDragState: DragState = {
      isDragging: true,
      startX,
      startY,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      currentStartDate: new Date(task.startDate),
      currentEndDate: new Date(task.endDate),
      dragType: 'move',
      startTimestamp: startTime,
      telemetryId,
      dataSize: JSON.stringify({ taskId: task.id, startDate: task.startDate, endDate: task.endDate }).length
    }

    setDragState(newDragState)
    setShowGridGuides(true)

    // Generate enhanced tooltip data
    const tooltipData = generateEnhancedTooltipData('move', newDragState, newDragState)
    setEnhancedTooltipData(tooltipData)
    setShowTooltip(true)

    // Track performance
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: 0, // Start time, will be updated on completion
      taskCount: 1
    })
  }, [task, onTaskUpdate, timelineStartDate, isMilestone, width, generateEnhancedTooltipData, startDragOperation])

  // AC2: Enhanced mouse move handler with telemetry updates
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState?.isDragging) return

    const currentX = event.clientX
    const currentY = event.clientY
    const deltaX = currentX - dragState.startX
    const deltaY = currentY - dragState.startY

    // AC2: Update drag operation telemetry
    if (dragState.telemetryId) {
      updateDragOperation(
        dragState.telemetryId,
        { x: deltaX, y: deltaY },
        // Calculate accuracy based on distance from snap points
        dragState.snapToGrid ? 1.0 : Math.max(0, 1 - Math.abs(deltaX) / width),
        'GanttBar'
      )
    }

    const newDragState = { ...dragState }
    
    if (dragState.dragType === 'progress-update') {
      // Update progress
      const newProgress = calculateProgressFromMouseX(currentX)
      newDragState.currentProgress = newProgress
    } else {
      // Update dates based on drag type
      const dateChange = calculateDateFromPixelDelta(deltaX)
      
      if (dragState.dragType === 'move') {
        newDragState.currentStartDate = new Date(dragState.originalStartDate.getTime() + dateChange)
        newDragState.currentEndDate = new Date(dragState.originalEndDate.getTime() + dateChange)
      } else if (dragState.dragType === 'resize-left') {
        newDragState.currentStartDate = new Date(dragState.originalStartDate.getTime() + dateChange)
      } else if (dragState.dragType === 'resize-right') {
        newDragState.currentEndDate = new Date(dragState.originalEndDate.getTime() + dateChange)
      }
    }

    setDragState(newDragState)

    // Update tooltip
    const tooltipData = generateEnhancedTooltipData(dragState.dragType, newDragState, dragState)
    setEnhancedTooltipData(tooltipData)
  }, [dragState, calculateProgressFromMouseX, calculateDateFromPixelDelta, width, generateEnhancedTooltipData, updateDragOperation])

  // AC2: Enhanced mouse up handler with telemetry completion
  const handleMouseUp = useCallback(async () => {
    if (!dragState?.isDragging || !onTaskUpdate) return

    const endTime = performance.now()
    const duration = endTime - dragState.startTimestamp
    let success = false
    let errorMessage: string | undefined

    try {
      if (dragState.dragType === 'progress-update' && isLeafTask && typeof dragState.currentProgress === 'number') {
        // Update progress in the store
        await updateIssue(task.id, { progress: dragState.currentProgress })
        success = true
        
        ganttPerformanceMonitor.recordMetrics({
          dragResponseTime: duration,
          taskCount: 1
        })
      } else if (dragState.dragType !== 'progress-update') {
        // Update dates
        await onTaskUpdate(task.id, {
          startDate: dragState.currentStartDate,
          endDate: dragState.currentEndDate
        })
        success = true

        ganttPerformanceMonitor.recordMetrics({
          dragResponseTime: duration,
          taskCount: 1
        })
      }
    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error updating task:', error)
    }

    // AC2: Complete drag operation telemetry
    if (dragState.telemetryId) {
      const result = completeDragOperation(dragState.telemetryId, !success, errorMessage)
      
      if (process.env.NODE_ENV === 'development' && result) {
        console.log('🎯 Drag operation completed:', {
          operationType: result.operationType,
          duration: result.responseTime,
          success,
          dataSize: result.dataSize,
          accuracy: result.accuracy
        })
      }
    }

    // Clean up drag state
    setDragState(null)
    setShowTooltip(false)
    setEnhancedTooltipData(null)
    setShowGridGuides(false)
    setSnapAlignmentGuides([])

    ganttPerformanceMonitor.endMeasurement('bar-drag-complete')
  }, [dragState, onTaskUpdate, updateIssue, task.id, isLeafTask, completeDragOperation])

  // Set up global mouse event listeners for dragging
  React.useEffect(() => {
    if (dragState?.isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState?.isDragging, handleMouseMove, handleMouseUp])

  // Early return for empty or invalid tasks
  if (!task || width < 1 || height < 1) {
    return null
  }

  const barColor = getBarColor()
  const progressColor = getProgressColor()

  // Render milestone differently
  if (isMilestone) {
    const milestoneSize = height * 0.8
    const milestoneY = y + (height - milestoneSize) / 2
    
    return (
      <g
        ref={dragRef}
        className="gantt-bar milestone"
        data-testid={dataTestId}
        data-task-id={task.id}
        onMouseEnter={() => setIsBarHovered(true)}
        onMouseLeave={() => setIsBarHovered(false)}
      >
        {/* Milestone diamond */}
        <path
          d={`M ${x + milestoneSize/2} ${milestoneY} L ${x + milestoneSize} ${milestoneY + milestoneSize/2} L ${x + milestoneSize/2} ${milestoneY + milestoneSize} L ${x} ${milestoneY + milestoneSize/2} Z`}
          fill={barColor}
          stroke={isSelected ? '#2563EB' : '#374151'}
          strokeWidth={isSelected ? 2 : 1}
          className="cursor-pointer transition-colors duration-200"
          onClick={() => onClick(task)}
          onMouseEnter={handleStatusTooltipShow}
          onMouseLeave={handleStatusTooltipHide}
        />
        
        {/* Milestone label - T020 AC6: Responsive visibility */}
        {zoomLevel !== 'micro' && (
          <text
            x={x + milestoneSize + 4}
            y={milestoneY + milestoneSize/2 + 4}
            fontSize={zoomLevel === 'small' ? '10' : '12'}
            fill="#374151"
            className="pointer-events-none select-none"
          >
            {zoomLevel === 'small' ? task.title.substring(0, 10) + '...' : task.title}
          </text>
        )}

        {/* Connection points for dependency creation */}
        {(dependencyCreationMode || showConnectionPoints || isBarHovered) && (
          <>
            <circle
              cx={x}
              cy={milestoneY + milestoneSize/2}
              r="4"
              fill="#3B82F6"
              stroke="#FFFFFF"
              strokeWidth="2"
              className={`cursor-crosshair transition-opacity ${hoveredConnectionPoint === 'start' ? 'opacity-100' : 'opacity-60'}`}
              onMouseEnter={() => setHoveredConnectionPoint('start')}
              onMouseLeave={() => setHoveredConnectionPoint(null)}
              onMouseDown={(e) => handleConnectionPointMouseDown(e, 'start')}
            />
            <circle
              cx={x + milestoneSize}
              cy={milestoneY + milestoneSize/2}
              r="4"
              fill="#3B82F6"
              stroke="#FFFFFF"
              strokeWidth="2"
              className={`cursor-crosshair transition-opacity ${hoveredConnectionPoint === 'end' ? 'opacity-100' : 'opacity-60'}`}
              onMouseEnter={() => setHoveredConnectionPoint('end')}
              onMouseLeave={() => setHoveredConnectionPoint(null)}
              onMouseDown={(e) => handleConnectionPointMouseDown(e, 'end')}
            />
          </>
        )}

        {/* T020 AC2 & AC5: Status Tooltip for milestones */}
        <StatusTooltip
          task={task}
          isVisible={showStatusTooltip}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      </g>
    )
  }

  return (
    <g
      ref={dragRef}
      className="gantt-bar task"
      data-testid={dataTestId}
      data-task-id={task.id}
      onMouseEnter={() => setIsBarHovered(true)}
      onMouseLeave={() => setIsBarHovered(false)}
    >
      {/* Grid guides during drag */}
      {showGridGuides && (
        <g className="grid-guides opacity-30">
          {Array.from({ length: Math.ceil(width / pixelsPerDay) + 2 }, (_, i) => (
            <line
              key={i}
              x1={x - pixelsPerDay + (i * pixelsPerDay)}
              y1={y - 10}
              x2={x - pixelsPerDay + (i * pixelsPerDay)}
              y2={y + height + 10}
              stroke="#6B7280"
              strokeWidth={0.5}
              strokeDasharray="2,2"
              className="pointer-events-none"
            />
          ))}
        </g>
      )}

      {/* T020 AC1: Overdue striped pattern definition */}
      {taskMetrics.isOverdue && (
        <defs>
          <pattern
            id={`overdue-stripes-${task.id}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill={barColor} />
            <rect width="3" height="6" fill="#DC2626" />
          </pattern>
        </defs>
      )}

      {/* T020 AC2: Blocked task pattern definition */}
      {taskMetrics.isBlocked && (
        <defs>
          <pattern
            id={`blocked-pattern-${task.id}`}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
          >
            <rect width="8" height="8" fill={barColor} />
            <path d="M0,8 L8,0" stroke="#F59E0B" strokeWidth="2" />
            <path d="M0,0 L8,8" stroke="#F59E0B" strokeWidth="2" />
          </pattern>
        </defs>
      )}

      {/* Main task bar */}
      <rect
        x={dragState?.dragType === 'move' ? x + (dragState.startX ? (event?.clientX || dragState.startX) - dragState.startX : 0) : x}
        y={y}
        width={width}
        height={height}
        rx={2}
        ry={2}
        fill={
          taskMetrics.isOverdue ? `url(#overdue-stripes-${task.id})` :
          taskMetrics.isBlocked ? `url(#blocked-pattern-${task.id})` :
          barColor
        }
        stroke={isSelected ? '#2563EB' : hasDates ? '#D1D5DB' : '#F87171'}
        strokeWidth={isSelected ? 2 : hasDates ? 1 : 2}
        strokeDasharray={hasDates ? '0' : '4,4'}
        className={`cursor-grab transition-colors duration-200 ${!onTaskUpdate || isMilestone ? 'cursor-pointer' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onClick={() => !dragState?.isDragging && onClick(task)}
        onMouseEnter={handleStatusTooltipShow}
        onMouseLeave={handleStatusTooltipHide}
        style={{ opacity: hasDates ? 1 : 0.7 }}
      />

      {/* T020 AC1 & AC6: Responsive overdue warning indicator */}
      {taskMetrics.isOverdue && zoomLevel !== 'micro' && (
        <g>
          <path
            d={`M ${x + width - 8} ${y} L ${x + width} ${y} L ${x + width} ${y + 8} Z`}
            fill="#DC2626"
            className="pointer-events-none"
          />
          {zoomLevel !== 'small' && (
            <text
              x={x + width - 4}
              y={y + 6}
              fontSize="8"
              fill="white"
              textAnchor="middle"
              className="pointer-events-none select-none font-bold"
            >
              !
            </text>
          )}
        </g>
      )}

      {/* T020 AC2 & AC6: Responsive blocked status indicator */}
      {taskMetrics.isBlocked && zoomLevel !== 'micro' && (
        <g>
          <rect
            x={x + 2}
            y={y + 2}
            width="12"
            height="12"
            rx="2"
            fill="#F59E0B"
            className="pointer-events-none"
          />
          {zoomLevel !== 'small' && (
            <text
              x={x + 8}
              y={y + 10}
              fontSize="8"
              fill="white"
              textAnchor="middle"
              className="pointer-events-none select-none font-bold"
            >
              🚫
            </text>
          )}
        </g>
      )}

      {/* Progress bar */}
      {isLeafTask && hasDates && currentProgress > 0 && (
        <rect
          x={dragState?.dragType === 'move' ? x + (dragState.startX ? (event?.clientX || dragState.startX) - dragState.startX : 0) : x}
          y={y}
          width={progressWidth}
          height={height}
          rx={2}
          ry={2}
          fill={progressColor}
          className={`transition-all duration-200 ${isLeafTask ? 'cursor-col-resize' : 'pointer-events-none'}`}
          onMouseDown={isLeafTask ? handleProgressMouseDown : undefined}
          onMouseEnter={() => setHoveredProgress(true)}
          onMouseLeave={() => setHoveredProgress(false)}
          style={{ opacity: 0.8 }}
        />
      )}

      {/* Resize handles */}
      {onTaskUpdate && !isMilestone && hasDates && (
        <>
          {/* Left resize handle */}
          <rect
            x={x - 2}
            y={y}
            width={4}
            height={height}
            fill="transparent"
            className={`cursor-col-resize ${hoveredHandle === 'left' ? 'fill-blue-400' : ''}`}
            onMouseEnter={() => setHoveredHandle('left')}
            onMouseLeave={() => setHoveredHandle(null)}
            onMouseDown={(e) => handleResizeStart(e, 'resize-left')}
          />
          
          {/* Right resize handle */}
          <rect
            x={x + width - 2}
            y={y}
            width={4}
            height={height}
            fill="transparent"
            className={`cursor-col-resize ${hoveredHandle === 'right' ? 'fill-blue-400' : ''}`}
            onMouseEnter={() => setHoveredHandle('right')}
            onMouseLeave={() => setHoveredHandle(null)}
            onMouseDown={(e) => handleResizeStart(e, 'resize-right')}
          />
        </>
      )}

      {/* T020 AC6: Responsive task label */}
      {zoomLevel !== 'micro' && (
        <text
          x={x + 8}
          y={y + height/2 + 4}
          fontSize={zoomLevel === 'small' ? '10' : '12'}
          fill={hasDates ? "#FFFFFF" : "#9CA3AF"}
          className="pointer-events-none select-none font-medium"
        >
          {zoomLevel === 'small' ? 
            task.title.length > 6 ? task.title.substring(0, 6) + '...' : task.title :
            task.title
          }
        </text>
      )}

      {/* T020 AC6: Responsive progress percentage */}
      {isLeafTask && hasDates && currentProgress > 0 && zoomLevel !== 'micro' && zoomLevel !== 'small' && (
        <text
          x={x + width - 8}
          y={y + height/2 + 4}
          fontSize="11"
          fill={progressWidth > width - 40 ? "#FFFFFF" : "#6B7280"}
          textAnchor="end"
          className="pointer-events-none select-none"
        >
          {Math.round(currentProgress)}%
        </text>
      )}

      {/* T020 AC4: Critical path indicator */}
      {schedulingInfo?.isCriticalPath && (
        <rect
          x={x}
          y={y - 2}
          width={width}
          height={2}
          fill="#DC2626"
          className="pointer-events-none"
        />
      )}

      {schedulingInfo?.slackDays !== undefined && schedulingInfo.slackDays >= 0 && zoomLevel === 'large' && (
        <text
          x={x + width + 4}
          y={y + height/2 + 4}
          fontSize="10"
          fill="#6B7280"
          className="pointer-events-none select-none"
        >
          {schedulingInfo.slackDays}d slack
        </text>
      )}

      {/* Connection points for dependency creation */}
      {(dependencyCreationMode || showConnectionPoints || isBarHovered) && hasDates && (
        <>
          <circle
            cx={x}
            cy={y + height/2}
            r="4"
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth="2"
            className={`cursor-crosshair transition-opacity ${hoveredConnectionPoint === 'start' ? 'opacity-100' : 'opacity-60'}`}
            onMouseEnter={() => setHoveredConnectionPoint('start')}
            onMouseLeave={() => setHoveredConnectionPoint(null)}
            onMouseDown={(e) => handleConnectionPointMouseDown(e, 'start')}
          />
          <circle
            cx={x + width}
            cy={y + height/2}
            r="4"
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth="2"
            className={`cursor-crosshair transition-opacity ${hoveredConnectionPoint === 'end' ? 'opacity-100' : 'opacity-60'}`}
            onMouseEnter={() => setHoveredConnectionPoint('end')}
            onMouseLeave={() => setHoveredConnectionPoint(null)}
            onMouseDown={(e) => handleConnectionPointMouseDown(e, 'end')}
          />
        </>
      )}

      {/* Enhanced drag tooltip - T020 AC5: Enhanced tooltip with status info */}
      {showTooltip && enhancedTooltipData && dragState?.isDragging && (
        <g className="drag-tooltip">
          <foreignObject
            x={Math.max(0, Math.min(x + width/2 - 120, window.innerWidth - 240))}
            y={y - 80}
            width="240"
            height="70"
          >
            <div className="bg-black bg-opacity-90 text-white p-3 rounded shadow-lg text-xs">
              <div className="font-semibold">{enhancedTooltipData.operationType}</div>
              <div className="text-gray-300">{enhancedTooltipData.primaryText}</div>
              <div>{enhancedTooltipData.secondaryText}</div>
              {enhancedTooltipData.deltaText && (
                <div className={`font-mono ${enhancedTooltipData.deltaText.startsWith('+') ? 'text-green-400' : enhancedTooltipData.deltaText.startsWith('-') ? 'text-red-400' : 'text-gray-300'}`}>
                  {enhancedTooltipData.deltaText}
                </div>
              )}
              {/* T020 AC5: Status information in tooltip */}
              {taskMetrics.isOverdue && (
                <div className="text-red-400 font-medium mt-1">
                  ⚠️ Overdue by {taskMetrics.overdueDays} day{taskMetrics.overdueDays !== 1 ? 's' : ''}
                </div>
              )}
              {taskMetrics.isBlocked && (
                <div className="text-amber-400 font-medium mt-1">
                  🚫 Task is blocked
                </div>
              )}
              {/* AC2: Show telemetry performance info in dev mode */}
              {process.env.NODE_ENV === 'development' && getDragPerformanceStats() && (
                <div className="mt-1 pt-1 border-t border-gray-600 text-xs opacity-75">
                  Ops: {getDragPerformanceStats()?.totalOperations || 0} | 
                  Avg: {Math.round(getDragPerformanceStats()?.avgResponseTime || 0)}ms
                </div>
              )}
            </div>
          </foreignObject>
        </g>
      )}

      {/* T020 AC2 & AC5: Status Tooltip */}
      <StatusTooltip
        task={task}
        isVisible={showStatusTooltip}
        x={tooltipPosition.x}
        y={tooltipPosition.y}
      />
    </g>
  )
})

GanttBar.displayName = 'GanttBar'