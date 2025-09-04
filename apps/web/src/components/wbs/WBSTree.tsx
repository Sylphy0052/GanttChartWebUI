'use client'

import React, { useEffect, useMemo } from 'react'
import { List } from 'react-window'
import { WBSTreeNode } from '@/types/wbs'
import { useWBSStore, useWBSSelectors } from '@/stores/wbs.store'
import { WBSNode } from './WBSNode'
import { WBSActions } from './WBSActions'
import { WBSUtils } from '@/lib/wbs-utils'

interface WBSTreeProps {
  projectId?: string
  height?: number
  className?: string
}

interface ListItemData {
  visibleNodes: WBSTreeNode[]
  selectedNodeId?: string
  onSelectNode: (nodeId: string) => void
}

const WBSTreeItem: React.FC<{
  index: number
  style: React.CSSProperties
  data: ListItemData
}> = ({ index, style, data }) => {
  const { visibleNodes, selectedNodeId, onSelectNode } = data
  const node = visibleNodes[index]
  
  if (!node) return null
  
  return (
    <div style={style}>
      <WBSNode
        node={node}
        level={node.level}
        isSelected={node.id === selectedNodeId}
        onSelect={onSelectNode}
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
    selectNode, 
    fetchTree 
  } = useWBSStore()
  
  const selectors = useWBSSelectors()

  // Calculate visible nodes based on expansion state
  const visibleNodes = useMemo(() => {
    return selectors.visibleNodes()
  }, [nodes, selectors])

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
    onSelectNode: handleSelectNode
  }

  return (
    <div className={`flex flex-col bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Actions Header */}
      <WBSActions projectId={projectId} onRefresh={handleRefresh} />
      
      {/* Tree Content */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">更新中...</span>
            </div>
          </div>
        )}
        
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
      </div>
      
      {/* Status Bar */}
      <div className="border-t border-gray-200 px-6 py-2 bg-gray-50 text-sm text-gray-600">
        <div className="flex justify-between items-center">
          <span>
            {visibleNodes.length} / {selectors.treeStats().totalNodes} タスク表示中
          </span>
          <span>
            最大深度: {selectors.treeStats().maxDepth}
          </span>
        </div>
      </div>
    </div>
  )
}