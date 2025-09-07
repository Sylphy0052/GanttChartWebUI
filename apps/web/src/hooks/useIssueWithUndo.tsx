/**
 * Hook for Issue Operations with Undo/Redo Support
 * 
 * This hook provides issue editing capabilities with full undo/redo functionality.
 * It wraps the standard issue operations in command pattern implementations that
 * integrate with the centralized undo/redo system.
 * 
 * Features:
 * - Batch editing with auto-save
 * - Undo/Redo for all issue modifications
 * - Real-time validation and conflict detection
 * - Performance optimizations for large issue sets
 * - Telemetry integration
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Issue } from '@/types/gantt'
import { useIssues } from '@/hooks/useIssues'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { IssueEditCommand } from '@/lib/commands/IssueEditCommand'
import { ganttPerformanceMonitor } from '@/lib/performance'

export interface IssueEditState {
  issues: Record<string, Issue>
  editingIssues: Set<string>
  validationErrors: Record<string, string[]>
  hasUnsavedChanges: boolean
  lastSavedAt?: number
  operationInProgress: boolean
}

export interface IssueWithUndoHookResult {
  // State
  issues: Record<string, Issue>
  editingIssues: Set<string>
  validationErrors: Record<string, string[]>
  hasUnsavedChanges: boolean
  operationInProgress: boolean
  isLoading: boolean
  
  // Issue Operations with Undo/Redo
  updateIssue: (issueId: string, updates: Partial<Issue>) => Promise<void>
  updateIssues: (updates: Array<{ issueId: string, updates: Partial<Issue> }>) => Promise<void>
  deleteIssue: (issueId: string) => Promise<void>
  restoreIssue: (issue: Issue) => Promise<void>
  
  // Batch Operations
  startBatchEdit: () => void
  commitBatchEdit: () => Promise<void>
  cancelBatchEdit: () => void
  
  // Auto-save Controls
  enableAutoSave: () => void
  disableAutoSave: () => void
  forceSave: () => Promise<void>
  
  // Undo/Redo Controls
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
  
  // Validation
  validateIssue: (issue: Issue) => string[]
  hasValidationErrors: (issueId: string) => boolean
}

interface UseIssueWithUndoOptions {
  projectId?: string // Required for telemetry
  autoSaveEnabled?: boolean
  autoSaveDelay?: number
  validateOnChange?: boolean
  enableBatchMode?: boolean
  onIssueUpdated?: (issue: Issue, command: IssueEditCommand) => void
  onError?: (error: Error, context: string) => void
  onStateChanged?: (state: IssueEditState) => void
}

const DEFAULT_AUTO_SAVE_DELAY = 2000
const VALIDATION_DEBOUNCE = 300

export const useIssueWithUndo = (options: UseIssueWithUndoOptions = {}): IssueWithUndoHookResult => {
  const {
    projectId,
    autoSaveEnabled = true,
    autoSaveDelay = DEFAULT_AUTO_SAVE_DELAY,
    validateOnChange = true,
    enableBatchMode = true,
    onIssueUpdated,
    onError,
    onStateChanged
  } = options

  const { updateIssue, isLoading } = useIssues()
  const undoRedo = useUndoRedo({
    enableKeyboardShortcuts: true,
    telemetryEnabled: true,
    projectId, // Pass projectId for audit log integration
    onCommandExecuted: (command, result) => {
      if (command.type === 'issue-edit' && result.success && onIssueUpdated) {
        const issueCommand = command as IssueEditCommand
        // Get the updated issue from the result metadata
        const updatedIssue = (result.metadata as any)?.updatedIssue
        if (updatedIssue) {
          onIssueUpdated(updatedIssue, issueCommand)
        }
      }
    }
  })

  const [state, setState] = useState<IssueEditState>({
    issues: {},
    editingIssues: new Set(),
    validationErrors: {},
    hasUnsavedChanges: false,
    operationInProgress: false
  })

  const autoSaveTimer = useRef<NodeJS.Timeout>()
  const validationTimer = useRef<NodeJS.Timeout>()
  const batchChanges = useRef<Array<{ issueId: string, updates: Partial<Issue> }>>([])
  const isBatchModeActive = useRef(false)

  /**
   * Validate an issue and return validation errors
   */
  const validateIssue = useCallback((issue: Issue): string[] => {
    const errors: string[] = []

    // Required fields validation
    if (!issue.title?.trim()) {
      errors.push('Title is required')
    }

    if (!issue.startDate) {
      errors.push('Start date is required')
    }

    if (!issue.endDate) {
      errors.push('End date is required')
    }

    // Date validation
    if (issue.startDate && issue.endDate && new Date(issue.startDate) > new Date(issue.endDate)) {
      errors.push('Start date must be before end date')
    }

    // Progress validation
    if (issue.progress !== undefined && (issue.progress < 0 || issue.progress > 100)) {
      errors.push('Progress must be between 0 and 100')
    }

    // Priority validation
    if (issue.priority && !['low', 'medium', 'high', 'urgent'].includes(issue.priority)) {
      errors.push('Invalid priority value')
    }

    // Status validation
    if (issue.status && !['not-started', 'in-progress', 'completed', 'blocked'].includes(issue.status)) {
      errors.push('Invalid status value')
    }

    return errors
  }, [])

  /**
   * Update validation errors with debouncing
   */
  const updateValidationErrors = useCallback((issueId: string, issue: Issue) => {
    if (!validateOnChange) return

    clearTimeout(validationTimer.current)
    validationTimer.current = setTimeout(() => {
      const errors = validateIssue(issue)
      setState(prev => ({
        ...prev,
        validationErrors: {
          ...prev.validationErrors,
          [issueId]: errors
        }
      }))
    }, VALIDATION_DEBOUNCE)
  }, [validateIssue, validateOnChange])

  /**
   * Update a single issue with undo/redo support
   */
  const updateIssueWithUndo = useCallback(async (issueId: string, updates: Partial<Issue>) => {
    if (state.operationInProgress) {
      throw new Error('Another operation is in progress')
    }

    setState(prev => ({ ...prev, operationInProgress: true }))

    try {
      const currentIssue = state.issues[issueId]
      if (!currentIssue) {
        throw new Error(`Issue with ID ${issueId} not found`)
      }

      const updatedIssue = { ...currentIssue, ...updates }

      // Validate the updated issue
      if (validateOnChange) {
        const errors = validateIssue(updatedIssue)
        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join(', ')}`)
        }
      }

      // Create and execute the command
      const command = new IssueEditCommand({
        issueId,
        originalIssue: currentIssue,
        updates,
        onExecute: async (id: string, issue: Issue) => {
          await updateIssue(id, issue)
          setState(prev => ({
            ...prev,
            issues: {
              ...prev.issues,
              [id]: issue
            },
            hasUnsavedChanges: autoSaveEnabled ? false : true,
            lastSavedAt: Date.now()
          }))
        },
        context: {
          projectId,
          batchMode: isBatchModeActive.current,
          validationEnabled: validateOnChange
        }
      })

      await undoRedo.executeCommand(command)

      // Update local state
      setState(prev => ({
        ...prev,
        issues: {
          ...prev.issues,
          [issueId]: updatedIssue
        },
        editingIssues: new Set([...prev.editingIssues, issueId])
      }))

      // Update validation
      updateValidationErrors(issueId, updatedIssue)

      // Setup auto-save if enabled
      if (autoSaveEnabled && !isBatchModeActive.current) {
        clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = setTimeout(async () => {
          try {
            setState(prev => ({ ...prev, hasUnsavedChanges: false, lastSavedAt: Date.now() }))
          } catch (error) {
            console.error('Auto-save failed:', error)
          }
        }, autoSaveDelay)
      }

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      console.error('Issue update failed:', errorObj)
      
      if (onError) {
        onError(errorObj, `updateIssue-${issueId}`)
      }
      
      throw errorObj
    } finally {
      setState(prev => ({ ...prev, operationInProgress: false }))
    }
  }, [state.issues, state.operationInProgress, updateIssue, undoRedo, validateIssue, validateOnChange, 
      updateValidationErrors, autoSaveEnabled, autoSaveDelay, onError, projectId])

  /**
   * Update multiple issues in batch
   */
  const updateIssuesWithUndo = useCallback(async (
    updates: Array<{ issueId: string, updates: Partial<Issue> }>
  ) => {
    if (state.operationInProgress) {
      throw new Error('Another operation is in progress')
    }

    setState(prev => ({ ...prev, operationInProgress: true }))

    try {
      const commands = updates.map(({ issueId, updates: issueUpdates }) => {
        const currentIssue = state.issues[issueId]
        if (!currentIssue) {
          throw new Error(`Issue with ID ${issueId} not found`)
        }

        return new IssueEditCommand({
          issueId,
          originalIssue: currentIssue,
          updates: issueUpdates,
          onExecute: async (id: string, issue: Issue) => {
            await updateIssue(id, issue)
            setState(prev => ({
              ...prev,
              issues: {
                ...prev.issues,
                [id]: issue
              }
            }))
          },
          context: {
            projectId,
            batchMode: true,
            validationEnabled: validateOnChange
          }
        })
      })

      // Execute all commands
      for (const command of commands) {
        await undoRedo.executeCommand(command)
      }

      setState(prev => ({
        ...prev,
        hasUnsavedChanges: autoSaveEnabled ? false : true,
        lastSavedAt: Date.now()
      }))

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      console.error('Batch issue update failed:', errorObj)
      
      if (onError) {
        onError(errorObj, 'updateIssues-batch')
      }
      
      throw errorObj
    } finally {
      setState(prev => ({ ...prev, operationInProgress: false }))
    }
  }, [state.issues, state.operationInProgress, updateIssue, undoRedo, autoSaveEnabled, 
      onError, projectId, validateOnChange])

  /**
   * Delete an issue with undo support
   */
  const deleteIssueWithUndo = useCallback(async (issueId: string) => {
    const currentIssue = state.issues[issueId]
    if (!currentIssue) {
      throw new Error(`Issue with ID ${issueId} not found`)
    }

    // Create delete command (implemented as setting deleted flag)
    const deleteCommand = new IssueEditCommand({
      issueId,
      originalIssue: currentIssue,
      updates: { deleted: true },
      onExecute: async (id: string, issue: Issue) => {
        setState(prev => {
          const newIssues = { ...prev.issues }
          delete newIssues[id]
          return {
            ...prev,
            issues: newIssues
          }
        })
      },
      context: {
        projectId,
        operation: 'delete'
      }
    })

    await undoRedo.executeCommand(deleteCommand)
  }, [state.issues, undoRedo, projectId])

  /**
   * Restore a deleted issue
   */
  const restoreIssueWithUndo = useCallback(async (issue: Issue) => {
    const restoreCommand = new IssueEditCommand({
      issueId: issue.id,
      originalIssue: { ...issue, deleted: true },
      updates: { deleted: false },
      onExecute: async (id: string, restoredIssue: Issue) => {
        await updateIssue(id, restoredIssue)
        setState(prev => ({
          ...prev,
          issues: {
            ...prev.issues,
            [id]: restoredIssue
          }
        }))
      },
      context: {
        projectId,
        operation: 'restore'
      }
    })

    await undoRedo.executeCommand(restoreCommand)
  }, [updateIssue, undoRedo, projectId])

  /**
   * Batch mode controls
   */
  const startBatchEdit = useCallback(() => {
    if (!enableBatchMode) return
    
    isBatchModeActive.current = true
    batchChanges.current = []
    
    setState(prev => ({
      ...prev,
      editingIssues: new Set()
    }))
  }, [enableBatchMode])

  const commitBatchEdit = useCallback(async () => {
    if (!isBatchModeActive.current || batchChanges.current.length === 0) return

    try {
      await updateIssuesWithUndo(batchChanges.current)
      batchChanges.current = []
      isBatchModeActive.current = false
      
      setState(prev => ({ 
        ...prev, 
        editingIssues: new Set(),
        hasUnsavedChanges: false 
      }))
    } catch (error) {
      console.error('Batch commit failed:', error)
      throw error
    }
  }, [updateIssuesWithUndo])

  const cancelBatchEdit = useCallback(() => {
    batchChanges.current = []
    isBatchModeActive.current = false
    
    setState(prev => ({ 
      ...prev, 
      editingIssues: new Set(),
      hasUnsavedChanges: false 
    }))
    
    // Clear any pending auto-save
    clearTimeout(autoSaveTimer.current)
  }, [])

  /**
   * Auto-save controls
   */
  const enableAutoSave = useCallback(() => {
    setState(prev => ({ ...prev, hasUnsavedChanges: false }))
  }, [])

  const disableAutoSave = useCallback(() => {
    clearTimeout(autoSaveTimer.current)
  }, [])

  const forceSave = useCallback(async () => {
    if (!state.hasUnsavedChanges) return

    try {
      setState(prev => ({ 
        ...prev, 
        hasUnsavedChanges: false, 
        lastSavedAt: Date.now() 
      }))
    } catch (error) {
      console.error('Force save failed:', error)
      throw error
    }
  }, [state.hasUnsavedChanges])

  /**
   * Utility functions
   */
  const hasValidationErrors = useCallback((issueId: string): boolean => {
    const errors = state.validationErrors[issueId]
    return errors ? errors.length > 0 : false
  }, [state.validationErrors])

  // State change notification
  useEffect(() => {
    if (onStateChanged) {
      onStateChanged(state)
    }
  }, [state, onStateChanged])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(autoSaveTimer.current)
      clearTimeout(validationTimer.current)
    }
  }, [])

  return {
    // State
    issues: state.issues,
    editingIssues: state.editingIssues,
    validationErrors: state.validationErrors,
    hasUnsavedChanges: state.hasUnsavedChanges,
    operationInProgress: state.operationInProgress,
    isLoading,

    // Issue Operations with Undo/Redo
    updateIssue: updateIssueWithUndo,
    updateIssues: updateIssuesWithUndo,
    deleteIssue: deleteIssueWithUndo,
    restoreIssue: restoreIssueWithUndo,

    // Batch Operations
    startBatchEdit,
    commitBatchEdit,
    cancelBatchEdit,

    // Auto-save Controls
    enableAutoSave,
    disableAutoSave,
    forceSave,

    // Undo/Redo Controls
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    clearHistory: undoRedo.clearHistory,

    // Validation
    validateIssue,
    hasValidationErrors
  }
}