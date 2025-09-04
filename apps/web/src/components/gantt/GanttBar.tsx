'use client'

import React, { memo } from 'react'
import { GanttTask } from '@/types/gantt'

interface GanttBarProps {
  task: GanttTask
  x: number
  y: number
  width: number
  height: number
  isSelected: boolean
  onClick: (task: GanttTask) => void
}

export const GanttBar = memo<GanttBarProps>(({ 
  task, 
  x, 
  y, 
  width, 
  height, 
  isSelected, 
  onClick 
}) => {
  const progressWidth = (width * task.progress) / 100
  
  const getStatusColor = (status: string) => {
    const colors = {
      TODO: '#94a3b8',      // gray
      IN_PROGRESS: '#3b82f6', // blue
      DONE: '#10b981',       // emerald
      CANCELLED: '#ef4444'   // red
    }
    return colors[status as keyof typeof colors] || colors.TODO
  }

  const barColor = task.color || getStatusColor(task.status)
  
  return (
    <g onClick={() => onClick(task)} className="cursor-pointer">
      {/* Main task bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={barColor}
        stroke={isSelected ? '#1f2937' : 'transparent'}
        strokeWidth={isSelected ? 2 : 0}
        rx={3}
        ry={3}
        className="transition-all duration-200 hover:opacity-80"
      />
      
      {/* Progress bar */}
      <rect
        x={x}
        y={y}
        width={progressWidth}
        height={height}
        fill={barColor}
        opacity={0.8}
        rx={3}
        ry={3}
        style={{
          filter: 'brightness(1.2)'
        }}
      />
      
      {/* Progress text */}
      {width > 60 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-white font-medium pointer-events-none"
          style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.3)' }}
        >
          {task.progress}%
        </text>
      )}
      
      {/* Task title (if there's enough space) */}
      {width > 100 && (
        <text
          x={x + 8}
          y={y - 4}
          className="text-xs fill-gray-700 font-medium pointer-events-none"
        >
          {task.title.length > 20 ? task.title.substring(0, 17) + '...' : task.title}
        </text>
      )}
    </g>
  )
})

GanttBar.displayName = 'GanttBar'