/**
 * Additional Gantt utilities for date/position calculations
 * Supplements the main GanttUtils class with UI-specific helpers
 */

import { GanttTimeScale, GanttTask, GanttViewport } from '@/types/gantt'

/**
 * Date-to-pixel conversion utilities
 */
export class GanttDateUtils {
  /**
   * Convert a date to pixel position within the viewport
   */
  static dateToPixel(date: Date, viewport: GanttViewport): number {
    return viewport.timeScale(date) || 0
  }

  /**
   * Convert pixel position to date within the viewport
   */
  static pixelToDate(x: number, viewport: GanttViewport): Date {
    return viewport.timeScale.invert(x)
  }

  /**
   * Get pixel width for a duration in the current time scale
   */
  static durationToPixelWidth(
    startDate: Date, 
    endDate: Date, 
    viewport: GanttViewport
  ): number {
    const startX = this.dateToPixel(startDate, viewport)
    const endX = this.dateToPixel(endDate, viewport)
    return Math.max(endX - startX, 2) // Minimum 2px width
  }

  /**
   * Calculate the optimal time range to show all tasks
   */
  static calculateOptimalTimeRange(
    tasks: GanttTask[],
    paddingPercentage: number = 0.1
  ): { startDate: Date; endDate: Date } {
    if (tasks.length === 0) {
      const now = new Date()
      return {
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
      }
    }

    const startDates = tasks.map(task => task.startDate.getTime())
    const endDates = tasks.map(task => task.endDate.getTime())
    
    const minStart = Math.min(...startDates)
    const maxEnd = Math.max(...endDates)
    
    const totalDuration = maxEnd - minStart
    const padding = totalDuration * paddingPercentage
    
    return {
      startDate: new Date(minStart - padding),
      endDate: new Date(maxEnd + padding)
    }
  }

  /**
   * Get the appropriate time scale based on date range
   */
  static getOptimalTimeScale(startDate: Date, endDate: Date, viewportWidth: number): GanttTimeScale {
    const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    const pixelsPerDay = viewportWidth / rangeDays

    // Choose scale based on pixels per day for readability
    if (pixelsPerDay > 50) return 'day'
    if (pixelsPerDay > 15) return 'week' 
    if (pixelsPerDay > 5) return 'month'
    return 'quarter'
  }
}

/**
 * Position calculation utilities for Gantt bars
 */
export class GanttPositionUtils {
  /**
   * Calculate the position and dimensions of a task bar
   */
  static calculateTaskBarPosition(
    task: GanttTask,
    viewport: GanttViewport,
    rowIndex: number
  ): {
    x: number
    y: number
    width: number
    height: number
  } {
    const x = GanttDateUtils.dateToPixel(task.startDate, viewport)
    const y = rowIndex * viewport.rowHeight + (viewport.rowHeight - viewport.taskHeight) / 2
    const width = GanttDateUtils.durationToPixelWidth(task.startDate, task.endDate, viewport)
    const height = viewport.taskHeight

    return { x, y, width, height }
  }

  /**
   * Calculate progress bar width based on task progress
   */
  static calculateProgressWidth(taskWidth: number, progress: number): number {
    return Math.max((taskWidth * progress) / 100, 0)
  }

  /**
   * Check if a task bar is visible within the viewport
   */
  static isTaskVisible(
    task: GanttTask,
    viewport: GanttViewport
  ): boolean {
    const taskStartX = GanttDateUtils.dateToPixel(task.startDate, viewport)
    const taskEndX = GanttDateUtils.dateToPixel(task.endDate, viewport)
    
    // Task is visible if it overlaps with the viewport
    return !(taskEndX < 0 || taskStartX > viewport.width)
  }

  /**
   * Get the Y position for a task row
   */
  static getTaskRowY(rowIndex: number, rowHeight: number): number {
    return rowIndex * rowHeight
  }
}

/**
 * Zoom and scroll calculation utilities
 */
export class GanttZoomUtils {
  /**
   * Calculate zoom level based on date range and viewport
   */
  static calculateZoomLevel(
    dateRange: { start: Date; end: Date },
    viewportWidth: number
  ): number {
    const rangeDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)
    return viewportWidth / rangeDays
  }

  /**
   * Calculate new date range after zoom operation
   */
  static calculateZoomedDateRange(
    currentRange: { start: Date; end: Date },
    zoomFactor: number,
    zoomCenter: { x: number; viewportWidth: number }
  ): { start: Date; end: Date } {
    const currentDuration = currentRange.end.getTime() - currentRange.start.getTime()
    const newDuration = currentDuration / zoomFactor
    
    // Calculate zoom center as ratio
    const centerRatio = zoomCenter.x / zoomCenter.viewportWidth
    const currentCenterTime = currentRange.start.getTime() + currentDuration * centerRatio
    
    return {
      start: new Date(currentCenterTime - newDuration * centerRatio),
      end: new Date(currentCenterTime + newDuration * (1 - centerRatio))
    }
  }

  /**
   * Calculate scroll offset for horizontal panning
   */
  static calculatePanOffset(
    currentRange: { start: Date; end: Date },
    panDelta: number,
    viewportWidth: number
  ): { start: Date; end: Date } {
    const currentDuration = currentRange.end.getTime() - currentRange.start.getTime()
    const timePerPixel = currentDuration / viewportWidth
    const timeDelta = panDelta * timePerPixel
    
    return {
      start: new Date(currentRange.start.getTime() + timeDelta),
      end: new Date(currentRange.end.getTime() + timeDelta)
    }
  }
}

/**
 * Performance optimization utilities
 */
export class GanttPerformanceUtils {
  /**
   * Calculate visible task range for virtualization
   */
  static calculateVisibleTaskRange(
    scrollTop: number,
    viewportHeight: number,
    rowHeight: number,
    totalTasks: number,
    overscan: number = 5
  ): { startIndex: number; endIndex: number } {
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const visibleRows = Math.ceil(viewportHeight / rowHeight)
    const endIndex = Math.min(totalTasks - 1, startIndex + visibleRows + overscan * 2)
    
    return { startIndex, endIndex }
  }

  /**
   * Debounce function for performance-sensitive operations
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  /**
   * Throttle function for scroll/zoom handlers
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }
}

/**
 * Today line utilities
 */
export class GanttTodayUtils {
  /**
   * Calculate today line position
   */
  static getTodayLinePosition(viewport: GanttViewport): number | null {
    const today = new Date()
    const todayX = GanttDateUtils.dateToPixel(today, viewport)
    
    // Only show if today is within the visible range
    if (todayX >= 0 && todayX <= viewport.width) {
      return todayX
    }
    
    return null
  }

  /**
   * Check if today is within the current date range
   */
  static isTodayVisible(startDate: Date, endDate: Date): boolean {
    const today = new Date()
    const todayTime = today.getTime()
    
    // Reset time to start of day for comparison
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const startTime = startDate.getTime()
    const endTime = endDate.getTime()
    
    return todayStart >= startTime && todayStart <= endTime
  }

  /**
   * Get today indicator props for rendering
   */
  static getTodayIndicatorProps(viewport: GanttViewport): {
    visible: boolean
    x: number
    label: string
  } {
    const x = this.getTodayLinePosition(viewport)
    
    return {
      visible: x !== null,
      x: x || 0,
      label: new Date().toLocaleDateString('ja-JP', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }
}