'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGanttStore } from '@/stores/gantt.store'
import { GanttTimeScale } from '@/types/gantt'

interface UseGanttZoomPanOptions {
  containerRef: React.RefObject<HTMLElement>
  enabled?: boolean
  zoomSensitivity?: number
  panSensitivity?: number
  minZoomLevel?: number
  maxZoomLevel?: number
}

interface ZoomPanState {
  isDragging: boolean
  dragStartPosition: { x: number; y: number }
  lastPanPosition: { x: number; y: number }
  currentZoomLevel: number
  isTouchZooming: boolean
  lastTouchDistance?: number
}

const ZOOM_LEVELS: GanttTimeScale[] = ['quarter', 'month', 'week', 'day']
const ZOOM_FACTORS = { quarter: 0.25, month: 1, week: 4, day: 16 }

export function useGanttZoomPan({
  containerRef,
  enabled = true,
  zoomSensitivity = 0.1,
  panSensitivity = 1,
  minZoomLevel = 0,
  maxZoomLevel = 3
}: UseGanttZoomPanOptions) {
  const {
    config,
    viewport,
    zoomIn,
    zoomOut,
    setDateRange,
    updateViewport
  } = useGanttStore()

  const [state, setState] = useState<ZoomPanState>({
    isDragging: false,
    dragStartPosition: { x: 0, y: 0 },
    lastPanPosition: { x: 0, y: 0 },
    currentZoomLevel: ZOOM_LEVELS.indexOf(config.scale),
    isTouchZooming: false
  })

  const rafRef = useRef<number>()
  const throttledUpdateRef = useRef<(() => void) | null>(null)

  // Calculate current zoom percentage for display
  const zoomPercentage = Math.round(ZOOM_FACTORS[config.scale] * 100)

  // Mouse wheel zoom handler
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enabled || !containerRef.current?.contains(event.target as Node)) return

    // Only handle zoom with Ctrl/Cmd key to avoid conflicts with scrolling
    if (!event.ctrlKey && !event.metaKey) return

    event.preventDefault()
    event.stopPropagation()

    const delta = event.deltaY
    const zoomCenter = {
      x: event.clientX - containerRef.current!.getBoundingClientRect().left,
      y: event.clientY - containerRef.current!.getBoundingClientRect().top
    }

    // Calculate zoom direction and apply
    if (delta < 0) {
      // Zoom in
      handleZoomAtPoint(zoomCenter, 1)
    } else if (delta > 0) {
      // Zoom out
      handleZoomAtPoint(zoomCenter, -1)
    }
  }, [enabled, containerRef])

  // Mouse drag pan handlers
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!enabled || !containerRef.current?.contains(event.target as Node)) return

    // Only handle middle mouse button or left mouse with modifier key for panning
    if (event.button !== 1 && !(event.button === 0 && (event.ctrlKey || event.shiftKey))) return

    event.preventDefault()
    event.stopPropagation()

    setState(prev => ({
      ...prev,
      isDragging: true,
      dragStartPosition: { x: event.clientX, y: event.clientY },
      lastPanPosition: { x: event.clientX, y: event.clientY }
    }))

    document.body.style.cursor = 'grabbing'
  }, [enabled, containerRef])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!state.isDragging) return

    event.preventDefault()

    const deltaX = event.clientX - state.lastPanPosition.x
    const deltaY = event.clientY - state.lastPanPosition.y

    // Throttle pan updates for performance
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    
    rafRef.current = requestAnimationFrame(() => {
      handlePan(deltaX * panSensitivity, deltaY * panSensitivity)
    })

    setState(prev => ({
      ...prev,
      lastPanPosition: { x: event.clientX, y: event.clientY }
    }))
  }, [state.isDragging, state.lastPanPosition, panSensitivity])

  const handleMouseUp = useCallback(() => {
    if (!state.isDragging) return

    setState(prev => ({
      ...prev,
      isDragging: false
    }))

    document.body.style.cursor = 'default'
  }, [state.isDragging])

  // Touch handlers for mobile zoom and pan
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!enabled || !containerRef.current?.contains(event.target as Node)) return

    if (event.touches.length === 2) {
      // Two-finger pinch zoom
      event.preventDefault()
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
      )

      setState(prev => ({
        ...prev,
        isTouchZooming: true,
        lastTouchDistance: distance
      }))
    } else if (event.touches.length === 1) {
      // Single finger pan
      const touch = event.touches[0]
      setState(prev => ({
        ...prev,
        isDragging: true,
        dragStartPosition: { x: touch.clientX, y: touch.clientY },
        lastPanPosition: { x: touch.clientX, y: touch.clientY }
      }))
    }
  }, [enabled, containerRef])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enabled) return

    if (event.touches.length === 2 && state.isTouchZooming && state.lastTouchDistance) {
      // Pinch zoom
      event.preventDefault()
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
      )

      const zoomDelta = distance - state.lastTouchDistance
      const zoomCenter = {
        x: (touch1.clientX + touch2.clientX) / 2 - containerRef.current!.getBoundingClientRect().left,
        y: (touch1.clientY + touch2.clientY) / 2 - containerRef.current!.getBoundingClientRect().top
      }

      if (Math.abs(zoomDelta) > 10) { // Threshold to prevent micro-movements
        handleZoomAtPoint(zoomCenter, zoomDelta > 0 ? 1 : -1)
        setState(prev => ({ ...prev, lastTouchDistance: distance }))
      }
    } else if (event.touches.length === 1 && state.isDragging) {
      // Touch pan
      const touch = event.touches[0]
      const deltaX = touch.clientX - state.lastPanPosition.x
      const deltaY = touch.clientY - state.lastPanPosition.y

      handlePan(deltaX * panSensitivity, deltaY * panSensitivity)

      setState(prev => ({
        ...prev,
        lastPanPosition: { x: touch.clientX, y: touch.clientY }
      }))
    }
  }, [enabled, state.isTouchZooming, state.isDragging, state.lastTouchDistance, state.lastPanPosition, panSensitivity])

  const handleTouchEnd = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      isTouchZooming: false,
      lastTouchDistance: undefined
    }))
  }, [])

  // Zoom at specific point (maintaining focus on that point)
  const handleZoomAtPoint = useCallback((zoomCenter: { x: number; y: number }, direction: number) => {
    const currentLevel = ZOOM_LEVELS.indexOf(config.scale)
    const newLevel = Math.max(minZoomLevel, Math.min(maxZoomLevel, currentLevel + direction))
    
    if (newLevel === currentLevel) return

    // Calculate date at zoom center
    const centerDate = new Date(
      viewport.startDate.getTime() + 
      (zoomCenter.x / viewport.width) * (viewport.endDate.getTime() - viewport.startDate.getTime())
    )

    // Apply zoom
    if (direction > 0) {
      zoomIn()
    } else {
      zoomOut()
    }

    // Adjust date range to keep zoom center fixed
    setTimeout(() => {
      const currentRange = config.endDate.getTime() - config.startDate.getTime()
      const centerRatio = zoomCenter.x / viewport.width
      const newStartTime = centerDate.getTime() - currentRange * centerRatio
      const newEndTime = centerDate.getTime() + currentRange * (1 - centerRatio)
      
      setDateRange(new Date(newStartTime), new Date(newEndTime))
    }, 0)

    setState(prev => ({ ...prev, currentZoomLevel: newLevel }))
  }, [config.scale, viewport, minZoomLevel, maxZoomLevel, zoomIn, zoomOut, setDateRange])

  // Pan handling with boundary constraints
  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    // Horizontal panning - adjust date range
    if (Math.abs(deltaX) > 0) {
      const dateRange = config.endDate.getTime() - config.startDate.getTime()
      const timePerPixel = dateRange / viewport.width
      const timeDelta = -deltaX * timePerPixel // Negative for natural scroll direction

      const newStartDate = new Date(config.startDate.getTime() + timeDelta)
      const newEndDate = new Date(config.endDate.getTime() + timeDelta)

      // Apply reasonable boundaries (don't pan too far from today)
      const today = new Date()
      const maxPastDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000 * 5) // 5 years past
      const maxFutureDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000 * 10) // 10 years future

      if (newStartDate >= maxPastDate && newEndDate <= maxFutureDate) {
        if (throttledUpdateRef.current) throttledUpdateRef.current()
        throttledUpdateRef.current = () => setDateRange(newStartDate, newEndDate)
        setTimeout(throttledUpdateRef.current, 0)
      }
    }

    // Vertical panning would be handled by the parent scroll container
    // We emit the deltaY for the parent to handle WBS synchronization
    if (Math.abs(deltaY) > 0) {
      const ganttScrollElement = containerRef.current?.querySelector('[data-gantt-scroll]') as HTMLElement
      if (ganttScrollElement) {
        ganttScrollElement.scrollTop = Math.max(0, ganttScrollElement.scrollTop - deltaY)
      }
    }
  }, [config.startDate, config.endDate, viewport.width, setDateRange, containerRef])

  // Attach event listeners
  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current

    // Mouse events
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Touch events
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [
    enabled,
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  ])

  // Reset cursor on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default'
    }
  }, [])

  // Enhanced zoom controls
  const resetZoom = useCallback(() => {
    const { zoomToFit } = useGanttStore.getState()
    zoomToFit()
    setState(prev => ({ ...prev, currentZoomLevel: ZOOM_LEVELS.indexOf('month') }))
  }, [])

  const zoomToToday = useCallback(() => {
    const { scrollToToday } = useGanttStore.getState()
    scrollToToday()
  }, [])

  return {
    zoomPercentage,
    currentZoomLevel: state.currentZoomLevel,
    maxZoomLevel,
    minZoomLevel,
    isDragging: state.isDragging,
    isTouchZooming: state.isTouchZooming,
    canZoomIn: state.currentZoomLevel < maxZoomLevel,
    canZoomOut: state.currentZoomLevel > minZoomLevel,
    resetZoom,
    zoomToToday,
    handleZoomAtPoint
  }
}