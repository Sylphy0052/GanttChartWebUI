'use client'

import React, { memo } from 'react'
import { GanttMilestone } from '@/types/gantt'

interface MilestoneMarkerProps {
  milestone: GanttMilestone
  x: number
  y: number
  height: number
  onClick?: (milestone: GanttMilestone) => void
  isSelected?: boolean
}

export const MilestoneMarker = memo<MilestoneMarkerProps>(({
  milestone,
  x,
  y,
  height,
  onClick,
  isSelected = false
}) => {
  const getMilestoneIcon = (type: GanttMilestone['type']) => {
    const icons = {
      project_start: '🚀',
      project_end: '🏁',
      phase_completion: '✅',
      delivery: '📦',
      review: '👀',
      custom: '📍'
    }
    return icons[type] || icons.custom
  }

  const getMilestoneColor = () => {
    if (milestone.color) return milestone.color
    
    const colors = {
      CRITICAL: '#dc2626', // red-600
      HIGH: '#f59e0b',     // amber-500
      MEDIUM: '#3b82f6',   // blue-500
      LOW: '#64748b'       // slate-500
    }
    
    const statusColors = {
      PENDING: colors[milestone.priority],
      ACHIEVED: '#10b981', // emerald-500
      MISSED: '#ef4444',   // red-500
      AT_RISK: '#f59e0b'   // amber-500
    }
    
    return statusColors[milestone.status] || colors[milestone.priority]
  }

  const markerColor = getMilestoneColor()
  const markerSize = 12
  const icon = getMilestoneIcon(milestone.type)

  return (
    <g 
      className="cursor-pointer" 
      onClick={() => onClick?.(milestone)}
    >
      {/* Milestone line */}
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + height}
        stroke={markerColor}
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray={milestone.status === 'PENDING' ? '4,2' : 'none'}
        opacity={0.8}
      />
      
      {/* Milestone diamond */}
      <g transform={`translate(${x}, ${y + height / 2})`}>
        <polygon
          points={`0,-${markerSize} ${markerSize},0 0,${markerSize} -${markerSize},0`}
          fill={markerColor}
          stroke={isSelected ? '#1f2937' : '#ffffff'}
          strokeWidth={isSelected ? 2 : 1}
          className="drop-shadow-md transition-all duration-200 hover:scale-110"
        />
        
        {/* Icon overlay */}
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs pointer-events-none"
          fill="white"
          fontWeight="bold"
        >
          {icon}
        </text>
      </g>
      
      {/* Milestone label */}
      <text
        x={x + 16}
        y={y + height / 2}
        className="text-xs font-semibold pointer-events-none"
        fill={markerColor}
        dominantBaseline="middle"
      >
        {milestone.title}
      </text>
      
      {/* Achievement date if milestone is achieved */}
      {milestone.status === 'ACHIEVED' && milestone.achievedDate && (
        <text
          x={x + 16}
          y={y + height / 2 + 12}
          className="text-xs pointer-events-none"
          fill="#10b981"
          dominantBaseline="middle"
        >
          ✓ {milestone.achievedDate.toLocaleDateString()}
        </text>
      )}
      
      {/* Status indicator for missed or at-risk milestones */}
      {(milestone.status === 'MISSED' || milestone.status === 'AT_RISK') && (
        <g transform={`translate(${x + markerSize + 2}, ${y + height / 2 - markerSize})`}>
          <circle
            r={4}
            fill={milestone.status === 'MISSED' ? '#ef4444' : '#f59e0b'}
            className="animate-pulse"
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-bold pointer-events-none"
            fill="white"
          >
            !
          </text>
        </g>
      )}
      
      {/* Selection highlight */}
      {isSelected && (
        <circle
          cx={x}
          cy={y + height / 2}
          r={markerSize + 4}
          fill="none"
          stroke="#1f2937"
          strokeWidth={2}
          strokeDasharray="2,2"
          opacity={0.7}
        />
      )}
    </g>
  )
})

MilestoneMarker.displayName = 'MilestoneMarker'