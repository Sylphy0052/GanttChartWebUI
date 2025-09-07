/**
 * Auto-Scheduling Demo Component - T010 AC4 & AC5 Demonstration
 * 
 * This component demonstrates the auto-scheduling functionality with:
 * - AC4: Automatic successor task shifting when predecessors move
 * - AC5: All auto-adjustments included in single undo operation
 * 
 * Features:
 * - Visual demonstration of dependency scheduling
 * - Real-time impact analysis
 * - Undo/redo with auto-scheduling integration
 * - Performance metrics display
 */

'use client'

import React, { useState, useCallback } from 'react'
import { GanttTask, GanttDependency } from '@/types/gantt'
import { useAutoScheduling } from '@/hooks/useAutoScheduling'
import { useUndoRedo } from '@/hooks/useUndoRedo'

interface AutoSchedulingDemoProps {
  projectId: string
}

// Demo data for auto-scheduling demonstration
const DEMO_TASKS: GanttTask[] = [
  {
    id: 'task-setup',
    title: 'Project Setup',
    startDate: '2024-01-01',
    endDate: '2024-01-03',
    progress: 100,
    assignee: 'John Doe',
    priority: 'high',
    status: 'completed'
  },
  {
    id: 'task-design',
    title: 'UI/UX Design',
    startDate: '2024-01-04',
    endDate: '2024-01-10',
    progress: 75,
    assignee: 'Jane Smith',
    priority: 'high',
    status: 'in-progress'
  },
  {
    id: 'task-frontend',
    title: 'Frontend Development',
    startDate: '2024-01-11',
    endDate: '2024-01-20',
    progress: 30,
    assignee: 'Mike Johnson',
    priority: 'medium',
    status: 'in-progress'
  },
  {
    id: 'task-backend',
    title: 'Backend API',
    startDate: '2024-01-11',
    endDate: '2024-01-18',
    progress: 0,
    assignee: 'Sarah Wilson',
    priority: 'medium',
    status: 'todo'
  },
  {
    id: 'task-integration',
    title: 'Integration Testing',
    startDate: '2024-01-21',
    endDate: '2024-01-25',
    progress: 0,
    assignee: 'Chris Brown',
    priority: 'high',
    status: 'todo'
  }
]

const DEMO_DEPENDENCIES: GanttDependency[] = [
  {
    id: 'dep-1',
    predecessorId: 'task-setup',
    successorId: 'task-design',
    fromTaskId: 'task-setup',
    toTaskId: 'task-design',
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  },
  {
    id: 'dep-2',
    predecessorId: 'task-design',
    successorId: 'task-frontend',
    fromTaskId: 'task-design',
    toTaskId: 'task-frontend',
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  },
  {
    id: 'dep-3',
    predecessorId: 'task-design',
    successorId: 'task-backend',
    fromTaskId: 'task-design',
    toTaskId: 'task-backend',
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  },
  {
    id: 'dep-4',
    predecessorId: 'task-frontend',
    successorId: 'task-integration',
    fromTaskId: 'task-frontend',
    toTaskId: 'task-integration',
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  },
  {
    id: 'dep-5',
    predecessorId: 'task-backend',
    successorId: 'task-integration',
    fromTaskId: 'task-backend',
    toTaskId: 'task-integration',
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  }
]

