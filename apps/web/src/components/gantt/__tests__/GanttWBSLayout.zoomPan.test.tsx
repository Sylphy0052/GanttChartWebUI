/**
 * Test file for enhanced Gantt Chart Zoom and Pan functionality
 * S2-FE-06: Gantt Chart Zoom and Pan
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GanttWBSLayout } from '../GanttWBSLayout'

// Mock the stores and hooks
jest.mock('@/stores/wbs.store', () => ({
  useWBSStore: () => ({}),
  useWBSSelectors: () => ({
    visibleNodes: () => []
  })
}))

jest.mock('@/stores/gantt.store', () => ({
  useGanttStore: () => ({
    config: {
      scale: 'week',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      workingDays: [1, 2, 3, 4, 5],
      workingHoursPerDay: 8,
      holidays: [],
      rowHeight: 40,
      taskHeight: 24,
      headerHeight: 60
    },
    viewport: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      timeScale: jest.fn(),
      taskScale: jest.fn(),
      width: 1200,
      height: 600,
      rowHeight: 40,
      taskHeight: 24,
      headerHeight: 60,
      getDatePosition: jest.fn()
    },
    selectedTaskIds: new Set<string>(),
    loading: false,
    error: undefined,
    fetchGanttData: jest.fn(),
    setViewportSize: jest.fn(),
    selectTask: jest.fn(),
    clearSelection: jest.fn(),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    zoomToFit: jest.fn(),
    scrollToToday: jest.fn()
  })
}))

jest.mock('@/hooks/useGanttZoomPan', () => ({
  useGanttZoomPan: () => ({
    zoomPercentage: 100,
    currentZoomLevel: 1,
    maxZoomLevel: 3,
    minZoomLevel: 0,
    isDragging: false,
    isTouchZooming: false,
    canZoomIn: true,
    canZoomOut: true,
    resetZoom: jest.fn(),
    zoomToToday: jest.fn(),
    handleZoomAtPoint: jest.fn()
  })
}))

jest.mock('@/components/wbs/WBSTree', () => {
  return function WBSTree() {
    return <div data-testid="wbs-tree">WBS Tree</div>
  }
})

jest.mock('./GanttTimeline', () => {
  return function GanttTimeline() {
    return <div data-testid="gantt-timeline">Gantt Timeline</div>
  }
})

jest.mock('./VirtualizedGanttGrid', () => {
  return function VirtualizedGanttGrid() {
    return <div data-testid="gantt-grid">Gantt Grid</div>
  }
})

jest.mock('@/lib/gantt-utils', () => ({
  GanttUtils: {
    getTaskColor: jest.fn(() => '#3B82F6'),
    calculateOptimalDateRange: jest.fn(() => ({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31')
    })),
    createTimeScale: jest.fn(),
    createTaskScale: jest.fn()
  }
}))

describe('GanttWBSLayout - Zoom and Pan Enhancement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders enhanced zoom controls with percentage indicator', () => {
    render(<GanttWBSLayout />)
    
    // Check for enhanced zoom percentage indicator
    expect(screen.getByText('100%')).toBeInTheDocument()
    
    // Check for zoom buttons
    expect(screen.getByTitle(/Zoom out.*wheel down/)).toBeInTheDocument()
    expect(screen.getByTitle(/Zoom in.*wheel up/)).toBeInTheDocument()
  })

  it('displays enhanced help text for zoom and pan interactions', () => {
    render(<GanttWBSLayout />)
    
    // Check for enhanced keyboard shortcuts help
    const helpText = screen.getByText(/Ctrl\+Wheel: Zoom.*Mid-Click\/Ctrl\+Drag: Pan.*Pinch: Touch Zoom/)
    expect(helpText).toBeInTheDocument()
  })

  it('shows interaction feedback indicators', () => {
    const { rerender } = render(<GanttWBSLayout />)
    
    // Mock dragging state
    jest.mocked(require('@/hooks/useGanttZoomPan').useGanttZoomPan).mockReturnValue({
      zoomPercentage: 100,
      currentZoomLevel: 1,
      maxZoomLevel: 3,
      minZoomLevel: 0,
      isDragging: true,
      isTouchZooming: false,
      canZoomIn: true,
      canZoomOut: true,
      resetZoom: jest.fn(),
      zoomToToday: jest.fn(),
      handleZoomAtPoint: jest.fn()
    })
    
    rerender(<GanttWBSLayout />)
    
    // Check for panning indicator
    expect(screen.getByText('Panning...')).toBeInTheDocument()
  })

  it('shows touch zoom indicator when touch zooming', () => {
    const { rerender } = render(<GanttWBSLayout />)
    
    // Mock touch zooming state
    jest.mocked(require('@/hooks/useGanttZoomPan').useGanttZoomPan).mockReturnValue({
      zoomPercentage: 150,
      currentZoomLevel: 2,
      maxZoomLevel: 3,
      minZoomLevel: 0,
      isDragging: false,
      isTouchZooming: true,
      canZoomIn: true,
      canZoomOut: true,
      resetZoom: jest.fn(),
      zoomToToday: jest.fn(),
      handleZoomAtPoint: jest.fn()
    })
    
    rerender(<GanttWBSLayout />)
    
    // Check for touch zoom indicator
    expect(screen.getByText('Touch Zoom')).toBeInTheDocument()
  })

  it('handles zoom button clicks', () => {
    const mockZoomIn = jest.fn()
    const mockZoomOut = jest.fn()
    
    jest.mocked(require('@/stores/gantt.store').useGanttStore).mockReturnValue({
      config: {
        scale: 'week',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        workingDays: [1, 2, 3, 4, 5],
        workingHoursPerDay: 8,
        holidays: [],
        rowHeight: 40,
        taskHeight: 24,
        headerHeight: 60
      },
      viewport: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        timeScale: jest.fn(),
        taskScale: jest.fn(),
        width: 1200,
        height: 600,
        rowHeight: 40,
        taskHeight: 24,
        headerHeight: 60,
        getDatePosition: jest.fn()
      },
      selectedTaskIds: new Set<string>(),
      loading: false,
      error: undefined,
      fetchGanttData: jest.fn(),
      setViewportSize: jest.fn(),
      selectTask: jest.fn(),
      clearSelection: jest.fn(),
      zoomIn: mockZoomIn,
      zoomOut: mockZoomOut,
      zoomToFit: jest.fn(),
      scrollToToday: jest.fn()
    })
    
    render(<GanttWBSLayout />)
    
    // Click zoom in button
    fireEvent.click(screen.getByTitle(/Zoom in/))
    expect(mockZoomIn).toHaveBeenCalled()
    
    // Click zoom out button
    fireEvent.click(screen.getByTitle(/Zoom out/))
    expect(mockZoomOut).toHaveBeenCalled()
  })

  it('renders gantt container with proper refs and attributes', () => {
    render(<GanttWBSLayout />)
    
    // Check that the gantt scroll container has the data attribute
    const ganttScrollContainer = screen.getByTestId('gantt-wbs-grid').closest('[data-gantt-scroll="true"]')
    expect(ganttScrollContainer).toBeInTheDocument()
  })

  it('shows interactive overlay during zoom/pan operations', () => {
    const { container } = render(<GanttWBSLayout />)
    
    // Initially no overlay
    expect(container.querySelector('.bg-blue-100.bg-opacity-10')).not.toBeInTheDocument()
    
    // Mock interaction state
    jest.mocked(require('@/hooks/useGanttZoomPan').useGanttZoomPan).mockReturnValue({
      zoomPercentage: 100,
      currentZoomLevel: 1,
      maxZoomLevel: 3,
      minZoomLevel: 0,
      isDragging: true,
      isTouchZooming: false,
      canZoomIn: true,
      canZoomOut: true,
      resetZoom: jest.fn(),
      zoomToToday: jest.fn(),
      handleZoomAtPoint: jest.fn()
    })
    
    const { rerender } = render(<GanttWBSLayout />)
    rerender(<GanttWBSLayout />)
    
    // Should show overlay during interaction
    expect(container.querySelector('.bg-blue-100.bg-opacity-10')).toBeInTheDocument()
  })
})