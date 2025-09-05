'use client'

import React, { memo } from 'react'
// @ts-ignore - react-window v2.0.2 has type definition issues
import { List } from 'react-window'
import { GanttTask } from '@/types/gantt'

interface VirtualizedTaskListProps {
  tasks: GanttTask[]
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
  height: number
  rowHeight: number
  className?: string
  'data-testid'?: string
}

interface TaskListRowData {
  tasks: GanttTask[]
  selectedTaskIds: Set<string>
  onTaskClick: (task: GanttTask) => void
}

/**
 * Individual Task List Row Component
 */
const TaskListRow: React.FC<{
  index: number
  style: React.CSSProperties
  data: TaskListRowData
}> = memo(({ index, style, data }) => {
  const { tasks, selectedTaskIds, onTaskClick } = data
  const task = tasks[index]

  if (!task) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-green-500'
      case 'IN_PROGRESS':
        return 'bg-blue-500'
      case 'CANCELLED':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const isSelected = selectedTaskIds.has(task.id)

  return (
    <div
      style={style}
      className={`
        px-4 flex items-center cursor-pointer border-b border-gray-200 text-sm transition-colors
        ${isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-100'}
      `}
      onClick={() => onTaskClick(task)}
    >
      <div className="flex-1 truncate flex items-center">
        <span
          className={`inline-block w-3 h-3 rounded mr-2 flex-shrink-0 ${getStatusColor(task.status)}`}
        />
        <span className="truncate" title={task.title}>
          {task.title}
        </span>
      </div>
      <div className="text-xs text-gray-500 ml-2 flex-shrink-0">{task.progress}%</div>
    </div>
  )
})

TaskListRow.displayName = 'TaskListRow'

/**
 * Virtualized Task List Component
 *
 * High-performance task list using react-window for virtualization.
 * Only renders visible task rows to handle large datasets efficiently.
 */
export const VirtualizedTaskList = memo<VirtualizedTaskListProps>(
  ({ tasks, selectedTaskIds, onTaskClick, height, rowHeight, className = '', 'data-testid': dataTestId }) => {
    const listData: TaskListRowData = {
      tasks,
      selectedTaskIds,
      onTaskClick,
    }

    return (
      <div className={className} data-testid={dataTestId}>
        {/* react-window v2.0.2 has TypeScript compatibility issues - using createElement to bypass JSX type checking */}
        {React.createElement(
          List as any,
          {
            height,
            itemCount: tasks.length,
            itemSize: rowHeight,
            itemData: listData,
            overscanCount: 5,
          },
          TaskListRow as any
        )}
      </div>
    )
  }
)

VirtualizedTaskList.displayName = 'VirtualizedTaskList'
