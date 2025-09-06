'use client'

import React, { memo, useState } from 'react'
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { WBSTreeNode, DropZoneInfo } from '@/types/wbs'
import { useWBSStore, useWBSSelectors } from '@/stores/wbs.store'
import { cn } from '@/lib/utils'

interface WBSNodeProps {
  node: WBSTreeNode
  level: number
  isSelected: boolean
  onSelect: (nodeId: string) => void
  isDragging?: boolean
  draggedNodeId?: string
  onDropZoneHover?: (info: DropZoneInfo | null) => void
}

export const WBSNode = memo<WBSNodeProps>(({ 
  node, 
  level, 
  isSelected, 
  onSelect, 
  isDragging = false, 
  draggedNodeId,
  onDropZoneHover
}) => {
  const { toggleNode } = useWBSStore()
  const selectors = useWBSSelectors()
  const [hoveredDropZone, setHoveredDropZone] = useState<'above' | 'below' | 'inside' | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: node.id })

  // Set up drop zones for parent changes
  const {
    setNodeRef: setDropNodeRef,
    isOver: isOverParentDrop,
  } = useDroppable({
    id: `parent-${node.id}`,
    data: {
      type: 'parent',
      nodeId: node.id,
      accepts: ['WBSTreeNode']
    }
  })

  const {
    setNodeRef: setAboveDropRef,
    isOver: isOverAbove,
  } = useDroppable({
    id: `above-${node.id}`,
    data: {
      type: 'sibling',
      nodeId: node.id,
      position: 'above',
      accepts: ['WBSTreeNode']
    }
  })

  const {
    setNodeRef: setBelowDropRef,
    isOver: isOverBelow,
  } = useDroppable({
    id: `below-${node.id}`,
    data: {
      type: 'sibling',
      nodeId: node.id,
      position: 'below',
      accepts: ['WBSTreeNode']
    }
  })

  const indentWidth = level * 20

  const nodeStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${indentWidth + 12}px`
  }

  // Validate drop zones when dragging
  const getDropZoneInfo = (type: 'parent' | 'sibling', position?: 'above' | 'below'): DropZoneInfo | null => {
    if (!draggedNodeId) return null

    if (type === 'parent') {
      const validation = selectors.canChangeParent(draggedNodeId, node.id)
      return {
        nodeId: node.id,
        type: 'parent',
        position: 'inside',
        isValid: validation.canChange,
        reason: validation.reason
      }
    }

    // For sibling drops, we need to validate if both nodes can have the same parent
    return {
      nodeId: node.id,
      type: 'sibling',
      position: position || 'below',
      isValid: draggedNodeId !== node.id, // Can't drop on itself
      reason: draggedNodeId === node.id ? 'Cannot drop on itself' : undefined
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.hasChildren) {
      toggleNode(node.id)
    }
  }

  const handleSelect = () => {
    if (!isDragging && !isSortableDragging) {
      onSelect(node.id)
    }
  }

  const handleDropZoneHover = (info: DropZoneInfo | null) => {
    setHoveredDropZone(info?.position as any)
    onDropZoneHover?.(info)
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

  // Show visual feedback when being dragged over
  const showingDragFeedback = draggedNodeId && draggedNodeId !== node.id

  return (
    <div className="relative">
      {/* Above Drop Zone */}
      {showingDragFeedback && (
        <div
          ref={setAboveDropRef}
          className={cn(
            'absolute -top-1 left-0 right-0 h-2 transition-colors duration-200',
            isOverAbove && getDropZoneInfo('sibling', 'above')?.isValid
              ? 'bg-blue-500 rounded'
              : isOverAbove
              ? 'bg-red-500 rounded'
              : 'transparent'
          )}
          onMouseEnter={() => handleDropZoneHover(getDropZoneInfo('sibling', 'above'))}
          onMouseLeave={() => handleDropZoneHover(null)}
        />
      )}

      <div
        ref={(el) => {
          setNodeRef(el)
          setDropNodeRef(el)
        }}
        style={nodeStyle}
        className={cn(
          'group flex items-center py-2 px-3 cursor-pointer border-l-4 transition-all duration-200 relative',
          'min-h-[48px]',
          isSelected ? 'bg-blue-50 border-l-blue-500' : 'border-l-transparent',
          isDragging || isSortableDragging 
            ? 'opacity-50 bg-gray-100 shadow-lg z-50' 
            : 'hover:bg-gray-50',
          isSortableDragging && 'rotate-2 scale-105',
          // Parent drop zone feedback
          showingDragFeedback && isOverParentDrop && node.hasChildren && cn(
            'ring-2 ring-inset',
            getDropZoneInfo('parent')?.isValid 
              ? 'ring-blue-500 bg-blue-50' 
              : 'ring-red-500 bg-red-50'
          )
        )}
        onClick={handleSelect}
        {...attributes}
        onMouseEnter={() => {
          if (showingDragFeedback && node.hasChildren) {
            handleDropZoneHover(getDropZoneInfo('parent'))
          }
        }}
        onMouseLeave={() => {
          if (showingDragFeedback) {
            handleDropZoneHover(null)
          }
        }}
      >
        {/* Drag Handle - Only visible on hover and not while dragging */}
        {!isDragging && !isSortableDragging && (
          <div 
            className="flex-shrink-0 mr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            {...listeners}
          >
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
        )}

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
                className={cn(
                  'font-medium text-gray-900 truncate transition-colors duration-200',
                  !isDragging && !isSortableDragging && 'group-hover:text-blue-600'
                )}
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
            <div className={cn(
              'transition-opacity duration-200',
              isDragging || isSortableDragging 
                ? 'opacity-0' 
                : 'opacity-0 group-hover:opacity-100'
            )}>
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

        {/* Drag Indicator */}
        {(isDragging || isSortableDragging) && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r"></div>
        )}

        {/* Parent Drop Zone Indicator - only show when node has children and can accept drops */}
        {showingDragFeedback && node.hasChildren && isOverParentDrop && (
          <div className={cn(
            'absolute inset-0 border-2 border-dashed rounded pointer-events-none',
            getDropZoneInfo('parent')?.isValid 
              ? 'border-blue-500' 
              : 'border-red-500'
          )}>
            <div className={cn(
              'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
              'px-2 py-1 rounded text-xs font-medium text-white',
              getDropZoneInfo('parent')?.isValid 
                ? 'bg-blue-500' 
                : 'bg-red-500'
            )}>
              {getDropZoneInfo('parent')?.isValid 
                ? `Add as child (Level ${node.level + 1})` 
                : getDropZoneInfo('parent')?.reason
              }
            </div>
          </div>
        )}
      </div>

      {/* Below Drop Zone */}
      {showingDragFeedback && (
        <div
          ref={setBelowDropRef}
          className={cn(
            'absolute -bottom-1 left-0 right-0 h-2 transition-colors duration-200',
            isOverBelow && getDropZoneInfo('sibling', 'below')?.isValid
              ? 'bg-blue-500 rounded'
              : isOverBelow
              ? 'bg-red-500 rounded'
              : 'transparent'
          )}
          onMouseEnter={() => handleDropZoneHover(getDropZoneInfo('sibling', 'below'))}
          onMouseLeave={() => handleDropZoneHover(null)}
        />
      )}
    </div>
  )
})

WBSNode.displayName = 'WBSNode'