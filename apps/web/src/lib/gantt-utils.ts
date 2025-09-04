import { scaleTime, scaleBand } from 'd3-scale'
import { timeDay, timeWeek, timeMonth, timeYear } from 'd3-time'
import { GanttTask, GanttTimeScale, GanttViewport, GanttTimelineConfig, GanttDependency } from '@/types/gantt'
import { Issue, IssueDependency } from '@/types/issue'

export class GanttUtils {
  /**
   * Create time scale based on configuration
   */
  static createTimeScale(config: GanttTimelineConfig, width: number) {
    return scaleTime()
      .domain([config.startDate, config.endDate])
      .range([0, width])
  }

  /**
   * Create task scale for vertical positioning
   */
  static createTaskScale(tasks: GanttTask[], height: number) {
    const taskIds = tasks.map(task => task.id)
    return scaleBand<string>()
      .domain(taskIds)
      .range([0, height])
      .paddingInner(0.1)
      .paddingOuter(0.05)
  }

  /**
   * Convert Issues to GanttTasks
   */
  static issuesToGanttTasks(issues: Issue[], dependencies: IssueDependency[] = []): GanttTask[] {
    return issues.map((issue, index) => {
      const taskDependencies = dependencies
        .filter(dep => dep.successorId === issue.id)
        .map(dep => ({
          id: dep.id,
          predecessorId: dep.predecessorId,
          successorId: dep.successorId,
          type: dep.type,
          lag: dep.lag,
          lagUnit: dep.lagUnit
        }))

      return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        parentId: issue.parentIssueId,
        startDate: issue.startDate ? new Date(issue.startDate) : new Date(),
        endDate: issue.dueDate ? new Date(issue.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        progress: issue.progress,
        status: issue.status.toUpperCase() as any,
        assigneeId: issue.assigneeId,
        estimatedHours: issue.estimateValue * (issue.estimateUnit === 'h' ? 1 : 8),
        dependencies: taskDependencies,
        level: 0,
        order: index,
        color: GanttUtils.getTaskColor(issue.status, issue.type)
      }
    })
  }

  /**
   * Get task color based on status and type
   */
  static getTaskColor(status: string, type?: string): string {
    const statusColors: Record<string, string> = {
      todo: '#94a3b8',      // gray
      doing: '#3b82f6',     // blue  
      blocked: '#ef4444',   // red
      review: '#f59e0b',    // amber
      done: '#10b981'       // emerald
    }

    const typeColors: Record<string, string> = {
      feature: '#8b5cf6',   // violet
      bug: '#ef4444',       // red
      spike: '#06b6d4',     // cyan
      chore: '#6b7280'      // gray
    }

    return statusColors[status.toLowerCase()] || typeColors[type?.toLowerCase() || ''] || '#6b7280'
  }

  /**
   * Calculate optimal date range for tasks
   */
  static calculateOptimalDateRange(tasks: GanttTask[], padding = 0.1): { startDate: Date; endDate: Date } {
    if (tasks.length === 0) {
      const now = new Date()
      return {
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      }
    }

    const startDates = tasks.map(task => task.startDate.getTime())
    const endDates = tasks.map(task => task.endDate.getTime())
    
    const minStart = Math.min(...startDates)
    const maxEnd = Math.max(...endDates)
    
    const totalDuration = maxEnd - minStart
    const paddingTime = totalDuration * padding
    
    return {
      startDate: new Date(minStart - paddingTime),
      endDate: new Date(maxEnd + paddingTime)
    }
  }

