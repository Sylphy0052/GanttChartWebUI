/**
 * Batch Progress Update Modal Component
 * 
 * Implements AC6 for T015: Progress Management UI & Leaf Task Validation
 * 
 * Features:
 * - Batch progress update modal handles multiple selected tasks efficiently
 * - Validation prevents editing non-leaf tasks
 * - Progress bars and input controls for each task
 * - Real-time validation feedback
 * - Integration with undo/redo system
 * - Comprehensive telemetry and error handling
 */

'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  LockClosedIcon,
  ArrowPathIcon,
  PlayIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { GanttTask } from '@/types/gantt'
import { ProgressInput } from '@/components/ui/ProgressInput'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { BatchProgressUpdateCommand, ProgressCommandFactory, ProgressUtils } from '@/lib/commands/ProgressCommand'
import { cn } from '@/lib/utils'

interface BatchProgressUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: GanttTask[]
  parentTasks?: GanttTask[]
  childTaskMap?: Record<string, GanttTask[]>
  onProgressUpdate?: (taskId: string, progress: number) => Promise<void>
  onProgressValidation?: (taskId: string) => Promise<boolean>
  projectId?: string
  'data-testid'?: string
}

interface TaskProgressState {
  taskId: string
  originalProgress: number
  newProgress: number
  isLeafTask: boolean
  isValid: boolean
  validationMessage?: string
  canEdit: boolean
  hasChanges: boolean
}

interface BatchValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  editableTaskCount: number
  totalChangeCount: number
}

interface BatchExecutionState {
  isExecuting: boolean
  currentTaskIndex: number
  completedTasks: number
  failedTasks: number
  errors: string[]
  startTime?: number
  estimatedTimeRemaining?: number
}

