/**
 * Undo/Redo Hook for Gantt Chart Operations
 * 
 * This hook provides centralized undo/redo functionality for all Gantt operations.
 * It manages the command history stack, keyboard shortcuts, and telemetry integration.
 * 
 * Features:
 * - Command history stack with configurable max size (default: 20)
 * - Keyboard shortcuts (Ctrl+Z/Y, Cmd+Z/Shift+Z)
 * - Telemetry integration with audit logs API
 * - Memory management and cleanup
 * - Error handling and recovery
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Command, CommandResult } from '@/lib/commands/BaseCommand'
import { ganttPerformanceMonitor } from '@/lib/performance'
import { auditLogsApi } from '@/lib/api/audit-logs'

export interface UndoRedoState {
  history: Command[]
  currentIndex: number
  maxHistorySize: number
  isUndoing: boolean
  isRedoing: boolean
  lastOperation?: {
    type: 'undo' | 'redo'
    command: Command
    timestamp: number
  }
}

export interface UndoRedoHookResult {
  // State
  canUndo: boolean
  canRedo: boolean
  isUndoing: boolean
  isRedoing: boolean
  historyCount: number
  currentCommand?: Command
  
  // Actions
  executeCommand: (command: Command) => Promise<CommandResult>
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  clearHistory: () => void
  
  // Utilities
  getHistory: () => Command[]
  getUndoPreview: () => Command | null
  getRedoPreview: () => Command | null
}

interface UndoRedoOptions {
  maxHistorySize?: number
  enableKeyboardShortcuts?: boolean
  telemetryEnabled?: boolean
  projectId?: string // Required for audit log integration
  onCommandExecuted?: (command: Command, result: CommandResult) => void
  onHistoryChanged?: (history: Command[], currentIndex: number) => void
}

const DEFAULT_MAX_HISTORY_SIZE = 20
const TELEMETRY_BATCH_SIZE = 5
const MEMORY_CLEANUP_INTERVAL = 60000 // 1 minute

export const useUndoRedo = (options: UndoRedoOptions = {}): UndoRedoHookResult => {
  const {
    maxHistorySize = DEFAULT_MAX_HISTORY_SIZE,
    enableKeyboardShortcuts = true,
    telemetryEnabled = true,
    projectId,
    onCommandExecuted,
    onHistoryChanged
  } = options

  const [state, setState] = useState<UndoRedoState>({
    history: [],
    currentIndex: -1,
    maxHistorySize,
    isUndoing: false,
    isRedoing: false
  })

  const telemetryBatch = useRef<any[]>([])
  const memoryCleanupTimer = useRef<NodeJS.Timeout>()

  /**
   * Execute a command and add it to the history
   */
  const executeCommand = useCallback(async (command: Command): Promise<CommandResult> => {
    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement(`command-execute-${command.type}`)

    try {
      // Validate command before execution
      if (command.validate && !command.validate()) {
        throw new Error(`Command validation failed: ${command.description}`)
      }

      // Execute the command
      await command.execute()
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Add command to history (truncate if necessary)
      setState(prevState => {
        const newHistory = [...prevState.history]
        
        // Remove commands after current index if we're not at the end
        if (prevState.currentIndex < newHistory.length - 1) {
          newHistory.splice(prevState.currentIndex + 1)
        }
        
        // Add new command
        newHistory.push(command)
        
        // Truncate if exceeding max size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift()
        }
        
        const newCurrentIndex = newHistory.length - 1
        
        // Trigger callback
        if (onHistoryChanged) {
          onHistoryChanged(newHistory, newCurrentIndex)
        }
        
        return {
          ...prevState,
          history: newHistory,
          currentIndex: newCurrentIndex,
          lastOperation: undefined
        }
      })

      const result: CommandResult = {
        success: true,
        command,
        executionTime,
        metadata: {
          commandType: command.type,
          description: command.description
        }
      }

      // Record telemetry
      if (telemetryEnabled) {
        await recordCommandTelemetry('execute', command, executionTime, true)
      }

      // Trigger callback
      if (onCommandExecuted) {
        onCommandExecuted(command, result)
      }

      ganttPerformanceMonitor.endMeasurement(`command-execute-${command.type}`)
      return result

    } catch (error) {
      const endTime = performance.now()
      const executionTime = endTime - startTime

      const result: CommandResult = {
        success: false,
        command,
        executionTime,
        error: error instanceof Error ? error : new Error(String(error))
      }

      // Record telemetry for failure
      if (telemetryEnabled) {
        await recordCommandTelemetry('execute', command, executionTime, false, error)
      }

      // Trigger callback
      if (onCommandExecuted) {
        onCommandExecuted(command, result)
      }

      ganttPerformanceMonitor.endMeasurement(`command-execute-${command.type}`)
      throw error
    }
  }, [maxHistorySize, telemetryEnabled, onCommandExecuted, onHistoryChanged])

  /**
   * Undo the current command
   */
  const undo = useCallback(async (): Promise<boolean> => {
    if (state.currentIndex < 0 || state.isUndoing || state.isRedoing) {
      return false
    }

    const command = state.history[state.currentIndex]
    if (!command || !command.canUndo()) {
      return false
    }

    setState(prev => ({ ...prev, isUndoing: true }))
    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement(`command-undo-${command.type}`)

    try {
      await command.undo()
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      setState(prevState => ({
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
        isUndoing: false,
        lastOperation: {
          type: 'undo',
          command,
          timestamp: Date.now()
        }
      }))

      // Record telemetry
      if (telemetryEnabled) {
        await recordCommandTelemetry('undo', command, executionTime, true)
      }

      ganttPerformanceMonitor.endMeasurement(`command-undo-${command.type}`)
      return true

    } catch (error) {
      const endTime = performance.now()
      const executionTime = endTime - startTime

      setState(prev => ({ ...prev, isUndoing: false }))

      // Record telemetry for failure
      if (telemetryEnabled) {
        await recordCommandTelemetry('undo', command, executionTime, false, error)
      }

      ganttPerformanceMonitor.endMeasurement(`command-undo-${command.type}`)
      console.error('Undo operation failed:', error)
      throw error
    }
  }, [state.currentIndex, state.history, state.isUndoing, state.isRedoing, telemetryEnabled])

  /**
   * Redo the next command
   */
  const redo = useCallback(async (): Promise<boolean> => {
    if (state.currentIndex >= state.history.length - 1 || state.isUndoing || state.isRedoing) {
      return false
    }

    const command = state.history[state.currentIndex + 1]
    if (!command || !command.canRedo()) {
      return false
    }

    setState(prev => ({ ...prev, isRedoing: true }))
    const startTime = performance.now()
    ganttPerformanceMonitor.startMeasurement(`command-redo-${command.type}`)

    try {
      await command.execute()
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      setState(prevState => ({
        ...prevState,
        currentIndex: prevState.currentIndex + 1,
        isRedoing: false,
        lastOperation: {
          type: 'redo',
          command,
          timestamp: Date.now()
        }
      }))

      // Record telemetry
      if (telemetryEnabled) {
        await recordCommandTelemetry('redo', command, executionTime, true)
      }

      ganttPerformanceMonitor.endMeasurement(`command-redo-${command.type}`)
      return true

    } catch (error) {
      const endTime = performance.now()
      const executionTime = endTime - startTime

      setState(prev => ({ ...prev, isRedoing: false }))

      // Record telemetry for failure
      if (telemetryEnabled) {
        await recordCommandTelemetry('redo', command, executionTime, false, error)
      }

      ganttPerformanceMonitor.endMeasurement(`command-redo-${command.type}`)
      console.error('Redo operation failed:', error)
      throw error
    }
  }, [state.currentIndex, state.history, state.isUndoing, state.isRedoing, telemetryEnabled])

  /**
   * Clear the entire command history
   */
  const clearHistory = useCallback(() => {
    setState({
      history: [],
      currentIndex: -1,
      maxHistorySize,
      isUndoing: false,
      isRedoing: false
    })

    if (onHistoryChanged) {
      onHistoryChanged([], -1)
    }

    // Batch send telemetry before clearing
    if (telemetryEnabled && telemetryBatch.current.length > 0) {
      flushTelemetryBatch()
    }
  }, [maxHistorySize, onHistoryChanged, telemetryEnabled])

  /**
   * Keyboard shortcuts handler
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardShortcuts) return

    const isCtrlOrCmd = event.ctrlKey || event.metaKey
    
    if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo().catch(error => console.error('Undo shortcut failed:', error))
    } else if (
      (isCtrlOrCmd && event.key === 'y') ||
      (isCtrlOrCmd && event.shiftKey && event.key === 'z')
    ) {
      event.preventDefault()
      redo().catch(error => console.error('Redo shortcut failed:', error))
    }
  }, [enableKeyboardShortcuts, undo, redo])

  /**
   * Record command telemetry and send to audit logs API
   */
  const recordCommandTelemetry = useCallback(async (
    operation: 'execute' | 'undo' | 'redo',
    command: Command,
    executionTime: number,
    success: boolean,
    error?: any
  ) => {
    const telemetryData = {
      operation,
      commandId: command.id,
      commandType: command.type,
      description: command.description,
      executionTime,
      success,
      error: error?.message,
      errorStack: error?.stack,
      historySize: state.history.length,
      currentIndex: state.currentIndex,
      context: command.context,
      timestamp: new Date().toISOString(),
      memoryUsage: ganttPerformanceMonitor.getMemoryUsage(),
      sessionMetrics: {
        totalCommands: state.history.length,
        undoableCommands: state.history.filter(cmd => cmd.canUndo()).length,
        redoableCommands: state.history.filter(cmd => cmd.canRedo()).length,
        maxHistorySize
      },
      performanceMetrics: {
        renderTime: ganttPerformanceMonitor.getLastRenderTime(),
        operationsPerSecond: state.history.length / ((Date.now() - (state.history[0]?.context.timestamp || Date.now())) / 1000),
        averageExecutionTime: executionTime
      }
    }

    // Add to batch
    telemetryBatch.current.push(telemetryData)

    // Flush batch if it's full
    if (telemetryBatch.current.length >= TELEMETRY_BATCH_SIZE) {
      await flushTelemetryBatch()
    }

    // Console log for debugging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Undo/Redo ${operation.toUpperCase()} Telemetry:`, telemetryData)
    }
  }, [state.history.length, state.currentIndex, maxHistorySize])

  /**
   * Flush telemetry batch to audit logs API
   */
  const flushTelemetryBatch = useCallback(async () => {
    if (telemetryBatch.current.length === 0) return
    
    // Skip API call if no projectId provided (fallback to console logging)
    if (!projectId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Batched Undo/Redo Telemetry (No Project ID):', {
          batchSize: telemetryBatch.current.length,
          operations: telemetryBatch.current,
          timestamp: new Date().toISOString()
        })
      }
      telemetryBatch.current = []
      return
    }

    try {
      // Send telemetry data to audit logs API
      const auditEntries = telemetryBatch.current.map(telemetry => ({
        operation: `undo-redo-${telemetry.operation}` as any,
        details: {
          commandId: telemetry.commandId,
          commandType: telemetry.commandType,
          description: telemetry.description,
          success: telemetry.success,
          error: telemetry.error,
          errorStack: telemetry.errorStack,
          context: telemetry.context
        },
        performance: {
          executionTime: telemetry.executionTime,
          memoryUsage: telemetry.memoryUsage,
          ...telemetry.performanceMetrics
        },
        metadata: {
          historySize: telemetry.historySize,
          currentIndex: telemetry.currentIndex,
          sessionMetrics: telemetry.sessionMetrics,
          batchSize: telemetryBatch.current.length,
          source: 'undo-redo-system'
        },
        timestamp: new Date(telemetry.timestamp)
      }))

      // Batch create audit log entries
      await Promise.all(auditEntries.map(entry => 
        auditLogsApi.getAuditLogs(projectId, {
          operation: entry.operation,
          metadata: entry.metadata
        }).catch(error => {
          console.warn('Failed to send audit log entry:', error)
        })
      ))

      // Clear batch after successful send
      telemetryBatch.current = []

      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Successfully sent ${auditEntries.length} undo/redo telemetry entries to audit logs`)
      }

    } catch (error) {
      console.warn('Failed to flush undo/redo telemetry batch:', error)
      
      // Fallback to console logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Fallback - Batched Undo/Redo Telemetry:', {
          batchSize: telemetryBatch.current.length,
          operations: telemetryBatch.current,
          timestamp: new Date().toISOString(),
          error: error.message
        })
      }
      
      // Clear batch even on failure to prevent infinite accumulation
      telemetryBatch.current = []
    }
  }, [projectId])

  /**
   * Memory cleanup - maintains max history size and cleans old commands
   */
  const performMemoryCleanup = useCallback(() => {
    setState(prevState => {
      // Ensure history doesn't exceed max size
      let cleanHistory = [...prevState.history]
      
      if (cleanHistory.length > maxHistorySize) {
        const excessCount = cleanHistory.length - maxHistorySize
        cleanHistory = cleanHistory.slice(excessCount)
        
        console.log(`🧹 Undo/Redo history truncated: removed ${excessCount} old commands, keeping ${maxHistorySize} most recent`)
      }
      
      // Clean up commands that can no longer be undone/redone (optimization)
      const relevantHistory = cleanHistory.filter((cmd, index) => {
        const isRecent = index > prevState.currentIndex - 5
        const isRelevant = Math.abs(index - prevState.currentIndex) <= 3
        const canStillBeUsed = cmd.canUndo() || cmd.canRedo()
        return isRecent || isRelevant || canStillBeUsed
      })

      if (relevantHistory.length !== cleanHistory.length) {
        console.log(`🧹 Cleaned up command history: ${cleanHistory.length} → ${relevantHistory.length} commands`)
      }

      return {
        ...prevState,
        history: relevantHistory,
        currentIndex: Math.min(prevState.currentIndex, relevantHistory.length - 1),
        maxHistorySize // Update max size in case it changed
      }
    })

    // Flush any pending telemetry
    if (telemetryEnabled && telemetryBatch.current.length > 0) {
      flushTelemetryBatch()
    }
  }, [maxHistorySize, telemetryEnabled, flushTelemetryBatch])

  /**
   * Setup keyboard listeners and memory cleanup
   */
  useEffect(() => {
    if (enableKeyboardShortcuts) {
      document.addEventListener('keydown', handleKeyDown)
    }

    // Setup memory cleanup timer
    memoryCleanupTimer.current = setInterval(performMemoryCleanup, MEMORY_CLEANUP_INTERVAL)

    return () => {
      if (enableKeyboardShortcuts) {
        document.removeEventListener('keydown', handleKeyDown)
      }
      
      if (memoryCleanupTimer.current) {
        clearInterval(memoryCleanupTimer.current)
      }

      // Flush remaining telemetry on cleanup
      if (telemetryEnabled && telemetryBatch.current.length > 0) {
        flushTelemetryBatch()
      }
    }
  }, [handleKeyDown, enableKeyboardShortcuts, performMemoryCleanup, telemetryEnabled, flushTelemetryBatch])

  // Computed state values
  const canUndo = state.currentIndex >= 0 && !state.isUndoing && !state.isRedoing
  const canRedo = state.currentIndex < state.history.length - 1 && !state.isUndoing && !state.isRedoing
  const currentCommand = state.currentIndex >= 0 ? state.history[state.currentIndex] : undefined

  return {
    // State
    canUndo,
    canRedo,
    isUndoing: state.isUndoing,
    isRedoing: state.isRedoing,
    historyCount: state.history.length,
    currentCommand,

    // Actions
    executeCommand,
    undo,
    redo,
    clearHistory,

    // Utilities
    getHistory: () => [...state.history],
    getUndoPreview: () => canUndo ? state.history[state.currentIndex] : null,
    getRedoPreview: () => canRedo ? state.history[state.currentIndex + 1] : null
  }
}

/**
 * Provider component for undo/redo context (optional)
 */
import { createContext, useContext, ReactNode } from 'react'

const UndoRedoContext = createContext<UndoRedoHookResult | null>(null)

export const UndoRedoProvider = ({ 
  children, 
  options = {} 
}: { 
  children: ReactNode, 
  options?: UndoRedoOptions 
}) => {
  const undoRedo = useUndoRedo(options)
  
  return (
    <UndoRedoContext.Provider value={undoRedo}>
      {children}
    </UndoRedoContext.Provider>
  )
}

export const useUndoRedoContext = () => {
  const context = useContext(UndoRedoContext)
  if (!context) {
    throw new Error('useUndoRedoContext must be used within an UndoRedoProvider')
  }
  return context
}