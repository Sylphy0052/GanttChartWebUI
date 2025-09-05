'use client'

import React, { useState } from 'react'
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
} from '@heroicons/react/24/outline'
import { useWBSStore, useWBSSelectors } from '@/stores/wbs.store'
import { Button } from '@/components/ui/button'

interface WBSActionsProps {
  projectId?: string
  onRefresh?: () => void
}

export const WBSActions: React.FC<WBSActionsProps> = ({ projectId, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  const { expandAll, collapseAll, fetchTree, loading } = useWBSStore()
  const selectors = useWBSSelectors()
  const stats = selectors.treeStats()

  const handleRefresh = async () => {
    await fetchTree(projectId)
    onRefresh?.()
  }

  const handleExpandAll = () => {
    expandAll()
  }

  const handleCollapseAll = () => {
    collapseAll()
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    // TODO: Implement search functionality
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">WBS (Work Breakdown Structure)</h1>
          <p className="text-sm text-gray-600 mt-1">
            {stats.totalNodes} タスク ({stats.visibleNodes} 表示中, {stats.expandedNodes} 展開中)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            data-testid="wbs-refresh-button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            ) : (
              '更新'
            )}
          </Button>
          
          <Button
            data-testid="wbs-filter-button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
            フィルター
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Left side - Search and Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              data-testid="wbs-search-input"
              type="text"
              placeholder="タスクを検索..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
            />
          </div>

          {/* Expand/Collapse Actions */}
          <div className="flex items-center gap-2">
            <Button
              data-testid="wbs-expand-all-button"
              variant="ghost"
              size="sm"
              onClick={handleExpandAll}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowsPointingOutIcon className="w-4 h-4 mr-2" />
              全展開
            </Button>
            
            <Button
              data-testid="wbs-collapse-all-button"
              variant="ghost"
              size="sm"
              onClick={handleCollapseAll}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowsPointingInIcon className="w-4 h-4 mr-2" />
              全折りたたみ
            </Button>
          </div>
        </div>

        {/* Right side - View Options */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">表示:</span>
          <div className="flex bg-gray-100 rounded-md p-1">
            <Button
              variant="ghost"
              size="sm"
              className="px-3 py-1 text-sm bg-white shadow-sm"
            >
              ツリー
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              リスト
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ステータス
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">すべて</option>
                <option value="TODO">TODO</option>
                <option value="IN_PROGRESS">進行中</option>
                <option value="DONE">完了</option>
                <option value="CANCELLED">キャンセル</option>
              </select>
            </div>

            {/* Assignee Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                担当者
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">すべて</option>
                <option value="unassigned">未割当</option>
                {/* TODO: Dynamic assignee list */}
              </select>
            </div>

            {/* Progress Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                進捗率
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">すべて</option>
                <option value="0">0%</option>
                <option value="1-50">1-50%</option>
                <option value="51-99">51-99%</option>
                <option value="100">100%</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                期限
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">すべて</option>
                <option value="overdue">期限切れ</option>
                <option value="today">今日</option>
                <option value="week">今週</option>
                <option value="month">今月</option>
              </select>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Reset filters
              }}
            >
              リセット
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // TODO: Apply filters
              }}
            >
              適用
            </Button>
          </div>
        </div>
      )}

      {/* Column Headers */}
      <div className="mt-4 border-t border-gray-200 pt-3">
        <div className="grid grid-cols-12 gap-4 px-12 text-sm font-medium text-gray-700">
          <div className="col-span-4">タスク</div>
          <div className="col-span-2">進捗</div>
          <div className="col-span-2">日程</div>
          <div className="col-span-1 text-center">工数</div>
          <div className="col-span-2">担当者</div>
          <div className="col-span-1"></div>
        </div>
      </div>
    </div>
  )
}