export const AutoSchedulingDemo: React.FC<AutoSchedulingDemoProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<GanttTask[]>(DEMO_TASKS)
  const [schedulingEnabled, setSchedulingEnabled] = useState(true)
  const [lastSchedulingResult, setLastSchedulingResult] = useState<any>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)

  // Mock task update function that updates local state
  const handleTaskUpdate = useCallback(async (taskId: string, startDate: Date, endDate: Date) => {
    console.log(`🔄 Updating task ${taskId}:`, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    })

    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
          }
        : task
    ))

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50))
  }, [])

  // Get auto-scheduling hook
  const {
    executeBarMoveWithScheduling,
    analyzeSchedulingImpact,
    isAutoSchedulingAvailable,
    config,
    isProcessing
  } = useAutoScheduling({
    projectId,
    tasks,
    onTaskUpdate: handleTaskUpdate,
    config: {
      enabled: schedulingEnabled,
      showPreview: true,
      maxAffectedTasks: 10,
      performanceThreshold: 1000
    }
  })

  // Get undo/redo functionality
  const { canUndo, canRedo, undo, redo, historyCount } = useUndoRedo({
    maxHistorySize: 20,
    onCommandExecuted: (command, result) => {
      setPerformanceMetrics({
        executionTime: result.executionTime,
        success: result.success,
        commandType: command.type,
        description: command.description
      })
    }
  })

  // Simulate moving a task
  const handleMoveTask = useCallback(async (taskId: string, dayOffset: number) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const originalStart = new Date(task.startDate)
    const originalEnd = new Date(task.endDate)
    const newStart = new Date(originalStart.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    const newEnd = new Date(originalEnd.getTime() + dayOffset * 24 * 60 * 60 * 1000)

    console.log(`🎯 Moving ${taskId} by ${dayOffset} days`)

    // Analyze impact before execution
    const impact = await analyzeSchedulingImpact(taskId)
    setLastSchedulingResult(impact)

    try {
      await executeBarMoveWithScheduling({
        taskId,
        originalStartDate: originalStart,
        originalEndDate: originalEnd,
        newStartDate: newStart,
        newEndDate: newEnd
      })

      console.log('✅ Task move completed with auto-scheduling')
    } catch (error) {
      console.error('❌ Task move failed:', error)
    }
  }, [tasks, executeBarMoveWithScheduling, analyzeSchedulingImpact])

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toISOString().split('T')[0]
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Auto-Scheduling Demo (T010 AC4 & AC5)
      </h2>

      {/* Control Panel */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Controls</h3>
          <div className="flex gap-2">
            <button
              onClick={() => undo()}
              disabled={!canUndo || isProcessing}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Undo ({canUndo ? '✓' : '✗'})
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo || isProcessing}
              className="px-3 py-1 bg-green-500 text-white rounded disabled:bg-gray-300"
            >
              Redo ({canRedo ? '✓' : '✗'})
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={schedulingEnabled}
              onChange={(e) => setSchedulingEnabled(e.target.checked)}
            />
            Auto-Scheduling Enabled
          </label>
          <span className="text-sm text-gray-600">
            History: {historyCount} commands
          </span>
          {isProcessing && (
            <span className="text-sm text-orange-600">⏳ Processing...</span>
          )}
        </div>
      </div>

      {/* Demo Actions */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h3 className="text-lg font-semibold mb-3">Demo Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            onClick={() => handleMoveTask('task-setup', 2)}
            disabled={isProcessing}
            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
          >
            Move Setup +2 days
          </button>
          <button
            onClick={() => handleMoveTask('task-design', 3)}
            disabled={isProcessing}
            className="px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300"
          >
            Move Design +3 days
          </button>
          <button
            onClick={() => handleMoveTask('task-design', -1)}
            disabled={isProcessing}
            className="px-3 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:bg-gray-300"
          >
            Move Design -1 day
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          These actions will trigger auto-scheduling of dependent tasks. 
          Use Undo to revert all changes at once (AC5 demonstration).
        </p>
      </div>

      {/* Scheduling Impact Analysis */}
      {lastSchedulingResult && (
        <div className="mb-6 p-4 bg-yellow-50 rounded">
          <h3 className="text-lg font-semibold mb-3">Last Scheduling Impact</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Affected Tasks:</span>
              <br />
              {lastSchedulingResult.estimatedAffectedTasks}
            </div>
            <div>
              <span className="font-medium">Cascading Levels:</span>
              <br />
              {lastSchedulingResult.maxCascadingLevels}
            </div>
            <div>
              <span className="font-medium">Execution Time:</span>
              <br />
              {lastSchedulingResult.estimatedExecutionTime}ms
            </div>
            <div>
              <span className="font-medium">Action:</span>
              <br />
              <span className={`font-bold ${
                lastSchedulingResult.recommendedAction === 'proceed' ? 'text-green-600' :
                lastSchedulingResult.recommendedAction === 'review' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {lastSchedulingResult.recommendedAction.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {performanceMetrics && (
        <div className="mb-6 p-4 bg-green-50 rounded">
          <h3 className="text-lg font-semibold mb-3">Last Operation Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Command:</span>
              <br />
              {performanceMetrics.commandType}
            </div>
            <div>
              <span className="font-medium">Execution Time:</span>
              <br />
              {performanceMetrics.executionTime.toFixed(2)}ms
            </div>
            <div>
              <span className="font-medium">Status:</span>
              <br />
              <span className={performanceMetrics.success ? 'text-green-600' : 'text-red-600'}>
                {performanceMetrics.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>
            <div>
              <span className="font-medium">Description:</span>
              <br />
              {performanceMetrics.description}
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-3">Task Timeline</h3>
        <div className="space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex justify-between items-center p-3 bg-white rounded border"
            >
              <div className="flex-1">
                <span className="font-medium">{task.title}</span>
                <div className="text-sm text-gray-600">
                  {formatDate(task.startDate)} → {formatDate(task.endDate)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.status}
                </span>
                {isAutoSchedulingAvailable(task.id) && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                    Auto-Schedulable
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dependency Visualization */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-3">Dependencies</h3>
        <div className="space-y-1 text-sm">
          {DEMO_DEPENDENCIES.map(dep => (
            <div key={dep.id} className="flex items-center gap-2">
              <span className="font-mono text-blue-600">
                {tasks.find(t => t.id === dep.predecessorId)?.title}
              </span>
              <span>→</span>
              <span className="font-mono text-green-600">
                {tasks.find(t => t.id === dep.successorId)?.title}
              </span>
              <span className="px-1 py-0.5 bg-gray-200 rounded text-xs">
                {dep.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="text-lg font-semibold mb-2">Test Instructions</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li><strong>AC4 Test:</strong> Click "Move Design +3 days" and watch Frontend/Backend/Integration automatically shift</li>
          <li><strong>AC5 Test:</strong> After moving tasks, click "Undo" to revert ALL changes in one operation</li>
          <li><strong>Performance:</strong> Monitor execution times and affected task counts</li>
          <li><strong>Dependencies:</strong> Observe how the dependency chain propagates changes</li>
        </ul>
      </div>
    </div>
  )
}

export default AutoSchedulingDemo