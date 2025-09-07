/**
 * Progress Management System Integration Component
 * 
 * Integrates all T015 acceptance criteria into a cohesive system:
 * 
 * AC1: Progress input field with percentage validation (0-100%) for leaf tasks only ✅ (ProgressInput)
 * AC2: Visual progress handles on Gantt bars support drag-to-update functionality ✅
 * AC3: Parent task progress displays as read-only computed values from children ✅
 * AC4: Progress change validation prevents editing non-leaf tasks with clear user feedback ✅
 * AC5: Undo/redo integration supports progress operations with proper state management ✅
 * AC6: Batch progress update modal handles multiple selected tasks efficiently ✅
 * AC7: Progress change telemetry records operation timing and success metrics ✅
 */

'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { GanttTask } from '@/types/gantt'
import { EnhancedGanttBar } from './EnhancedGanttBar'
import { BatchProgressUpdateModal } from './BatchProgressUpdateModal'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { useIssuesStore } from '@/stores/issues.store'
import { ProgressCommandFactory, ProgressUtils } from '@/lib/commands/ProgressCommand'
import { trackProgressOperation, useProgressTelemetry } from '@/lib/telemetry/progress-telemetry'
import { 
  Bars3BottomRightIcon, 
  ArrowUturnLeftIcon, 
  ArrowUturnRightIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface ProgressManagementSystemProps {
  tasks: GanttTask[]
  selectedTaskIds: Set<string>
  onTaskUpdate?: (taskId: string, updates: { startDate: Date; endDate: Date }) => Promise<void>
  onTaskClick: (task: GanttTask) => void
  projectId?: string
  // Gantt rendering props
  x: number
  y: number
  width: number
  height: number
  pixelsPerDay?: number
  timelineStartDate?: Date
  // Enhanced features
  showProgressHandles?: boolean
  enableProgressDrag?: boolean
  enableBatchUpdate?: boolean
  showTelemetryPanel?: boolean
  'data-testid'?: string
}

interface TaskHierarchy {
  task: GanttTask
  children: GanttTask[]
  parents: GanttTask[]
  isLeaf: boolean
  computedProgress: number
}

interface ProgressValidationResult {
  isValid: boolean
  canEdit: boolean
  message?: string
  type: 'error' | 'warning' | 'info'
}

export const ProgressManagementSystem: React.FC<ProgressManagementSystemProps> = ({
  tasks,
  selectedTaskIds,
  onTaskUpdate,
  onTaskClick,
  projectId,
  x,
  y,
  width,
  height,
  pixelsPerDay = 30,
  timelineStartDate,
  showProgressHandles = true,
  enableProgressDrag = true,
  enableBatchUpdate = true,
  showTelemetryPanel = false,
  'data-testid': dataTestId
}) => {
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, ProgressValidationResult>>({})
  const [telemetryPanelVisible, setTelemetryPanelVisible] = useState(showTelemetryPanel)
  
  const updateIssue = useIssuesStore(state => state.updateIssue)
  
  // Undo/Redo system
  const { executeCommand, canUndo, canRedo, undo, redo, getHistory } = useUndoRedo({
    projectId: projectId || 'current-project',
    enableKeyboardShortcuts: true,
    telemetryEnabled: true,
    onCommandExecuted: (command, result) => {
      console.log('Progress command executed:', command.type, result.success)
    }
  })

  // Telemetry tracking
  const { trackOperation, getStats, exportData } = useProgressTelemetry()

  /**
   * Build task hierarchy for progress computation and validation (AC3, AC4)
   */
  const taskHierarchy = useMemo(() => {
    const hierarchyMap = new Map<string, TaskHierarchy>()
    
    // First pass: create basic hierarchy entries
    tasks.forEach(task => {
      hierarchyMap.set(task.id, {
        task,
        children: [],
        parents: [],
        isLeaf: true, // Will be updated in second pass
        computedProgress: task.progress
      })
    })
    
    // Second pass: build parent-child relationships
    tasks.forEach(task => {
      const entry = hierarchyMap.get(task.id)!
      
      // Find children (tasks that have this task as parent)
      const children = tasks.filter(t => t.parentId === task.id)
      entry.children = children
      entry.isLeaf = children.length === 0 && task.type !== 'summary'
      
      // Find parents (traverse up the hierarchy)
      const parents: GanttTask[] = []
      let currentParentId = task.parentId
      while (currentParentId) {
        const parent = tasks.find(t => t.id === currentParentId)
        if (parent) {
          parents.push(parent)
          currentParentId = parent.parentId
        } else {
          break
        }
      }
      entry.parents = parents
      
      // Compute progress for parent tasks (AC3)
      if (!entry.isLeaf && children.length > 0) {
        const childProgresses = children.map(child => child.progress)
        entry.computedProgress = ProgressUtils.calculateParentProgress(childProgresses)
      }
    })
    
    return hierarchyMap
  }, [tasks])

  /**
   * Validate progress edit capability (AC4)
   */
  const validateProgressEdit = useCallback(async (taskId: string): Promise<ProgressValidationResult> => {
    const hierarchy = taskHierarchy.get(taskId)
    if (!hierarchy) {
      return {
        isValid: false,
        canEdit: false,
        message: 'Task not found',
        type: 'error'
      }
    }

    // Track validation telemetry
    const validationStart = performance.now()
    
    try {
      // Leaf task validation
      if (!hierarchy.isLeaf) {
        const result = {
          isValid: false,
          canEdit: false,
          message: `This task has ${hierarchy.children.length} subtasks. Progress is automatically calculated from children.`,
          type: 'warning' as const
        }
        
        // Track validation telemetry
        trackOperation.validation(taskId, false, 'parent-task', performance.now() - validationStart)
        
        return result
      }

      // Additional validation checks could go here
      // (e.g., permissions, task status, etc.)
      
      const result = {
        isValid: true,
        canEdit: true,
        type: 'info' as const
      }
      
      // Track successful validation telemetry
      trackOperation.validation(taskId, true, 'leaf-task', performance.now() - validationStart)
      
      return result
      
    } catch (error) {
      const result = {
        isValid: false,
        canEdit: false,
        message: 'Validation failed. Please try again.',
        type: 'error' as const
      }
      
      // Track validation error telemetry
      trackOperation.validation(taskId, false, 'error', performance.now() - validationStart)
      
      return result
    }
  }, [taskHierarchy, trackOperation])

  /**
   * Handle individual progress update with telemetry and undo/redo (AC5, AC7)
   */
  const handleProgressUpdate = useCallback(async (taskId: string, newProgress: number): Promise<void> => {
    const hierarchy = taskHierarchy.get(taskId)
    if (!hierarchy) {
      throw new Error('Task not found')
    }

    const originalProgress = hierarchy.task.progress
    
    // Validate the operation
    const validation = await validateProgressEdit(taskId)
    if (!validation.canEdit) {
      throw new Error(validation.message || 'Cannot edit this task progress')
    }

    try {
      // Create and execute progress update command with undo/redo (AC5)
      const progressCommand = ProgressCommandFactory.createProgressUpdateCommand({
        taskId,
        originalProgress,
        newProgress,
        isLeafTask: hierarchy.isLeaf,
        parentTaskIds: hierarchy.parents.map(p => p.id),
        childTaskIds: hierarchy.children.map(c => c.id),
        source: 'input',
        interactionType: 'keyboard-input',
        onExecute: async (id: string, progress: number) => {
          await updateIssue(id, { progress })
        },
        onValidateLeafTask: async (id: string) => {
          const result = await validateProgressEdit(id)
          return result.canEdit
        },
        onComputeParentProgress: async (parentId: string, childIds: string[]) => {
          const children = childIds.map(id => taskHierarchy.get(id)?.task).filter(Boolean) as GanttTask[]
          return ProgressUtils.calculateParentProgress(children.map(c => c.progress))
        }
      })

      // Execute through undo/redo system (AC5)
      await executeCommand(progressCommand)
      
      // Update parent tasks if needed (AC3)
      for (const parent of hierarchy.parents) {
        const parentHierarchy = taskHierarchy.get(parent.id)
        if (parentHierarchy) {
          const newParentProgress = ProgressUtils.calculateParentProgress(
            parentHierarchy.children.map(c => c.id === taskId ? newProgress : c.progress)
          )
          
          if (newParentProgress !== parent.progress) {
            await updateIssue(parent.id, { progress: newParentProgress })
          }
        }
      }

      // Track successful operation telemetry (AC7)
      trackOperation.single(
        taskId,
        'keyboard-input',
        originalProgress,
        newProgress,
        true,
        {
          taskTitle: hierarchy.task.title,
          isLeafTask: hierarchy.isLeaf,
          hasChildren: hierarchy.children.length > 0,
          childCount: hierarchy.children.length,
          parentCount: hierarchy.parents.length
        }
      )

    } catch (error) {
      // Track failed operation telemetry (AC7)
      trackOperation.single(
        taskId,
        'keyboard-input',
        originalProgress,
        newProgress,
        false,
        {
          error: {
            type: error instanceof Error ? error.constructor.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            recoveryAttempted: false
          }
        }
      )
      
      throw error
    }
  }, [taskHierarchy, validateProgressEdit, executeCommand, updateIssue, trackOperation])

  /**
   * Handle batch progress update (AC6)
   */
  const handleBatchProgressUpdate = useCallback(() => {
    const selectedTasks = tasks.filter(task => selectedTaskIds.has(task.id))
    if (selectedTasks.length === 0) {
      return
    }

    setShowBatchModal(true)
  }, [tasks, selectedTaskIds])

  /**
   * Get selected tasks for batch operations
   */
  const selectedTasks = useMemo(() => {
    return tasks.filter(task => selectedTaskIds.has(task.id))
  }, [tasks, selectedTaskIds])

  /**
   * Render enhanced Gantt bars with progress management
   */
  const renderEnhancedGanttBars = () => {
    return tasks.map((task, index) => {
      const hierarchy = taskHierarchy.get(task.id)
      if (!hierarchy) return null

      const taskY = y + (index * height)
      
      return (
        <EnhancedGanttBar
          key={task.id}
          task={task}
          x={x}
          y={taskY}
          width={width}
          height={height}
          isSelected={selectedTaskIds.has(task.id)}
          onClick={onTaskClick}
          pixelsPerDay={pixelsPerDay}
          onTaskUpdate={onTaskUpdate}
          timelineStartDate={timelineStartDate}
          parentTasks={hierarchy.parents}
          childTasks={hierarchy.children}
          onProgressValidation={async (taskId) => {
            const result = await validateProgressEdit(taskId)
            return result.canEdit
          }}
          showProgressHandles={showProgressHandles}
          enableProgressDrag={enableProgressDrag}
          projectId={projectId}
          data-testid={`enhanced-gantt-bar-${task.id}`}
        />
      )
    })
  }

  /**
   * Progress management toolbar
   */
  const renderProgressToolbar = () => {
    const stats = getStats()
    
    return (
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-900">Progress Management</h3>
          
          {/* Selection info */}
          {selectedTaskIds.size > 0 && (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{selectedTaskIds.size} tasks selected</span>
              <span>•</span>
              <span>
                {selectedTasks.filter(task => taskHierarchy.get(task.id)?.isLeaf).length} editable
              </span>
            </div>
          )}
          
          {/* Validation warnings */}
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-center space-x-1 text-xs text-yellow-600">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span>{Object.keys(validationErrors).length} validation warnings</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Telemetry stats */}
          {telemetryPanelVisible && (
            <div className="flex items-center space-x-3 text-xs text-gray-500 mr-4">
              <span>Operations: {stats.operations.total}</span>
              <span>Success: {stats.operations.successRate.toFixed(1)}%</span>
              <span>Avg: {stats.performance.averageDuration.toFixed(0)}ms</span>
            </div>
          )}
          
          {/* Undo/Redo buttons */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className={cn(
              "p-2 rounded-md transition-colors",
              canUndo 
                ? "text-gray-700 hover:bg-gray-100" 
                : "text-gray-300 cursor-not-allowed"
            )}
            title="Undo progress change (Ctrl+Z)"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
          </button>
          
          <button
            onClick={redo}
            disabled={!canRedo}
            className={cn(
              "p-2 rounded-md transition-colors",
              canRedo 
                ? "text-gray-700 hover:bg-gray-100" 
                : "text-gray-300 cursor-not-allowed"
            )}
            title="Redo progress change (Ctrl+Y)"
          >
            <ArrowUturnRightIcon className="h-4 w-4" />
          </button>
          
          {/* Batch update button */}
          {enableBatchUpdate && (
            <button
              onClick={handleBatchProgressUpdate}
              disabled={selectedTaskIds.size === 0}
              className={cn(
                "px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1",
                selectedTaskIds.size > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
              title="Batch update progress for selected tasks"
            >
              <Bars3BottomRightIcon className="h-4 w-4" />
              <span>Batch Update ({selectedTaskIds.size})</span>
            </button>
          )}
          
          {/* Telemetry panel toggle */}
          <button
            onClick={() => setTelemetryPanelVisible(!telemetryPanelVisible)}
            className={cn(
              "p-2 rounded-md transition-colors",
              telemetryPanelVisible
                ? "bg-blue-100 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            )}
            title="Toggle telemetry panel"
          >
            <ChartBarIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  /**
   * Telemetry panel for monitoring progress operations (AC7)
   */
  const renderTelemetryPanel = () => {
    if (!telemetryPanelVisible) return null
    
    const stats = getStats()
    const history = getHistory()
    
    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-lg z-50">
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Progress Operation Telemetry</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Total Operations</div>
              <div className="text-lg font-semibold text-gray-900">{stats.operations.total}</div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Success Rate</div>
              <div className="text-lg font-semibold text-green-600">{stats.operations.successRate.toFixed(1)}%</div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Avg Duration</div>
              <div className="text-lg font-semibold text-blue-600">{stats.performance.averageDuration.toFixed(0)}ms</div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Tasks Updated</div>
              <div className="text-lg font-semibold text-purple-600">{stats.productivity.tasksUpdated}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Operation Types</h5>
              <div className="space-y-1">
                {Object.entries(stats.operations.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-gray-600">{type}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Interaction Types</h5>
              <div className="space-y-1">
                {Object.entries(stats.operations.byInteraction).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-gray-600">{type}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => console.log('Telemetry Data:', exportData())}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Export Data
            </button>
            <button
              onClick={() => setTelemetryPanelVisible(false)}
              className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="progress-management-system relative" data-testid={dataTestId}>
      {/* Progress Management Toolbar */}
      {renderProgressToolbar()}
      
      {/* Enhanced Gantt Bars with Progress Management */}
      <div className="gantt-bars-container">
        {renderEnhancedGanttBars()}
      </div>
      
      {/* Telemetry Panel */}
      {renderTelemetryPanel()}
      
      {/* Batch Progress Update Modal (AC6) */}
      {showBatchModal && (
        <BatchProgressUpdateModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          tasks={selectedTasks}
          parentTasks={tasks.filter(task => 
            selectedTasks.some(selected => 
              taskHierarchy.get(selected.id)?.parents.some(p => p.id === task.id)
            )
          )}
          childTaskMap={Object.fromEntries(
            selectedTasks.map(task => [
              task.id,
              taskHierarchy.get(task.id)?.children || []
            ])
          )}
          onProgressUpdate={handleProgressUpdate}
          onProgressValidation={async (taskId) => {
            const result = await validateProgressEdit(taskId)
            return result.canEdit
          }}
          projectId={projectId}
          data-testid="batch-progress-modal"
        />
      )}
    </div>
  )
}

ProgressManagementSystem.displayName = 'ProgressManagementSystem'