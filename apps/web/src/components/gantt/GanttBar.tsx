'use client'

import React, { memo, useMemo } from 'react'
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
  'data-testid'?: string
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
  'data-testid': dataTestId
}) => {
  
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

  const progressWidth = (width * task.progress) / 100
  
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

  const barColor = getBarColor()
  const progressColor = getProgressColor()
  const isCritical = schedulingInfo?.isCriticalPath
  const hasSlack = schedulingInfo?.slackDays && schedulingInfo.slackDays > 0
  
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
      </g>
    )
  }
  
  return (
    <g 
      onClick={() => onClick(task)} 
      className="cursor-pointer task-bar gantt-task"
      data-testid={dataTestId || "task-bar"}
    >
      {/* Missing dates indicator */}
      {!hasDates && (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke="#D1D5DB"
            strokeWidth={1}
            strokeDasharray="4,4"
            rx={3}
            ry={3}
            opacity={0.7}
          />
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-gray-400 font-medium pointer-events-none"
          >
            No dates
          </text>
          <title>Task has no specific dates assigned</title>
        </g>
      )}

      {/* Main task bar background */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={barColor}
        opacity={hasDates ? 0.3 : 0.1}
        stroke={isSelected ? '#1F2937' : (isCritical ? '#DC2626' : 'transparent')}
        strokeWidth={isSelected ? 3 : (isCritical ? 2 : 0)}
        rx={3}
        ry={3}
        className="transition-all duration-200 hover:opacity-70"
      />
      
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
      
      {/* Actual progress bar */}
      {task.progress > 0 && hasDates && (
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
            className="transition-all duration-300"
          />
          
          {/* Progress gradient overlay for depth */}
          <defs>
            <linearGradient id={`progress-gradient-${task.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="50%" stopColor="white" stopOpacity="0.1" />
              <stop offset="100%" stopColor="black" stopOpacity="0.1" />
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
        </>
      )}
      
      {/* Critical path indicator bar */}
      {isCritical && (
        <rect
          x={x}
          y={y - 3}
          width={width}
          height={2}
          fill="#DC2626"
          rx={1}
          opacity={0.8}
        />
      )}
      
      {/* Progress percentage text */}
      {width > 50 && task.progress > 0 && hasDates && (
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
          {task.progress}%
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
          
          {/* Status indicators */}
          <g>
            {/* Overdue indicator */}
            {taskMetrics.isOverdue && (
              <g>
                <circle
                  cx={x + width - 8}
                  cy={y - 6}
                  r={4}
                  fill="#DC2626"
                  className="animate-pulse"
                />
                <text
                  x={x + width - 8}
                  y={y - 4}
                  textAnchor="middle"
                  className="text-xs fill-white font-bold pointer-events-none"
                  dominantBaseline="middle"
                >
                  !
                </text>
                <title>Task is overdue</title>
              </g>
            )}
            
            {/* At risk indicator */}
            {!taskMetrics.isOverdue && taskMetrics.isAtRisk && (
              <g>
                <circle
                  cx={x + width - 8}
                  cy={y - 6}
                  r={4}
                  fill="#F59E0B"
                />
                <text
                  x={x + width - 8}
                  y={y - 4}
                  textAnchor="middle"
                  className="text-xs fill-white font-bold pointer-events-none"
                  dominantBaseline="middle"
                >
                  ⚠
                </text>
                <title>Task is at risk</title>
              </g>
            )}
            
            {/* Ahead of schedule indicator */}
            {taskMetrics.progressDelta > 15 && !taskMetrics.isOverdue && (
              <g>
                <circle
                  cx={x + width - 8}
                  cy={y - 6}
                  r={4}
                  fill="#10B981"
                />
                <text
                  x={x + width - 8}
                  y={y - 4}
                  textAnchor="middle"
                  className="text-xs fill-white font-bold pointer-events-none"
                  dominantBaseline="middle"
                >
                  ✓
                </text>
                <title>Task is ahead of schedule</title>
              </g>
            )}
          </g>
        </g>
      )}
      
      {/* Duration and dates display */}
      {width > 120 && hasDates && (
        <text
          x={x + 6}
          y={y + height + 12}
          className="text-xs fill-gray-500 font-normal pointer-events-none"
        >
          {task.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      )}

      {/* Progress delta indicator */}
      {Math.abs(taskMetrics.progressDelta) > 10 && width > 100 && hasDates && (
        <text
          x={x + width - 4}
          y={y + height - 2}
          textAnchor="end"
          className="text-xs font-medium pointer-events-none"
          fill={taskMetrics.progressDelta > 0 ? '#10B981' : '#EF4444'}
        >
          {taskMetrics.progressDelta > 0 ? '+' : ''}{Math.round(taskMetrics.progressDelta)}%
        </text>
      )}

      {/* Slack time indicator */}
      {hasSlack && width > 60 && hasDates && (
        <g>
          <rect
            x={x + width + 4}
            y={y + height / 3}
            width={Math.min(schedulingInfo.slackDays! * 3, 24)} // Scale slack visually
            height={height / 3}
            fill="#10B981"
            fillOpacity={0.2}
            stroke="#10B981"
            strokeWidth={1}
            strokeDasharray="2,2"
            rx={2}
          />
          <text
            x={x + width + 8}
            y={y + height / 2}
            className="text-xs fill-green-700 font-medium pointer-events-none"
            dominantBaseline="middle"
          >
            {schedulingInfo.slackDays}d
          </text>
          <title>{schedulingInfo.slackDays} days of slack time</title>
        </g>
      )}

      {/* Critical path badge */}
      {isCritical && width > 70 && (
        <g>
          <rect
            x={x + width - 20}
            y={y - 10}
            width={16}
            height={12}
            fill="#DC2626"
            rx={3}
            ry={3}
          />
          <text
            x={x + width - 12}
            y={y - 4}
            textAnchor="middle"
            className="text-xs fill-white font-bold pointer-events-none"
            dominantBaseline="middle"
          >
            CP
          </text>
          <title>Critical Path Task</title>
        </g>
      )}

      {/* Assignee indicator */}
      {task.assigneeName && width > 100 && (
        <text
          x={x + width - 4}
          y={y + height + 12}
          textAnchor="end"
          className="text-xs fill-gray-500 font-normal pointer-events-none"
        >
          {task.assigneeName.split(' ')[0]} {/* First name only to save space */}
        </text>
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
      />
    </g>
  )
})

GanttBar.displayName = 'GanttBar'