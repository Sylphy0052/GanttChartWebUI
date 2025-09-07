import React from 'react'
import { render, screen } from '@testing-library/react'
import { DependencyLines } from '../DependencyLines'
import { GanttTask, GanttDependency, GanttViewport } from '@/types/gantt'
import { scaleTime } from 'd3-scale'

// Mock data for testing
const mockTasks: GanttTask[] = [
  {
    id: 'task-1',
    title: 'Task 1',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-05'),
    progress: 50,
    status: 'IN_PROGRESS',
    dependencies: [],
    level: 0,
    order: 0
  },
  {
    id: 'task-2',
    title: 'Task 2',
    startDate: new Date('2024-01-06'),
    endDate: new Date('2024-01-10'),
    progress: 0,
    status: 'TODO',
    dependencies: [],
    level: 0,
    order: 1
  }
]

const mockDependencies: GanttDependency[] = [
  {
    id: 'dep-1',
    predecessorId: 'task-1',
    successorId: 'task-2',
    fromTaskId: 'task-1',
    toTaskId: 'task-2',
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  }
]

const mockViewport: GanttViewport = {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  timeScale: scaleTime().domain([new Date('2024-01-01'), new Date('2024-01-31')]).range([0, 800]),
  taskScale: null,
  width: 800,
  height: 400,
  rowHeight: 40,
  taskHeight: 24,
  headerHeight: 60,
  getDatePosition: (date: Date) => 0
}

describe('DependencyLines', () => {
  it('renders SVG container when dependencies exist', () => {
    render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={mockDependencies}
        viewport={mockViewport}
        width={800}
        height={400}
      />
    )

    const svg = screen.getByTestId('dependency-lines-svg')
    expect(svg).toBeInTheDocument()
    expect(svg.tagName).toBe('svg')
  })

  it('renders nothing when no dependencies exist', () => {
    const { container } = render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={[]}
        viewport={mockViewport}
        width={800}
        height={400}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders dependency line with correct test id', () => {
    render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={mockDependencies}
        viewport={mockViewport}
        width={800}
        height={400}
      />
    )

    const dependencyLine = screen.getByTestId('dependency-line-dep-1')
    expect(dependencyLine).toBeInTheDocument()
    expect(dependencyLine.tagName).toBe('path')
  })

  it('applies custom className', () => {
    render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={mockDependencies}
        viewport={mockViewport}
        width={800}
        height={400}
        className="custom-class"
      />
    )

    const svg = screen.getByTestId('dependency-lines-svg')
    expect(svg).toHaveClass('custom-class')
  })

  it('handles click events on dependencies', () => {
    const mockOnClick = jest.fn()
    
    render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={mockDependencies}
        viewport={mockViewport}
        width={800}
        height={400}
        onDependencyClick={mockOnClick}
      />
    )

    const dependencyLine = screen.getByTestId('dependency-line-dep-1')
    dependencyLine.click()
    
    expect(mockOnClick).toHaveBeenCalledWith(
      mockDependencies[0],
      expect.any(Object) // MouseEvent
    )
  })

  it('handles context menu events on dependencies', () => {
    const mockOnContextMenu = jest.fn()
    
    render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={mockDependencies}
        viewport={mockViewport}
        width={800}
        height={400}
        onDependencyContextMenu={mockOnContextMenu}
      />
    )

    const dependencyLine = screen.getByTestId('dependency-line-dep-1')
    dependencyLine.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    
    expect(mockOnContextMenu).toHaveBeenCalledWith(
      mockDependencies[0],
      expect.any(Object) // MouseEvent
    )
  })

  it('renders arrow markers for different dependency types', () => {
    const dependenciesWithDifferentTypes: GanttDependency[] = [
      {
        id: 'dep-fs',
        predecessorId: 'task-1',
        successorId: 'task-2',
        fromTaskId: 'task-1',
        toTaskId: 'task-2',
        type: 'FS',
        lag: 0,
        lagUnit: 'hours'
      },
      {
        id: 'dep-ss',
        predecessorId: 'task-1',
        successorId: 'task-2',
        fromTaskId: 'task-1',
        toTaskId: 'task-2',
        type: 'SS',
        lag: 0,
        lagUnit: 'hours'
      }
    ]

    render(
      <DependencyLines
        tasks={mockTasks}
        dependencies={dependenciesWithDifferentTypes}
        viewport={mockViewport}
        width={800}
        height={400}
      />
    )

    const svg = screen.getByTestId('dependency-lines-svg')
    const defs = svg.querySelector('defs')
    
    expect(defs).toBeInTheDocument()
    expect(defs?.querySelector('#dependency-arrow-fs')).toBeInTheDocument()
    expect(defs?.querySelector('#dependency-arrow-ss')).toBeInTheDocument()
  })
})