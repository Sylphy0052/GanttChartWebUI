import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { scaleTime, scaleBand } from 'd3-scale'
import { GanttStore, GanttTask, GanttTimeScale, GanttViewport, GanttTimelineConfig, GanttConfig } from '@/types/gantt'
import { GanttUtils } from '@/lib/gantt-utils'
import { SchedulingResult } from '@/types/scheduling'
import { apiClient, ConflictError, StateSnapshot } from '@/lib/api-client'
import { offlineSyncManager } from '@/lib/offline-sync'
import { errorLogger } from '@/lib/error-logger'
import { userErrorMessages } from '@/lib/user-error-messages'
import { toast } from 'react-hot-toast'

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
    (set, get) => {
      // AC1 & AC4: Setup rollback and offline sync event listeners
      if (typeof window !== 'undefined') {
        window.addEventListener('gantt:rollback_task', (event: any) => {
          const { originalState, operation } = event.detail
          
          // Restore task state from snapshot
          if (originalState && originalState.tasks) {
            set({ 
              tasks: originalState.tasks,
              error: `Operation "${operation}" was rolled back due to conflict`
            })
            get().updateViewport()
          }
        })

        window.addEventListener('gantt:rollback_dependency', (event: any) => {
          const { originalState, operation } = event.detail
          
          // Restore dependency state from snapshot
          if (originalState && originalState.dependencies) {
            set({ 
              dependencies: originalState.dependencies,
              error: `Operation "${operation}" was rolled back due to conflict`
            })
          }
        })

        window.addEventListener('api:rollback', (event: any) => {
          const { snapshot, operation } = event.detail
          
          // General rollback handler
          toast.info(
            `Rolling back "${operation}" due to conflict...`,
            { duration: 3000, id: `rollback-${snapshot.id}` }
          )
        })

        // AC4: Handle offline/online state changes
        window.addEventListener('online', () => {
          errorLogger.addBreadcrumb({
            category: 'custom',
            message: 'Connection restored - Gantt store ready for sync',
            level: 'info'
          })
        })

        window.addEventListener('offline', () => {
          errorLogger.addBreadcrumb({
            category: 'custom',
            message: 'Connection lost - Gantt operations will be queued',
            level: 'warning'
          })
        })

        // AC3: Handle successful conflict resolutions
        window.addEventListener('conflict:resolved', (event: any) => {
          const { entityType, entityId, resolvedData, result } = event.detail
          
          if (entityType === 'task' || entityType === 'issue') {
            // Update local state with resolved data
            set((state) => ({
              tasks: state.tasks.map(task => 
                task.id === entityId ? { ...task, ...resolvedData } : task
              )
            }))
            get().updateViewport()
          }
        })
      }

      return {
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

        // AC1 & AC4: Enhanced updateTask with conflict resolution and offline support
        updateTask: async (taskId: string, updates: Partial<GanttTask>) => {
          const currentState = { tasks: get().tasks, dependencies: get().dependencies }
          const currentTask = get().tasks.find(t => t.id === taskId)
          
          if (!currentTask) {
            const errorMsg = userErrorMessages.generateErrorMessage(
              new Error('Task not found'), 
              { operation: 'update_task', entityType: 'task', entityId: taskId }
            )
            toast.error(errorMsg.message)
            return
          }

          // Optimistic update
          set((state) => ({
            tasks: state.tasks.map(task => 
              task.id === taskId ? { ...task, ...updates } : task
            )
          }))

          const endpoint = `/api/v1/issues/${taskId}`
          const requestData = {
            ...updates,
            version: currentTask.version || 1
          }

          // AC4: Check if online, queue if offline
          if (!offlineSyncManager.isOnlineStatus()) {
            const operationId = offlineSyncManager.queueOperation(
              'update',
              'task',
              taskId,
              endpoint,
              'PUT',
              requestData,
              currentState,
              'medium'
            )

            errorLogger.addBreadcrumb({
              category: 'custom',
              message: `Task update queued for offline sync`,
              level: 'info',
              data: { taskId, operationId, updates: Object.keys(updates) }
            })

            return operationId
          }

          // Online - attempt immediate sync
          try {
            await apiClient.put(endpoint, requestData, currentState, 'update_task')
            set({ error: undefined })
            
          } catch (error) {
            if (error instanceof ConflictError) {
              // AC2 & AC3: Emit conflict event for modal handling
              window.dispatchEvent(new CustomEvent('api:conflict', {
                detail: {
                  error,
                  localData: { ...currentTask, ...updates },
                  remoteData: error.data?.remoteData,
                  entityType: 'task',
                  entityId: taskId,
                  operation: 'update_task'
                }
              }))
            } else {
              // Handle other errors with user-friendly messages
              const errorMessage = userErrorMessages.generateErrorMessage(error as Error, {
                operation: 'update_task',
                entityType: 'task',
                entityId: taskId
              })

              set({ 
                tasks: currentState.tasks,
                error: errorMessage.message
              })

              // AC6: Log error with context
              errorLogger.captureError(error as Error, {
                level: 'api',
                context: {
                  operation: 'update_task',
                  taskId,
                  updates,
                  currentState
                }
              })

              // AC7: Show user-friendly error message
              toast.error(errorMessage.message)
            }
          }
        },

        // AC1 & AC4: Enhanced moveTask with offline support
        moveTask: async (taskId: string, newStartDate: Date, newEndDate: Date) => {
          const currentState = { tasks: get().tasks, dependencies: get().dependencies }
          const currentTask = get().tasks.find(t => t.id === taskId)
          
          if (!currentTask) {
            const errorMsg = userErrorMessages.generateErrorMessage(
              new Error('Task not found'), 
              { operation: 'move_task', entityType: 'task', entityId: taskId }
            )
            toast.error(errorMsg.message)
            return
          }

          const originalStartDate = currentTask.startDate
          const originalEndDate = currentTask.endDate

          // Optimistic update
          set((state) => ({
            tasks: state.tasks.map(task => 
              task.id === taskId ? { ...task, startDate: newStartDate, endDate: newEndDate } : task
            )
          }))

          const endpoint = `/api/v1/issues/${taskId}/dates`
          const requestData = {
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString(),
            version: currentTask.version || 1
          }

          // AC4: Queue for offline sync if needed
          if (!offlineSyncManager.isOnlineStatus()) {
            const operationId = offlineSyncManager.queueOperation(
              'patch',
              'task',
              taskId,
              endpoint,
              'PATCH',
              requestData,
              currentState,
              'high' // High priority for date changes
            )

            errorLogger.addBreadcrumb({
              category: 'custom',
              message: `Task move queued for offline sync`,
              level: 'info',
              data: { taskId, operationId, newStartDate, newEndDate }
            })

            return operationId
          }

          try {
            await apiClient.patch(endpoint, requestData, currentState, 'move_task')
            set({ error: undefined })
            get().updateViewport()
            
          } catch (error) {
            if (error instanceof ConflictError) {
              window.dispatchEvent(new CustomEvent('api:conflict', {
                detail: {
                  error,
                  localData: { ...currentTask, startDate: newStartDate, endDate: newEndDate },
                  remoteData: error.data?.remoteData,
                  entityType: 'task',
                  entityId: taskId,
                  operation: 'move_task'
                }
              }))
            } else {
              // Rollback on error
              set((state) => ({
                tasks: state.tasks.map(task => 
                  task.id === taskId ? { ...task, startDate: originalStartDate, endDate: originalEndDate } : task
                ),
                error: (error as Error).message
              }))

              const errorMessage = userErrorMessages.generateErrorMessage(error as Error, {
                operation: 'move_task',
                entityType: 'task',
                entityId: taskId
              })

              toast.error(errorMessage.message)
              
              errorLogger.captureError(error as Error, {
                level: 'api',
                context: { operation: 'move_task', taskId, newStartDate, newEndDate }
              })
            }
          }
        },

        // AC1 & AC4: Enhanced resizeTask with offline support
        resizeTask: async (taskId: string, newStartDate: Date, newEndDate: Date) => {
          const currentState = { tasks: get().tasks, dependencies: get().dependencies }
          const currentTask = get().tasks.find(t => t.id === taskId)
          
          if (!currentTask) {
            const errorMsg = userErrorMessages.generateErrorMessage(
              new Error('Task not found'), 
              { operation: 'resize_task', entityType: 'task', entityId: taskId }
            )
            toast.error(errorMsg.message)
            return
          }

          const originalStartDate = currentTask.startDate
          const originalEndDate = currentTask.endDate

          // Optimistic update
          set((state) => ({
            tasks: state.tasks.map(task => 
              task.id === taskId ? { ...task, startDate: newStartDate, endDate: newEndDate } : task
            )
          }))

          const endpoint = `/api/v1/issues/${taskId}/resize`
          const requestData = {
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString(),
            version: currentTask.version || 1
          }

          // AC4: Queue for offline sync if needed
          if (!offlineSyncManager.isOnlineStatus()) {
            const operationId = offlineSyncManager.queueOperation(
              'patch',
              'task',
              taskId,
              endpoint,
              'PATCH',
              requestData,
              currentState,
              'high' // High priority for resize operations
            )

            errorLogger.addBreadcrumb({
              category: 'custom',
              message: `Task resize queued for offline sync`,
              level: 'info',
              data: { taskId, operationId, newStartDate, newEndDate }
            })

            return operationId
          }

          try {
            await apiClient.patch(endpoint, requestData, currentState, 'resize_task')
            set({ error: undefined })
            get().updateViewport()
            
          } catch (error) {
            if (error instanceof ConflictError) {
              window.dispatchEvent(new CustomEvent('api:conflict', {
                detail: {
                  error,
                  localData: { ...currentTask, startDate: newStartDate, endDate: newEndDate },
                  remoteData: error.data?.remoteData,
                  entityType: 'task',
                  entityId: taskId,
                  operation: 'resize_task'
                }
              }))
            } else {
              set((state) => ({
                tasks: state.tasks.map(task => 
                  task.id === taskId ? { ...task, startDate: originalStartDate, endDate: originalEndDate } : task
                ),
                error: (error as Error).message
              }))

              const errorMessage = userErrorMessages.generateErrorMessage(error as Error, {
                operation: 'resize_task',
                entityType: 'task',
                entityId: taskId
              })

              toast.error(errorMessage.message)

              errorLogger.captureError(error as Error, {
                level: 'api',
                context: { operation: 'resize_task', taskId, newStartDate, newEndDate }
              })
            }
          }
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

        // AC1 & AC4: Enhanced addDependency with offline support
        addDependency: async (dependency: any) => {
          const currentState = { tasks: get().tasks, dependencies: get().dependencies }
          
          // Optimistic update
          const newDependency = { ...dependency, id: generateId() }
          set((state) => ({
            dependencies: [...state.dependencies, newDependency]
          }))

          const endpoint = `/api/v1/dependencies`
          const requestData = {
            fromTaskId: dependency.fromTaskId,
            toTaskId: dependency.toTaskId,
            type: dependency.type || 'finish-to-start'
          }

          // AC4: Queue for offline sync if needed
          if (!offlineSyncManager.isOnlineStatus()) {
            const operationId = offlineSyncManager.queueOperation(
              'create',
              'dependency',
              newDependency.id,
              endpoint,
              'POST',
              requestData,
              currentState,
              'medium'
            )

            errorLogger.addBreadcrumb({
              category: 'custom',
              message: `Dependency creation queued for offline sync`,
              level: 'info',
              data: { dependencyId: newDependency.id, operationId }
            })

            return operationId
          }

          try {
            await apiClient.post(endpoint, requestData, currentState, 'create_dependency')
            set({ error: undefined })
            
          } catch (error) {
            if (error instanceof ConflictError) {
              window.dispatchEvent(new CustomEvent('api:conflict', {
                detail: {
                  error,
                  localData: requestData,
                  remoteData: error.data?.remoteData,
                  entityType: 'dependency',
                  entityId: newDependency.id,
                  operation: 'create_dependency'
                }
              }))
            } else {
              set({
                dependencies: currentState.dependencies,
                error: (error as Error).message
              })

              const errorMessage = userErrorMessages.generateErrorMessage(error as Error, {
                operation: 'create_dependency',
                entityType: 'dependency'
              })

              toast.error(errorMessage.message)

              errorLogger.captureError(error as Error, {
                level: 'api',
                context: { operation: 'create_dependency', dependency: requestData }
              })
            }
          }
        },

        // AC1 & AC4: Enhanced removeDependency with offline support
        removeDependency: async (dependencyId: string) => {
          const currentState = { tasks: get().tasks, dependencies: get().dependencies }
          const dependencyToRemove = get().dependencies.find(dep => dep.id === dependencyId)
          
          if (!dependencyToRemove) {
            const errorMsg = userErrorMessages.generateErrorMessage(
              new Error('Dependency not found'), 
              { operation: 'delete_dependency', entityType: 'dependency', entityId: dependencyId }
            )
            toast.error(errorMsg.message)
            return
          }

          // Optimistic update
          set((state) => ({
            dependencies: state.dependencies.filter(dep => dep.id !== dependencyId)
          }))

          const endpoint = `/api/v1/dependencies/${dependencyId}`

          // AC4: Queue for offline sync if needed
          if (!offlineSyncManager.isOnlineStatus()) {
            const operationId = offlineSyncManager.queueOperation(
              'delete',
              'dependency',
              dependencyId,
              endpoint,
              'DELETE',
              undefined,
              currentState,
              'low'
            )

            errorLogger.addBreadcrumb({
              category: 'custom',
              message: `Dependency deletion queued for offline sync`,
              level: 'info',
              data: { dependencyId, operationId }
            })

            return operationId
          }

          try {
            await apiClient.delete(endpoint, currentState, 'delete_dependency')
            set({ error: undefined })
            
          } catch (error) {
            if (error instanceof ConflictError) {
              window.dispatchEvent(new CustomEvent('api:conflict', {
                detail: {
                  error,
                  localData: dependencyToRemove,
                  remoteData: error.data?.remoteData,
                  entityType: 'dependency',
                  entityId: dependencyId,
                  operation: 'delete_dependency'
                }
              }))
            } else {
              set({
                dependencies: currentState.dependencies,
                error: (error as Error).message
              })

              const errorMessage = userErrorMessages.generateErrorMessage(error as Error, {
                operation: 'delete_dependency',
                entityType: 'dependency',
                entityId: dependencyId
              })

              toast.error(errorMessage.message)

              errorLogger.captureError(error as Error, {
                level: 'api',
                context: { operation: 'delete_dependency', dependencyId }
              })
            }
          }
        },

        // AC1 & AC6: Enhanced fetchGanttData with comprehensive error handling
        fetchGanttData: async (projectId?: string) => {
          set({ loading: true, error: undefined })
          
          try {
            const params = new URLSearchParams()
            if (projectId) params.append('projectId', projectId)
            params.append('includeDependencies', 'true')
            params.append('includeCompleted', 'true')
            
            const data = await apiClient.get(`/api/v1/issues/gantt?${params.toString()}`)
            
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
              color: apiTask.color,
              version: apiTask.version || 1
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

            errorLogger.addBreadcrumb({
              category: 'http',
              message: `Successfully loaded ${tasks.length} tasks for Gantt chart`,
              level: 'info',
              data: { projectId, taskCount: tasks.length }
            })
            
          } catch (error) {
            const errorMessage = userErrorMessages.generateErrorMessage(error as Error, {
              operation: 'fetch_gantt_data',
              context: { projectId }
            })

            set({
              loading: false,
              error: errorMessage.message
            })
            
            errorLogger.captureError(error as Error, {
              level: 'api',
              context: { operation: 'fetchGanttData', projectId }
            })

            if (!(error instanceof ConflictError)) {
              toast.error(errorMessage.message)
            }
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
        },

        // AC1: Utility methods for conflict resolution
        getStateSnapshot: () => {
          const { tasks, dependencies, config } = get()
          return {
            tasks: JSON.parse(JSON.stringify(tasks)),
            dependencies: JSON.parse(JSON.stringify(dependencies)),
            config: JSON.parse(JSON.stringify(config)),
            timestamp: Date.now()
          }
        },

        clearErrors: () => {
          set({ error: undefined })
        },

        // AC1: Get rollback history
        getRollbackHistory: () => {
          return apiClient.getStateSnapshots()
        },

        // AC1: Clear rollback history
        clearRollbackHistory: (prefix?: string) => {
          apiClient.clearStateSnapshots(prefix)
        }
      }
    }
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