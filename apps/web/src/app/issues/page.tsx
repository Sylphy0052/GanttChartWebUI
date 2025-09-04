'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIssues } from '@/stores/issues.store'
import { useAuth } from '@/stores/auth.store'
import { formatDate, getStatusColor, getTypeColor, getPriorityColor } from '@/lib/utils'
import { Issue } from '@/types/issue'

export default function IssuesPage() {
  const { 
    issues, 
    isLoading, 
    error, 
    pagination, 
    fetchIssues, 
    loadMore, 
    search, 
    clearError,
    setSelectedIssue 
  } = useIssues()
  
  const { isAuthenticated, user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [localLoading, setLocalLoading] = useState(false)

  useEffect(() => {
    // Initial load
    fetchIssues()
  }, [])

  useEffect(() => {
    // Clear error when component mounts
    clearError()
  }, [clearError])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalLoading(true)
    await search(searchTerm)
    setLocalLoading(false)
  }

  const handleLoadMore = async () => {
    if (!isLoading && pagination.hasMore) {
      await loadMore()
    }
  }

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
              <div className="text-red-800">
                <h3 className="text-sm font-medium">エラーが発生しました</h3>
                <div className="mt-2 text-sm">{error}</div>
                <div className="mt-4">
                  <Button 
                    onClick={() => fetchIssues()} 
                    variant="outline" 
                    size="sm"
                  >
                    再試行
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href="/">
                <h1 className="text-2xl font-bold text-gray-900">
                  Gantt Chart WebUI
                </h1>
              </Link>
              <p className="mt-1 text-sm text-gray-600">
                Issue管理システム
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    こんにちは、{user?.name || user?.email}さん
                  </span>
                  <Link href="/login">
                    <Button variant="outline" size="sm">
                      ログアウト
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">ゲストモード</span>
                  <Link href="/login">
                    <Button size="sm">
                      ログイン
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Issue一覧
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {pagination.total > 0 && `全 ${pagination.total} 件`}
            </p>
          </div>
          
          <div className="flex space-x-4">
            <Link href="/issues/create">
              <Button disabled={!isAuthenticated}>
                新しいIssue
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Issue を検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              loading={localLoading}
              disabled={isLoading}
            >
              検索
            </Button>
          </form>
        </div>

        {/* Issues List */}
        {isLoading && issues.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="text-gray-500">読み込み中...</div>
            </div>
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {searchTerm ? '検索条件に該当するIssueが見つかりませんでした。' : 'Issueがありません。'}
            </div>
            {isAuthenticated && (
              <div className="mt-4">
                <Link href="/issues/create">
                  <Button>
                    最初のIssueを作成
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <div className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
                    <Link href={`/issues/${issue.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(issue.status)}`}>
                              {issue.status}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(issue.type)}`}>
                              {issue.type}
                            </span>
                            <span className={`text-sm ${getPriorityColor(issue.priority)}`}>
                              優先度: {issue.priority}
                            </span>
                          </div>
                          
                          <div className="mt-2">
                            <p className="text-lg font-medium text-gray-900 truncate">
                              {issue.title}
                            </p>
                            {issue.description && (
                              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                {issue.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                            {issue.assigneeId && (
                              <span>担当者: {issue.assigneeId}</span>
                            )}
                            {issue.startDate && (
                              <span>開始: {formatDate(issue.startDate)}</span>
                            )}
                            {issue.dueDate && (
                              <span>期限: {formatDate(issue.dueDate)}</span>
                            )}
                            <span>
                              進捗: {issue.progress}% ({issue.spent}h/{issue.estimateValue}{issue.estimateUnit})
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            
            {/* Load More Button */}
            {pagination.hasMore && (
              <div className="px-6 py-4 border-t border-gray-200">
                <Button
                  onClick={handleLoadMore}
                  loading={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  さらに読み込む
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}