'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useGanttStore, useGanttSelectors } from '@/stores/gantt.store'
import { GanttTimeline } from './GanttTimeline'
import { GanttGrid } from './GanttGrid'
import { GanttTask } from '@/types/gantt'

interface GanttChartProps {
  projectId?: string
  height?: number
  className?: string
}

export const GanttChart: React.FC<GanttChartProps> = ({ 
  projectId, 
  height = 600, 
  className = '' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 1200, height })

  // Gantt store
  const {
    tasks,
    config,
    viewport,
    selectedTaskIds,
    loading,
    error,
    selectTask,
    clearSelection,
    setViewportSize,
    fetchGanttData,
    zoomIn,
    zoomOut,
    zoomToFit,
    scrollToToday
  } = useGanttStore()

  // Selectors
  const selectors = useGanttSelectors()
  const visibleTasks = selectors.visibleTasks()
  const ganttStats = selectors.ganttStats()

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width } = entry.contentRect
        setContainerSize({ width, height })
        setViewportSize(width, height)
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [height, setViewportSize])

  // Fetch data on mount
  useEffect(() => {
    fetchGanttData(projectId)
  }, [projectId, fetchGanttData])

  // Handle task selection
  const handleTaskClick = useCallback((task: GanttTask) => {
    if (selectedTaskIds.has(task.id)) {
      clearSelection()
    } else {
      selectTask(task.id)
    }
  }, [selectedTaskIds, selectTask, clearSelection])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return

      switch (event.key) {
        case '+':
        case '=':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            zoomIn()
          }
          break
        case '-':
        case '_':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            zoomOut()
          }
          break
        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            zoomToFit()
          }
          break
        case 't':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            scrollToToday()
          }
          break
        case 'Escape':
          clearSelection()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut, zoomToFit, scrollToToday, clearSelection])

  if (loading) {
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading Gantt chart...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load Gantt chart</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchGanttData(projectId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className={`gantt-chart flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l6-6v13M9 19c0 1.105.895 2 2 2h2c1.105 0 2-.895 2-2M9 19H7c-1.105 0-2-.895-2-2V9c0-1.105.895-2 2-2h2M9 19v-6h4v6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks to display</h3>
          <p className="text-gray-600">This project doesn't have any tasks with dates.</p>
        </div>
      </div>
    )
  }

  const taskListWidth = 300 // Fixed width for task list

  return (
    <div ref={containerRef} className={`gantt-chart border border-gray-200 rounded-lg overflow-hidden ${className}`} style={{ height }}>
      {/* Toolbar */}
      <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-sm font-semibold text-gray-900">Gantt Chart</h2>
          <div className="text-xs text-gray-500">
            {ganttStats.totalTasks} tasks | {ganttStats.completionRate}% complete
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-gray-300 rounded">
            <button
              onClick={zoomOut}
              className="px-2 py-1 text-xs hover:bg-gray-100 border-r border-gray-300"
              title="Zoom out (Ctrl + -)"
            >
              −
            </button>
            <span className="px-3 py-1 text-xs bg-white border-r border-gray-300 min-w-[60px] text-center">
              {config.scale}
            </span>
            <button
              onClick={zoomIn}
              className="px-2 py-1 text-xs hover:bg-gray-100"
              title="Zoom in (Ctrl + +)"
            >
              +
            </button>
          </div>
          
          {/* Action buttons */}
          <button
            onClick={zoomToFit}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Fit to window (Ctrl + 0)"
          >
            Fit
          </button>
          
          <button
            onClick={scrollToToday}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Go to today (Ctrl + T)"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex h-full">
        {/* Task list panel */}
        <div 
          className="flex-none border-r border-gray-200 bg-gray-50 overflow-y-auto"
          style={{ width: taskListWidth }}
        >
          {/* Task list header */}
          <div className="h-12 bg-gray-100 border-b border-gray-200 flex items-center px-4">
            <div className="text-xs font-semibold text-gray-700">Task Name</div>
          </div>
          
          {/* Task list */}
          <div>
            {visibleTasks.map((task, index) => (
              <div
                key={task.id}
                className={`
                  h-10 px-4 flex items-center cursor-pointer border-b border-gray-200 text-sm
                  ${selectedTaskIds.has(task.id) ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-100'}
                `}
                onClick={() => handleTaskClick(task)}
              >
                <div className="flex-1 truncate">
                  <span className={`inline-block w-3 h-3 rounded mr-2 ${
                    task.status === 'DONE' ? 'bg-green-500' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                    task.status === 'CANCELLED' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} />
                  {task.title}
                </div>
                <div className="text-xs text-gray-500 ml-2">
                  {task.progress}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gantt chart area */}
        <div className="flex-1 overflow-auto">
          <div style={{ minWidth: containerSize.width - taskListWidth }}>
            {/* Timeline header */}
            <GanttTimeline
              config={config}
              viewport={viewport}
              className="sticky top-0 z-10"
            />

            {/* Gantt grid */}
            <GanttGrid
              tasks={visibleTasks}
              config={config}
              viewport={viewport}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={handleTaskClick}
            />
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow opacity-75 hover:opacity-100 transition-opacity">
        Ctrl + / - : Zoom | Ctrl 0 : Fit | Ctrl T : Today | ESC : Clear selection
      </div>
    </div>
  )
}

export default GanttChart