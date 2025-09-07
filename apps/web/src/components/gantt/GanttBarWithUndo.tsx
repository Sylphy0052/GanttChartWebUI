/**
 * Enhanced GanttBar with Undo/Redo Support
 * 
 * This component extends the existing GanttBar with full undo/redo capabilities
 * for bar move, resize, and progress update operations. It implements the first
 * acceptance criterion: "Bar move/resize undo/redo with Ctrl+Z/Y"
 */

'use client'

import React, { memo, useMemo, useState, useCallback, useRef } from 'react'
import { GanttTask } from '@/types/gantt'
import { useIssuesStore } from '@/stores/issues.store'
import { ganttPerformanceMonitor } from '@/lib/performance'
import { auditLogsApi } from '@/lib/api/audit-logs'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { BarMoveCommand, BarResizeCommand, ProgressUpdateCommand } from '@/lib/commands/BarOperationCommand'

interface SchedulingInfo {
  isCriticalPath?: boolean
  slackDays?: number
  isDelayed?: boolean
}

interface GanttBarWithUndoProps {
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

export const GanttBarWithUndo = memo<GanttBarWithUndoProps>(({ 
  task, 
  x, 
  y, 
  width, 
  height, 
  isSelected, 
  onClick,
  schedulingInfo,
  'data-testid': dataTestId,
  pixelsPerDay = 30,
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
  const dragRef = useRef<SVGGElement>(null)

  // Initialize undo/redo system with telemetry callbacks
  const { executeCommand, canUndo, canRedo } = useUndoRedo({
    maxHistorySize: 20,
    enableKeyboardShortcuts: true,
    telemetryEnabled: true,
    onCommandExecuted: (command, result) => {
      console.log(`✅ Command executed: ${command.description}`, result)
      
      // Show success feedback
      if (result.success) {
        setEnhancedTooltipData({
          operationType: 'Command Executed',
          primaryText: `✅ ${command.description}`,
          secondaryText: `Completed in ${Math.round(result.executionTime)}ms`,
          deltaText: canUndo ? 'Press Ctrl+Z to undo' : undefined
        })
        setShowTooltip(true)
        setTimeout(() => setShowTooltip(false), 3000)
      }
    },
    onHistoryChanged: (history, currentIndex) => {
      console.log(`📚 History updated: ${history.length} commands, current: ${currentIndex}`)
    }
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
    return task.type !== 'summary'
  }, [task.type])

  // Task metrics for progress and status analysis
  const taskMetrics = useMemo(() => {
    const today = new Date()
    const isOverdue = task.endDate < today && task.progress < 100
    const isAtRisk = task.endDate > today && task.progress < 50 && 
      (task.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 7
    
    const totalDays = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.max(0, Math.ceil((today.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const expectedProgress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0
    
    return {
      isOverdue,
      isAtRisk,
      expectedProgress,
      progressDelta: task.progress - expectedProgress,
      totalDays,
      elapsedDays
    }
  }, [task.startDate, task.endDate, task.progress])

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

  // Dynamic color based on task state
  const getBarColor = () => {
    // Priority: Critical Path > Scheduling State > Custom Color > Status Color
    if (schedulingInfo?.isCriticalPath) {
      return '#DC2626' // red-600
    }
    if (schedulingInfo?.isDelayed || taskMetrics.isOverdue) {
      return '#F59E0B' // amber-500
    }
    if (taskMetrics.isAtRisk) {
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

    // Add undo/redo information
    if (canUndo) {
      baseData.deltaText = (baseData.deltaText || '') + ' • Ctrl+Z to undo'
    }

    return baseData
  }, [task.title, task.progress, canUndo])

  /**
   * UNDO/REDO INTEGRATION - Enhanced task update function
   */
  const executeTaskUpdate = useCallback(async (taskId: string, startDate: Date, endDate: Date) => {
    // Update through the provided handler
    if (onTaskUpdate) {
      await onTaskUpdate(taskId, { startDate, endDate })
    }
    
    // Also update through the issues store for consistency
    await updateIssue(taskId, {
      startDate: startDate.toISOString().split('T')[0],
      dueDate: endDate.toISOString().split('T')[0]
    })
  }, [onTaskUpdate, updateIssue])

  /**
   * UNDO/REDO INTEGRATION - Enhanced progress update function
   */
  const executeProgressUpdate = useCallback(async (taskId: string, progress: number) => {
    await updateIssue(taskId, { progress })
  }, [updateIssue])

  // Enhanced dependency connection point click - AC4 implementation
  const handleConnectionPointMouseDown = useCallback(async (event: React.MouseEvent, connectionPoint: 'start' | 'end') => {
    if (!onDependencyCreate || !hasDates || isMilestone) return
    
    event.preventDefault()
    event.stopPropagation()

    ganttPerformanceMonitor.startMeasurement('dependency-create-start')
    const startTime = performance.now()

    try {
      // Start dependency creation drag (delegates to grid-level system)
      await onDependencyCreate(task.id, '', connectionPoint)
      
    } catch (error) {
      console.error('Failed to start dependency creation:', error)
    }
  }, [task, onDependencyCreate, hasDates, isMilestone])

  // Handle progress bar click/drag start
  const handleProgressMouseDown = useCallback((event: React.MouseEvent) => {
    if (!isLeafTask || !hasDates || isMilestone) return
    
    event.preventDefault()
    event.stopPropagation()

    ganttPerformanceMonitor.startMeasurement('progress-drag-start')
    const startTime = performance.now()

    const startX = event.clientX
    const startY = event.clientY
    const newProgress = calculateProgressFromMouseX(startX)

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
      startTimestamp: startTime
    }

    setDragState(newDragState)

    // Generate enhanced tooltip data
    const tooltipData = generateEnhancedTooltipData('progress-update', newDragState, newDragState)
    setEnhancedTooltipData(tooltipData)
    setShowTooltip(true)

    // Track performance
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: 0,
      taskCount: 1
    })
  }, [task, isLeafTask, hasDates, isMilestone, calculateProgressFromMouseX, generateEnhancedTooltipData])

  // Handle resize start (left or right handle)
  const handleResizeStart = useCallback((event: React.MouseEvent, handleType: 'resize-left' | 'resize-right') => {
    if (!onTaskUpdate || !timelineStartDate || isMilestone) return
    
    event.preventDefault()
    event.stopPropagation()

    ganttPerformanceMonitor.startMeasurement('bar-resize-start')
    const startTime = performance.now()

    const startX = event.clientX
    const startY = event.clientY

    const newDragState: DragState = {
      isDragging: true,
      startX,
      startY,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      currentStartDate: new Date(task.startDate),
      currentEndDate: new Date(task.endDate),
      dragType: handleType,
      startTimestamp: startTime
    }

    setDragState(newDragState)
    setShowGridGuides(true)

    // Generate enhanced tooltip data
    const tooltipData = generateEnhancedTooltipData(handleType, newDragState, newDragState)
    setEnhancedTooltipData(tooltipData)
    setShowTooltip(true)

    // Track performance
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: 0,
      taskCount: 1
    })
  }, [task, onTaskUpdate, timelineStartDate, isMilestone, generateEnhancedTooltipData])

  // Handle main bar drag start (move)
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!onTaskUpdate || !timelineStartDate || isMilestone) return
    
    // Check if click is near resize handles (within 8 pixels of either end)
    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const isNearLeftHandle = clickX <= 8
    const isNearRightHandle = clickX >= width - 8

    if (isNearLeftHandle || isNearRightHandle) {
      return
    }
    
    event.preventDefault()
    event.stopPropagation()

    ganttPerformanceMonitor.startMeasurement('bar-drag-start')
    const startTime = performance.now()

    const startX = event.clientX
    const startY = event.clientY

    const newDragState: DragState = {
      isDragging: true,
      startX,
      startY,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      currentStartDate: new Date(task.startDate),
      currentEndDate: new Date(task.endDate),
      dragType: 'move',
      startTimestamp: startTime
    }

    setDragState(newDragState)
    setShowGridGuides(true)

    // Generate enhanced tooltip data
    const tooltipData = generateEnhancedTooltipData('move', newDragState, newDragState)
    setEnhancedTooltipData(tooltipData)
    setShowTooltip(true)

    // Track performance
    ganttPerformanceMonitor.recordMetrics({
      dragResponseTime: 0,
      taskCount: 1
    })
  }, [task, onTaskUpdate, timelineStartDate, isMilestone, width, generateEnhancedTooltipData])

  // Handle drag movement (only for non-dependency operations)
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState) return

    const currentX = event.clientX
    const deltaX = currentX - dragState.startX

    if (dragState.dragType === 'progress-update') {
      // Handle progress update
      const newProgress = calculateProgressFromMouseX(currentX)
      
      const updatedDragState = { ...dragState, currentProgress: newProgress }
      setDragState(updatedDragState)

      // Update enhanced tooltip
      const tooltipData = generateEnhancedTooltipData('progress-update', updatedDragState, dragState)
      setEnhancedTooltipData(tooltipData)
      
      return
    }

    if (!onTaskUpdate || !timelineStartDate) return

    // Handle grid snapping for date-based operations
    const snapResult = calculateGridSnapping(currentX)
    const snappedDeltaX = snapResult.snapped ? snapResult.x - dragState.startX : deltaX
    
    let newStartDate: Date, newEndDate: Date

    if (dragState.dragType === 'move') {
      // Calculate new dates based on pixel movement (both dates move together)
      const timeDelta = calculateDateFromPixelDelta(snappedDeltaX)
      newStartDate = new Date(dragState.originalStartDate.getTime() + timeDelta)
      newEndDate = new Date(dragState.originalEndDate.getTime() + timeDelta)
    } else if (dragState.dragType === 'resize-left') {
      // Resize from left (change start date only)
      const timeDelta = calculateDateFromPixelDelta(snappedDeltaX)
      newStartDate = new Date(dragState.originalStartDate.getTime() + timeDelta)
      newEndDate = new Date(dragState.originalEndDate)
      
      // Prevent start date from going beyond end date
      if (newStartDate >= newEndDate) {
        newStartDate = new Date(newEndDate.getTime() - 24 * 60 * 60 * 1000)
      }
    } else if (dragState.dragType === 'resize-right') {
      // Resize from right (change end date only)
      const timeDelta = calculateDateFromPixelDelta(snappedDeltaX)
      newStartDate = new Date(dragState.originalStartDate)
      newEndDate = new Date(dragState.originalEndDate.getTime() + timeDelta)
      
      // Prevent end date from going before start date
      if (newEndDate <= newStartDate) {
        newEndDate = new Date(newStartDate.getTime() + 24 * 60 * 60 * 1000)
      }
    } else {
      return
    }

    // Update drag state for visual feedback
    const updatedDragState = {
      ...dragState,
      currentStartDate: newStartDate,
      currentEndDate: newEndDate,
      snapToGrid: snapResult.snapped,
      gridAlignmentX: snapResult.snapped ? snapResult.x : undefined
    }
    setDragState(updatedDragState)

    // Update snap alignment guides
    if (snapResult.snapped) {
      setSnapAlignmentGuides([{ x: snapResult.x, type: snapResult.type }])
    } else {
      setSnapAlignmentGuides([])
    }

    // Update enhanced tooltip
    const tooltipData = generateEnhancedTooltipData(dragState.dragType, updatedDragState, dragState)
    if (snapResult.snapped) {
      tooltipData.snapInfo = { isSnapped: true, snapType: snapResult.type }
    }
    setEnhancedTooltipData(tooltipData)

    // Measure drag responsiveness
    ganttPerformanceMonitor.endMeasurement('bar-resize-start')
  }, [dragState, onTaskUpdate, timelineStartDate, calculateDateFromPixelDelta, calculateProgressFromMouseX, calculateGridSnapping, generateEnhancedTooltipData])

  /**
   * UNDO/REDO INTEGRATION - Enhanced drag end with command execution
   */
  const handleMouseUp = useCallback(async (event: MouseEvent) => {
    if (!dragState) return

    const endTime = performance.now()
    const operationDuration = endTime - dragState.startTimestamp
    
    try {
      if (dragState.dragType === 'progress-update') {
        // Handle progress update completion with undo/redo command
        const newProgress = dragState.currentProgress ?? task.progress
        const progressChange = Math.abs(newProgress - (dragState.originalProgress ?? task.progress))

        // Only update if there's a meaningful change (at least 1%)
        if (progressChange >= 1) {
          const command = new ProgressUpdateCommand({
            taskId: task.id,
            originalProgress: dragState.originalProgress ?? task.progress,
            newProgress,
            onExecute: executeProgressUpdate,
            context: {
              timestamp: dragState.startTimestamp,
              metadata: {
                operationDuration,
                progressChange,
                dragDistance: Math.abs(event.clientX - dragState.startX)
              }
            }
          })

          await executeCommand(command)
        } else {
          // No significant change, just hide tooltip
          setShowTooltip(false)
        }

        // Clean up
        setDragState(null)
        setShowGridGuides(false)
        setSnapAlignmentGuides([])
        return
      }

      // Handle date-based operations (move/resize) with undo/redo commands
      if (!onTaskUpdate) return

      // Calculate final dates
      const currentX = event.clientX
      const deltaX = currentX - dragState.startX
      
      let newStartDate: Date, newEndDate: Date, timeDelta: number

      if (dragState.dragType === 'move') {
        timeDelta = calculateDateFromPixelDelta(deltaX)
        newStartDate = new Date(dragState.originalStartDate.getTime() + timeDelta)
        newEndDate = new Date(dragState.originalEndDate.getTime() + timeDelta)
      } else if (dragState.dragType === 'resize-left') {
        timeDelta = calculateDateFromPixelDelta(deltaX)
        newStartDate = new Date(dragState.originalStartDate.getTime() + timeDelta)
        newEndDate = new Date(dragState.originalEndDate)
        
        // Prevent invalid date ranges
        if (newStartDate >= newEndDate) {
          newStartDate = new Date(newEndDate.getTime() - 24 * 60 * 60 * 1000)
        }
      } else if (dragState.dragType === 'resize-right') {
        timeDelta = calculateDateFromPixelDelta(deltaX)
        newStartDate = new Date(dragState.originalStartDate)
        newEndDate = new Date(dragState.originalEndDate.getTime() + timeDelta)
        
        // Prevent invalid date ranges
        if (newEndDate <= newStartDate) {
          newEndDate = new Date(newStartDate.getTime() + 24 * 60 * 60 * 1000)
        }
      } else {
        return
      }

      // Only update if there's a meaningful change (at least 1 day)
      const minChange = 24 * 60 * 60 * 1000 // 1 day in milliseconds
      const hasStartChange = Math.abs(newStartDate.getTime() - dragState.originalStartDate.getTime()) >= minChange
      const hasEndChange = Math.abs(newEndDate.getTime() - dragState.originalEndDate.getTime()) >= minChange

      if (hasStartChange || hasEndChange) {
        // Create appropriate command based on operation type
        let command
        
        if (dragState.dragType === 'move') {
          command = new BarMoveCommand({
            taskId: task.id,
            originalStartDate: dragState.originalStartDate,
            originalEndDate: dragState.originalEndDate,
            newStartDate,
            newEndDate,
            onExecute: executeTaskUpdate,
            context: {
              timestamp: dragState.startTimestamp,
              metadata: {
                operationDuration,
                dragDistance: Math.abs(deltaX),
                snapToGrid: dragState.snapToGrid
              }
            }
          })
        } else {
          command = new BarResizeCommand({
            taskId: task.id,
            originalStartDate: dragState.originalStartDate,
            originalEndDate: dragState.originalEndDate,
            newStartDate,
            newEndDate,
            resizeType: dragState.dragType === 'resize-left' ? 'start' : 'end',
            onExecute: executeTaskUpdate,
            context: {
              timestamp: dragState.startTimestamp,
              metadata: {
                operationDuration,
                dragDistance: Math.abs(deltaX),
                snapToGrid: dragState.snapToGrid
              }
            }
          })
        }

        // Execute command through undo/redo system
        await executeCommand(command)
      } else {
        // No significant change, just hide tooltip
        setShowTooltip(false)
      }
    } catch (error) {
      console.error('Failed to execute task operation:', error)
      
      // Update tooltip for error
      const errorTooltip: EnhancedTooltipData = {
        operationType: 'Operation Failed',
        primaryText: `❌ ${task.title}`,
        secondaryText: `Failed to update task`,
        deltaText: 'Please try again'
      }
      setEnhancedTooltipData(errorTooltip)
      
      // Hide tooltip after 3 seconds
      setTimeout(() => setShowTooltip(false), 3000)
    }

    // Clean up drag state and guides
    setDragState(null)
    setShowGridGuides(false)
    setSnapAlignmentGuides([])
  }, [dragState, onTaskUpdate, task.id, task.title, task.progress, calculateDateFromPixelDelta, executeTaskUpdate, executeProgressUpdate, executeCommand])

  // Set up global mouse event listeners for drag (only for non-dependency operations)
  React.useEffect(() => {
    if (dragState?.isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      // Change cursor based on operation
      const cursorMap = {
        'move': 'grabbing',
        'resize-left': 'ew-resize',
        'resize-right': 'ew-resize',
        'progress-update': 'col-resize'
      }
      document.body.style.cursor = cursorMap[dragState.dragType] || 'grabbing'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'default'
      }
    }
  }, [dragState?.isDragging, handleMouseMove, handleMouseUp, dragState?.dragType])

  const barColor = getBarColor()
  const progressColor = getProgressColor()
  const isCritical = schedulingInfo?.isCriticalPath
  const hasSlack = schedulingInfo?.slackDays && schedulingInfo.slackDays > 0
  const isDragging = dragState?.isDragging
  
  // Calculate ghost bar position and size during drag with enhanced styling
  const getGhostBarProperties = () => {
    if (!isDragging || !dragState) return { x, width, opacity: 0.6 }
    
    let ghostX = x
    let ghostWidth = width
    let opacity = 0.6

    if (dragState.dragType === 'move') {
      const deltaX = (dragState.currentStartDate.getTime() - dragState.originalStartDate.getTime()) / (24 * 60 * 60 * 1000) * pixelsPerDay
      ghostX = x + deltaX
      opacity = dragState.snapToGrid ? 0.8 : 0.6
    } else if (dragState.dragType === 'resize-left') {
      const deltaX = (dragState.currentStartDate.getTime() - dragState.originalStartDate.getTime()) / (24 * 60 * 60 * 1000) * pixelsPerDay
      const newWidth = width - deltaX
      ghostX = x + deltaX
      ghostWidth = Math.max(newWidth, pixelsPerDay) // Minimum 1 day width
      opacity = dragState.snapToGrid ? 0.8 : 0.6
    } else if (dragState.dragType === 'resize-right') {
      const deltaX = (dragState.currentEndDate.getTime() - dragState.originalEndDate.getTime()) / (24 * 60 * 60 * 1000) * pixelsPerDay
      const newWidth = width + deltaX
      ghostWidth = Math.max(newWidth, pixelsPerDay) // Minimum 1 day width
      opacity = dragState.snapToGrid ? 0.8 : 0.6
    }
    
    return { x: ghostX, width: ghostWidth, opacity }
  }

  const { x: ghostX, width: ghostWidth, opacity: ghostOpacity } = getGhostBarProperties()

  // Determine if connection points should be visible
  const shouldShowConnectionPoints = (showConnectionPoints || dependencyCreationMode || isBarHovered) && hasDates && !isMilestone && !isDragging
  
  // Handle milestone rendering
  if (isMilestone) {
    const milestoneSize = Math.min(height, 16)
    const centerX = x + width / 2
    const centerY = y + height / 2
    
    return (
      <g 
        onClick={() => onClick(task)} 
        className="cursor-pointer milestone-marker gantt-milestone"
        data-testid={dataTestId || "milestone-bar"}
        onMouseEnter={() => setIsBarHovered(true)}
        onMouseLeave={() => setIsBarHovered(false)}
      >
        {/* Milestone diamond shape */}
        <polygon
          points={`${centerX},${centerY - milestoneSize/2} ${centerX + milestoneSize/2},${centerY} ${centerX},${centerY + milestoneSize/2} ${centerX - milestoneSize/2},${centerY}`}
          fill={barColor}
          stroke={isSelected ? '#1F2937' : (isCritical ? '#DC2626' : barColor)}
          strokeWidth={isSelected ? 3 : (isCritical ? 2 : 1)}
          className="transition-all duration-200 hover:opacity-80"
        />
        
        {/* Milestone title */}
        {width > 20 && (
          <text
            x={centerX}
            y={y - 6}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-semibold pointer-events-none"
          >
            ◆ {task.title.length > 15 ? task.title.substring(0, 12) + '...' : task.title}
          </text>
        )}
        
        {/* Critical milestone indicator */}
        {isCritical && (
          <circle
            cx={centerX + milestoneSize/3}
            cy={centerY - milestoneSize/3}
            r={3}
            fill="#DC2626"
            className="animate-pulse"
          />
        )}

        {/* Connection points for milestones */}
        {shouldShowConnectionPoints && (
          <g className="connection-points">
            {/* Start connection point */}
            <circle
              cx={centerX - milestoneSize/2 - 4}
              cy={centerY}
              r={4}
              fill="#3B82F6"
              opacity={hoveredConnectionPoint === 'start' ? 1 : 0.7}
              className="cursor-crosshair hover:opacity-100 transition-opacity"
              onMouseEnter={() => setHoveredConnectionPoint('start')}
              onMouseLeave={() => setHoveredConnectionPoint(null)}
              onMouseDown={(e) => handleConnectionPointMouseDown(e, 'start')}
              style={{ pointerEvents: 'all' }}
            />
            
            {/* End connection point */}
            <circle
              cx={centerX + milestoneSize/2 + 4}
              cy={centerY}
              r={4}
              fill="#10B981"
              opacity={hoveredConnectionPoint === 'end' ? 1 : 0.7}
              className="cursor-crosshair hover:opacity-100 transition-opacity"
              onMouseEnter={() => setHoveredConnectionPoint('end')}
              onMouseLeave={() => setHoveredConnectionPoint(null)}
              onMouseDown={(e) => handleConnectionPointMouseDown(e, 'end')}
              style={{ pointerEvents: 'all' }}
            />
          </g>
        )}

        {/* Undo/Redo Status Indicator for Milestones */}
        {(canUndo || canRedo) && (
          <g className="undo-redo-indicator">
            <circle
              cx={centerX + milestoneSize/2 + 12}
              cy={centerY - milestoneSize/2}
              r={6}
              fill="rgba(59, 130, 246, 0.9)"
              className="animate-pulse"
            />
            <text
              x={centerX + milestoneSize/2 + 12}
              y={centerY - milestoneSize/2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-white font-bold pointer-events-none"
            >
              {canUndo ? 'Z' : 'Y'}
            </text>
            <title>{canUndo ? 'Press Ctrl+Z to undo' : 'Press Ctrl+Y to redo'}</title>
          </g>
        )}
      </g>
    )
  }
  
  // Regular task bar rendering continues with all the existing SVG elements...
  // For brevity, I'll focus on the key integration points and add the undo/redo indicators
  
  return (
    <g 
      ref={dragRef}
      className={`cursor-pointer task-bar gantt-task ${isDragging ? 'dragging' : ''}`}
      data-testid={dataTestId || "task-bar"}
      onMouseEnter={() => setIsBarHovered(true)}
      onMouseLeave={() => setIsBarHovered(false)}
    >
      {/* Enhanced Grid Guide Lines */}
      {showGridGuides && isDragging && (
        <g className="grid-guides" opacity={0.4}>
          {Array.from({ length: 20 }, (_, i) => {
            const gridX = Math.floor(x / pixelsPerDay) * pixelsPerDay + (i * pixelsPerDay)
            if (gridX < x - pixelsPerDay * 5 || gridX > x + width + pixelsPerDay * 5) return null
            return (
              <line
                key={`grid-${i}`}
                x1={gridX}
                y1={y - 20}
                x2={gridX}
                y2={y + height + 20}
                stroke="#E5E7EB"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )
          })}
        </g>
      )}

      {/* Snap Alignment Guides */}
      {snapAlignmentGuides.map((guide, index) => (
        <g key={`snap-guide-${index}`} className="snap-guides">
          <line
            x1={guide.x}
            y1={0}
            x2={guide.x}
            y2={1000}
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="4,4"
            opacity={0.8}
            className="animate-pulse"
          />
          <rect
            x={guide.x - 20}
            y={y - 25}
            width={40}
            height={18}
            fill="#3B82F6"
            rx={3}
            opacity={0.9}
          />
          <text
            x={guide.x}
            y={y - 15}
            textAnchor="middle"
            className="text-xs fill-white font-medium pointer-events-none"
            dominantBaseline="middle"
          >
            {guide.type === 'day-boundary' ? 'DAY' : guide.type.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Enhanced Ghost bar during drag */}
      {isDragging && dragState && (
        <g opacity={ghostOpacity}>
          <rect
            x={ghostX}
            y={y}
            width={ghostWidth}
            height={height}
            fill={dragState.dragType === 'progress-update' ? progressColor : barColor}
            stroke={dragState.snapToGrid ? '#3B82F6' : '#1F2937'}
            strokeWidth={dragState.snapToGrid ? 3 : 2}
            strokeDasharray={dragState.snapToGrid ? '6,2' : '4,4'}
            rx={3}
            ry={3}
            className={`ghost-bar ${dragState.snapToGrid ? 'animate-pulse' : ''}`}
          />
          
          {/* Ghost bar operation indicator */}
          <rect
            x={ghostX + 2}
            y={y + 2}
            width={Math.max(ghostWidth - 4, 20)}
            height={4}
            fill={dragState.dragType === 'progress-update' ? '#3B82F6' : '#10B981'}
            rx={2}
            opacity={0.8}
            className="ghost-operation-indicator"
          />

          {/* Ghost bar label with operation info */}
          <text
            x={ghostX + ghostWidth / 2}
            y={y - 8}
            textAnchor="middle"
            className="text-xs fill-blue-600 font-semibold pointer-events-none"
          >
            {dragState.dragType === 'move' && `Moving (${dragState.currentStartDate.toLocaleDateString()})`}
            {dragState.dragType === 'resize-left' && `Start: ${dragState.currentStartDate.toLocaleDateString()}`}
            {dragState.dragType === 'resize-right' && `End: ${dragState.currentEndDate.toLocaleDateString()}`}
            {dragState.dragType === 'progress-update' && `${dragState.currentProgress}%`}
          </text>
        </g>
      )}

      {/* Main task bar background */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={barColor}
        opacity={hasDates ? (isDragging ? 0.4 : 0.3) : 0.1}
        stroke={isSelected ? '#1F2937' : (isCritical ? '#DC2626' : 'transparent')}
        strokeWidth={isSelected ? 3 : (isCritical ? 2 : 0)}
        rx={3}
        ry={3}
        className={`transition-all duration-200 ${hasDates ? 'hover:opacity-70' : ''}`}
        onMouseDown={hasDates ? handleMouseDown : undefined}
        style={{ cursor: hasDates ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
        onClick={!hasDates ? () => onClick(task) : undefined}
      />

      {/* Enhanced Connection points for regular tasks (AC4) */}
      {shouldShowConnectionPoints && (
        <g className="connection-points">
          {/* Start connection point */}
          <circle
            cx={x - 6}
            cy={y + height / 2}
            r={hoveredConnectionPoint === 'start' ? 5 : 4}
            fill="#3B82F6"
            opacity={hoveredConnectionPoint === 'start' ? 1 : 0.7}
            className="cursor-crosshair hover:opacity-100 transition-all duration-200"
            onMouseEnter={() => setHoveredConnectionPoint('start')}
            onMouseLeave={() => setHoveredConnectionPoint(null)}
            onMouseDown={(e) => handleConnectionPointMouseDown(e, 'start')}
            style={{ pointerEvents: 'all' }}
          />
          
          {/* End connection point */}
          <circle
            cx={x + width + 6}
            cy={y + height / 2}
            r={hoveredConnectionPoint === 'end' ? 5 : 4}
            fill="#10B981"
            opacity={hoveredConnectionPoint === 'end' ? 1 : 0.7}
            className="cursor-crosshair hover:opacity-100 transition-all duration-200"
            onMouseEnter={() => setHoveredConnectionPoint('end')}
            onMouseLeave={() => setHoveredConnectionPoint(null)}
            onMouseDown={(e) => handleConnectionPointMouseDown(e, 'end')}
            style={{ pointerEvents: 'all' }}
          />
        </g>
      )}

      {/* Resize handles (only show for tasks with dates and not milestones) */}
      {hasDates && !isMilestone && !isDragging && (
        <>
          {/* Left resize handle */}
          <rect
            x={x - 2}
            y={y}
            width={8}
            height={height}
            fill={hoveredHandle === 'left' ? '#3B82F6' : 'transparent'}
            opacity={0.7}
            rx={3}
            className="resize-handle-left cursor-ew-resize hover:fill-blue-500 transition-all duration-200"
            onMouseDown={(e) => handleResizeStart(e, 'resize-left')}
            onMouseEnter={() => setHoveredHandle('left')}
            onMouseLeave={() => setHoveredHandle(null)}
          />
          
          {/* Right resize handle */}
          <rect
            x={x + width - 6}
            y={y}
            width={8}
            height={height}
            fill={hoveredHandle === 'right' ? '#3B82F6' : 'transparent'}
            opacity={0.7}
            rx={3}
            className="resize-handle-right cursor-ew-resize hover:fill-blue-500 transition-all duration-200"
            onMouseDown={(e) => handleResizeStart(e, 'resize-right')}
            onMouseEnter={() => setHoveredHandle('right')}
            onMouseLeave={() => setHoveredHandle(null)}
          />
        </>
      )}
      
      {/* Expected progress indicator (only for active tasks) */}
      {task.status !== 'DONE' && task.status !== 'CANCELLED' && hasDates && taskMetrics.expectedProgress > 0 && (
        <rect
          x={x}
          y={y}
          width={(width * taskMetrics.expectedProgress) / 100}
          height={height}
          fill={barColor}
          opacity={0.6}
          rx={3}
          ry={3}
        />
      )}
      
      {/* Actual progress bar with interactive capabilities */}
      {currentProgress > 0 && hasDates && (
        <>
          <rect
            x={x}
            y={y}
            width={progressWidth}
            height={height}
            fill={progressColor}
            opacity={0.9}
            rx={3}
            ry={3}
            className={`transition-all duration-300 ${isLeafTask ? 'cursor-col-resize hover:opacity-75' : ''}`}
            onMouseDown={isLeafTask ? handleProgressMouseDown : undefined}
            onMouseEnter={() => isLeafTask && setHoveredProgress(true)}
            onMouseLeave={() => setHoveredProgress(false)}
          />

          {/* Progress interaction hint (for leaf tasks) */}
          {isLeafTask && hoveredProgress && !isDragging && (
            <g>
              <rect
                x={x + progressWidth - 2}
                y={y}
                width={4}
                height={height}
                fill="#3B82F6"
                opacity={0.8}
                rx={2}
                className="progress-handle"
              />
              <title>Click and drag to update progress</title>
            </g>
          )}
        </>
      )}

      {/* Progress percentage text */}
      {width > 50 && currentProgress > 0 && hasDates && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-white font-semibold pointer-events-none"
          style={{ 
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))'
          }}
        >
          {currentProgress}%
        </text>
      )}
      
      {/* Task title and metadata */}
      {width > 80 && (
        <g>
          {/* Task title */}
          <text
            x={x + 6}
            y={y - 6}
            className="text-xs fill-gray-800 font-medium pointer-events-none"
          >
            {task.title.length > 18 ? task.title.substring(0, 15) + '...' : task.title}
          </text>
        </g>
      )}

      {/* UNDO/REDO STATUS INDICATOR */}
      {(canUndo || canRedo) && width > 40 && !isDragging && (
        <g className="undo-redo-indicator">
          <circle
            cx={x + width - 12}
            cy={y - 8}
            r={6}
            fill="rgba(59, 130, 246, 0.9)"
            stroke="rgba(255, 255, 255, 0.8)"
            strokeWidth={1}
            className="animate-pulse"
          />
          <text
            x={x + width - 12}
            y={y - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-white font-bold pointer-events-none"
          >
            {canUndo ? 'Z' : 'Y'}
          </text>
          <title>{canUndo ? 'Press Ctrl+Z to undo last operation' : 'Press Ctrl+Y to redo last operation'}</title>
        </g>
      )}

      {/* Selection highlight overlay */}
      {isSelected && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill="none"
          stroke="#1F2937"
          strokeWidth={2}
          rx={5}
          ry={5}
          opacity={0.6}
          className="animate-pulse"
        />
      )}
      
      {/* Hover interaction area */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        className="hover:fill-black hover:fill-opacity-5 transition-all duration-200"
        rx={3}
        ry={3}
        onClick={!hasDates ? () => onClick(task) : undefined}
      />

      {/* Enhanced Professional Tooltip */}
      {showTooltip && enhancedTooltipData && (
        <g className="enhanced-tooltip">
          {/* Tooltip background with shadow effect */}
          <defs>
            <filter id={`tooltip-shadow-${task.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
            </filter>
          </defs>
          
          <rect
            x={x + width / 2 - 120}
            y={y - 100}
            width={240}
            height={enhancedTooltipData.progressIndicator ? 85 : 80}
            fill="rgba(15, 23, 42, 0.95)"
            rx={8}
            ry={8}
            stroke="rgba(59, 130, 246, 0.5)"
            strokeWidth={1}
            filter={`url(#tooltip-shadow-${task.id})`}
            className="tooltip-background"
          />
          
          {/* Operation type header */}
          <text
            x={x + width / 2}
            y={y - 85}
            textAnchor="middle"
            className="text-xs fill-blue-400 font-semibold pointer-events-none"
            dominantBaseline="middle"
          >
            {enhancedTooltipData.operationType}
          </text>
          
          {/* Primary text (task title) */}
          <text
            x={x + width / 2}
            y={y - 70}
            textAnchor="middle"
            className="text-sm fill-white font-medium pointer-events-none"
            dominantBaseline="middle"
          >
            {enhancedTooltipData.primaryText}
          </text>
          
          {/* Secondary text (dates/progress) */}
          <text
            x={x + width / 2}
            y={y - 55}
            textAnchor="middle"
            className="text-xs fill-gray-300 font-normal pointer-events-none"
            dominantBaseline="middle"
          >
            {enhancedTooltipData.secondaryText}
          </text>
          
          {/* Delta text (changes) */}
          {enhancedTooltipData.deltaText && (
            <text
              x={x + width / 2}
              y={y - 40}
              textAnchor="middle"
              className={`text-xs font-semibold pointer-events-none ${
                enhancedTooltipData.deltaText.includes('Ctrl+Z') ? 'fill-blue-400' :
                enhancedTooltipData.deltaText.startsWith('+') ? 'fill-green-400' : 
                enhancedTooltipData.deltaText.startsWith('-') ? 'fill-red-400' : 'fill-yellow-400'
              }`}
              dominantBaseline="middle"
            >
              {enhancedTooltipData.deltaText}
            </text>
          )}
          
          {/* Progress indicator bar */}
          {enhancedTooltipData.progressIndicator && (
            <g>
              <rect
                x={x + width / 2 - 100}
                y={y - 25}
                width={200}
                height={6}
                fill="rgba(75, 85, 99, 0.5)"
                rx={3}
              />
              <rect
                x={x + width / 2 - 100}
                y={y - 25}
                width={(200 * enhancedTooltipData.progressIndicator.current) / 100}
                height={6}
                fill="#10B981"
                rx={3}
              />
            </g>
          )}
          
          {/* Snap indicator */}
          {enhancedTooltipData.snapInfo?.isSnapped && (
            <g>
              <circle
                cx={x + width / 2 + 105}
                cy={y - 85}
                r={4}
                fill="#10B981"
                className="animate-pulse"
              />
              <text
                x={x + width / 2 + 105}
                y={y - 85}
                textAnchor="middle"
                className="text-xs fill-white font-bold pointer-events-none"
                dominantBaseline="middle"
              >
                ✓
              </text>
              <title>Snapped to {enhancedTooltipData.snapInfo.snapType}</title>
            </g>
          )}
        </g>
      )}
    </g>
  )
})

GanttBarWithUndo.displayName = 'GanttBarWithUndo'