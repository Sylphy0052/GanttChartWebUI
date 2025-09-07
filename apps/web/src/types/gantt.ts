import { ScaleTime, ScaleBand } from 'd3-scale'
import { SchedulingResult } from './scheduling'
import { StateSnapshot } from '@/lib/api-client'

export type GanttTimeScale = 'day' | 'week' | 'month' | 'quarter'

export interface GanttTask {
  id: string
  title: string
  description?: string
  parentId?: string
  startDate: Date
  endDate: Date
  progress: number
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  assigneeId?: string
  assigneeName?: string
  estimatedHours?: number
  actualHours?: number
  dependencies: GanttDependency[]
  level: number
  order: number
  color?: string
  type?: 'task' | 'milestone' | 'summary'
  milestoneDate?: Date
  version?: number // AC1: Add version for optimistic locking
}

export interface GanttDependency {
  id: string
  predecessorId: string
  successorId: string
  fromTaskId: string  // alias for predecessorId
  toTaskId: string    // alias for successorId
  type: 'FS' | 'SS' | 'FF' | 'SF'
  lag: number
  lagUnit: 'days' | 'hours'
  version?: number // AC1: Add version for optimistic locking
}

export interface GanttTimelineConfig extends GanttConfig {
}

export interface GanttViewport {
  startDate: Date
  endDate: Date
  timeScale: ScaleTime<number, number>
  taskScale: any
  width: number
  height: number
  rowHeight: number
  taskHeight: number
  headerHeight: number
  getDatePosition: (date: Date) => number
  scrollLeft?: number // AC1: Add scroll position for conflict resolution
  scrollTop?: number  // AC1: Add scroll position for conflict resolution
}

export interface GanttInteraction {
  isDragging: boolean
  isResizing: boolean
  dragTaskId?: string
  resizeTaskId?: string
  resizeType?: 'start' | 'end'
  mousePosition: { x: number; y: number }
}

export interface GanttState {
  tasks: GanttTask[]
  dependencies: GanttDependency[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  interaction: GanttInteraction
  selectedTaskId?: string
  selectedTaskIds: Set<string>
  expandedTaskIds: Set<string>
  loading: boolean
  error?: string
  lastCalculationResult?: SchedulingResult
}

export interface GanttActions {
  setTasks: (tasks: GanttTask[]) => void
  updateTask: (taskId: string, updates: Partial<GanttTask>) => Promise<void> // AC1: Made async for conflict resolution
  moveTask: (taskId: string, newStartDate: Date, newEndDate: Date) => Promise<void> // AC1: Made async
  resizeTask: (taskId: string, newStartDate: Date, newEndDate: Date) => Promise<void> // AC1: Made async
  selectTask: (taskId: string) => void
  selectMultipleTasks: (taskIds: string[]) => void
  clearSelection: () => void
  expandTask: (taskId: string) => void
  collapseTask: (taskId: string) => void
  setTimeScale: (scale: GanttTimeScale) => void
  setDateRange: (startDate: Date, endDate: Date) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: () => void
  scrollToToday: () => void
  addDependency: (dependency: Omit<GanttDependency, 'id'>) => Promise<void> // AC1: Made async
  removeDependency: (dependencyId: string) => Promise<void> // AC1: Made async
  fetchGanttData: (projectId?: string) => Promise<void>
  setViewportSize: (width: number, height: number) => void
  updateViewport: () => void
  setLastCalculationResult: (result: SchedulingResult | undefined) => void
  
  // AC1: New conflict resolution methods
  getStateSnapshot: () => any
  clearErrors: () => void
  getRollbackHistory: () => StateSnapshot[]
  clearRollbackHistory: (prefix?: string) => void
}

export type GanttStore = GanttState & GanttActions

export interface GanttConfig {
  scale: GanttTimeScale
  startDate: Date
  endDate: Date
  workingDays: number[]
  workingHoursPerDay: number
  holidays: Date[]
  rowHeight: number
  taskHeight: number
  headerHeight: number
}

// AC1: Gantt-specific conflict types
export interface GanttConflict {
  id: string
  type: 'task_move' | 'task_resize' | 'task_update' | 'dependency_change'
  affectedTaskIds: string[]
  conflictingFields: string[]
  localChanges: any
  remoteChanges: any
  suggestedResolution?: string
  priority: 'high' | 'medium' | 'low'
}