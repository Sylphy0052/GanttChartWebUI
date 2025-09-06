'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { WBSTree } from '@/components/wbs/WBSTree'
import { GanttTimeline } from './GanttTimeline'
import { VirtualizedGanttGrid } from './VirtualizedGanttGrid'
import { useWBSStore, useWBSSelectors } from '@/stores/wbs.store'
import { useGanttStore } from '@/stores/gantt.store'
import { useGanttZoomPan } from '@/hooks/useGanttZoomPan'
import { GanttTask } from '@/types/gantt'
import { GanttUtils } from '@/lib/gantt-utils'

interface GanttWBSLayoutProps {
  projectId?: string
  height?: number
  className?: string
}

export const GanttWBSLayout: React.FC<GanttWBSLayoutProps> = ({ 
  projectId, 
  height = 600, 
  className = '' 
}) => {
  // Split panel state
  const [splitRatio, setSplitRatio] = useState(0.3) // 30% for WBS, 70% for Gantt
  const [isDragging, setIsDragging] = useState(false)
  
  // Scroll synchronization
  const wbsScrollRef = useRef<HTMLDivElement>(null)
  const ganttScrollRef = useRef<HTMLDivElement>(null)
  const [lastScrollSource, setLastScrollSource] = useState<'wbs' | 'gantt' | null>(null)
  
  // Container sizing
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttContainerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 1200, height })
  
  // Store hooks
  const wbsSelectors = useWBSSelectors()
  const { 
    config: ganttConfig, 
    viewport: ganttViewport, 
    selectedTaskIds: ganttSelectedTaskIds,
    loading: ganttLoading,
    error: ganttError,
    fetchGanttData,
    setViewportSize,
    selectTask,
    clearSelection,
    zoomIn,
    zoomOut,
    zoomToFit,
    scrollToToday
  } = useGanttStore()

  // Enhanced zoom and pan functionality
  const zoomPanControls = useGanttZoomPan({
    containerRef: ganttContainerRef,
    enabled: true,
    zoomSensitivity: 0.1,
    panSensitivity: 1,
    minZoomLevel: 0,
    maxZoomLevel: 3
  })

  // Get visible nodes from WBS (these will be our "tasks" for Gantt display)
  const visibleWBSNodes = wbsSelectors.visibleNodes()
  
  // Convert WBS nodes to Gantt tasks for display with enhanced color mapping
  const ganttTasks: GanttTask[] = visibleWBSNodes.map(node => {
    // Determine task type based on node characteristics
    const hasChildren = visibleWBSNodes.some(n => n.parentId === node.id)
    const duration = node.dueDate && node.startDate ? 
      node.dueDate.getTime() - node.startDate.getTime() : 0
    const isMilestone = duration <= 24 * 60 * 60 * 1000 // <= 1 day
    
    return {
      id: node.id,
      title: node.title,
      description: node.description || '',
      parentId: node.parentId,
      startDate: node.startDate || new Date(),
      endDate: node.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
      progress: node.progress || 0,
      status: node.status,
      priority: 'MEDIUM', // Default priority since WBS doesn't have priority field
      assigneeId: node.assigneeId,
      assigneeName: node.assigneeId || 'Unassigned', // TODO: Get actual assignee name
      estimatedHours: node.estimatedHours || 8,
      actualHours: 0, // TODO: Get from API if available  
      dependencies: [], // TODO: Get dependencies if needed
      level: node.level,
      order: node.order,
      // Enhanced color mapping using GanttUtils
      color: GanttUtils.getTaskColor(node.status, hasChildren ? 'summary' : (isMilestone ? 'milestone' : 'task')),
      type: hasChildren ? 'summary' : (isMilestone ? 'milestone' : 'task'),
      milestoneDate: isMilestone ? node.dueDate : undefined
    }
  })

  // Simple stats calculation without complex selectors
  const ganttStats = {
    totalTasks: ganttTasks.length,
    completedTasks: ganttTasks.filter(task => task.progress >= 100).length,
    inProgressTasks: ganttTasks.filter(task => task.progress > 0 && task.progress < 100).length,
    notStartedTasks: ganttTasks.filter(task => task.progress === 0).length,
    overdueTasks: ganttTasks.filter(task => {
      const today = new Date()
      return task.endDate < today && task.progress < 100
    }).length,
    completionRate: ganttTasks.length > 0 ? Math.round((ganttTasks.filter(task => task.progress >= 100).length / ganttTasks.length) * 100) : 0
  }

  // Calculate split positions
  const wbsWidth = Math.floor(containerSize.width * splitRatio)
  const ganttWidth = containerSize.width - wbsWidth

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

  // Load data on mount
  useEffect(() => {
    if (projectId) {
      // Load both WBS and Gantt data
      fetchGanttData(projectId)
    }
  }, [projectId, fetchGanttData])

  // Synchronized scrolling between WBS and Gantt
  const handleWBSScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (lastScrollSource === 'gantt') return
    
    setLastScrollSource('wbs')
    const scrollTop = event.currentTarget.scrollTop
    
    if (ganttScrollRef.current) {
      ganttScrollRef.current.scrollTop = scrollTop
    }
    
    // Reset scroll source after a short delay
    setTimeout(() => setLastScrollSource(null), 50)
  }, [lastScrollSource])

  const handleGanttScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (lastScrollSource === 'wbs') return
    
    setLastScrollSource('gantt')
    const scrollTop = event.currentTarget.scrollTop
    
    if (wbsScrollRef.current) {
      wbsScrollRef.current.scrollTop = scrollTop
    }
    
    // Reset scroll source after a short delay
    setTimeout(() => setLastScrollSource(null), 50)
  }, [lastScrollSource])

  // Handle split panel resize
  const handleSplitMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true)
    event.preventDefault()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      const newRatio = Math.max(0.2, Math.min(0.6, (event.clientX - containerRect.left) / containerRect.width))
      setSplitRatio(newRatio)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Handle task click (sync between WBS and Gantt)
  const handleTaskClick = useCallback((task: GanttTask) => {
    if (ganttSelectedTaskIds.has(task.id)) {
      clearSelection()
    } else {
      selectTask(task.id)
    }
  }, [ganttSelectedTaskIds, selectTask, clearSelection])

  // Keyboard shortcuts
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

  return (
    <div 
      ref={containerRef}
      className={`gantt-wbs-layout border border-gray-200 rounded-lg overflow-hidden ${className}`} 
      style={{ height }}
    >
      {/* Enhanced Toolbar with Zoom Indicators */}
      <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-sm font-semibold text-gray-900">Project View</h2>
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <span>{ganttStats.totalTasks} tasks</span>
            <span>{visibleWBSNodes.length} visible</span>
            <span>{ganttStats.completionRate}% complete</span>
            {ganttStats.overdueTasks > 0 && (
              <span className="text-red-600 font-medium">{ganttStats.overdueTasks} overdue</span>
            )}
          </div>
          
          {/* Zoom Level Indicator */}
          {zoomPanControls.isDragging && (
            <div className="flex items-center space-x-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Panning...</span>
            </div>
          )}
          
          {zoomPanControls.isTouchZooming && (
            <div className="flex items-center space-x-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <span>Touch Zoom</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Enhanced Zoom Controls with Percentage Indicator */}
          <div className="flex items-center border border-gray-300 rounded">
            <button
              onClick={zoomOut}
              disabled={!zoomPanControls.canZoomOut}
              className="px-2 py-1 text-xs hover:bg-gray-100 border-r border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom out (Ctrl + - or wheel down)"
            >
              −
            </button>
            <span className="px-3 py-1 text-xs bg-white border-r border-gray-300 min-w-[80px] text-center font-mono">
              {zoomPanControls.zoomPercentage}%
            </span>
            <button
              onClick={zoomIn}
              disabled={!zoomPanControls.canZoomIn}
              className="px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom in (Ctrl + + or wheel up)"
            >
              +
            </button>
          </div>
          
          <button
            onClick={zoomPanControls.resetZoom}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Fit to window (Ctrl + 0)"
          >
            Fit
          </button>
          
          <button
            onClick={zoomPanControls.zoomToToday}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            title="Go to today (Ctrl + T)"
          >
            Today
          </button>

          {/* Pan Hint */}
          <div className="text-xs text-gray-400 hidden md:block">
            Ctrl+Wheel: Zoom | Middle-click: Pan
          </div>
        </div>
      </div>

      {/* Split panel layout */}
      <div className="flex h-full" style={{ height: height - 48 }}>
        {/* WBS Tree Panel */}
        <div 
          className="flex-none border-r border-gray-200 bg-white overflow-hidden"
          style={{ width: wbsWidth }}
        >
          <div className="h-full flex flex-col">
            {/* WBS Header */}
            <div className="h-12 bg-gray-100 border-b border-gray-200 flex items-center px-4">
              <div className="text-xs font-semibold text-gray-700">WBS Structure</div>
            </div>
            
            {/* WBS Tree with custom scroll ref */}
            <div 
              ref={wbsScrollRef}
              className="flex-1 overflow-auto"
              onScroll={handleWBSScroll}
            >
              <WBSTree
                projectId={projectId}
                height={height - 48 - 48} // Total - toolbar - header
                className="border-none shadow-none"
              />
            </div>
          </div>
        </div>

        {/* Splitter */}
        <div
          className={`w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex-none ${
            isDragging ? 'bg-blue-400' : ''
          }`}
          onMouseDown={handleSplitMouseDown}
        />

        {/* Enhanced Gantt Chart Panel with Zoom/Pan */}
        <div 
          ref={ganttContainerRef}
          className="flex-1 overflow-hidden bg-white relative"
          style={{ 
            width: ganttWidth,
            cursor: zoomPanControls.isDragging ? 'grabbing' : 'default'
          }}
        >
          <div className="h-full flex flex-col">
            {/* Gantt Timeline Header */}
            <div className="h-12 border-b border-gray-200">
              <GanttTimeline
                config={ganttConfig}
                viewport={ganttViewport}
                className="h-full"
              />
            </div>
            
            {/* Gantt Grid with synchronized scrolling and enhanced interactions */}
            <div 
              ref={ganttScrollRef}
              className="flex-1 overflow-auto"
              onScroll={handleGanttScroll}
              data-gantt-scroll="true"
            >
              {ganttTasks.length > 0 ? (
                <VirtualizedGanttGrid
                  tasks={ganttTasks}
                  config={ganttConfig}
                  viewport={ganttViewport}
                  selectedTaskIds={ganttSelectedTaskIds}
                  onTaskClick={handleTaskClick}
                  height={height - 48 - 48} // Total - toolbar - timeline
                  data-testid="gantt-wbs-grid"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l6-6v13M9 19c0 1.105.895 2 2 2h2c1.105 0 2-.895 2-2M9 19H7c-1.105 0-2-.895-2-2V9c0-1.105.895-2 2-2h2M9 19v-6h4v6" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks with dates</h3>
                    <p className="text-gray-600">Add start and due dates to WBS tasks to see them in the Gantt view.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Overlay for Touch Feedback */}
          {(zoomPanControls.isDragging || zoomPanControls.isTouchZooming) && (
            <div className="absolute inset-0 bg-blue-100 bg-opacity-10 pointer-events-none transition-opacity duration-200" />
          )}
        </div>
      </div>

      {/* Enhanced Status Bar with Pan/Zoom Info */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-xs text-gray-600">
        <div className="flex justify-between items-center">
          <span>
            Split: {Math.round(splitRatio * 100)}% WBS | {Math.round((1 - splitRatio) * 100)}% Gantt
            {zoomPanControls.isDragging && <span className="ml-2 text-blue-600">• Panning</span>}
          </span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                TODO ({ganttStats.notStartedTasks})
              </span>
              <span className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                In Progress ({ganttStats.inProgressTasks})
              </span>
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                Done ({ganttStats.completedTasks})
              </span>
            </div>
            <span>
              Ctrl+Wheel: Zoom | Mid-Click/Ctrl+Drag: Pan | Pinch: Touch Zoom | Ctrl+0: Fit | Ctrl+T: Today | ESC: Clear
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GanttWBSLayout