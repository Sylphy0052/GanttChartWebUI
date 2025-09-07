/**
 * Progress Management Demo Page
 * 
 * Comprehensive demonstration of T015: Progress Management UI & Leaf Task Validation
 * 
 * This page showcases all implemented acceptance criteria:
 * AC1: Progress input field with percentage validation (0-100%) for leaf tasks only ✅
 * AC2: Visual progress handles on Gantt bars support drag-to-update functionality ✅
 * AC3: Parent task progress displays as read-only computed values from children ✅
 * AC4: Progress change validation prevents editing non-leaf tasks with clear user feedback ✅
 * AC5: Undo/redo integration supports progress operations with proper state management ✅
 * AC6: Batch progress update modal handles multiple selected tasks efficiently ✅
 * AC7: Progress change telemetry records operation timing and success metrics ✅
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ProgressInput } from '@/components/ui/ProgressInput'
import { EnhancedGanttBar } from '@/components/gantt/EnhancedGanttBar'
import { BatchProgressUpdateModal } from '@/components/gantt/BatchProgressUpdateModal'
import { ProgressManagementSystem } from '@/components/gantt/ProgressManagementSystem'
import { GanttTask } from '@/types/gantt'
import { UndoRedoProvider } from '@/hooks/useUndoRedo'
import { useProgressTelemetry } from '@/lib/telemetry/progress-telemetry'
import { ProgressUtils } from '@/lib/commands/ProgressCommand'
import { 
  PlayIcon, 
  PauseIcon, 
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

// Mock task data with realistic hierarchy
const generateMockTasks = (): GanttTask[] => [
  // Project root
  {
    id: 'project-1',
    title: 'Web Application Development',
    progress: 0, // Will be computed from children
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-03-31'),
    type: 'summary',
    parentId: null,
    dependencies: []
  },
  // Phase 1 - Planning (Parent)
  {
    id: 'phase-1',
    title: 'Planning Phase',
    progress: 0, // Will be computed from children
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-15'),
    type: 'summary',
    parentId: 'project-1',
    dependencies: []
  },
  // Phase 1 - Leaf tasks
  {
    id: 'task-1-1',
    title: 'Requirements Gathering',
    progress: 75,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-05'),
    type: 'task',
    parentId: 'phase-1',
    dependencies: []
  },
  {
    id: 'task-1-2',
    title: 'System Architecture Design',
    progress: 50,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-06'),
    endDate: new Date('2024-01-10'),
    type: 'task',
    parentId: 'phase-1',
    dependencies: [{ fromTaskId: 'task-1-1', toTaskId: 'task-1-2', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  {
    id: 'task-1-3',
    title: 'UI/UX Design',
    progress: 25,
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: new Date('2024-01-11'),
    endDate: new Date('2024-01-15'),
    type: 'task',
    parentId: 'phase-1',
    dependencies: [{ fromTaskId: 'task-1-2', toTaskId: 'task-1-3', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  // Phase 2 - Development (Parent)
  {
    id: 'phase-2',
    title: 'Development Phase',
    progress: 0, // Will be computed from children
    status: 'TODO',
    priority: 'HIGH',
    startDate: new Date('2024-01-16'),
    endDate: new Date('2024-03-15'),
    type: 'summary',
    parentId: 'project-1',
    dependencies: [{ fromTaskId: 'phase-1', toTaskId: 'phase-2', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  // Phase 2 - Leaf tasks
  {
    id: 'task-2-1',
    title: 'Frontend Implementation',
    progress: 30,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-16'),
    endDate: new Date('2024-02-15'),
    type: 'task',
    parentId: 'phase-2',
    dependencies: [{ fromTaskId: 'task-1-3', toTaskId: 'task-2-1', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  {
    id: 'task-2-2',
    title: 'Backend API Development',
    progress: 45,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-20'),
    endDate: new Date('2024-02-20'),
    type: 'task',
    parentId: 'phase-2',
    dependencies: [{ fromTaskId: 'task-1-2', toTaskId: 'task-2-2', type: 'FS', lag: 4, lagUnit: 'hours' }]
  },
  {
    id: 'task-2-3',
    title: 'Database Setup',
    progress: 80,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: new Date('2024-01-22'),
    endDate: new Date('2024-01-26'),
    type: 'task',
    parentId: 'phase-2',
    dependencies: []
  },
  {
    id: 'task-2-4',
    title: 'Integration Testing',
    progress: 0,
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: new Date('2024-02-21'),
    endDate: new Date('2024-03-15'),
    type: 'task',
    parentId: 'phase-2',
    dependencies: [
      { fromTaskId: 'task-2-1', toTaskId: 'task-2-4', type: 'FS', lag: 0, lagUnit: 'hours' },
      { fromTaskId: 'task-2-2', toTaskId: 'task-2-4', type: 'FS', lag: 0, lagUnit: 'hours' }
    ]
  },
  // Phase 3 - Deployment (Parent)
  {
    id: 'phase-3',
    title: 'Deployment Phase',
    progress: 0,
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: new Date('2024-03-16'),
    endDate: new Date('2024-03-31'),
    type: 'summary',
    parentId: 'project-1',
    dependencies: [{ fromTaskId: 'phase-2', toTaskId: 'phase-3', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  // Phase 3 - Leaf tasks
  {
    id: 'task-3-1',
    title: 'Production Deployment',
    progress: 0,
    status: 'TODO',
    priority: 'HIGH',
    startDate: new Date('2024-03-16'),
    endDate: new Date('2024-03-25'),
    type: 'task',
    parentId: 'phase-3',
    dependencies: [{ fromTaskId: 'task-2-4', toTaskId: 'task-3-1', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  {
    id: 'task-3-2',
    title: 'User Training & Documentation',
    progress: 0,
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: new Date('2024-03-20'),
    endDate: new Date('2024-03-31'),
    type: 'task',
    parentId: 'phase-3',
    dependencies: [{ fromTaskId: 'task-3-1', toTaskId: 'task-3-2', type: 'FS', lag: 0, lagUnit: 'hours' }]
  },
  // Milestone
  {
    id: 'milestone-1',
    title: 'Project Launch',
    progress: 0,
    status: 'TODO',
    priority: 'HIGH',
    startDate: new Date('2024-03-31'),
    endDate: new Date('2024-03-31'),
    type: 'milestone',
    parentId: 'project-1',
    dependencies: [{ fromTaskId: 'phase-3', toTaskId: 'milestone-1', type: 'FS', lag: 0, lagUnit: 'hours' }]
  }
]

export default function ProgressManagementDemoPage() {
  const [tasks, setTasks] = useState<GanttTask[]>(generateMockTasks())
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [activeDemo, setActiveDemo] = useState<string>('overview')
  const [simulationRunning, setSimulationRunning] = useState(false)
  
  const { getStats, exportData } = useProgressTelemetry()

  // Compute task hierarchy and parent progress (AC3)
  const taskHierarchy = useMemo(() => {
    const hierarchy = new Map<string, { children: GanttTask[]; parents: GanttTask[]; isLeaf: boolean }>()
    
    tasks.forEach(task => {
      const children = tasks.filter(t => t.parentId === task.id)
      const parents: GanttTask[] = []
      
      // Find all parent tasks
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
      
      hierarchy.set(task.id, {
        children,
        parents,
        isLeaf: children.length === 0 && task.type !== 'summary'
      })
    })
    
    return hierarchy
  }, [tasks])

  // Update parent task progress when children change (AC3)
  const updateParentProgress = useCallback((taskId: string, newProgress: number) => {
    setTasks(prevTasks => {
      const newTasks = [...prevTasks]
      
      // Update the task itself
      const taskIndex = newTasks.findIndex(t => t.id === taskId)
      if (taskIndex !== -1) {
        newTasks[taskIndex] = { ...newTasks[taskIndex], progress: newProgress }
      }
      
      // Update parent tasks recursively
      const updateParents = (childTaskId: string) => {
        const childTask = newTasks.find(t => t.id === childTaskId)
        if (childTask?.parentId) {
          const parentTask = newTasks.find(t => t.id === childTask.parentId)
          if (parentTask) {
            const siblings = newTasks.filter(t => t.parentId === parentTask.id)
            const parentProgress = ProgressUtils.calculateParentProgress(
              siblings.map(s => s.id === taskId ? newProgress : s.progress)
            )
            
            const parentIndex = newTasks.findIndex(t => t.id === parentTask.id)
            if (parentIndex !== -1) {
              newTasks[parentIndex] = { ...newTasks[parentIndex], progress: parentProgress }
            }
            
            // Recursively update grandparents
            updateParents(parentTask.id)
          }
        }
      }
      
      updateParents(taskId)
      return newTasks
    })
  }, [])

  // Handle task selection
  const handleTaskClick = useCallback((task: GanttTask) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(task.id)) {
        newSet.delete(task.id)
      } else {
        newSet.add(task.id)
      }
      return newSet
    })
  }, [])

  // Progress update handler
  const handleProgressUpdate = useCallback(async (taskId: string, progress: number) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))
    updateParentProgress(taskId, progress)
  }, [updateParentProgress])

  // Progress validation handler (AC4)
  const handleProgressValidation = useCallback(async (taskId: string): Promise<boolean> => {
    const hierarchy = taskHierarchy.get(taskId)
    return hierarchy?.isLeaf ?? false
  }, [taskHierarchy])

  // Simulate progress changes
  const runProgressSimulation = useCallback(() => {
    if (simulationRunning) return
    
    setSimulationRunning(true)
    const leafTasks = tasks.filter(task => taskHierarchy.get(task.id)?.isLeaf)
    
    const simulateStep = (index: number) => {
      if (index >= leafTasks.length) {
        setSimulationRunning(false)
        return
      }
      
      const task = leafTasks[index]
      const currentProgress = task.progress
      const increment = Math.random() * 20 // Random progress increment
      const newProgress = Math.min(100, currentProgress + increment)
      
      updateParentProgress(task.id, newProgress)
      
      setTimeout(() => simulateStep(index + 1), 1000)
    }
    
    simulateStep(0)
  }, [tasks, taskHierarchy, simulationRunning, updateParentProgress])

  // Get telemetry stats
  const telemetryStats = useMemo(() => getStats(), [getStats])

  // Filter tasks by type for demonstrations
  const leafTasks = tasks.filter(task => taskHierarchy.get(task.id)?.isLeaf)
  const parentTasks = tasks.filter(task => !taskHierarchy.get(task.id)?.isLeaf)
  const selectedTasks = tasks.filter(task => selectedTaskIds.has(task.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            T015: Progress Management UI & Leaf Task Validation
          </h1>
          <p className="text-gray-600 mb-6">
            Comprehensive demonstration of all acceptance criteria with real-time telemetry tracking
          </p>
          
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{tasks.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Leaf Tasks</div>
              <div className="text-2xl font-bold text-green-600">{leafTasks.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Parent Tasks</div>
              <div className="text-2xl font-bold text-purple-600">{parentTasks.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Selected</div>
              <div className="text-2xl font-bold text-blue-600">{selectedTaskIds.size}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Operations</div>
              <div className="text-2xl font-bold text-orange-600">{telemetryStats.operations.total}</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: ChartBarIcon },
              { id: 'ac1', name: 'AC1: Input Field', icon: CheckCircleIcon },
              { id: 'ac2-ac3', name: 'AC2-AC3: Gantt Bars', icon: PlayIcon },
              { id: 'ac4-ac5', name: 'AC4-AC5: Validation & Undo', icon: ExclamationTriangleIcon },
              { id: 'ac6', name: 'AC6: Batch Update', icon: ArrowPathIcon },
              { id: 'ac7', name: 'AC7: Telemetry', icon: ChartBarIcon }
            ].map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveDemo(id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeDemo === id
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Demo Content */}
        <div className="space-y-8">
          {/* Overview */}
          {activeDemo === 'overview' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">Implementation Overview</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">✅ Implemented Features</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC1: Progress input with validation (0-100%) for leaf tasks</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC2: Visual progress handles with drag-to-update</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC3: Parent task progress computed from children</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC4: Progress validation with clear user feedback</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC5: Undo/redo integration with state management</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC6: Batch progress update modal</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>AC7: Comprehensive progress operation telemetry</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">🔧 Key Components</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• <strong>ProgressInput:</strong> Enhanced input component with validation</li>
                    <li>• <strong>EnhancedGanttBar:</strong> Interactive Gantt bars with progress handles</li>
                    <li>• <strong>BatchProgressUpdateModal:</strong> Efficient batch operations</li>
                    <li>• <strong>ProgressCommand:</strong> Undo/redo command implementation</li>
                    <li>• <strong>ProgressTelemetry:</strong> Comprehensive operation tracking</li>
                    <li>• <strong>ProgressManagementSystem:</strong> Integrated solution</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Quick Actions</h3>
                <div className="flex space-x-4">
                  <button
                    onClick={runProgressSimulation}
                    disabled={simulationRunning}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
                  >
                    {simulationRunning ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                    <span>{simulationRunning ? 'Running...' : 'Run Progress Simulation'}</span>
                  </button>
                  
                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    Open Batch Update Modal
                  </button>
                  
                  <button
                    onClick={() => console.log('Telemetry Export:', exportData())}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Export Telemetry Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AC1: Progress Input Field */}
          {activeDemo === 'ac1' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">AC1: Progress Input Field with Validation</h2>
              <p className="text-gray-600 mb-6">
                Progress input field with percentage validation (0-100%) for leaf tasks only. 
                Parent tasks show computed values and cannot be edited.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-green-700 mb-3">✅ Editable Leaf Tasks</h3>
                  <div className="space-y-4">
                    {leafTasks.slice(0, 4).map(task => (
                      <div key={task.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Leaf Task</span>
                        </div>
                        <ProgressInput
                          value={task.progress}
                          onChange={(value) => handleProgressUpdate(task.id, value)}
                          isLeafTask={true}
                          size="sm"
                          data-testid={`progress-input-${task.id}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-purple-700 mb-3">🔒 Read-only Parent Tasks</h3>
                  <div className="space-y-4">
                    {parentTasks.slice(0, 4).map(task => {
                      const hierarchy = taskHierarchy.get(task.id)
                      const computedProgress = hierarchy?.children.length 
                        ? ProgressUtils.calculateParentProgress(hierarchy.children.map(c => c.progress))
                        : task.progress
                      
                      return (
                        <div key={task.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">Parent Task</span>
                          </div>
                          <ProgressInput
                            value={computedProgress}
                            onChange={() => {}} // No-op for parent tasks
                            isLeafTask={false}
                            hasChildren={true}
                            computedValue={computedProgress}
                            isComputed={true}
                            size="sm"
                            data-testid={`progress-input-${task.id}`}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Computed from {hierarchy?.children.length || 0} subtasks
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AC2-AC3: Enhanced Gantt Bars */}
          {activeDemo === 'ac2-ac3' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">AC2-AC3: Visual Progress Handles & Parent Computation</h2>
              <p className="text-gray-600 mb-6">
                Enhanced Gantt bars with visual progress handles for drag-to-update functionality.
                Parent task progress displays as read-only computed values from children.
              </p>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Interactive Instructions</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Click on tasks to select them (selected tasks have blue borders)</li>
                  <li>• Hover over progress bars to see interactive handles on leaf tasks</li>
                  <li>• Drag progress handles to update task progress</li>
                  <li>• Parent tasks show computed progress with a lock icon</li>
                  <li>• Watch parent progress update automatically when children change</li>
                </ul>
              </div>
              
              <UndoRedoProvider options={{ projectId: 'demo-project' }}>
                <div className="border rounded-lg overflow-hidden">
                  <ProgressManagementSystem
                    tasks={tasks}
                    selectedTaskIds={selectedTaskIds}
                    onTaskClick={handleTaskClick}
                    onTaskUpdate={async () => {}} // Mock implementation
                    projectId="demo-project"
                    x={200}
                    y={50}
                    width={300}
                    height={30}
                    pixelsPerDay={30}
                    timelineStartDate={new Date('2024-01-01')}
                    showProgressHandles={true}
                    enableProgressDrag={true}
                    enableBatchUpdate={true}
                    showTelemetryPanel={true}
                    data-testid="progress-management-system"
                  />
                </div>
              </UndoRedoProvider>
            </div>
          )}

          {/* AC4-AC5: Validation & Undo/Redo */}
          {activeDemo === 'ac4-ac5' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">AC4-AC5: Progress Validation & Undo/Redo Integration</h2>
              <p className="text-gray-600 mb-6">
                Progress change validation prevents editing non-leaf tasks with clear user feedback.
                Undo/redo integration supports progress operations with proper state management.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-red-700 mb-3">❌ Validation Errors</h3>
                  <div className="space-y-4">
                    {parentTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                        </div>
                        <ProgressInput
                          value={task.progress}
                          onChange={() => {}}
                          isLeafTask={false}
                          hasChildren={true}
                          validationMessage="Cannot edit parent task progress"
                          size="sm"
                        />
                        <div className="text-xs text-red-600 mt-2">
                          ⚠️ Parent task progress is computed from {taskHierarchy.get(task.id)?.children.length || 0} children and cannot be edited directly
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-green-700 mb-3">✅ Valid Operations</h3>
                  <div className="space-y-4">
                    <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Undo/Redo Status</h4>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <ArrowUturnLeftIcon className="h-4 w-4 text-gray-500" />
                          <span>Undo Available: {telemetryStats.operations.total > 0 ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <ArrowUturnRightIcon className="h-4 w-4 text-gray-500" />
                          <span>Operations: {telemetryStats.operations.total}</span>
                        </div>
                      </div>
                    </div>
                    
                    {leafTasks.slice(0, 2).map(task => (
                      <div key={task.id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        </div>
                        <ProgressInput
                          value={task.progress}
                          onChange={(value) => handleProgressUpdate(task.id, value)}
                          isLeafTask={true}
                          successMessage="Valid leaf task - progress can be updated"
                          size="sm"
                        />
                        <div className="text-xs text-green-600 mt-2">
                          ✅ Leaf task progress can be updated and supports undo/redo
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AC6: Batch Progress Update Modal */}
          {activeDemo === 'ac6' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">AC6: Batch Progress Update Modal</h2>
              <p className="text-gray-600 mb-6">
                Batch progress update modal handles multiple selected tasks efficiently with validation,
                bulk operations, and progress tracking.
              </p>
              
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Task Selection</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click on tasks below to select them for batch operations. Selected tasks will be highlighted.
                </p>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.map(task => {
                    const isSelected = selectedTaskIds.has(task.id)
                    const hierarchy = taskHierarchy.get(task.id)
                    
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50 shadow-md' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{task.title}</h4>
                          <div className="flex items-center space-x-1">
                            {isSelected && <CheckCircleIcon className="h-4 w-4 text-blue-500" />}
                            <span className={`text-xs px-2 py-1 rounded ${
                              hierarchy?.isLeaf 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {hierarchy?.isLeaf ? 'Leaf' : 'Parent'}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          Progress: {task.progress}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedTaskIds.size} tasks selected
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedTasks.filter(t => taskHierarchy.get(t.id)?.isLeaf).length} editable leaf tasks
                  </div>
                </div>
                <button
                  onClick={() => setShowBatchModal(true)}
                  disabled={selectedTaskIds.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Open Batch Update Modal
                </button>
              </div>
            </div>
          )}

          {/* AC7: Telemetry */}
          {activeDemo === 'ac7' && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">AC7: Progress Change Telemetry</h2>
              <p className="text-gray-600 mb-6">
                Comprehensive progress change telemetry records operation timing, success metrics,
                user interaction patterns, and system performance data.
              </p>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Total Operations</div>
                  <div className="text-2xl font-bold text-blue-900">{telemetryStats.operations.total}</div>
                  <div className="text-xs text-blue-600">Since page load</div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Success Rate</div>
                  <div className="text-2xl font-bold text-green-900">{telemetryStats.operations.successRate.toFixed(1)}%</div>
                  <div className="text-xs text-green-600">
                    {telemetryStats.operations.successful}/{telemetryStats.operations.total} successful
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Avg Duration</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {telemetryStats.performance.averageDuration.toFixed(0)}ms
                  </div>
                  <div className="text-xs text-purple-600">Per operation</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-sm text-orange-600 font-medium">Tasks Updated</div>
                  <div className="text-2xl font-bold text-orange-900">{telemetryStats.productivity.tasksUpdated}</div>
                  <div className="text-xs text-orange-600">Progress changes</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Operation Types</h3>
                  <div className="space-y-2">
                    {Object.entries(telemetryStats.operations.byType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600 capitalize">{type.replace('-', ' ')}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                    {Object.keys(telemetryStats.operations.byType).length === 0 && (
                      <div className="text-sm text-gray-500 italic">No operations recorded yet</div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Interaction Types</h3>
                  <div className="space-y-2">
                    {Object.entries(telemetryStats.operations.byInteraction).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600 capitalize">{type.replace('-', ' ')}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                    {Object.keys(telemetryStats.operations.byInteraction).length === 0 && (
                      <div className="text-sm text-gray-500 italic">No interactions recorded yet</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">Telemetry Export</h3>
                    <p className="text-sm text-gray-600">Export all collected telemetry data for analysis</p>
                  </div>
                  <button
                    onClick={() => {
                      const data = exportData()
                      console.log('Exported Telemetry Data:', data)
                      // In a real implementation, this would download a JSON file or send to analytics
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Batch Progress Update Modal */}
        <BatchProgressUpdateModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          tasks={selectedTasks}
          parentTasks={parentTasks}
          childTaskMap={Object.fromEntries(
            tasks.map(task => [task.id, taskHierarchy.get(task.id)?.children || []])
          )}
          onProgressUpdate={handleProgressUpdate}
          onProgressValidation={handleProgressValidation}
          projectId="demo-project"
          data-testid="batch-progress-modal"
        />
      </div>
    </div>
  )
}