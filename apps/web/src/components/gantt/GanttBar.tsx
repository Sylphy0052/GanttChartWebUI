'use client'

import React, { memo } from 'react'
import { GanttTask } from '@/types/gantt'

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
}

export const GanttBar = memo<GanttBarProps>(({ 
  task, 
  x, 
  y, 
  width, 
  height, 
  isSelected, 
  onClick,
  schedulingInfo
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

  // Determine bar color based on scheduling info
  const getBarColor = () => {
    if (schedulingInfo?.isCriticalPath) {
      return '#ef4444' // Critical path: red
    }
    if (schedulingInfo?.isDelayed) {
      return '#f59e0b' // Delayed: amber
    }
    return task.color || getStatusColor(task.status)
  }

  const barColor = getBarColor()
  const isCritical = schedulingInfo?.isCriticalPath
  const hasSlack = schedulingInfo?.slackDays && schedulingInfo.slackDays > 0
  
  return (
    <g onClick={() => onClick(task)} className="cursor-pointer">
      {/* Main task bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={barColor}
        stroke={isSelected ? '#1f2937' : (isCritical ? '#dc2626' : 'transparent')}
        strokeWidth={isSelected ? 2 : (isCritical ? 2 : 0)}
        rx={3}
        ry={3}
        className="transition-all duration-200 hover:opacity-80"
      />
      
      {/* Critical path indicator */}
      {isCritical && (
        <rect
          x={x}
          y={y - 2}
          width={width}
          height={2}
          fill="#dc2626"
          rx={1}
        />
      )}
      
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

      {/* Slack indicator */}
      {hasSlack && width > 40 && (
        <g>
          <rect
            x={x + width + 2}
            y={y + height / 4}
            width={Math.min(schedulingInfo.slackDays! * 5, 30)} // Scale slack visually
            height={height / 2}
            fill="#10b981"
            fillOpacity={0.3}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="2,2"
            rx={2}
          />
          <text
            x={x + width + 6}
            y={y + height / 2}
            className="text-xs fill-green-700 font-medium pointer-events-none"
            dominantBaseline="middle"
          >
            {schedulingInfo.slackDays}d
          </text>
        </g>
      )}

      {/* Critical path badge */}
      {isCritical && width > 60 && (
        <g>
          <rect
            x={x + width - 16}
            y={y - 8}
            width={14}
            height={10}
            fill="#dc2626"
            rx={2}
          />
          <text
            x={x + width - 9}
            y={y - 3}
            textAnchor="middle"
            className="text-xs fill-white font-bold pointer-events-none"
            dominantBaseline="middle"
          >
            C
          </text>
        </g>
      )}

      {/* Delay warning */}
      {schedulingInfo?.isDelayed && width > 40 && (
        <g>
          <rect
            x={x - 12}
            y={y - 8}
            width={10}
            height={10}
            fill="#f59e0b"
            rx={2}
          />
          <text
            x={x - 7}
            y={y - 3}
            textAnchor="middle"
            className="text-xs fill-white font-bold pointer-events-none"
            dominantBaseline="middle"
          >
            !
          </text>
        </g>
      )}
    </g>
  )
})

GanttBar.displayName = 'GanttBar'