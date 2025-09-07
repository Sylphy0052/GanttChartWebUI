/**
 * Dependency Undo/Redo Demo Component
 * 
 * Demonstrates T010-AC2: Dependency create/delete operations with undo/redo support.
 * This component provides a complete test interface for dependency command operations.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useDependenciesWithUndo } from '@/hooks/useDependenciesWithUndo'
import { GanttDependency } from '@/types/gantt'

interface DependencyUndoDemoProps {
  projectId?: string
  initialTasks?: Array<{
    id: string
    title: string
    startDate: Date
    endDate: Date
  }>
}

interface MockTask {
  id: string
  title: string
  startDate: Date
  endDate: Date
}

const DEFAULT_TASKS: MockTask[] = [
  {
    id: 'task-1',
    title: 'Project Planning',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-05')
  },
  {
    id: 'task-2',
    title: 'Requirements Gathering',
    startDate: new Date('2024-01-06'),
    endDate: new Date('2024-01-12')
  },
  {
    id: 'task-3',
    title: 'Design Phase',
    startDate: new Date('2024-01-13'),
    endDate: new Date('2024-01-20')
  },
  {
    id: 'task-4',
    title: 'Development',
    startDate: new Date('2024-01-21'),
    endDate: new Date('2024-02-10')
  },
  {
    id: 'task-5',
    title: 'Testing & QA',
    startDate: new Date('2024-02-11'),
    endDate: new Date('2024-02-20')
  }
]

export const DependencyUndoDemo: React.FC<DependencyUndoDemoProps> = ({
  projectId = 'demo-project',
  initialTasks = DEFAULT_TASKS
}) => {
  const [tasks] = useState<MockTask[]>(initialTasks)
  const [selectedPredecessor, setSelectedPredecessor] = useState<string>('')
  const [selectedSuccessor, setSelectedSuccessor] = useState<string>('')
  const [operationLog, setOperationLog] = useState<string[]>([])
  const [lastOperation, setLastOperation] = useState<{
    type: 'create' | 'delete' | 'undo' | 'redo'
    timestamp: number
    details: string
  } | null>(null)

  const {
    dependencies,
    loading,
    error,
    createDependencyWithUndo,
    deleteDependencyWithUndo,
    canUndoDependency,
    canRedoDependency,
    undoDependencyOperation,
    redoDependencyOperation,
    canCreateDependency,
    findExistingDependency,
    getTaskDependencies
  } = useDependenciesWithUndo({
    projectId,
    enableUndo: true,
    telemetryEnabled: true,
    onDependencyCreated: (dependency) => {
      const message = `✅ Created: ${dependency.predecessorId} → ${dependency.successorId}`
      addToLog(message)
      setLastOperation({
        type: 'create',
        timestamp: Date.now(),
        details: message
      })
    },
    onDependencyDeleted: (dependency) => {
      const message = `🗑️ Deleted: ${dependency.predecessorId} → ${dependency.successorId}`
      addToLog(message)
      setLastOperation({
        type: 'delete',
        timestamp: Date.now(),
        details: message
      })
    },
    onOperationFailed: (operation, error) => {
      const message = `❌ ${operation.toUpperCase()} failed: ${error.message}`
      addToLog(message)
    }
  })

  const addToLog = (message: string) => {
    setOperationLog(prev => [
      `${new Date().toLocaleTimeString()}: ${message}`,
      ...prev.slice(0, 9) // Keep last 10 entries
    ])
  }

  const handleCreateDependency = async () => {
    if (!selectedPredecessor || !selectedSuccessor) {
      addToLog('❌ Please select both predecessor and successor tasks')
      return
    }

    const validation = canCreateDependency(selectedPredecessor, selectedSuccessor)
    if (!validation.canCreate) {
      addToLog(`❌ Cannot create dependency: ${validation.reason}`)
      return
    }

    try {
      await createDependencyWithUndo(selectedPredecessor, selectedSuccessor)
    } catch (error) {
      // Error already logged by onOperationFailed callback
      console.error('Create dependency error:', error)
    }
  }

  const handleDeleteDependency = async () => {
    if (!selectedPredecessor || !selectedSuccessor) {
      addToLog('❌ Please select both predecessor and successor tasks')
      return
    }

    const existing = findExistingDependency(selectedPredecessor, selectedSuccessor)
    if (!existing) {
      addToLog('❌ No dependency exists between selected tasks')
      return
    }

    try {
      await deleteDependencyWithUndo(selectedPredecessor, selectedSuccessor)
    } catch (error) {
      // Error already logged by onOperationFailed callback
      console.error('Delete dependency error:', error)
    }
  }

  const handleUndo = async () => {
    if (!canUndoDependency) {
      addToLog('❌ No operations to undo')
      return
    }

    try {
      const success = await undoDependencyOperation()
      if (success) {
        const message = '↶ Undid last operation'
        addToLog(message)
        setLastOperation({
          type: 'undo',
          timestamp: Date.now(),
          details: message
        })
      } else {
        addToLog('❌ Undo failed')
      }
    } catch (error) {
      console.error('Undo error:', error)
    }
  }

  const handleRedo = async () => {
    if (!canRedoDependency) {
      addToLog('❌ No operations to redo')
      return
    }

    try {
      const success = await redoDependencyOperation()
      if (success) {
        const message = '↷ Redid last operation'
        addToLog(message)
        setLastOperation({
          type: 'redo',
          timestamp: Date.now(),
          details: message
        })
      } else {
        addToLog('❌ Redo failed')
      }
    } catch (error) {
      console.error('Redo error:', error)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault()
          handleUndo()
        } else if (event.key === 'y' || (event.shiftKey && event.key === 'z')) {
          event.preventDefault()
          handleRedo()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canUndoDependency, canRedoDependency])

  const getTaskName = (taskId: string): string => {
    return tasks.find(task => task.id === taskId)?.title || taskId
  }

  const renderDependencyInfo = (taskId: string) => {
    const taskDeps = getTaskDependencies(taskId)
    if (taskDeps.predecessors.length === 0 && taskDeps.successors.length === 0) {
      return null
    }

    return (
      <div className="text-xs text-gray-500 mt-1">
        {taskDeps.predecessors.length > 0 && (
          <div>← {taskDeps.predecessors.map(dep => getTaskName(dep.predecessorId)).join(', ')}</div>
        )}
        {taskDeps.successors.length > 0 && (
          <div>→ {taskDeps.successors.map(dep => getTaskName(dep.successorId)).join(', ')}</div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          T010-AC2: Dependency Undo/Redo Demo
        </h1>
        <p className="text-gray-600">
          Test dependency create/delete operations with full undo/redo support
        </p>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg border ${loading ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className="font-semibold text-sm">Status</h3>
          <p className="text-sm">{loading ? 'Loading...' : 'Ready'}</p>
        </div>
        
        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-sm">Dependencies</h3>
          <p className="text-sm">{dependencies.length} active</p>
        </div>
        
        <div className={`p-4 rounded-lg border ${error ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <h3 className="font-semibold text-sm">Error Status</h3>
          <p className="text-sm">{error || 'None'}</p>
        </div>
      </div>

      {/* Task Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Create/Delete Dependencies</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Predecessor Task
              </label>
              <select
                value={selectedPredecessor}
                onChange={(e) => setSelectedPredecessor(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select predecessor task...</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Successor Task
              </label>
              <select
                value={selectedSuccessor}
                onChange={(e) => setSelectedSuccessor(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select successor task...</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCreateDependency}
                disabled={loading || !selectedPredecessor || !selectedSuccessor}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Dependency
              </button>

              <button
                onClick={handleDeleteDependency}
                disabled={loading || !selectedPredecessor || !selectedSuccessor}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Dependency
              </button>
            </div>

            {/* Validation info */}
            {selectedPredecessor && selectedSuccessor && (
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                {(() => {
                  const existing = findExistingDependency(selectedPredecessor, selectedSuccessor)
                  const validation = canCreateDependency(selectedPredecessor, selectedSuccessor)
                  
                  return (
                    <div className="space-y-1">
                      <div>
                        <strong>Existing dependency:</strong> {existing ? '✅ Yes' : '❌ No'}
                      </div>
                      <div>
                        <strong>Can create:</strong> {validation.canCreate ? '✅ Yes' : `❌ ${validation.reason}`}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Undo/Redo Controls</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleUndo}
              disabled={!canUndoDependency}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>↶</span>
              Undo (Ctrl+Z)
            </button>

            <button
              onClick={handleRedo}
              disabled={!canRedoDependency}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>↷</span>
              Redo (Ctrl+Y)
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded-md text-sm">
            <div className="space-y-1">
              <div>
                <strong>Can Undo:</strong> {canUndoDependency ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Can Redo:</strong> {canRedoDependency ? '✅ Yes' : '❌ No'}
              </div>
            </div>
          </div>

          {lastOperation && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-sm mb-1">Last Operation</h4>
              <p className="text-sm text-gray-700">{lastOperation.details}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(lastOperation.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Current Dependencies */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Current Dependencies ({dependencies.length})</h3>
        
        {dependencies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No dependencies created yet. Create some dependencies to test undo/redo functionality!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dependencies.map((dep, index) => (
              <div
                key={dep.id || `${dep.predecessorId}-${dep.successorId}-${index}`}
                className="p-3 border border-gray-200 rounded-md bg-white"
              >
                <div className="text-sm font-medium">
                  {getTaskName(dep.predecessorId)} → {getTaskName(dep.successorId)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Type: {dep.type} | Lag: {dep.lag} {dep.lagUnit}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task List with Dependencies */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Tasks & Their Dependencies</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tasks.map(task => (
            <div
              key={task.id}
              className="p-3 border border-gray-200 rounded-md bg-white"
            >
              <div className="font-medium text-sm">{task.title}</div>
              <div className="text-xs text-gray-500">{task.id}</div>
              <div className="text-xs text-gray-500">
                {task.startDate.toLocaleDateString()} - {task.endDate.toLocaleDateString()}
              </div>
              {renderDependencyInfo(task.id)}
            </div>
          ))}
        </div>
      </div>

      {/* Operation Log */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Operation Log</h3>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm max-h-40 overflow-y-auto">
          {operationLog.length === 0 ? (
            <div className="text-gray-500">No operations performed yet...</div>
          ) : (
            operationLog.map((entry, index) => (
              <div key={index} className="mb-1">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-semibold text-sm mb-2">Instructions</h4>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Select predecessor and successor tasks to create/delete dependencies</li>
          <li>• Use <kbd className="bg-gray-200 px-1 rounded">Ctrl+Z</kbd> to undo operations</li>
          <li>• Use <kbd className="bg-gray-200 px-1 rounded">Ctrl+Y</kbd> to redo operations</li>
          <li>• Watch the operation log for real-time feedback</li>
          <li>• Dependencies prevent circular references automatically</li>
        </ul>
      </div>
    </div>
  )
}

export default DependencyUndoDemo