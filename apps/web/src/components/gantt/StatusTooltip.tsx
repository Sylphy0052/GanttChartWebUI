'use client'

import React, { useState, useRef, useEffect } from 'react'
import { GanttTask } from '@/types/gantt'

interface StatusTooltipProps {
  task: GanttTask
  isVisible: boolean
  x: number
  y: number
  className?: string
}

interface TaskStatus {
  isOverdue: boolean
  isBlocked: boolean
  isAtRisk: boolean
  overdueDays: number
  blockageReason: string
  expectedProgress: number
  progressDelta: number
}

/**
 * T020 AC2 & AC5: Status Tooltip Component
 * 
 * Provides detailed status information about tasks with hover tooltips
 * explaining blockage, overdue status, and other task conditions
 */
export const StatusTooltip: React.FC<StatusTooltipProps> = ({
  task,
  isVisible,
  x,
  y,
  className = ''
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y })

  // T020 AC5: Calculate comprehensive task status
  const taskStatus: TaskStatus = React.useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const taskEndDate = new Date(task.endDate)
    taskEndDate.setHours(23, 59, 59, 999)
    
    const taskStartDate = new Date(task.startDate)
    taskStartDate.setHours(0, 0, 0, 0)
    
    const isOverdue = taskEndDate < today && task.progress < 100
    const isAtRisk = taskEndDate > today && task.progress < 50 && 
      (taskEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 7
    
    // T020 AC2: Enhanced blocked status detection
    const isBlocked = task.status === 'TODO' && task.startDate < today && task.progress === 0
    
    const totalDays = Math.ceil((taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.max(0, Math.ceil((today.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)))
    const expectedProgress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0
    
    const overdueDays = isOverdue ? Math.ceil((today.getTime() - taskEndDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
    
    // T020 AC2: Determine blockage reason
    let blockageReason = ''
    if (isBlocked) {
      if (task.dependencies && task.dependencies.length > 0) {
        blockageReason = 'Waiting for dependencies to complete'
      } else if (task.assigneeId && !task.assigneeName) {
        blockageReason = 'Assignee not available'
      } else if (task.startDate < today && task.progress === 0) {
        blockageReason = 'Task not started despite due date'
      } else {
        blockageReason = 'Task is blocked for unknown reasons'
      }
    }
    
    return {
      isOverdue,
      isBlocked,
      isAtRisk,
      overdueDays,
      blockageReason,
      expectedProgress,
      progressDelta: task.progress - expectedProgress
    }
  }, [task])

  // Adjust tooltip position to keep it on screen
  useEffect(() => {
    if (!isVisible || !tooltipRef.current) return

    const tooltip = tooltipRef.current
    const rect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let adjustedX = x
    let adjustedY = y
    
    // Adjust horizontal position if tooltip goes off screen
    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10
    }
    if (adjustedX < 10) {
      adjustedX = 10
    }
    
    // Adjust vertical position if tooltip goes off screen
    if (y + rect.height > viewportHeight) {
      adjustedY = y - rect.height - 10
    }
    if (adjustedY < 10) {
      adjustedY = 10
    }
    
    setAdjustedPosition({ x: adjustedX, y: adjustedY })
  }, [x, y, isVisible])

  if (!isVisible) return null

  return (
    <div
      ref={tooltipRef}
      className={`fixed z-50 pointer-events-none ${className}`}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div className="bg-gray-900 text-white rounded-lg shadow-xl p-4 max-w-sm border border-gray-700">
        {/* Task header */}
        <div className="border-b border-gray-600 pb-2 mb-3">
          <h3 className="font-semibold text-sm text-white">{task.title}</h3>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              task.status === 'TODO' ? 'bg-gray-100 text-gray-800' :
              task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
              task.status === 'DONE' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {task.status.replace('_', ' ')}
            </span>
            {task.priority && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                task.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {task.priority}
              </span>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="space-y-2">
          {/* T020 AC2: Blocked status with explanation */}
          {taskStatus.isBlocked && (
            <div className="flex items-start space-x-2 p-2 bg-amber-900 bg-opacity-50 rounded-md">
              <div className="flex-shrink-0 text-amber-400 text-sm font-bold">🚫</div>
              <div>
                <div className="text-amber-400 font-medium text-xs">Task Blocked</div>
                <div className="text-amber-300 text-xs mt-1">{taskStatus.blockageReason}</div>
              </div>
            </div>
          )}

          {/* T020 AC1: Overdue status */}
          {taskStatus.isOverdue && (
            <div className="flex items-start space-x-2 p-2 bg-red-900 bg-opacity-50 rounded-md">
              <div className="flex-shrink-0 text-red-400 text-sm font-bold">⚠️</div>
              <div>
                <div className="text-red-400 font-medium text-xs">Overdue Task</div>
                <div className="text-red-300 text-xs mt-1">
                  {taskStatus.overdueDays} day{taskStatus.overdueDays !== 1 ? 's' : ''} past due date
                </div>
              </div>
            </div>
          )}

          {/* At risk status */}
          {taskStatus.isAtRisk && !taskStatus.isOverdue && (
            <div className="flex items-start space-x-2 p-2 bg-orange-900 bg-opacity-50 rounded-md">
              <div className="flex-shrink-0 text-orange-400 text-sm font-bold">⚡</div>
              <div>
                <div className="text-orange-400 font-medium text-xs">At Risk</div>
                <div className="text-orange-300 text-xs mt-1">Low progress with approaching deadline</div>
              </div>
            </div>
          )}
        </div>

        {/* Task details */}
        <div className="border-t border-gray-600 pt-3 mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Start:</span>
              <div className="text-white">{task.startDate.toLocaleDateString()}</div>
            </div>
            <div>
              <span className="text-gray-400">End:</span>
              <div className="text-white">{task.endDate.toLocaleDateString()}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Progress:</span>
              <div className="text-white">{task.progress}%</div>
            </div>
            <div>
              <span className="text-gray-400">Expected:</span>
              <div className={`${taskStatus.progressDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Math.round(taskStatus.expectedProgress)}%
              </div>
            </div>
          </div>

          {task.assigneeName && (
            <div className="text-xs">
              <span className="text-gray-400">Assigned to:</span>
              <div className="text-white">{task.assigneeName}</div>
            </div>
          )}

          {task.dependencies && task.dependencies.length > 0 && (
            <div className="text-xs">
              <span className="text-gray-400">Dependencies:</span>
              <div className="text-white">{task.dependencies.length} task{task.dependencies.length !== 1 ? 's' : ''}</div>
            </div>
          )}

          {task.estimatedHours && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Estimated:</span>
                <div className="text-white">{task.estimatedHours}h</div>
              </div>
              {task.actualHours && (
                <div>
                  <span className="text-gray-400">Actual:</span>
                  <div className="text-white">{task.actualHours}h</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Performance indicator */}
        {taskStatus.progressDelta !== 0 && (
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className={`text-xs flex items-center space-x-2 ${
              taskStatus.progressDelta > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              <span>{taskStatus.progressDelta > 0 ? '📈' : '📉'}</span>
              <span>
                {taskStatus.progressDelta > 0 ? 'Ahead of schedule' : 'Behind schedule'} 
                ({taskStatus.progressDelta > 0 ? '+' : ''}{Math.round(taskStatus.progressDelta)}%)
              </span>
            </div>
          </div>
        )}

        {/* Tooltip arrow */}
        <div className="absolute -bottom-1 left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  )
}

export default StatusTooltip