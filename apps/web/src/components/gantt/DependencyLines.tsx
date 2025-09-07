'use client'

import React, { memo, useMemo } from 'react'
import { GanttTask, GanttDependency, GanttViewport } from '@/types/gantt'

interface DependencyLinesProps {
  tasks: GanttTask[]
  dependencies: GanttDependency[]
  viewport: GanttViewport
  width: number
  height: number
  className?: string
  onDependencyClick?: (dependency: GanttDependency, event: React.MouseEvent) => void
  onDependencyContextMenu?: (dependency: GanttDependency, event: React.MouseEvent) => void
}

interface DependencyPath {
  id: string
  d: string
  dependency: GanttDependency
  isValid: boolean
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
}

/**
 * DependencyLines Component
 * 
 * Renders dependency relationships as SVG paths connecting tasks in the Gantt chart.
 * Supports different dependency types (FS, SS, FF, SF) and provides interactive features.
 */
export const DependencyLines = memo<DependencyLinesProps>(({
  tasks,
  dependencies,
  viewport,
  width,
  height,
  className = '',
  onDependencyClick,
  onDependencyContextMenu
}) => {
  /**
   * Create optimized task lookup maps for O(1) access
   */
  const taskMaps = useMemo(() => {
    const taskIndexMap = new Map<string, number>()
    const taskByIdMap = new Map<string, GanttTask>()

    tasks.forEach((task, index) => {
      taskIndexMap.set(task.id, index)
      taskByIdMap.set(task.id, task)
    })

    return { taskIndexMap, taskByIdMap }
  }, [tasks])

  /**
   * Calculate dependency paths with validation and positioning
   */
  const dependencyPaths = useMemo((): DependencyPath[] => {
    const paths: DependencyPath[] = []
    const { taskIndexMap, taskByIdMap } = taskMaps

    dependencies.forEach(dependency => {
      // Get predecessor and successor tasks
      const predecessorTask = taskByIdMap.get(dependency.predecessorId)
      const successorTask = taskByIdMap.get(dependency.successorId)
      
      if (!predecessorTask || !successorTask) {
        return // Skip invalid dependencies
      }

      // Get task positions
      const predecessorIndex = taskIndexMap.get(dependency.predecessorId)
      const successorIndex = taskIndexMap.get(dependency.successorId)
      
      if (predecessorIndex === undefined || successorIndex === undefined) {
        return // Skip if we can't find task positions
      }

      // Calculate connection points based on dependency type
      let startX: number, startY: number, endX: number, endY: number

      const predecessorY = predecessorIndex * viewport.rowHeight + viewport.rowHeight / 2
      const successorY = successorIndex * viewport.rowHeight + viewport.rowHeight / 2

      switch (dependency.type) {
        case 'FS': // Finish-to-Start (default)
          startX = viewport.timeScale(predecessorTask.endDate) || 0
          startY = predecessorY
          endX = viewport.timeScale(successorTask.startDate) || 0
          endY = successorY
          break
          
        case 'SS': // Start-to-Start
          startX = viewport.timeScale(predecessorTask.startDate) || 0
          startY = predecessorY
          endX = viewport.timeScale(successorTask.startDate) || 0
          endY = successorY
          break
          
        case 'FF': // Finish-to-Finish
          startX = viewport.timeScale(predecessorTask.endDate) || 0
          startY = predecessorY
          endX = viewport.timeScale(successorTask.endDate) || 0
          endY = successorY
          break
          
        case 'SF': // Start-to-Finish
          startX = viewport.timeScale(predecessorTask.startDate) || 0
          startY = predecessorY
          endX = viewport.timeScale(successorTask.endDate) || 0
          endY = successorY
          break
          
        default:
          startX = viewport.timeScale(predecessorTask.endDate) || 0
          startY = predecessorY
          endX = viewport.timeScale(successorTask.startDate) || 0
          endY = successorY
      }

      // Validate connection points are within viewport
      const isValid = startX >= 0 && endX >= 0 && 
                     startX <= width && endX <= width &&
                     startX <= endX // Don't show backwards dependencies

      if (!isValid) return

      // Generate SVG path based on line routing preferences
      const pathData = generateDependencyPath(
        { x: startX, y: startY },
        { x: endX, y: endY },
        dependency.type
      )

      paths.push({
        id: dependency.id,
        d: pathData,
        dependency,
        isValid,
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY }
      })
    })

    return paths
  }, [dependencies, taskMaps, viewport, width])

  /**
   * Generate SVG path string for dependency line
   */
  function generateDependencyPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    type: string
  ): string {
    const ARROW_SIZE = 8
    const CURVE_RADIUS = 20
    
    // Adjust end point to account for arrow
    const adjustedEndX = end.x - ARROW_SIZE
    const adjustedEndY = end.y

    // If the line is mostly horizontal, use a simple curved path
    if (Math.abs(start.y - end.y) < 10) {
      const midX = (start.x + adjustedEndX) / 2
      return `M ${start.x} ${start.y} C ${midX} ${start.y} ${midX} ${adjustedEndY} ${adjustedEndX} ${adjustedEndY}`
    }

    // For more complex routing, use L-shaped path with rounded corners
    const horizontalMid = start.x + Math.max(30, (adjustedEndX - start.x) * 0.5)
    
    if (start.y === adjustedEndY) {
      // Straight horizontal line
      return `M ${start.x} ${start.y} L ${adjustedEndX} ${adjustedEndY}`
    } else {
      // L-shaped path with rounded corner
      return `M ${start.x} ${start.y} ` +
             `L ${horizontalMid - CURVE_RADIUS} ${start.y} ` +
             `Q ${horizontalMid} ${start.y} ${horizontalMid} ${start.y + (adjustedEndY > start.y ? CURVE_RADIUS : -CURVE_RADIUS)} ` +
             `L ${horizontalMid} ${adjustedEndY - (adjustedEndY > start.y ? CURVE_RADIUS : -CURVE_RADIUS)} ` +
             `Q ${horizontalMid} ${adjustedEndY} ${horizontalMid + CURVE_RADIUS} ${adjustedEndY} ` +
             `L ${adjustedEndX} ${adjustedEndY}`
    }
  }

  /**
   * Generate arrow marker path
   */
  function generateArrowPath(endPoint: { x: number; y: number }): string {
    const ARROW_SIZE = 8
    return `M ${endPoint.x - ARROW_SIZE} ${endPoint.y - ARROW_SIZE/2} ` +
           `L ${endPoint.x} ${endPoint.y} ` +
           `L ${endPoint.x - ARROW_SIZE} ${endPoint.y + ARROW_SIZE/2} Z`
  }

  /**
   * Get line color based on dependency type
   */
  function getDependencyColor(type: string): string {
    switch (type) {
      case 'FS': return '#6b7280' // Gray
      case 'SS': return '#3b82f6' // Blue
      case 'FF': return '#10b981' // Green
      case 'SF': return '#f59e0b' // Amber
      default: return '#6b7280'
    }
  }

  /**
   * Handle dependency click
   */
  const handleDependencyClick = (dependency: GanttDependency, event: React.MouseEvent) => {
    event.stopPropagation()
    onDependencyClick?.(dependency, event)
  }

  /**
   * Handle dependency context menu
   */
  const handleDependencyContextMenu = (dependency: GanttDependency, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onDependencyContextMenu?.(dependency, event)
  }

  if (dependencyPaths.length === 0) {
    return null // No dependencies to render
  }

  return (
    <svg
      className={`dependency-lines absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%', zIndex: 15 }}
      data-testid="dependency-lines-svg"
    >
      {/* Define arrow markers */}
      <defs>
        <marker
          id="dependency-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
        </marker>
        
        <marker
          id="dependency-arrow-fs"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
        </marker>
        
        <marker
          id="dependency-arrow-ss"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
        </marker>
        
        <marker
          id="dependency-arrow-ff"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
        </marker>
        
        <marker
          id="dependency-arrow-sf"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#f59e0b" />
        </marker>
      </defs>

      {/* Render dependency paths */}
      {dependencyPaths.map(({ id, d, dependency, endPoint }) => (
        <g key={id}>
          {/* Main dependency line */}
          <path
            d={d}
            stroke={getDependencyColor(dependency.type)}
            strokeWidth="2"
            fill="none"
            strokeDasharray={dependency.type === 'FS' ? '0' : '4,4'}
            opacity="0.8"
            className="dependency-line hover:opacity-100 cursor-pointer transition-opacity"
            markerEnd={`url(#dependency-arrow-${dependency.type.toLowerCase()})`}
            style={{ pointerEvents: 'stroke', strokeWidth: '8px' }} // Invisible thick stroke for easier clicking
            onClick={(e) => handleDependencyClick(dependency, e)}
            onContextMenu={(e) => handleDependencyContextMenu(dependency, e)}
            data-testid={`dependency-line-${dependency.id}`}
          />
          
          {/* Visible thin line for aesthetics */}
          <path
            d={d}
            stroke={getDependencyColor(dependency.type)}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray={dependency.type === 'FS' ? '0' : '3,3'}
            opacity="0.7"
            className="dependency-line-visual pointer-events-none"
            markerEnd={`url(#dependency-arrow-${dependency.type.toLowerCase()})`}
          />
          
          {/* Arrow head (manual rendering for better control) */}
          <path
            d={generateArrowPath(endPoint)}
            fill={getDependencyColor(dependency.type)}
            opacity="0.8"
            className="dependency-arrow pointer-events-none"
          />
        </g>
      ))}
    </svg>
  )
})

DependencyLines.displayName = 'DependencyLines'