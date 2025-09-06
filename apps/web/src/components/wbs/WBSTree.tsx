'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { List } from 'react-window'
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent, 
  DragOverlay, 
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragOverEvent,
  closestCenter
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { WBSTreeNode, DropZoneInfo } from '@/types/wbs'
import { useWBSStore, useWBSSelectors } from '@/stores/wbs.store'
import { WBSNode } from './WBSNode'
import { WBSActions } from './WBSActions'

interface WBSTreeProps {
  projectId?: string
  height?: number
  className?: string
}

interface ListItemData {
  visibleNodes: WBSTreeNode[]
  selectedNodeId?: string
  onSelectNode: (nodeId: string) => void
  draggedNodeId?: string
  onDropZoneHover: (info: DropZoneInfo | null) => void
}

const WBSTreeItem: React.FC<{
  index: number
  style: React.CSSProperties
  data: ListItemData
}> = ({ index, style, data }) => {
  const { visibleNodes, selectedNodeId, onSelectNode, draggedNodeId, onDropZoneHover } = data
  const node = visibleNodes[index]
  
  if (!node) return null
  
  return (
    <div style={style} data-testid="wbs-node-item">
      <WBSNode
        node={node}
        level={node.level}
        isSelected={node.id === selectedNodeId}
        onSelect={onSelectNode}
        isDragging={node.id === draggedNodeId}
        draggedNodeId={draggedNodeId}
        onDropZoneHover={onDropZoneHover}
      />
    </div>
  )
}

