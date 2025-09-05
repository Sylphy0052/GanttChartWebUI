'use client'

import React, { memo, useMemo } from 'react'
import { GanttTask, GanttTimelineConfig, GanttViewport } from '@/types/gantt'
import { GanttBar } from './GanttBar'

interface GanttGridProps {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
  className?: string
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

export const GanttGrid = memo<GanttGridProps>(({ 
  tasks, 
  config, 
  viewport, 
  selectedTaskIds, 
  onTaskClick, 
  className = '' 
}) => {
  const gridLines = useMemo((): GridLine[] => {
    const lines: GridLine[] = []
    const { timeScale, rowHeight } = viewport
    const { scale } = config
    
    // Generate vertical grid lines
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
        height: tasks.length * rowHeight,
        isWeekend,
        isToday
      })
      
      // Advance to next grid line
      switch (scale) {
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
    
    // Generate horizontal grid lines
    for (let i = 0; i <= tasks.length; i++) {
      lines.push({
        type: 'horizontal',
        x: 0,
        y: i * rowHeight,
        width: viewport.width,
        height: 1
      })
    }
    
    return lines
  }, [tasks, config, viewport])
  
  const taskBars = useMemo(() => {
    return tasks.map((task, index) => {
      const startX = viewport.timeScale(task.startDate) || 0
      const endX = viewport.timeScale(task.endDate) || 0
      const width = Math.max(endX - startX, 4) // Minimum width of 4px
      const y = index * viewport.rowHeight + (viewport.rowHeight - viewport.taskHeight) / 2
      const isSelected = selectedTaskIds.has(task.id)
      
      return {
        task,
        x: startX,
        y,
        width,
        height: viewport.taskHeight,
        isSelected
      }
    })
  }, [tasks, viewport, selectedTaskIds])
  
  return (
    <div className={`gantt-grid relative bg-white ${className}`} style={{ height: tasks.length * viewport.rowHeight }}>
      {/* Grid lines */}
      <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
        {gridLines.map((line, index) => (
          <line
            key={index}
            x1={line.type === 'vertical' ? line.x : line.x}
            y1={line.type === 'vertical' ? line.y : line.y}
            x2={line.type === 'vertical' ? line.x : (line.x || 0) + (line.width || 0)}
            y2={line.type === 'vertical' ? (line.y || 0) + (line.height || 0) : line.y}
            stroke={
              line.isToday ? '#ef4444' :
              line.isWeekend ? '#e5e7eb' :
              line.type === 'horizontal' ? '#f3f4f6' : '#e5e7eb'
            }
            strokeWidth={line.isToday ? 2 : 1}
            strokeOpacity={
              line.isToday ? 0.8 :
              line.type === 'horizontal' ? 0.5 : 0.3
            }
          />
        ))}
      </svg>
      
      {/* Weekend backgrounds */}
      {(() => {
        const weekendBands: { x: number; width: number }[] = []
        const { timeScale } = viewport
        
        if (config.scale === 'day') {
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
                weekendBands.push({ x, width })
              }
            }
            currentDate.setDate(currentDate.getDate() + 1)
          }
        }
        
        return weekendBands.map((band, index) => (
          <div
            key={`weekend-${index}`}
            className="absolute top-0 bottom-0 bg-gray-50 pointer-events-none"
            style={{
              left: band.x,
              width: band.width,
              opacity: 0.3
            }}
          />
        ))
      })()}
      
      {/* Task bars */}
      <svg className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
        {taskBars.map((bar, index) => (
          <GanttBar
            key={bar.task.id}
            task={bar.task}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            isSelected={bar.isSelected}
            onClick={onTaskClick}
          />
        ))}
      </svg>
      
      {/* Task dependencies */}
      {tasks.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          {tasks.map((task, taskIndex) => 
            task.dependencies.map((dep, depIndex) => {
              const dependentTask = tasks.find(t => t.id === dep.successorId)
              if (!dependentTask) return null
              
              const dependentIndex = tasks.findIndex(t => t.id === dep.successorId)
              if (dependentIndex === -1) return null
              
              // Calculate arrow path
              const fromX = (viewport.timeScale(task.endDate) || 0)
              const fromY = taskIndex * viewport.rowHeight + viewport.rowHeight / 2
              const toX = (viewport.timeScale(dependentTask.startDate) || 0)
              const toY = dependentIndex * viewport.rowHeight + viewport.rowHeight / 2
              
              if (fromX >= toX) return null // Don't show invalid dependencies
              
              const midX = (fromX + toX) / 2
              
              return (
                <g key={`${task.id}-${dep.successorId}-${depIndex}`}>
                  {/* Dependency line */}
                  <path
                    d={`M ${fromX} ${fromY} C ${midX} ${fromY} ${midX} ${toY} ${toX - 8} ${toY}`}
                    stroke="#6b7280"
                    strokeWidth="1.5"
                    fill="none"
                    strokeDasharray="3,3"
                    opacity="0.6"
                  />
                  {/* Arrow head */}
                  <polygon
                    points={`${toX - 8},${toY - 4} ${toX},${toY} ${toX - 8},${toY + 4}`}
                    fill="#6b7280"
                    opacity="0.6"
                  />
                </g>
              )
            })
          )}
        </svg>
      )}
      
      {/* Today indicator line */}
      {(() => {
        const today = new Date()
        const todayX = viewport.timeScale(today)
        if (todayX && todayX >= 0 && todayX <= viewport.width) {
          return (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
              style={{ left: todayX }}
            >
              <div className="absolute -top-2 -left-3 w-6 h-4 bg-red-500 rounded-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
          )
        }
        return null
      })()}
    </div>
  )
})

GanttGrid.displayName = 'GanttGrid'