export const BatchProgressUpdateModal: React.FC<BatchProgressUpdateModalProps> = ({
  isOpen,
  onClose,
  tasks,
  parentTasks = [],
  childTaskMap = {},
  onProgressUpdate,
  onProgressValidation,
  projectId,
  'data-testid': dataTestId
}) => {
  const [taskProgressStates, setTaskProgressStates] = useState<TaskProgressState[]>([])
  const [batchValidation, setBatchValidation] = useState<BatchValidationResult>({
    valid: false,
    errors: [],
    warnings: [],
    editableTaskCount: 0,
    totalChangeCount: 0
  })
  const [executionState, setExecutionState] = useState<BatchExecutionState>({
    isExecuting: false,
    currentTaskIndex: 0,
    completedTasks: 0,
    failedTasks: 0,
    errors: []
  })
  const [bulkUpdateValue, setBulkUpdateValue] = useState<number>(0)
  const [bulkUpdateMode, setBulkUpdateMode] = useState<'set' | 'add' | 'subtract'>('set')
  const [showBulkControls, setShowBulkControls] = useState(false)

  // Undo/Redo integration
  const { executeCommand, canUndo, canRedo } = useUndoRedo({
    projectId: projectId || 'current-project',
    enableKeyboardShortcuts: false, // Disabled in modal to avoid conflicts
    telemetryEnabled: true
  })

  /**
   * Initialize task progress states when modal opens
   */
  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      const initializeTaskStates = async () => {
        const states: TaskProgressState[] = []
        
        for (const task of tasks) {
          const childTasks = childTaskMap[task.id] || []
          const isLeafTask = childTasks.length === 0 && task.type !== 'summary'
          
          // Validate edit capability
          let canEdit = isLeafTask
          let validationMessage: string | undefined
          
          if (onProgressValidation) {
            try {
              canEdit = await onProgressValidation(task.id)
              if (!canEdit && isLeafTask) {
                validationMessage = 'Task validation failed'
              }
            } catch (error) {
              canEdit = false
              validationMessage = 'Validation error occurred'
            }
          }
          
          if (!isLeafTask) {
            validationMessage = 'Parent task progress is computed from children'
          }

          states.push({
            taskId: task.id,
            originalProgress: task.progress,
            newProgress: task.progress,
            isLeafTask,
            isValid: true,
            validationMessage,
            canEdit,
            hasChanges: false
          })
        }
        
        setTaskProgressStates(states)
        updateBatchValidation(states)
      }

      initializeTaskStates()
    }
  }, [isOpen, tasks, childTaskMap, onProgressValidation])

  /**
   * Update batch validation results
   */
  const updateBatchValidation = useCallback((states: TaskProgressState[]): BatchValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []
    let editableTaskCount = 0
    let totalChangeCount = 0

    states.forEach((state, index) => {
      const task = tasks[index]
      if (!task) return

      if (state.canEdit) {
        editableTaskCount++
      } else {
        warnings.push(`${task.title}: Cannot edit (${state.validationMessage})`)
      }

      if (state.hasChanges) {
        totalChangeCount++
        
        // Validate progress value
        const validation = ProgressUtils.validateProgress(state.newProgress)
        if (!validation.valid) {
          errors.push(`${task.title}: ${validation.error}`)
          state.isValid = false
          state.validationMessage = validation.error
        } else {
          state.isValid = true
          if (!state.canEdit) {
            state.validationMessage = state.isLeafTask ? 'Task validation failed' : 'Parent task progress is computed from children'
          } else {
            state.validationMessage = undefined
          }
        }
      }
    })

    const result: BatchValidationResult = {
      valid: errors.length === 0 && totalChangeCount > 0,
      errors,
      warnings,
      editableTaskCount,
      totalChangeCount
    }

    setBatchValidation(result)
    return result
  }, [tasks])

  /**
   * Handle individual task progress change
   */
  const handleTaskProgressChange = useCallback((taskId: string, newProgress: number) => {
    setTaskProgressStates(prevStates => {
      const newStates = prevStates.map(state => {
        if (state.taskId === taskId) {
          const hasChanges = newProgress !== state.originalProgress
          return {
            ...state,
            newProgress,
            hasChanges,
            isValid: true // Will be validated by updateBatchValidation
          }
        }
        return state
      })
      
      updateBatchValidation(newStates)
      return newStates
    })
  }, [updateBatchValidation])

  /**
   * Apply bulk update to all editable tasks
   */
  const applyBulkUpdate = useCallback(() => {
    setTaskProgressStates(prevStates => {
      const newStates = prevStates.map(state => {
        if (!state.canEdit) return state

        let newProgress: number
        switch (bulkUpdateMode) {
          case 'set':
            newProgress = bulkUpdateValue
            break
          case 'add':
            newProgress = Math.min(100, state.newProgress + bulkUpdateValue)
            break
          case 'subtract':
            newProgress = Math.max(0, state.newProgress - bulkUpdateValue)
            break
          default:
            return state
        }

        return {
          ...state,
          newProgress,
          hasChanges: newProgress !== state.originalProgress
        }
      })
      
      updateBatchValidation(newStates)
      return newStates
    })
    
    // Close bulk controls after applying
    setShowBulkControls(false)
    setBulkUpdateValue(0)
  }, [bulkUpdateValue, bulkUpdateMode, updateBatchValidation])

  /**
   * Reset all changes
   */
  const resetAllChanges = useCallback(() => {
    setTaskProgressStates(prevStates => {
      const newStates = prevStates.map(state => ({
        ...state,
        newProgress: state.originalProgress,
        hasChanges: false,
        isValid: true,
        validationMessage: state.canEdit ? undefined : state.validationMessage
      }))
      
      updateBatchValidation(newStates)
      return newStates
    })
  }, [updateBatchValidation])

  /**
   * Execute batch progress update
   */
  const executeBatchUpdate = useCallback(async () => {
    const changedStates = taskProgressStates.filter(state => state.hasChanges && state.canEdit && state.isValid)
    if (changedStates.length === 0) return

    setExecutionState({
      isExecuting: true,
      currentTaskIndex: 0,
      completedTasks: 0,
      failedTasks: 0,
      errors: [],
      startTime: Date.now()
    })

    try {
      // Create batch progress update command
      const batchCommand = ProgressCommandFactory.createBatchProgressUpdateCommand({
        updates: changedStates.map(state => ({
          taskId: state.taskId,
          originalProgress: state.originalProgress,
          newProgress: state.newProgress,
          isLeafTask: state.isLeafTask,
          source: 'batch',
          interactionType: 'mouse',
          onExecute: onProgressUpdate,
          onValidateLeafTask: onProgressValidation
        })),
        description: `Batch update progress for ${changedStates.length} tasks`,
        validateAllLeafTasks: true,
        stopOnFirstError: false,
        onProgressCallback: (completed: number, total: number) => {
          setExecutionState(prev => ({
            ...prev,
            currentTaskIndex: completed,
            completedTasks: completed,
            estimatedTimeRemaining: prev.startTime 
              ? ((Date.now() - prev.startTime) / completed) * (total - completed)
              : undefined
          }))
        }
      })

      // Execute through undo/redo system
      await executeCommand(batchCommand)

      // Update execution state
      setExecutionState(prev => ({
        ...prev,
        isExecuting: false,
        completedTasks: changedStates.length,
        failedTasks: 0
      }))

      // Close modal after short delay
      setTimeout(() => {
        onClose()
      }, 1000)

    } catch (error) {
      console.error('Batch progress update failed:', error)
      
      setExecutionState(prev => ({
        ...prev,
        isExecuting: false,
        errors: [...prev.errors, error instanceof Error ? error.message : 'Unknown error occurred']
      }))
    }
  }, [taskProgressStates, executeCommand, onProgressUpdate, onProgressValidation, onClose])

  // Memoized task list with computed properties
  const taskList = useMemo(() => {
    return tasks.map((task, index) => {
      const state = taskProgressStates[index]
      if (!state) return null

      const childTasks = childTaskMap[task.id] || []
      const progressChange = state.newProgress - state.originalProgress
      
      return {
        task,
        state,
        childTasks,
        progressChange,
        progressChangeText: ProgressUtils.formatProgressChange(state.originalProgress, state.newProgress)
      }
    }).filter(Boolean)
  }, [tasks, taskProgressStates, childTaskMap])

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} data-testid={dataTestId}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <Dialog.Title as="h3" className="text-xl font-semibold text-gray-900">
                      Batch Progress Update
                    </Dialog.Title>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{tasks.length} tasks selected</span>
                      <span>•</span>
                      <span>{batchValidation.editableTaskCount} editable</span>
                      {batchValidation.totalChangeCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 font-medium">{batchValidation.totalChangeCount} changes</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                    disabled={executionState.isExecuting}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Bulk Update Controls */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-900">Bulk Update Controls</h4>
                    <button
                      onClick={() => setShowBulkControls(!showBulkControls)}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      disabled={executionState.isExecuting}
                    >
                      {showBulkControls ? 'Hide' : 'Show'} Bulk Controls
                    </button>
                  </div>
                  
                  {showBulkControls && (
                    <div className="flex items-center space-x-4">
                      <select
                        value={bulkUpdateMode}
                        onChange={(e) => setBulkUpdateMode(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={executionState.isExecuting}
                      >
                        <option value="set">Set to</option>
                        <option value="add">Add</option>
                        <option value="subtract">Subtract</option>
                      </select>
                      
                      <input
                        type="number"
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(Number(e.target.value))}
                        min={0}
                        max={100}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={executionState.isExecuting}
                      />
                      
                      <span className="text-sm text-gray-500">%</span>
                      
                      <button
                        onClick={applyBulkUpdate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                        disabled={executionState.isExecuting}
                      >
                        Apply to {batchValidation.editableTaskCount} tasks
                      </button>
                      
                      <button
                        onClick={resetAllChanges}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                        disabled={executionState.isExecuting}
                      >
                        Reset All
                      </button>
                    </div>
                  )}
                </div>

                {/* Task List */}
                <div className="mb-6 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <div className="col-span-4">Task</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Current</div>
                    <div className="col-span-2">New</div>
                    <div className="col-span-1">Change</div>
                    <div className="col-span-1">Status</div>
                  </div>
                  
                  {taskList.map((item, index) => {
                    if (!item) return null
                    const { task, state, childTasks, progressChange, progressChangeText } = item
                    
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "grid grid-cols-12 gap-4 p-4 border-b border-gray-100",
                          executionState.isExecuting && executionState.currentTaskIndex === index && "bg-blue-50",
                          state.hasChanges && "bg-yellow-50",
                          !state.canEdit && "bg-gray-50"
                        )}
                      >
                        {/* Task Info */}
                        <div className="col-span-4">
                          <div className="flex items-center space-x-2">
                            {!state.isLeafTask && <span className="text-purple-500">📁</span>}
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {task.title}
                              </div>
                              {childTasks.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  {childTasks.length} subtasks
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Task Type */}
                        <div className="col-span-2 flex items-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            state.isLeafTask 
                              ? "bg-green-100 text-green-800" 
                              : "bg-purple-100 text-purple-800"
                          )}>
                            {state.isLeafTask ? 'Leaf Task' : 'Parent Task'}
                          </span>
                        </div>

                        {/* Current Progress */}
                        <div className="col-span-2 flex items-center">
                          <div className="w-full">
                            <div className="text-sm font-medium text-gray-900">
                              {state.originalProgress}%
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${state.originalProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* New Progress */}
                        <div className="col-span-2">
                          {state.canEdit ? (
                            <ProgressInput
                              value={state.newProgress}
                              onChange={(value) => handleTaskProgressChange(task.id, value)}
                              size="sm"
                              isLeafTask={state.isLeafTask}
                              disabled={executionState.isExecuting}
                              validationMessage={!state.isValid ? state.validationMessage : undefined}
                              data-testid={`progress-input-${task.id}`}
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">{state.newProgress}%</span>
                              <LockClosedIcon className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Change Indicator */}
                        <div className="col-span-1 flex items-center">
                          {progressChange !== 0 && (
                            <span className={cn(
                              "text-xs font-medium",
                              progressChange > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {progressChange > 0 ? '+' : ''}{progressChange}%
                            </span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="col-span-1 flex items-center justify-center">
                          {executionState.isExecuting && executionState.currentTaskIndex === index ? (
                            <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />
                          ) : !state.canEdit ? (
                            <LockClosedIcon className="h-4 w-4 text-gray-400" />
                          ) : !state.isValid ? (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                          ) : state.hasChanges ? (
                            <ClockIcon className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <CheckCircleIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Validation Messages */}
                {(batchValidation.errors.length > 0 || batchValidation.warnings.length > 0) && (
                  <div className="mb-6 space-y-2">
                    {batchValidation.errors.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                          <h4 className="text-sm font-medium text-red-800">Validation Errors</h4>
                        </div>
                        <ul className="text-sm text-red-700 space-y-1">
                          {batchValidation.errors.map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {batchValidation.warnings.length > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                          <h4 className="text-sm font-medium text-yellow-800">Warnings</h4>
                        </div>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          {batchValidation.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Execution Progress */}
                {executionState.isExecuting && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-blue-800">Updating Progress...</h4>
                      <span className="text-sm text-blue-600">
                        {executionState.completedTasks} / {batchValidation.totalChangeCount}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(executionState.completedTasks / batchValidation.totalChangeCount) * 100}%` 
                        }}
                      />
                    </div>
                    {executionState.estimatedTimeRemaining && (
                      <p className="text-xs text-blue-600 mt-2">
                        Estimated time remaining: {Math.ceil(executionState.estimatedTimeRemaining / 1000)}s
                      </p>
                    )}
                  </div>
                )}

                {/* Execution Errors */}
                {executionState.errors.length > 0 && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                      <h4 className="text-sm font-medium text-red-800">Execution Errors</h4>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1">
                      {executionState.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>Press Ctrl+Z to undo after applying changes</span>
                    {canUndo && (
                      <span className="text-blue-600">• Undo available</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      onClick={onClose}
                      disabled={executionState.isExecuting}
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="button"
                      className={cn(
                        "px-6 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2",
                        batchValidation.valid && !executionState.isExecuting
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      )}
                      onClick={executeBatchUpdate}
                      disabled={!batchValidation.valid || executionState.isExecuting}
                    >
                      {executionState.isExecuting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4" />
                          <span>Update {batchValidation.totalChangeCount} Tasks</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

BatchProgressUpdateModal.displayName = 'BatchProgressUpdateModal'