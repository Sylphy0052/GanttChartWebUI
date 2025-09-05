'use client'

import React, { memo, useMemo, useCallback } from 'react'
// @ts-ignore - react-window v2.0.2 has type definition issues
import { List } from 'react-window'
import { GanttTask, GanttTimelineConfig, GanttViewport } from '@/types/gantt'
import { GanttBar } from './GanttBar'

interface VirtualizedGanttGridProps {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
  height: number
  className?: string
}

interface TaskRowData {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
  visibleRowRange: { startIndex: number; endIndex: number }
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

/**
 * Individual Task Row Component for Virtualization
 */
const TaskRow: React.FC<{
  index: number
  style: React.CSSProperties
  data: TaskRowData
}> = memo(({ index, style, data }) => {
  const { tasks, viewport, selectedTaskIds, onTaskClick } = data
  const task = tasks[index]

  if (!task) return null

  // Calculate task bar properties
  const startX = viewport.timeScale(task.startDate) || 0
  const endX = viewport.timeScale(task.endDate) || 0
  const width = Math.max(endX - startX, 4) // Minimum width of 4px
  const y = (viewport.rowHeight - viewport.taskHeight) / 2
  const isSelected = selectedTaskIds.has(task.id)

  return (
    <div style={style} className="relative">
      {/* Row background */}
      <div className="absolute inset-0 border-b border-gray-200 hover:bg-gray-50" />

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
        />
      </svg>
    </div>
  )
})

TaskRow.displayName = 'TaskRow'

/**
 * Virtualized Gantt Grid Component
 *
 * High-performance grid implementation using react-window for virtualization.
 * Only renders visible rows to handle large datasets (1000+ tasks) efficiently.
 */
export const VirtualizedGanttGrid = memo<VirtualizedGanttGridProps>(
  ({ tasks, config, viewport, selectedTaskIds, onTaskClick, height, className = '' }) => {
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
     * Optimized task index maps for O(1) lookups
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
     * Generate visible dependency arrows with optimized lookups
     */
    const visibleDependencies = useMemo(() => {
      const dependencies: Array<{
        id: string
        fromX: number
        fromY: number
        toX: number
        toY: number
      }> = []

      const { taskIndexMap, taskByIdMap } = taskMaps

      tasks.forEach((task, taskIndex) => {
        task.dependencies.forEach((dep, depIndex) => {
          // O(1) lookup instead of O(n) find()
          const dependentTask = taskByIdMap.get(dep.successorId)
          if (!dependentTask) return

          // O(1) lookup instead of O(n) findIndex()
          const dependentIndex = taskIndexMap.get(dep.successorId)
          if (dependentIndex === undefined) return

          // Calculate arrow path
          const fromX = viewport.timeScale(task.endDate) || 0
          const fromY = taskIndex * viewport.rowHeight + viewport.rowHeight / 2
          const toX = viewport.timeScale(dependentTask.startDate) || 0
          const toY = dependentIndex * viewport.rowHeight + viewport.rowHeight / 2

          if (fromX >= toX) return // Don't show invalid dependencies

          dependencies.push({
            id: `${task.id}-${dep.successorId}-${depIndex}`,
            fromX,
            fromY,
            toX,
            toY,
          })
        })
      })

      return dependencies
    }, [tasks, viewport, taskMaps])

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
      }),
      [tasks, config, viewport, selectedTaskIds, onTaskClick]
    )

    /**
     * Today indicator position
     */
    const todayIndicator = useMemo(() => {
      const today = new Date()
      const todayX = viewport.timeScale(today)
      if (todayX && todayX >= 0 && todayX <= viewport.width) {
        return todayX
      }
      return null
    }, [viewport])

    return (
      <div className={`virtualized-gantt-grid relative bg-white ${className}`} style={{ height }}>
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

        {/* Dependency arrows overlay */}
        <svg
          className="absolute inset-0 pointer-events-none z-20"
          style={{ width: '100%', height: '100%' }}
        >
          {visibleDependencies.map(dep => {
            const midX = (dep.fromX + dep.toX) / 2

            return (
              <g key={dep.id}>
                {/* Dependency line */}
                <path
                  d={`M ${dep.fromX} ${dep.fromY} C ${midX} ${dep.fromY} ${midX} ${dep.toY} ${dep.toX - 8} ${dep.toY}`}
                  stroke="#6b7280"
                  strokeWidth="1.5"
                  fill="none"
                  strokeDasharray="3,3"
                  opacity="0.6"
                />
                {/* Arrow head */}
                <polygon
                  points={`${dep.toX - 8},${dep.toY - 4} ${dep.toX},${dep.toY} ${dep.toX - 8},${dep.toY + 4}`}
                  fill="#6b7280"
                  opacity="0.6"
                />
              </g>
            )
          })}
        </svg>

        {/* Today indicator line */}
        {todayIndicator !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30"
            style={{ left: todayIndicator }}
          >
            <div className="absolute -top-2 -left-3 w-6 h-4 bg-red-500 rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
        )}
      </div>
    )
  }
)

VirtualizedGanttGrid.displayName = 'VirtualizedGanttGrid'