  /**
   * Generate time grid lines based on scale
   */
  static generateTimeGridLines(
    timeScale: ReturnType<typeof scaleTime>,
    scale: GanttTimeScale,
    startDate: Date,
    endDate: Date
  ) {
    const lines: Array<{ x: number; date: Date; type: 'major' | 'minor' | 'today'; label?: string }> = []
    const today = new Date()
    const todayX = timeScale(today)

    let timeInterval: any
    let labelFormat: (date: Date) => string

    switch (scale) {
      case 'day':
        timeInterval = timeDay
        labelFormat = (date) => date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
        break
      case 'week':
        timeInterval = timeWeek
        labelFormat = (date) => `${date.getMonth() + 1}/${date.getDate()}`
        break
      case 'month':
        timeInterval = timeMonth
        labelFormat = (date) => date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })
        break
      case 'quarter':
        timeInterval = timeMonth.every(3)
        labelFormat = (date) => `${date.getFullYear()}Q${Math.ceil((date.getMonth() + 1) / 3)}`
        break
    }

    // Generate major grid lines
    const dates = timeInterval.range(
      timeInterval.floor(startDate),
      timeInterval.ceil(endDate)
    )

    dates.forEach((date: Date) => {
      const x = timeScale(date) as number
      lines.push({
        x,
        date,
        type: 'major' as 'major' | 'minor' | 'today',
        label: labelFormat(date)
      })
    })

    // Add today line
    const todayXPos = todayX as number
    if (todayXPos >= 0 && todayXPos <= (timeScale.range()[1] as number)) {
      lines.push({
        x: todayXPos,
        date: today,
        type: 'today' as 'major' | 'minor' | 'today',
        label: 'Today'
      })
    }

    return lines
  }

  /**
   * Calculate task bar position and dimensions
   */
  static calculateTaskBarPosition(
    task: GanttTask,
    timeScale: ReturnType<typeof scaleTime>,
    taskScale: ReturnType<typeof scaleBand>,
    rowHeight: number
  ) {
    const x = timeScale(task.startDate) as number
    const y = (taskScale(task.id) || 0) as number
    const width = Math.max(
      (timeScale(task.endDate) as number) - (timeScale(task.startDate) as number),
      2 // Minimum width for visibility
    )
    const height = rowHeight * 0.6 // Leave some padding

    return { x, y, width, height }
  }

  /**
   * Validate and resolve task dependencies
   */
  static validateDependencies(tasks: GanttTask[]): {
    isValid: boolean
    errors: Array<{ taskId: string; message: string }>
    warnings: Array<{ taskId: string; message: string }>
  } {
    const errors: Array<{ taskId: string; message: string }> = []
    const warnings: Array<{ taskId: string; message: string }> = []
    const taskMap = new Map(tasks.map(task => [task.id, task]))

    // Check for circular dependencies
    const visited = new Set<string>()
    const inProgress = new Set<string>()

    function detectCircularDependency(taskId: string): boolean {
      if (inProgress.has(taskId)) {
        errors.push({
          taskId,
          message: 'Circular dependency detected'
        })
        return true
      }

      if (visited.has(taskId)) return false

      const task = taskMap.get(taskId)
      if (!task) return false

      visited.add(taskId)
      inProgress.add(taskId)

      for (const dep of task.dependencies) {
        if (detectCircularDependency(dep.predecessorId)) {
          return true
        }
      }

      inProgress.delete(taskId)
      return false
    }

    tasks.forEach(task => detectCircularDependency(task.id))

    // Check for missing predecessor tasks
    tasks.forEach(task => {
      task.dependencies.forEach(dep => {
        if (!taskMap.has(dep.predecessorId)) {
          errors.push({
            taskId: task.id,
            message: `Predecessor task not found: ${dep.predecessorId}`
          })
        }
      })
    })

    // Check for date conflicts
    tasks.forEach(task => {
      task.dependencies.forEach(dep => {
        const predecessor = taskMap.get(dep.predecessorId)
        if (!predecessor) return

        const requiredStartDate = new Date(predecessor.endDate.getTime() + dep.lag * 24 * 60 * 60 * 1000)
        
        if (task.startDate < requiredStartDate) {
          warnings.push({
            taskId: task.id,
            message: `Task starts before predecessor completes (${dep.type} dependency)`
          })
        }
      })
    })

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Auto-schedule tasks based on dependencies
   */
  static autoScheduleTasks(tasks: GanttTask[]): GanttTask[] {
    const taskMap = new Map(tasks.map(task => [task.id, { ...task }]))
    const scheduled = new Set<string>()
    
    function scheduleTask(taskId: string): void {
      if (scheduled.has(taskId)) return

      const task = taskMap.get(taskId)
      if (!task) return

      // Schedule all predecessors first
      let latestEndDate = task.startDate

      task.dependencies.forEach(dep => {
        scheduleTask(dep.predecessorId)
        const predecessor = taskMap.get(dep.predecessorId)
        if (predecessor) {
          const requiredDate = new Date(predecessor.endDate.getTime() + dep.lag * 24 * 60 * 60 * 1000)
          if (requiredDate > latestEndDate) {
            latestEndDate = requiredDate
          }
        }
      })

      // Update task dates if needed
      if (latestEndDate > task.startDate) {
        const duration = task.endDate.getTime() - task.startDate.getTime()
        task.startDate = latestEndDate
        task.endDate = new Date(latestEndDate.getTime() + duration)
      }

      scheduled.add(taskId)
    }

    // Schedule all tasks
    tasks.forEach(task => scheduleTask(task.id))

    return Array.from(taskMap.values())
  }

  /**
   * Calculate critical path
   */
  static calculateCriticalPath(tasks: GanttTask[]): string[] {
    // Simplified critical path calculation
    // In a real implementation, this would use proper CPM algorithm
    
    const taskMap = new Map(tasks.map(task => [task.id, task]))
    const criticalTasks: string[] = []
    
    // Find tasks with no float/slack
    tasks.forEach(task => {
      const hasSuccessors = tasks.some(t => 
        t.dependencies.some(dep => dep.predecessorId === task.id)
      )
      
      if (!hasSuccessors) {
        // This is an end task, trace back critical path
        const path = GanttUtils.traceCriticalPath(task, taskMap)
        path.forEach(taskId => {
          if (!criticalTasks.includes(taskId)) {
            criticalTasks.push(taskId)
          }
        })
      }
    })
    
    return criticalTasks
  }

  /**
   * Trace critical path from end task backwards
   */
  private static traceCriticalPath(
    task: GanttTask,
    taskMap: Map<string, GanttTask>,
    path: string[] = []
  ): string[] {
    path.push(task.id)
    
    // Find the predecessor that determines this task's start date
    let criticalPredecessor: GanttTask | null = null
    let latestRequiredDate = new Date(0)
    
    task.dependencies.forEach((dep: GanttDependency) => {
      const predecessor = taskMap.get(dep.predecessorId)
      if (predecessor) {
        const requiredDate = new Date(predecessor.endDate.getTime() + dep.lag * 24 * 60 * 60 * 1000)
        if (requiredDate >= latestRequiredDate) {
          latestRequiredDate = requiredDate
          criticalPredecessor = predecessor
        }
      }
    })
    
    if (criticalPredecessor && !path.includes((criticalPredecessor as GanttTask).id)) {
      return GanttUtils.traceCriticalPath(criticalPredecessor, taskMap, path)
    }
    
    return path
  }

  /**
   * Get working days between two dates
   */
  static getWorkingDays(startDate: Date, endDate: Date, workingDays: number[] = [1, 2, 3, 4, 5]): number {
    let count = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      if (workingDays.includes(current.getDay())) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }

  /**
   * Add working days to a date
   */
  static addWorkingDays(date: Date, days: number, workingDays: number[] = [1, 2, 3, 4, 5]): Date {
    const result = new Date(date)
    let addedDays = 0
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1)
      if (workingDays.includes(result.getDay())) {
        addedDays++
      }
    }
    
    return result
  }

  /**
   * Check if date is a working day
   */
  static isWorkingDay(date: Date, workingDays: number[] = [1, 2, 3, 4, 5], holidays: Date[] = []): boolean {
    // Check if it's a working day of week
    if (!workingDays.includes(date.getDay())) return false
    
    // Check if it's a holiday
    const dateStr = date.toDateString()
    return !holidays.some(holiday => holiday.toDateString() === dateStr)
  }

  /**
   * Format duration in human readable format
   */
  static formatDuration(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
    
    if (diffDays === 1) return '1 day'
    if (diffDays < 7) return `${diffDays} days`
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      const remainingDays = diffDays % 7
      if (remainingDays === 0) return `${weeks} week${weeks > 1 ? 's' : ''}`
      return `${weeks}w ${remainingDays}d`
    }
    
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''}`
  }
}