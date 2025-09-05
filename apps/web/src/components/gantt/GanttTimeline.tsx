'use client'

import React, { memo, useMemo } from 'react'
import { GanttTimelineConfig, GanttViewport } from '@/types/gantt'
import { format } from 'date-fns'

interface GanttTimelineProps {
  config: GanttTimelineConfig
  viewport: GanttViewport
  className?: string
  'data-testid'?: string
}

interface TimelineSegment {
  date: Date
  label: string
  x: number
  width: number
  isWeekend?: boolean
  isToday?: boolean
}

export const GanttTimeline = memo<GanttTimelineProps>(({ config, viewport, className = '', 'data-testid': dataTestId }) => {
  const timelineSegments = useMemo((): TimelineSegment[] => {
    const segments: TimelineSegment[] = []
    const { timeScale } = viewport
    const { scale } = config
    
    const startDate = new Date(config.startDate)
    const endDate = new Date(config.endDate)
    const today = new Date()
    
    // Generate timeline segments based on scale
    let currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate)
      
      // Calculate next segment based on scale
      switch (scale) {
        case 'day':
          nextDate.setDate(nextDate.getDate() + 1)
          break
        case 'week':
          nextDate.setDate(nextDate.getDate() + 7)
          break
        case 'month':
          nextDate.setMonth(nextDate.getMonth() + 1)
          break
        case 'quarter':
          nextDate.setMonth(nextDate.getMonth() + 3)
          break
      }
      
      const x = timeScale(currentDate) || 0
      const nextX = timeScale(Math.min(nextDate.getTime(), endDate.getTime())) || viewport.width
      const width = nextX - x
      
      if (width > 0) {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6
        const isToday = currentDate.toDateString() === today.toDateString()
        
        let label = ''
        switch (scale) {
          case 'day':
            label = format(currentDate, 'dd')
            break
          case 'week':
            label = format(currentDate, 'MM/dd')
            break
          case 'month':
            label = format(currentDate, 'MMM yyyy')
            break
          case 'quarter':
            label = format(currentDate, 'QQQ yyyy')
            break
        }
        
        segments.push({
          date: new Date(currentDate),
          label,
          x,
          width,
          isWeekend,
          isToday
        })
      }
      
      currentDate = nextDate
    }
    
    return segments
  }, [config, viewport])
  
  // Generate month headers for day/week scales
  const monthHeaders = useMemo(() => {
    if (config.scale === 'month' || config.scale === 'quarter') return []
    
    const headers: { date: Date; label: string; x: number; width: number }[] = []
    const { timeScale } = viewport
    
    let currentMonth = new Date(config.startDate.getFullYear(), config.startDate.getMonth(), 1)
    const endDate = config.endDate
    
    while (currentMonth <= endDate) {
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      const monthEnd = new Date(Math.min(nextMonth.getTime() - 1, endDate.getTime()))
      
      const x = timeScale(currentMonth) || 0
      const endX = timeScale(monthEnd) || viewport.width
      const width = endX - x
      
      if (width > 30) { // Only show if wide enough
        headers.push({
          date: new Date(currentMonth),
          label: format(currentMonth, 'MMMM yyyy'),
          x,
          width
        })
      }
      
      currentMonth = nextMonth
    }
    
    return headers
  }, [config, viewport])
  
  return (
    <div className={`gantt-timeline border-b border-gray-200 ${className}`} data-testid={dataTestId}>
      {/* Month headers */}
      {monthHeaders.length > 0 && (
        <div className="relative h-8 bg-gray-50 border-b border-gray-200">
          {monthHeaders.map((header, index) => (
            <div
              key={index}
              className="absolute top-0 px-2 py-1 text-sm font-medium text-gray-700 border-r border-gray-200"
              style={{
                left: header.x,
                width: header.width
              }}
            >
              {header.label}
            </div>
          ))}
        </div>
      )}
      
      {/* Timeline segments */}
      <div className="relative h-12 bg-white">
        {timelineSegments.map((segment, index) => (
          <div
            key={index}
            className={`
              absolute top-0 h-full border-r border-gray-200 flex items-center justify-center text-xs
              ${segment.isWeekend ? 'bg-gray-50' : 'bg-white'}
              ${segment.isToday ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600'}
            `}
            style={{
              left: segment.x,
              width: segment.width
            }}
          >
            {segment.width > 20 && segment.label}
          </div>
        ))}
        
        {/* Today indicator line */}
        {(() => {
          const today = new Date()
          const todayX = viewport.timeScale(today)
          if (todayX && todayX >= 0 && todayX <= viewport.width) {
            return (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ left: todayX }}
              />
            )
          }
          return null
        })()}
      </div>
      
      {/* Scale indicator */}
      <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-500 bg-white border-l border-b border-gray-200 rounded-bl">
        {config.scale.charAt(0).toUpperCase() + config.scale.slice(1)} View
      </div>
    </div>
  )
})

GanttTimeline.displayName = 'GanttTimeline'