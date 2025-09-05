import { ScaleTime, ScaleBand } from 'd3-scale'
import { SchedulingResult } from './scheduling'

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
  updateTask: (taskId: string, updates: Partial<GanttTask>) => void
  moveTask: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  resizeTask: (taskId: string, newStartDate: Date, newEndDate: Date) => void
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
  addDependency: (dependency: Omit<GanttDependency, 'id'>) => void
  removeDependency: (dependencyId: string) => void
  fetchGanttData: (projectId?: string) => Promise<void>
  setViewportSize: (width: number, height: number) => void
  updateViewport: () => void
  setLastCalculationResult: (result: SchedulingResult | undefined) => void
}

export type GanttStore = GanttState & GanttActions

export interface GanttBarPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface GanttGridLine {
  type: 'major' | 'minor' | 'today'
  x: number
  date: Date
  label?: string
}

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

export interface GanttTooltipData {
  task: GanttTask
  position: { x: number; y: number }
  type: 'task' | 'dependency' | 'milestone'
}

export interface GanttContextMenuData {
  task: GanttTask
  position: { x: number; y: number }
  actions: GanttContextMenuAction[]
}

export interface GanttContextMenuAction {
  label: string
  icon?: string
  action: () => void
  disabled?: boolean
  divider?: boolean
}

export interface GanttPerformanceMetrics {
  renderTime: number
  scrollPerformance: number
  taskCount: number
  visibleTaskCount: number
  memoryUsage?: number
}

export interface GanttExportOptions {
  format: 'png' | 'svg' | 'pdf'
  dateRange?: { start: Date; end: Date }
  includeDependencies: boolean
  includeDetails: boolean
  scale: GanttTimeScale
}

export interface GanttUndoRedoState {
  past: GanttTask[][]
  present: GanttTask[]
  future: GanttTask[][]
}

export interface GanttKeyboardShortcuts {
  'ctrl+z': () => void
  'ctrl+y': () => void
  'ctrl+a': () => void
  'delete': () => void
  'escape': () => void
  'plus': () => void
  'minus': () => void
  'home': () => void
  'end': () => void
}

export interface GanttMilestone {
  id: string
  title: string
  description?: string
  date: Date
  type: 'project_start' | 'project_end' | 'phase_completion' | 'delivery' | 'review' | 'custom'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'PENDING' | 'ACHIEVED' | 'MISSED' | 'AT_RISK'
  achievedDate?: Date
  relatedTaskIds: string[]
  color?: string
  icon?: string
}

export interface GanttCriticalPath {
  tasks: GanttTask[]
  totalDuration: number
  startDate: Date
  endDate: Date
  slackTime: number
}

export interface GanttProgressSummary {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  completionPercentage: number
  estimatedCompletionDate: Date
  currentProgress: {
    onTime: number
    delayed: number
    ahead: number
  }
}

export interface GanttMilestoneViewOptions {
  showMilestones: boolean
  milestoneTypes: GanttMilestone['type'][]
  showMilestoneConnections: boolean
  showMilestoneProgress: boolean
}