'use client'

import React, { memo } from 'react'
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { WBSTreeNode } from '@/types/wbs'
import { useWBSStore } from '@/stores/wbs.store'
import { cn } from '@/lib/utils'

interface WBSNodeProps {
  node: WBSTreeNode
  level: number
  isSelected: boolean
  onSelect: (nodeId: string) => void
}

export const WBSNode = memo<WBSNodeProps>(({ node, level, isSelected, onSelect }) => {
  const { toggleNode } = useWBSStore()

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.hasChildren) {
      toggleNode(node.id)
    }
  }

  const handleSelect = () => {
    onSelect(node.id)
  }

  const getStatusColor = (status: string) => {
    const colors = {
      TODO: 'text-gray-500 bg-gray-100',
      IN_PROGRESS: 'text-blue-700 bg-blue-100',
      DONE: 'text-green-700 bg-green-100',
      CANCELLED: 'text-red-700 bg-red-100'
    }
    return colors[status as keyof typeof colors] || colors.TODO
  }

  const getProgressBar = (progress: number) => {
    const progressColor = progress >= 100 ? 'bg-green-500' :
                         progress >= 50 ? 'bg-yellow-500' : 'bg-blue-500'
    
    return (
      <div className="w-16 bg-gray-200 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all duration-300', progressColor)}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    )
  }

  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  const indentWidth = level * 20

  return (
    <div
      className={cn(
        'group flex items-center py-2 px-3 hover:bg-gray-50 cursor-pointer border-l-4 transition-all duration-200',
        isSelected ? 'bg-blue-50 border-l-blue-500' : 'border-l-transparent',
        'min-h-[48px]'
      )}
      style={{ paddingLeft: `${indentWidth + 12}px` }}
      onClick={handleSelect}
    >
      {/* Expand/Collapse Toggle */}
      <div className="flex-shrink-0 mr-2">
        {node.hasChildren ? (
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-gray-200 rounded transition-colors duration-200"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        ) : (
          <div className="w-6 h-6" /> /* Spacer */
        )}
      </div>

      {/* Node Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 items-center min-w-0">
        {/* Title */}
        <div className="col-span-4 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                getStatusColor(node.status)
              )}
            >
              {node.status.replace('_', ' ')}
            </span>
            <h3
              className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-200"
              title={node.title}
            >
              {node.title}
            </h3>
          </div>
          {node.description && (
            <p className="text-sm text-gray-500 truncate mt-1" title={node.description}>
              {node.description}
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="col-span-2 flex items-center gap-2">
          {getProgressBar(node.progress)}
          <span className="text-sm text-gray-600 w-12 text-right">
            {node.progress}%
          </span>
        </div>

        {/* Dates */}
        <div className="col-span-2 text-sm text-gray-600">
          <div className="flex flex-col">
            <span title={node.startDate?.toISOString()}>
              開始: {formatDate(node.startDate)}
            </span>
            <span title={node.dueDate?.toISOString()}>
              期限: {formatDate(node.dueDate)}
            </span>
          </div>
        </div>

        {/* Estimated Hours */}
        <div className="col-span-1 text-sm text-gray-600 text-center">
          {node.estimatedHours ? `${node.estimatedHours}h` : '-'}
        </div>

        {/* Assignee */}
        <div className="col-span-2 text-sm text-gray-600">
          {node.assigneeId ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-600">
                  {node.assigneeId.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="truncate">{node.assigneeId}</span>
            </div>
          ) : (
            <span className="text-gray-400">未割当</span>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex justify-end">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              className="p-1 hover:bg-gray-200 rounded"
              onClick={(e) => {
                e.stopPropagation()
                // TODO: Implement edit functionality
              }}
              aria-label="Edit"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

WBSNode.displayName = 'WBSNode'