'use client'

import React, { useMemo } from 'react'
import { GanttTask } from '@/types/gantt'
import { GanttConfig, GanttViewport } from '@/stores/gantt.store'
import { SchedulingResult, CriticalPathSegment } from '@/types/scheduling'

interface VisualizationLayerProps {
  tasks: GanttTask[]
  config: GanttConfig
  viewport: GanttViewport
  schedulingResult?: SchedulingResult
  width: number
  height: number
  className?: string
}

interface CriticalPathVisualization {
  x: number
  y: number
  width: number
  taskId: string
}

interface SlackVisualization {
  x: number
  y: number
  width: number
  slackDays: number
  taskId: string
}

export const VisualizationLayer: React.FC<VisualizationLayerProps> = ({
  tasks,
  config,
  viewport,
  schedulingResult,
  width,
  height,
  className = ''
}) => {
  // Critical path visualization calculations
  const criticalPathElements = useMemo((): CriticalPathVisualization[] => {
    if (!schedulingResult?.criticalPath) return []

    return schedulingResult.criticalPath
      .map((segment: CriticalPathSegment) => {
        const task = tasks.find(t => t.id === segment.taskId)
        if (!task?.startDate || !task?.endDate) return null

        const startX = viewport.getDatePosition(new Date(task.startDate))
        const endX = viewport.getDatePosition(new Date(task.endDate))
        const taskIndex = tasks.findIndex(t => t.id === task.id)
        
        return {
          x: startX,
          y: taskIndex * viewport.rowHeight + viewport.rowHeight / 4,
          width: endX - startX,
          taskId: task.id
        }
      })
      .filter((element): element is CriticalPathVisualization => element !== null)
  }, [tasks, schedulingResult?.criticalPath, viewport])

  // Slack visualization calculations
  const slackElements = useMemo((): SlackVisualization[] => {
    if (!schedulingResult?.taskSlacks) return []

    return Array.from(schedulingResult.taskSlacks.entries())
      .map(([taskId, slackInfo]) => {
        const task = tasks.find(t => t.id === taskId)
        if (!task?.startDate || !task?.endDate || slackInfo.totalSlack === 0) return null

        const endX = viewport.getDatePosition(new Date(task.endDate))
        const slackEndX = viewport.getDatePosition(
          new Date(new Date(task.endDate).getTime() + slackInfo.totalSlack * 60 * 60 * 1000)
        )
        const taskIndex = tasks.findIndex(t => t.id === task.id)
        
        return {
          x: endX,
          y: taskIndex * viewport.rowHeight + viewport.rowHeight / 4,
          width: slackEndX - endX,
          slackDays: slackInfo.totalSlack / 24, // Convert hours to days
          taskId: task.id
        }
      })
      .filter((element): element is SlackVisualization => element !== null)
  }, [tasks, schedulingResult?.taskSlacks, viewport])

  // Dependency arrows calculations
  const dependencyArrows = useMemo(() => {
    if (!schedulingResult?.dependencies) return []

    return schedulingResult.dependencies
      .map((dep) => {
        const fromTask = tasks.find(t => t.id === dep.fromTaskId)
        const toTask = tasks.find(t => t.id === dep.toTaskId)
        
        if (!fromTask?.endDate || !toTask?.startDate) return null

        const fromX = viewport.getDatePosition(new Date(fromTask.endDate))
        const toX = viewport.getDatePosition(new Date(toTask.startDate))
        const fromIndex = tasks.findIndex(t => t.id === fromTask.id)
        const toIndex = tasks.findIndex(t => t.id === toTask.id)
        const fromY = fromIndex * viewport.rowHeight + viewport.rowHeight / 2
        const toY = toIndex * viewport.rowHeight + viewport.rowHeight / 2

        return {
          fromX,
          fromY,
          toX,
          toY,
          type: dep.type,
          isCritical: schedulingResult.criticalPath?.some(cp => 
            cp.taskId === dep.fromTaskId || cp.taskId === dep.toTaskId
          ) || false
        }
      })
      .filter(arrow => arrow !== null)
  }, [tasks, schedulingResult?.dependencies, schedulingResult?.criticalPath, viewport])

  if (!schedulingResult) {
    return null
  }

  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width, height }}
    >
      <svg width={width} height={height} className="absolute inset-0">
        <defs>
          <pattern
            id="slackPattern"
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
          >
            <rect width="8" height="8" fill="#10b981" fillOpacity="0.1"/>
            <path d="M0,8 L8,0 M-2,2 L2,-2 M6,10 L10,6" stroke="#10b981" strokeWidth="1" strokeOpacity="0.3"/>
          </pattern>
          
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280"/>
          </marker>

          <marker
            id="criticalArrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444"/>
          </marker>
        </defs>

        {/* Critical Path Highlight */}
        {criticalPathElements.map((element, index) => (
          <g key={`critical-${element.taskId}-${index}`}>
            {/* Critical path background highlight */}
            <rect
              x={element.x}
              y={element.y - 2}
              width={element.width}
              height={viewport.rowHeight / 2 + 4}
              fill="rgba(239, 68, 68, 0.1)"
              rx="3"
            />
            {/* Critical path border */}
            <rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={viewport.rowHeight / 2}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              rx="3"
            />
            {/* Critical path indicator badge */}
            <g transform={`translate(${element.x + element.width - 20}, ${element.y - 8})`}>
              <rect
                x="0"
                y="0"
                width="16"
                height="12"
                fill="#ef4444"
                rx="2"
              />
              <text
                x="8"
                y="8"
                textAnchor="middle"
                className="text-xs fill-white font-medium"
                dominantBaseline="middle"
              >
                C
              </text>
            </g>
          </g>
        ))}

        {/* Slack Visualization */}
        {slackElements.map((element, index) => (
          <g key={`slack-${element.taskId}-${index}`}>
            {/* Slack zone */}
            <rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={viewport.rowHeight / 2}
              fill="url(#slackPattern)"
              stroke="#10b981"
              strokeWidth="1"
              strokeDasharray="4,2"
              rx="2"
            />
            {/* Slack days label */}
            {element.width > 30 && (
              <text
                x={element.x + element.width / 2}
                y={element.y + viewport.rowHeight / 4}
                textAnchor="middle"
                className="text-xs fill-green-700 font-medium"
                dominantBaseline="middle"
              >
                {element.slackDays}d
              </text>
            )}
          </g>
        ))}

        {/* Dependency Arrows */}
        {dependencyArrows.map((arrow, index) => {
          const isCritical = arrow.isCritical
          const strokeColor = isCritical ? '#ef4444' : '#6b7280'
          const markerEnd = isCritical ? 'url(#criticalArrowhead)' : 'url(#arrowhead)'
          
          return (
            <g key={`dependency-${index}`}>
              <line
                x1={arrow.fromX}
                y1={arrow.fromY}
                x2={arrow.toX}
                y2={arrow.toY}
                stroke={strokeColor}
                strokeWidth={isCritical ? "2" : "1"}
                markerEnd={markerEnd}
                strokeDasharray={arrow.type === 'SS' || arrow.type === 'SF' ? "4,2" : "none"}
              />
              
              {/* Dependency type label */}
              {arrow.type !== 'FS' && (
                <g transform={`translate(${(arrow.fromX + arrow.toX) / 2}, ${(arrow.fromY + arrow.toY) / 2})`}>
                  <rect
                    x="-8"
                    y="-6"
                    width="16"
                    height="12"
                    fill="white"
                    stroke={strokeColor}
                    strokeWidth="1"
                    rx="2"
                  />
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    className="text-xs font-medium"
                    dominantBaseline="middle"
                    fill={strokeColor}
                  >
                    {arrow.type}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Performance Metrics Overlay */}
        {schedulingResult.performanceMetrics && (
          <g transform={`translate(${width - 200}, 10)`}>
            <rect
              x="0"
              y="0"
              width="180"
              height="60"
              fill="rgba(255, 255, 255, 0.95)"
              stroke="#e5e7eb"
              strokeWidth="1"
              rx="4"
            />
            <text
              x="8"
              y="16"
              className="text-xs font-medium fill-gray-700"
            >
              Scheduling Metrics
            </text>
            <text
              x="8"
              y="30"
              className="text-xs fill-gray-600"
            >
              Duration: {Math.ceil((schedulingResult.criticalPath as any).totalDuration / 24)}h
            </text>
            <text
              x="8"
              y="42"
              className="text-xs fill-gray-600"
            >
              Critical Path: {schedulingResult.criticalPath?.length || 0} tasks
            </text>
            <text
              x="8"
              y="54"
              className="text-xs fill-gray-600"
            >
              Calculated: {new Date(schedulingResult.calculatedAt).toLocaleTimeString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

export default VisualizationLayer