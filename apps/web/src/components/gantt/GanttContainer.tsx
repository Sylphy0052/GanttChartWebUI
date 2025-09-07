'use client'

import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useGanttZoomPan } from '@/hooks/useGanttZoomPan'
import { GanttPerformanceUtils } from '@/utils/ganttUtils'

interface GanttContainerProps {
  children: React.ReactNode
  className?: string
  onScroll?: (scrollTop: number, scrollLeft: number) => void
  onZoom?: (zoomLevel: number) => void
  enableZoomPan?: boolean
  minHeight?: number
  'data-testid'?: string
}

/**
 * Gantt Container Component
 * 
 * Provides scroll synchronization, zoom/pan controls, and performance optimizations
 * for the Gantt chart. Handles the coordination between WBS tree and Gantt chart areas.
 */
export const GanttContainer: React.FC<GanttContainerProps> = ({
  children,
  className = '',
  onScroll,
  onZoom,
  enableZoomPan = true,
  minHeight = 600,
  'data-testid': dataTestId
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wbsScrollRef = useRef<HTMLDivElement>(null)
  const ganttScrollRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  // Zoom and pan functionality
  const {
    zoomPercentage,
    currentZoomLevel,
    canZoomIn,
    canZoomOut,
    isDragging,
    resetZoom,
    zoomToToday
  } = useGanttZoomPan({
    containerRef,
    enabled: enableZoomPan
  })

  // Throttled scroll handler for performance
  const throttledScrollHandler = useCallback(
    GanttPerformanceUtils.throttle((scrollTop: number, scrollLeft: number) => {
      onScroll?.(scrollTop, scrollLeft)
    }, 16), // ~60fps
    [onScroll]
  )

  // Synchronized scroll between WBS and Gantt areas
  const handleVerticalScroll = useCallback((scrollTop: number, source: 'wbs' | 'gantt') => {
    if (isScrolling) return
    
    setIsScrolling(true)
    
    // Sync scroll position between WBS and Gantt
    if (source === 'wbs' && ganttScrollRef.current) {
      ganttScrollRef.current.scrollTop = scrollTop
    } else if (source === 'gantt' && wbsScrollRef.current) {
      wbsScrollRef.current.scrollTop = scrollTop
    }
    
    throttledScrollHandler(scrollTop, 0)
    
    // Reset scrolling flag
    requestAnimationFrame(() => {
      setIsScrolling(false)
    })
  }, [isScrolling, throttledScrollHandler])

  const handleHorizontalScroll = useCallback((scrollLeft: number) => {
    throttledScrollHandler(0, scrollLeft)
  }, [throttledScrollHandler])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return

      switch (event.key) {
        case 'Home':
          if (event.ctrlKey) {
            event.preventDefault()
            resetZoom()
          }
          break
        case 'End':
          if (event.ctrlKey) {
            event.preventDefault()
            zoomToToday()
          }
          break
        case 'ArrowUp':
          if (event.ctrlKey && event.shiftKey) {
            event.preventDefault()
            // Scroll to top
            if (wbsScrollRef.current && ganttScrollRef.current) {
              wbsScrollRef.current.scrollTop = 0
              ganttScrollRef.current.scrollTop = 0
            }
          }
          break
        case 'ArrowDown':
          if (event.ctrlKey && event.shiftKey) {
            event.preventDefault()
            // Scroll to bottom
            if (wbsScrollRef.current && ganttScrollRef.current) {
              const maxScroll = Math.max(
                wbsScrollRef.current.scrollHeight - wbsScrollRef.current.clientHeight,
                ganttScrollRef.current.scrollHeight - ganttScrollRef.current.clientHeight
              )
              wbsScrollRef.current.scrollTop = maxScroll
              ganttScrollRef.current.scrollTop = maxScroll
            }
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [resetZoom, zoomToToday])

  // Provide context for child components
  const containerContext = {
    wbsScrollRef,
    ganttScrollRef,
    handleVerticalScroll,
    handleHorizontalScroll,
    zoomLevel: currentZoomLevel,
    isDragging,
    isScrolling
  }

  return (
    <div
      ref={containerRef}
      className={`gantt-container relative overflow-hidden ${className}`}
      style={{ minHeight }}
      data-testid={dataTestId}
      data-gantt-container="true"
    >
      {/* Zoom/Pan Status Indicator */}
      {enableZoomPan && (isDragging || currentZoomLevel !== 1) && (
        <div className="absolute top-4 left-4 z-50 bg-black/75 text-white px-3 py-2 rounded text-sm font-medium">
          <div className="flex items-center space-x-3">
            {isDragging && (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2" />
                パン中
              </span>
            )}
            <span>ズーム: {zoomPercentage}%</span>
          </div>
        </div>
      )}

      {/* Scroll Sync Indicator */}
      {isScrolling && (
        <div className="absolute top-4 right-4 z-50 bg-green-500/75 text-white px-3 py-2 rounded text-sm font-medium">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce mr-2" />
            スクロール同期
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="h-full relative" data-gantt-content="true">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            // Inject container context to child components
            return React.cloneElement(child as React.ReactElement<any>, {
              containerContext,
              ...child.props
            })
          }
          return child
        })}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 right-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="bg-black/90 text-white text-xs px-3 py-2 rounded max-w-xs">
          <div className="font-semibold mb-1">ショートカット</div>
          <div className="space-y-1">
            <div>Ctrl + Home: ズームリセット</div>
            <div>Ctrl + End: 今日に移動</div>
            <div>Ctrl + Shift + ↑/↓: 上下端にスクロール</div>
            <div>Ctrl + マウスホイール: ズーム</div>
            <div>中ボタン ドラッグ: パン</div>
          </div>
        </div>
      </div>

      {/* Performance Stats (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 bg-gray-800/90 text-green-400 text-xs px-3 py-2 rounded font-mono">
          <div>Zoom: {currentZoomLevel}</div>
          <div>Pan: {isDragging ? 'Active' : 'Inactive'}</div>
          <div>Sync: {isScrolling ? 'Syncing' : 'Ready'}</div>
        </div>
      )}
    </div>
  )
}

export default GanttContainer