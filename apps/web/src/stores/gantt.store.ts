import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { scaleTime, scaleBand } from 'd3-scale'
import { GanttStore, GanttTask, GanttTimeScale, GanttViewport, GanttTimelineConfig, GanttConfig } from '@/types/gantt'
import { GanttUtils } from '@/lib/gantt-utils'
import { SchedulingResult } from '@/types/scheduling'

// Re-export types needed by other components
export type { GanttConfig, GanttViewport } from '@/types/gantt'

interface GanttState {
  tasks: GanttTask[]
  config: GanttTimelineConfig
  viewport: GanttViewport
  selectedTaskId?: string
  selectedTaskIds: Set<string>
  expandedTaskIds: Set<string>
  loading: boolean
  error?: string
  lastCalculationResult?: SchedulingResult
}

export const useGanttStore = create<GanttStore>()(
  devtools(
    (set, get) => ({
      // State
      tasks: [],
      dependencies: [],
        config: {
          scale: 'day',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          workingDays: [1, 2, 3, 4, 5], // Mon-Fri
          workingHoursPerDay: 8,
          holidays: [],
          rowHeight: 40,
          taskHeight: 24,
          headerHeight: 60
        },
        viewport: {
          startDate: new Date(),
          endDate: new Date(),
          timeScale: scaleTime(),
          taskScale: scaleBand(),
          width: 1200,
          height: 600,
          rowHeight: 40,
          taskHeight: 24,
          headerHeight: 60,
          getDatePosition: (date: Date) => {
            const { viewport } = get()
            return viewport.timeScale(date) || 0
          }
        },
        interaction: {
          isDragging: false,
          isResizing: false,
          mousePosition: { x: 0, y: 0 }
        },
        selectedTaskId: undefined,
        selectedTaskIds: new Set<string>(),
        expandedTaskIds: new Set<string>(),
        loading: false,
        error: undefined,
        lastCalculationResult: undefined,

        // Actions
        setTasks: (tasks: GanttTask[]) => {
          set({ tasks })
          get().updateViewport()
        },

        updateTask: (taskId: string, updates: Partial<GanttTask>) => {
          set((state) => ({
            tasks: state.tasks.map(task => 
              task.id === taskId ? { ...task, ...updates } : task
            )
          }))
        },

        moveTask: (taskId: string, newStartDate: Date, newEndDate: Date) => {
          get().updateTask(taskId, {
            startDate: newStartDate,
            endDate: newEndDate
          })
        },

        resizeTask: (taskId: string, newStartDate: Date, newEndDate: Date) => {
          get().updateTask(taskId, {
            startDate: newStartDate,
            endDate: newEndDate
          })
        },

        selectTask: (taskId: string) => {
          set({ 
            selectedTaskId: taskId,
            selectedTaskIds: new Set([taskId])
          })
        },

        selectMultipleTasks: (taskIds: string[]) => {
          set({
            selectedTaskIds: new Set(taskIds),
            selectedTaskId: taskIds[0]
          })
        },

        clearSelection: () => {
          set({
            selectedTaskId: undefined,
            selectedTaskIds: new Set<string>()
          })
        },

        expandTask: (taskId: string) => {
          set((state) => ({
            expandedTaskIds: new Set([...state.expandedTaskIds, taskId])
          }))
        },

        collapseTask: (taskId: string) => {
          set((state) => {
            const newExpandedIds = new Set(state.expandedTaskIds)
            newExpandedIds.delete(taskId)
            return { expandedTaskIds: newExpandedIds }
          })
        },

        setTimeScale: (scale: GanttTimeScale) => {
          set((state) => ({
            config: { ...state.config, scale }
          }))
          get().updateViewport()
        },

        setDateRange: (startDate: Date, endDate: Date) => {
          set((state) => ({
            config: { ...state.config, startDate, endDate }
          }))
          get().updateViewport()
        },

        zoomIn: () => {
          const { config } = get()
          const scaleOrder: GanttTimeScale[] = ['quarter', 'month', 'week', 'day']
          const currentIndex = scaleOrder.indexOf(config.scale)
          
          if (currentIndex < scaleOrder.length - 1) {
            get().setTimeScale(scaleOrder[currentIndex + 1])
          }
        },

        zoomOut: () => {
          const { config } = get()
          const scaleOrder: GanttTimeScale[] = ['quarter', 'month', 'week', 'day']
          const currentIndex = scaleOrder.indexOf(config.scale)
          
          if (currentIndex > 0) {
            get().setTimeScale(scaleOrder[currentIndex - 1])
          }
        },

        zoomToFit: () => {
          const { tasks } = get()
          if (tasks.length === 0) return
          
          const dateRange = GanttUtils.calculateOptimalDateRange(tasks, 0.1)
          get().setDateRange(dateRange.startDate, dateRange.endDate)
        },

        scrollToToday: () => {
          const today = new Date()
          const { config } = get()
          const duration = config.endDate.getTime() - config.startDate.getTime()
          const padding = duration * 0.1
          
          const newStartDate = new Date(today.getTime() - padding)
          const newEndDate = new Date(today.getTime() + padding)
          
          get().setDateRange(newStartDate, newEndDate)
        },

        addDependency: (dependency: any) => {
          set((state) => ({
            dependencies: [...state.dependencies, { ...dependency, id: generateId() }]
          }))
        },

        removeDependency: (dependencyId: string) => {
          set((state) => ({
            dependencies: state.dependencies.filter(dep => dep.id !== dependencyId)
          }))
        },

        fetchGanttData: async (projectId?: string) => {
          set({ loading: true, error: undefined })
          
          try {
            const params = new URLSearchParams()
            if (projectId) params.append('projectId', projectId)
            params.append('includeDependencies', 'true')
            params.append('includeCompleted', 'true')
            
            const response = await fetch(`/api/v1/issues/gantt?${params.toString()}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            })
            
            if (!response.ok) {
              throw new Error(`Failed to fetch Gantt data: ${response.statusText}`)
            }
            
            const data = await response.json()
            
            // Convert API response to GanttTask format
            const tasks = data.tasks.map((apiTask: any) => ({
              id: apiTask.id,
              title: apiTask.title,
              description: apiTask.description,
              parentId: apiTask.parentId,
              startDate: new Date(apiTask.startDate),
              endDate: new Date(apiTask.endDate),
              progress: apiTask.progress,
              status: apiTask.status,
              assigneeId: apiTask.assigneeId,
              assigneeName: apiTask.assigneeName,
              estimatedHours: apiTask.estimatedHours,
              actualHours: apiTask.actualHours,
              dependencies: [],
              level: apiTask.level,
              order: apiTask.order,
              color: apiTask.color
            }))
            
            // Calculate optimal date range
            const dateRange = GanttUtils.calculateOptimalDateRange(tasks, 0.1)
            
            set({
              tasks,
              dependencies: data.dependencies || [],
              config: {
                ...get().config,
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
              },
              loading: false,
              error: undefined
            })
            
            get().updateViewport()
            
          } catch (error) {
            set({
              loading: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            })
          }
        },

        // Internal method to update viewport
        updateViewport: () => {
          const { config, tasks, viewport } = get()
          
          const timeScale = GanttUtils.createTimeScale(config, viewport.width - 200) // Account for task names column
          const taskScale = GanttUtils.createTaskScale(tasks, viewport.height - viewport.headerHeight) as any
          
          set({
            viewport: {
              ...viewport,
              startDate: config.startDate,
              endDate: config.endDate,
              timeScale,
              taskScale
            }
          })
        },

        // Viewport sizing
        setViewportSize: (width: number, height: number) => {
          set((state) => ({
            viewport: { ...state.viewport, width, height }
          }))
          get().updateViewport()
        },

        setLastCalculationResult: (result: SchedulingResult | undefined) => {
          set({ lastCalculationResult: result })
        }
      })
  )
)

// Helper functions
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Selectors for computed values
export const useGanttSelectors = () => {
  const store = useGanttStore()
  
  return {
    visibleTasks: () => {
      // Filter tasks based on date range and expansion state
      const { tasks, config, expandedTaskIds } = store
      
      return tasks.filter(task => {
        // Date range check
        const taskInRange = task.endDate >= config.startDate && task.startDate <= config.endDate
        
        // Hierarchy check - show if parent is expanded or if it's a root task
        if (task.parentId) {
          return taskInRange && expandedTaskIds.has(task.parentId)
        }
        
        return taskInRange
      }).sort((a, b) => a.order - b.order)
    },

    selectedTasks: () => {
      return store.tasks.filter(task => store.selectedTaskIds.has(task.id))
    },

    criticalPath: () => {
      return GanttUtils.calculateCriticalPath(store.tasks)
    },

    timelineGridLines: () => {
      const { config, viewport } = store
      return GanttUtils.generateTimeGridLines(
        viewport.timeScale,
        config.scale,
        config.startDate,
        config.endDate
      )
    },

    taskPositions: () => {
      const { tasks, viewport } = store
      const visibleTasks = store.tasks.filter(task => 
        task.endDate >= viewport.startDate && task.startDate <= viewport.endDate
      )
      
      return visibleTasks.map(task => ({
        task,
        position: GanttUtils.calculateTaskBarPosition(
          task,
          viewport.timeScale,
          viewport.taskScale,
          viewport.rowHeight
        )
      }))
    },

    ganttStats: () => {
      const { tasks } = store
      const totalTasks = tasks.length
      const completedTasks = tasks.filter(task => task.progress >= 100).length
      const inProgressTasks = tasks.filter(task => task.progress > 0 && task.progress < 100).length
      const notStartedTasks = tasks.filter(task => task.progress === 0).length
      
      const overdueTasks = tasks.filter(task => {
        const today = new Date()
        return task.endDate < today && task.progress < 100
      }).length
      
      return {
        totalTasks,
        completedTasks,
        inProgressTasks,
        notStartedTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    }
  }
}