export const WBSTree: React.FC<WBSTreeProps> = ({ 
  projectId, 
  height = 600,
  className = ''
}) => {
  const { 
    nodes, 
    selectedNodeId, 
    loading, 
    error, 
    reorderLoading,
    selectNode, 
    fetchTree,
    reorderNode,
    changeParent
  } = useWBSStore()
  
  const selectors = useWBSSelectors()
  const [draggedNode, setDraggedNode] = useState<WBSTreeNode | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [hoveredDropZone, setHoveredDropZone] = useState<DropZoneInfo | null>(null)

  // Calculate visible nodes based on expansion state
  const visibleNodes = useMemo(() => {
    return selectors.visibleNodes()
  }, [nodes, selectors])

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get sortable IDs for the current level being rendered
  const sortableIds = useMemo(() => {
    return visibleNodes.map(node => node.id)
  }, [visibleNodes])

  // Load data on mount and project change
  useEffect(() => {
    fetchTree(projectId)
  }, [projectId, fetchTree])

  const handleSelectNode = (nodeId: string) => {
    selectNode(nodeId)
  }

  const handleRefresh = () => {
    fetchTree(projectId)
  }

  const handleDropZoneHover = (info: DropZoneInfo | null) => {
    setHoveredDropZone(info)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const draggedNodeId = event.active.id as string
    const node = visibleNodes.find(n => n.id === draggedNodeId)
    if (node) {
      setDraggedNode(node)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (over) {
      const overIndex = visibleNodes.findIndex(node => node.id === over.id)
      setDragOverIndex(overIndex)
    } else {
      setDragOverIndex(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    setDraggedNode(null)
    setDragOverIndex(null)
    setHoveredDropZone(null)
    
    if (!over || active.id === over.id) {
      return
    }

    const draggedNodeId = active.id as string
    const draggedNode = visibleNodes.find(node => node.id === draggedNodeId)
    
    if (!draggedNode) {
      return
    }

    // Parse the over target to determine the operation type
    const overIdStr = over.id as string
    
    // Handle parent drop (dropping on a node to make it a child)
    if (overIdStr.startsWith('parent-')) {
      const targetParentId = overIdStr.replace('parent-', '')
      const validation = selectors.canChangeParent(draggedNodeId, targetParentId)
      
      if (!validation.canChange) {
        console.warn('Cannot change parent:', validation.reason)
        return
      }

      try {
        await changeParent(draggedNodeId, targetParentId, 0) // Add as first child
      } catch (error) {
        console.error('Failed to change parent:', error)
      }
      return
    }

    // Handle sibling drop (dropping above/below a node)
    if (overIdStr.startsWith('above-') || overIdStr.startsWith('below-')) {
      const isAbove = overIdStr.startsWith('above-')
      const targetNodeId = overIdStr.replace(isAbove ? 'above-' : 'below-', '')
      const targetNode = visibleNodes.find(node => node.id === targetNodeId)
      
      if (!targetNode) {
        return
      }

      // If different parents, change parent first
      if (draggedNode.parentId !== targetNode.parentId) {
        const validation = selectors.canChangeParent(draggedNodeId, targetNode.parentId || null)
        
        if (!validation.canChange) {
          console.warn('Cannot change parent for sibling drop:', validation.reason)
          return
        }

        // Calculate index based on position relative to target
        const { siblings } = selectors.getSiblings(targetNodeId)
        const targetIndex = siblings.findIndex(s => s.id === targetNodeId)
        const newIndex = isAbove ? targetIndex : targetIndex + 1

        try {
          await changeParent(draggedNodeId, targetNode.parentId || null, newIndex)
        } catch (error) {
          console.error('Failed to change parent for sibling drop:', error)
        }
        return
      }

      // Same parent - just reorder
      const { siblings } = selectors.getSiblings(draggedNodeId)
      
      if (siblings.length === 0) {
        return
      }

      // Calculate new index and create ordered sibling IDs
      const targetIndex = siblings.findIndex(s => s.id === targetNodeId)
      const draggedIndex = siblings.findIndex(s => s.id === draggedNodeId)
      
      if (targetIndex === draggedIndex) {
        return
      }

      // Create new order based on target position
      const reorderedSiblings = [...siblings]
      const draggedItem = reorderedSiblings.find(item => item.id === draggedNodeId)
      const filteredSiblings = reorderedSiblings.filter(item => item.id !== draggedNodeId)
      
      if (draggedItem) {
        const insertIndex = isAbove ? targetIndex : 
                          (targetIndex > draggedIndex ? targetIndex : targetIndex + 1)
        const adjustedIndex = Math.min(insertIndex, filteredSiblings.length)
        filteredSiblings.splice(adjustedIndex, 0, draggedItem)
      }
      
      const newSiblingIds = filteredSiblings.map(sibling => sibling.id)
      const newIndex = newSiblingIds.findIndex(id => id === draggedNodeId)

      try {
        await reorderNode(draggedNodeId, newIndex, newSiblingIds)
      } catch (error) {
        console.error('Failed to reorder node:', error)
      }
      return
    }

    // Handle direct node drop (legacy sibling reordering within same parent)
    const targetNodeId = overIdStr
    const targetNode = visibleNodes.find(node => node.id === targetNodeId)
    
    if (!targetNode) {
      return
    }

    // Only allow reordering within the same parent (same level) for direct drops
    if (draggedNode.parentId !== targetNode.parentId) {
      console.warn('Cross-parent reordering requires using drop zones')
      return
    }

    // Get siblings for the current parent level
    const { siblings } = selectors.getSiblings(draggedNodeId)
    
    if (siblings.length === 0) {
      return
    }

    // Calculate new index and create ordered sibling IDs
    const targetIndex = visibleNodes.findIndex(node => node.id === targetNodeId)
    const draggedIndex = visibleNodes.findIndex(node => node.id === draggedNodeId)
    
    if (targetIndex === draggedIndex) {
      return
    }

    // Create new order based on visible nodes within the same parent
    const parentSiblings = siblings.filter(sibling => sibling.parentId === draggedNode.parentId)
    const reorderedSiblings = [...parentSiblings]
    
    // Remove dragged item and insert at new position
    const draggedItem = reorderedSiblings.find(item => item.id === draggedNodeId)
    const filteredSiblings = reorderedSiblings.filter(item => item.id !== draggedNodeId)
    const targetSiblingIndex = filteredSiblings.findIndex(item => item.id === targetNodeId)
    
    if (draggedItem) {
      const insertIndex = targetIndex > draggedIndex ? targetSiblingIndex + 1 : targetSiblingIndex
      filteredSiblings.splice(insertIndex, 0, draggedItem)
    }
    
    // Create final sibling IDs array
    const newSiblingIds = filteredSiblings.map(sibling => sibling.id)
    const newIndex = newSiblingIds.findIndex(id => id === draggedNodeId)

    try {
      await reorderNode(draggedNodeId, newIndex, newSiblingIds)
    } catch (error) {
      console.error('Failed to reorder node:', error)
      // Error is already handled in the store
    }
  }

  const getItemSize = (index: number): number => {
    // Base height for each row
    const baseHeight = 48
    const node = visibleNodes[index]
    
    if (!node) return baseHeight
    
    // Add extra height if node has description
    const descriptionHeight = node.description ? 20 : 0
    
    return baseHeight + descriptionHeight
  }

  if (error) {
    return (
      <div className={`flex flex-col bg-white rounded-lg shadow ${className}`}>
        <WBSActions projectId={projectId} onRefresh={handleRefresh} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">データの読み込みに失敗しました</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading && nodes.length === 0) {
    return (
      <div className={`flex flex-col bg-white rounded-lg shadow ${className}`}>
        <WBSActions projectId={projectId} onRefresh={handleRefresh} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">WBSツリーを読み込んでいます...</p>
          </div>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className={`flex flex-col bg-white rounded-lg shadow ${className}`}>
        <WBSActions projectId={projectId} onRefresh={handleRefresh} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">タスクがありません</h3>
            <p className="text-gray-600 mb-4">
              {projectId ? 'このプロジェクトにはタスクがありません。' : 'タスクがありません。'}
            </p>
            <button
              onClick={() => {
                // TODO: Navigate to create task
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              タスクを作成
            </button>
          </div>
        </div>
      </div>
    )
  }

  const listData: ListItemData = {
    visibleNodes,
    selectedNodeId,
    onSelectNode: handleSelectNode,
    draggedNodeId: draggedNode?.id,
    onDropZoneHover: handleDropZoneHover
  }

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div data-testid="wbs-tree-container" className={`flex flex-col bg-white rounded-lg shadow overflow-hidden ${className}`}>
        {/* Actions Header */}
        <WBSActions projectId={projectId} onRefresh={handleRefresh} />
        
        {/* Tree Content */}
        <div className="flex-1 relative">
          {(loading || reorderLoading) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">
                  {reorderLoading ? '更新中...' : '更新中...'}
                </span>
              </div>
            </div>
          )}
          
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {visibleNodes.length > 0 && React.createElement(
              List as any,
              {
                height,
                itemCount: visibleNodes.length,
                itemSize: 50,
                itemData: listData,
                overscanCount: 10,
                className: "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100",
                children: WBSTreeItem
              }
            )}
          </SortableContext>
        </div>
        
        {/* Status Bar */}
        <div data-testid="wbs-status-bar" className="border-t border-gray-200 px-6 py-2 bg-gray-50 text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>
              {visibleNodes.length} / {selectors.treeStats().totalNodes} タスク表示中
            </span>
            <div className="flex items-center gap-4">
              <span>
                最大深度: {selectors.treeStats().maxDepth}
              </span>
              {hoveredDropZone && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  hoveredDropZone.isValid 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {hoveredDropZone.isValid 
                    ? `${hoveredDropZone.type === 'parent' ? '子要素として追加' : 'リ゙オーダー'}` 
                    : hoveredDropZone.reason
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedNode ? (
            <div className="bg-white border border-gray-300 rounded-md shadow-lg opacity-90">
              <WBSNode
                node={draggedNode}
                level={0}
                isSelected={false}
                onSelect={() => {}}
                isDragging={true}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}