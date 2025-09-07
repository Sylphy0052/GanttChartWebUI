'use client'

import { useState, useEffect } from 'react'
import { Issue, IssueStatus, IssueFilters } from '@/types/issue'
import { useIssues } from '@/stores/issues.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDate, getStatusColor, getPriorityColor } from '@/lib/utils'
import { IssueDetailPanel } from './IssueDetailPanel'

interface IssueTableProps {
  projectId?: string
}

const statusOptions = [
  { value: '', label: '全て' },
  { value: 'todo', label: 'Todo' },
  { value: 'doing', label: 'Doing' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' }
]

const priorityOptions = [
  { value: '', label: '全て' },
  { value: 'high', label: '高 (80+)' },
  { value: 'medium', label: '中 (50-79)' },
  { value: 'low', label: '低 (0-49)' }
]

export function IssueTable({ projectId }: IssueTableProps) {
  const {
    issues,
    selectedIssue,
    isLoading,
    error,
    pagination,
    fetchIssues,
    setSelectedIssue,
    clearError
  } = useIssues()

  // Local state for filters and UI
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  // Build filters object
  const buildFilters = (): IssueFilters => {
    const filters: IssueFilters = {}
    
    if (projectId) filters.projectId = projectId
    if (searchTerm.trim()) filters.search = searchTerm.trim()
    if (statusFilter) filters.status = statusFilter as IssueStatus
    if (assigneeFilter) filters.assigneeId = assigneeFilter
    
    if (priorityFilter) {
      switch (priorityFilter) {
        case 'high':
          filters.priorityMin = 80
          break
        case 'medium':
          filters.priorityMin = 50
          filters.priorityMax = 79
          break
        case 'low':
          filters.priorityMax = 49
          break
      }
    }
    
    return filters
  }

  // Load issues when filters change
  useEffect(() => {
    const filters = buildFilters()
    fetchIssues(filters)
    setCurrentPage(1)
  }, [searchTerm, statusFilter, assigneeFilter, priorityFilter, projectId])

  // Handle row click to open detail panel
  const handleRowClick = (issue: Issue) => {
    setSelectedIssue(issue)
    setIsDetailPanelOpen(true)
  }

  // Handle detail panel close
  const handleDetailPanelClose = () => {
    setIsDetailPanelOpen(false)
    setSelectedIssue(null)
  }

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is handled by useEffect when searchTerm changes
  }

  // Handle load more (pagination)
  const handleLoadMore = () => {
    if (pagination.hasMore && !isLoading) {
      const filters = buildFilters()
      fetchIssues(filters, true) // append = true
    }
  }

  // Get unique assignees for filter options
  const assigneeOptions = [
    { value: '', label: '全て' },
    ...Array.from(new Set(issues.map(issue => issue.assigneeId).filter(Boolean)))
      .map(assigneeId => ({
        value: assigneeId as string,
        label: assigneeId as string // In real app, this would be user name
      }))
  ]

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-red-800">
          <h3 className="text-sm font-medium">エラーが発生しました</h3>
          <div className="mt-2 text-sm">{error}</div>
          <div className="mt-4">
            <Button 
              onClick={() => {
                clearError()
                fetchIssues(buildFilters())
              }} 
              variant="outline" 
              size="sm"
            >
              再試行
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              検索
            </label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="タイトルや説明で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" loading={isLoading}>
                検索
              </Button>
            </div>
          </div>

          {/* Filter row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ステータス
              </label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder="ステータスを選択"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                担当者
              </label>
              <Select
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
                placeholder="担当者を選択"
              >
                {assigneeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                優先度
              </label>
              <Select
                value={priorityFilter}
                onValueChange={setPriorityFilter}
                placeholder="優先度を選択"
              >
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </form>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {pagination.total > 0 ? `全 ${pagination.total} 件` : '検索結果なし'}
        </p>
        {(searchTerm || statusFilter || assigneeFilter || priorityFilter) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setStatusFilter('')
              setAssigneeFilter('')
              setPriorityFilter('')
            }}
          >
            フィルターをクリア
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading && issues.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-pulse">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <div className="text-gray-500">
            {searchTerm || statusFilter || assigneeFilter || priorityFilter
              ? '検索条件に該当するIssueが見つかりませんでした。'
              : 'Issueがありません。'
            }
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タイトル
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    担当者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    優先度
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    開始日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期限
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    進捗
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {issues.map((issue) => (
                  <tr 
                    key={issue.id}
                    onClick={() => handleRowClick(issue)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-start space-x-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {issue.title}
                          </p>
                          {issue.description && (
                            <p className="text-sm text-gray-500 truncate mt-1">
                              {issue.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {issue.assigneeId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getPriorityColor(issue.priority)}`}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {issue.startDate ? formatDate(issue.startDate) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {issue.dueDate ? formatDate(issue.dueDate) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(issue.progress, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="ml-2 text-sm text-gray-500">
                          {issue.progress}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.hasMore && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                onClick={handleLoadMore}
                loading={isLoading}
                variant="outline"
                className="w-full"
              >
                さらに読み込む ({pagination.total - issues.length} 件残り)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      <IssueDetailPanel
        isOpen={isDetailPanelOpen}
        onClose={handleDetailPanelClose}
        issue={selectedIssue}
      />
    </div>
  )
}