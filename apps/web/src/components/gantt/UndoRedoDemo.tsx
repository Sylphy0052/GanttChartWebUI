/**
 * Undo/Redo Demo Component
 * 
 * This component demonstrates the first acceptance criterion:
 * "Bar move/resize undo/redo with Ctrl+Z/Y"
 * 
 * It provides a complete example of how to integrate the new undo/redo system
 * with the existing Gantt chart components.
 */

'use client'

import React, { useState, useCallback } from 'react'
import { GanttBarWithUndo } from './GanttBarWithUndo'
import { UndoRedoProvider, useUndoRedoContext } from '@/hooks/useUndoRedo'
import { GanttTask } from '@/types/gantt'
import { Button } from '@/components/ui/button'

// Sample task data for demonstration
const createSampleTask = (id: string, title: string, startOffset: number, duration: number): GanttTask => {
  const now = new Date()
  const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000)
  const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000)
  
  return {
    id,
    title,
    description: `Sample task ${id} for undo/redo demonstration`,
    parentId: null,
    startDate,
    endDate,
    progress: Math.floor(Math.random() * 100),
    status: ['TODO', 'IN_PROGRESS', 'DONE'][Math.floor(Math.random() * 3)] as any,
    assigneeId: 'user1',
    assigneeName: 'Demo User',
    estimatedHours: duration * 8,
    actualHours: Math.floor(duration * 8 * Math.random()),
    dependencies: [],
    level: 0,
    order: parseInt(id),
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][Math.floor(Math.random() * 4)],
    type: Math.random() > 0.8 ? 'milestone' : 'task'
  }
}

const UndoRedoDemoContent: React.FC = () => {
  const [tasks, setTasks] = useState<GanttTask[]>([
    createSampleTask('1', 'Project Setup', 0, 3),
    createSampleTask('2', 'Database Design', 3, 5),
    createSampleTask('3', 'API Development', 8, 7),
    createSampleTask('4', 'Frontend Implementation', 15, 10),
    createSampleTask('5', 'Testing & QA', 25, 5),
    createSampleTask('6', 'Deployment', 30, 2)
  ])
  const [selectedTaskId, setSelectedTaskId] = useState<string>()

  const { canUndo, canRedo, undo, redo, historyCount, getHistory, currentCommand } = useUndoRedoContext()

  // Handle task updates (this would normally be connected to your API)
  const handleTaskUpdate = useCallback(async (taskId: string, updates: { startDate: Date; endDate: Date }) => {
    console.log(`🔄 Updating task ${taskId}:`, updates)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, startDate: updates.startDate, endDate: updates.endDate }
          : task
      )
    )
  }, [])

  const handleTaskClick = useCallback((task: GanttTask) => {
    setSelectedTaskId(task.id === selectedTaskId ? undefined : task.id)
  }, [selectedTaskId])

  const handleUndo = useCallback(async () => {
    try {
      const success = await undo()
      if (success) {
        console.log('✅ Undo successful')
      } else {
        console.log('❌ Nothing to undo')
      }
    } catch (error) {
      console.error('❌ Undo failed:', error)
    }
  }, [undo])

  const handleRedo = useCallback(async () => {
    try {
      const success = await redo()
      if (success) {
        console.log('✅ Redo successful')
      } else {
        console.log('❌ Nothing to redo')
      }
    } catch (error) {
      console.error('❌ Redo failed:', error)
    }
  }, [redo])

  const history = getHistory()

  return (
    <div className="p-6 space-y-6">
      {/* Header with undo/redo controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Undo/Redo Demo</h2>
          <p className="text-gray-600 mt-1">
            Drag task bars to move or resize them. Use Ctrl+Z/Y or the buttons below to undo/redo.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            History: {historyCount} operations
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex items-center space-x-2"
          >
            <span>↶</span>
            <span>Undo</span>
            <kbd className="px-1 py-0.5 text-xs bg-gray-100 rounded">Ctrl+Z</kbd>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            className="flex items-center space-x-2"
          >
            <span>↷</span>
            <span>Redo</span>
            <kbd className="px-1 py-0.5 text-xs bg-gray-100 rounded">Ctrl+Y</kbd>
          </Button>
        </div>
      </div>

      {/* Current command info */}
      {currentCommand && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h3 className="font-semibold text-blue-900">Last Command</h3>
          <p className="text-blue-700 text-sm">{currentCommand.description}</p>
          <p className="text-blue-600 text-xs mt-1">
            Type: {currentCommand.type} • ID: {currentCommand.id}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">How to Test AC1: Bar Move/Resize Undo/Redo</h3>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>• <strong>Move tasks:</strong> Click and drag task bars left/right</li>
          <li>• <strong>Resize tasks:</strong> Drag the left or right edges of task bars</li>
          <li>• <strong>Update progress:</strong> Click and drag on the progress bar (colored portion)</li>
          <li>• <strong>Undo:</strong> Press Ctrl+Z or click the Undo button</li>
          <li>• <strong>Redo:</strong> Press Ctrl+Y or click the Redo button</li>
          <li>• <strong>Visual feedback:</strong> Look for the Z/Y indicator on tasks when operations are available</li>
        </ul>
      </div>

      {/* SVG Gantt Chart Demo */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Interactive Gantt Chart</h3>
          <p className="text-sm text-gray-600">Click task bars to select, then drag to move or resize</p>
        </div>
        
        <div className="p-6">
          <svg width="1000" height="300" className="border">
            {/* Timeline background */}
            <rect width="1000" height="300" fill="#fafafa" />
            
            {/* Grid lines */}
            {Array.from({ length: 10 }, (_, i) => (
              <line
                key={`grid-${i}`}
                x1={i * 100}
                y1={0}
                x2={i * 100}
                y2={300}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            ))}
            
            {/* Task bars */}
            {tasks.map((task, index) => (
              <GanttBarWithUndo
                key={task.id}
                task={task}
                x={50 + index * 150}
                y={30 + index * 40}
                width={120}
                height={24}
                isSelected={task.id === selectedTaskId}
                onClick={handleTaskClick}
                onTaskUpdate={handleTaskUpdate}
                pixelsPerDay={4}
                timelineStartDate={new Date()}
                data-testid={`task-bar-${task.id}`}
              />
            ))}
            
            {/* Task labels */}
            {tasks.map((task, index) => (
              <text
                key={`label-${task.id}`}
                x={10}
                y={45 + index * 40}
                className="text-sm fill-gray-700 font-medium"
              >
                {task.title}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Command history */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Command History</h3>
            <p className="text-sm text-gray-600">Recent operations (most recent first)</p>
          </div>
          
          <div className="p-4">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {history.slice().reverse().map((command, index) => (
                <div
                  key={command.id}
                  className={`p-2 rounded text-sm ${
                    index === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{command.description}</span>
                    <span className="text-xs text-gray-500">
                      {command.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(command.context.timestamp).toLocaleTimeString()} • 
                    Can undo: {command.canUndo() ? '✅' : '❌'} • 
                    Can redo: {command.canRedo() ? '✅' : '❌'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status info */}
      <div className="text-xs text-gray-500">
        Implementation Status: AC1 (Bar move/resize undo/redo) - ✅ COMPLETE
      </div>
    </div>
  )
}

export const UndoRedoDemo: React.FC = () => {
  return (
    <UndoRedoProvider options={{
      maxHistorySize: 20,
      enableKeyboardShortcuts: true,
      telemetryEnabled: true
    }}>
      <UndoRedoDemoContent />
    </UndoRedoProvider>
  )
}