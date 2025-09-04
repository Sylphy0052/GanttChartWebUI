'use client'

import React, { memo, useMemo } from 'react'
import { GanttTask, GanttViewport, GanttTimelineConfig } from '@/types/gantt'
import { CriticalPathAnalyzer } from '@/lib/critical-path'

interface CriticalPathOverlayProps {
  tasks: GanttTask[]
  viewport: GanttViewport
  config: GanttTimelineConfig
  showCriticalPath: boolean
  showFloatBars: boolean
  onTaskHighlight?: (taskId: string | null) => void
}

export const CriticalPathOverlay = memo<CriticalPathOverlayProps>(({
  tasks,
  viewport,
  config,
  showCriticalPath,
  showFloatBars,
  onTaskHighlight
}) => {
  const criticalPathData = useMemo(() => {
    if (!showCriticalPath && !showFloatBars) return null
    return CriticalPathAnalyzer.getCriticalPathVisualization(tasks)
  }, [tasks, showCriticalPath, showFloatBars])

  const taskAnalysis = useMemo(() => {
    if (!showFloatBars) return []
    return CriticalPathAnalyzer.getTaskAnalysis(tasks)
  }, [tasks, showFloatBars])

  if (!criticalPathData || (!showCriticalPath && !showFloatBars)) {
    return null
  }

  return (
    <g className="critical-path-overlay">
      {/* Critical path connections */}
      {showCriticalPath && (
        <g className="critical-path-lines">
          {criticalPathData.criticalTasks.map((taskId, index) => {
            if (index === criticalPathData.criticalTasks.length - 1) return null
            
            const currentTask = tasks.find(t => t.id === taskId)
            const nextTaskId = criticalPathData.criticalTasks[index + 1]
            const nextTask = tasks.find(t => t.id === nextTaskId)
            
            if (!currentTask || !nextTask) return null
            
            const currentTaskIndex = tasks.findIndex(t => t.id === taskId)
            const nextTaskIndex = tasks.findIndex(t => t.id === nextTaskId)
            
            const fromX = viewport.timeScale(currentTask.endDate) || 0
            const fromY = currentTaskIndex * viewport.rowHeight + viewport.rowHeight / 2
            const toX = viewport.timeScale(nextTask.startDate) || 0
            const toY = nextTaskIndex * viewport.rowHeight + viewport.rowHeight / 2
            
            return (
              <g key={`critical-connection-${taskId}-${nextTaskId}`}>
                {/* Critical path line */}
                <path
                  d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
                  stroke="#dc2626"
                  strokeWidth={3}
                  strokeOpacity={0.8}
                  strokeDasharray="8,4"
                  markerEnd="url(#critical-arrow)"
                />
                
                {/* Connection label */}
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2 - 8}
                  textAnchor="middle"
                  className="text-xs font-semibold fill-red-600"
                  opacity={0.8}
                >
                  Critical
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* Float visualization bars */}
      {showFloatBars && (
        <g className="float-bars">
          {taskAnalysis.map(analysis => {
            const taskIndex = tasks.findIndex(t => t.id === analysis.task.id)
            if (taskIndex === -1 || analysis.totalFloat === 0) return null
            
            const taskStartX = viewport.timeScale(analysis.task.startDate) || 0
            const taskEndX = viewport.timeScale(analysis.task.endDate) || 0
            const floatEndX = viewport.timeScale(analysis.latestFinish) || taskEndX
            const floatWidth = floatEndX - taskEndX
            
            if (floatWidth <= 0) return null
            
            const y = taskIndex * viewport.rowHeight + viewport.rowHeight - 8
            const floatPercentage = Math.min(100, (analysis.totalFloat / 10) * 100)
            
            return (
              <g
                key={`float-${analysis.task.id}`}
                onMouseEnter={() => onTaskHighlight?.(analysis.task.id)}
                onMouseLeave={() => onTaskHighlight?.(null)}
              >
                {/* Float bar background */}
                <rect
                  x={taskEndX}
                  y={y}
                  width={floatWidth}
                  height={4}
                  fill="#f3f4f6"
                  stroke="#d1d5db"
                  strokeWidth={0.5}
                  rx={2}
                  opacity={0.8}
                />
                
                {/* Float bar fill */}
                <rect
                  x={taskEndX}
                  y={y}
                  width={floatWidth * (floatPercentage / 100)}
                  height={4}
                  fill={analysis.totalFloat <= 2 ? '#f59e0b' : '#10b981'}
                  rx={2}
                  opacity={0.9}
                />
                
                {/* Float label */}
                {floatWidth > 30 && (
                  <text
                    x={taskEndX + floatWidth / 2}
                    y={y - 2}
                    textAnchor="middle"
                    className="text-xs font-medium"
                    fill={analysis.totalFloat <= 2 ? '#d97706' : '#059669'}
                  >
                    {analysis.totalFloat}d
                  </text>
                )}
              </g>
            )
          })}
        </g>
      )}

      {/* At-risk task indicators */}
      {showCriticalPath && (
        <g className="at-risk-indicators">
          {criticalPathData.atRiskTasks.map(taskId => {
            const task = tasks.find(t => t.id === taskId)
            const taskIndex = tasks.findIndex(t => t.id === taskId)
            
            if (!task || taskIndex === -1) return null
            
            const x = viewport.timeScale(task.endDate) || 0
            const y = taskIndex * viewport.rowHeight + viewport.rowHeight / 2
            
            return (
              <g
                key={`at-risk-${taskId}`}
                onMouseEnter={() => onTaskHighlight?.(taskId)}
                onMouseLeave={() => onTaskHighlight?.(null)}
              >
                {/* Warning indicator */}
                <circle
                  cx={x + 8}
                  cy={y - 8}
                  r={6}
                  fill="#fbbf24"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  className="animate-pulse"
                />
                <text
                  x={x + 8}
                  y={y - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-bold fill-white"
                >
                  !
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* Critical path highlights */}
      {showCriticalPath && (
        <g className="critical-task-highlights">
          {criticalPathData.criticalTasks.map(taskId => {
            const taskIndex = tasks.findIndex(t => t.id === taskId)
            if (taskIndex === -1) return null
            
            const task = tasks[taskIndex]
            const startX = viewport.timeScale(task.startDate) || 0
            const endX = viewport.timeScale(task.endDate) || 0
            const width = endX - startX
            const y = taskIndex * viewport.rowHeight
            
            return (
              <rect
                key={`critical-highlight-${taskId}`}
                x={startX - 2}
                y={y - 2}
                width={width + 4}
                height={viewport.rowHeight + 4}
                fill="none"
                stroke="#dc2626"
                strokeWidth={2}
                strokeOpacity={0.6}
                strokeDasharray="4,2"
                rx={4}
                className="animate-pulse"
                onMouseEnter={() => onTaskHighlight?.(taskId)}
                onMouseLeave={() => onTaskHighlight?.(null)}
              />
            )
          })}
        </g>
      )}

      {/* Arrow marker definition */}
      <defs>
        <marker
          id="critical-arrow"
          viewBox="0 -5 10 10"
          refX="10"
          refY="0"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,-5L10,0L0,5"
            fill="#dc2626"
            opacity={0.8}
          />
        </marker>
      </defs>
    </g>
  )
})

CriticalPathOverlay.displayName = 'CriticalPathOverlay'