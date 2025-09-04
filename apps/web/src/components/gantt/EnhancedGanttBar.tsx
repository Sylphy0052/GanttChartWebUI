'use client'

import React, { memo, useMemo } from 'react'
import { GanttTask } from '@/types/gantt'

interface EnhancedGanttBarProps {
  task: GanttTask
  x: number
  y: number
  width: number
  height: number
  isSelected: boolean
  onClick: (task: GanttTask) => void
  showDetails?: boolean
  isCriticalPath?: boolean
}

export const EnhancedGanttBar = memo<EnhancedGanttBarProps>(({ 
  task, 
  x, 
  y, 
  width, 
  height, 
  isSelected, 
  onClick,
  showDetails = true,
  isCriticalPath = false
}) => {
  const progressWidth = (width * task.progress) / 100
  
  // Calculate task metrics
  const taskMetrics = useMemo(() => {
    const today = new Date()
    const isOverdue = task.endDate < today && task.progress < 100
    const isAtRisk = task.endDate > today && task.progress < 50 && 
      (task.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 7
    
    const totalDays = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.ceil((today.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24))
    const expectedProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
    
    return {
      isOverdue,
      isAtRisk,
      expectedProgress,
      progressDelta: task.progress - expectedProgress
    }
  }, [task, task.startDate, task.endDate, task.progress])
  
  const getStatusColor = (status: string) => {
    const colors = {
      TODO: '#64748b',      // slate-500
      IN_PROGRESS: '#2563eb', // blue-600
      DONE: '#059669',       // emerald-600
      CANCELLED: '#dc2626',  // red-600
      BLOCKED: '#7c2d12'     // amber-800
    }
    return colors[status as keyof typeof colors] || colors.TODO
  }

  const getProgressColor = () => {
    if (task.status === 'DONE') return '#10b981' // emerald-500
    if (task.status === 'CANCELLED') return '#ef4444' // red-500
    if (taskMetrics.isOverdue) return '#dc2626' // red-600
    if (taskMetrics.isAtRisk) return '#f59e0b' // amber-500
    if (taskMetrics.progressDelta > 10) return '#10b981' // ahead - emerald-500
    return '#3b82f6' // on track - blue-500
  }

  const barColor = task.color || getStatusColor(task.status)
  const progressColor = getProgressColor()
  
  return (
    <g onClick={() => onClick(task)} className="cursor-pointer">
      {/* Critical path highlight */}
      {isCriticalPath && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="4,2"
          rx={5}
          ry={5}
          opacity={0.7}
        />
      )}
      
      {/* Main task bar background */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={barColor}
        opacity={0.3}
        stroke={isSelected ? '#1f2937' : 'transparent'}
        strokeWidth={isSelected ? 2 : 0}
        rx={3}
        ry={3}
        className="transition-all duration-200"
      />
      
      {/* Expected progress indicator (lighter background) */}
      {task.status !== 'DONE' && task.status !== 'CANCELLED' && (
        <rect
          x={x}
          y={y}
          width={(width * taskMetrics.expectedProgress) / 100}
          height={height}
          fill={barColor}
          opacity={0.5}
          rx={3}
          ry={3}
        />
      )}
      
      {/* Actual progress bar */}
      <rect
        x={x}
        y={y}
        width={progressWidth}
        height={height}
        fill={progressColor}
        opacity={0.9}
        rx={3}
        ry={3}
        className="transition-all duration-300"
      />
      
      {/* Progress gradient overlay */}
      <defs>
        <linearGradient id={`progress-gradient-${task.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={progressColor} stopOpacity="1" />
          <stop offset="100%" stopColor={progressColor} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={progressWidth}
        height={height}
        fill={`url(#progress-gradient-${task.id})`}
        rx={3}
        ry={3}
      />
      
      {/* Progress text */}
      {width > 60 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-white font-semibold pointer-events-none"
          style={{ 
            textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))'
          }}
        >
          {task.progress}%
        </text>
      )}
      
      {/* Task title with status indicators */}
      {width > 100 && showDetails && (
        <g>
          <text
            x={x + 8}
            y={y - 6}
            className="text-xs fill-gray-800 font-medium pointer-events-none"
          >
            {task.title.length > 18 ? task.title.substring(0, 15) + '...' : task.title}
          </text>
          
          {/* Status indicators */}
          <g>
            {taskMetrics.isOverdue && (
              <g>
                <circle
                  cx={x + width - 8}
                  cy={y - 6}
                  r={3}
                  fill="#dc2626"
                />
                <title>Overdue</title>
              </g>
            )}
            {!taskMetrics.isOverdue && taskMetrics.isAtRisk && (
              <g>
                <circle
                  cx={x + width - 8}
                  cy={y - 6}
                  r={3}
                  fill="#f59e0b"
                />
                <title>At Risk</title>
              </g>
            )}
            {taskMetrics.progressDelta > 10 && !taskMetrics.isOverdue && (
              <g>
                <circle
                  cx={x + width - 8}
                  cy={y - 6}
                  r={3}
                  fill="#10b981"
                />
                <title>Ahead of Schedule</title>
              </g>
            )}
          </g>
        </g>
      )}
      
      {/* Progress delta indicator */}
      {showDetails && Math.abs(taskMetrics.progressDelta) > 5 && width > 80 && (
        <text
          x={x + width - 4}
          y={y + height - 4}
          textAnchor="end"
          className="text-xs font-medium pointer-events-none"
          fill={taskMetrics.progressDelta > 0 ? '#10b981' : '#ef4444'}
        >
          {taskMetrics.progressDelta > 0 ? '+' : ''}{Math.round(taskMetrics.progressDelta)}%
        </text>
      )}
      
      {/* Milestone indicator */}
      {task.priority === 'HIGH' && (
        <polygon
          points={`${x + width - 6},${y} ${x + width},${y + height/2} ${x + width - 6},${y + height} ${x + width - 12},${y + height/2}`}
          fill="#fbbf24"
          stroke="#d97706"
          strokeWidth={1}
          className="drop-shadow-sm"
        />
      )}
      
      {/* Hover effects */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        className="hover:fill-black hover:fill-opacity-5 transition-all duration-200"
        rx={3}
        ry={3}
      />
    </g>
  )
})

EnhancedGanttBar.displayName = 'EnhancedGanttBar'