'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useIssues } from '@/stores/issues.store'
import { useAuth } from '@/stores/auth.store'
import { formatDate, formatDateTime, getStatusColor, getTypeColor, getPriorityColor } from '@/lib/utils'

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { 
    selectedIssue, 
    isLoading, 
    error, 
    fetchIssue, 
    deleteIssue,
    clearError 
  } = useIssues()
  
  const [isDeleting, setIsDeleting] = useState(false)
  const issueId = params.id as string

  useEffect(() => {
    if (issueId) {
      fetchIssue(issueId)
    }
  }, [issueId, fetchIssue])

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleDelete = async () => {
    if (!selectedIssue || !confirm('このIssueを削除してもよろしいですか？')) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteIssue(selectedIssue.id)
      router.push('/issues')
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="text-gray-500">読み込み中...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
              <div className="text-red-800">
                <h3 className="text-sm font-medium">エラーが発生しました</h3>
                <div className="mt-2 text-sm">{error}</div>
                <div className="mt-4">
                  <Link href="/issues">
                    <Button variant="outline" size="sm">
                      一覧に戻る
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedIssue) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-gray-500">Issueが見つかりませんでした。</div>
            <div className="mt-4">
              <Link href="/issues">
                <Button variant="outline">
                  一覧に戻る
                </Button>
              </Link>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href="/issues" className="text-sm text-gray-600 hover:text-gray-900">
                ← Issue一覧に戻る
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">
                Issue詳細
              </h1>
            </div>
            
            {isAuthenticated && (
              <div className="flex space-x-2">
                <Link href={`/issues/${selectedIssue.id}/edit`}>
                  <Button variant="outline">
                    編集
                  </Button>
                </Link>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  loading={isDeleting}
                >
                  削除
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {/* Issue Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedIssue.status)}`}>
                    {selectedIssue.status}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(selectedIssue.type)}`}>
                    {selectedIssue.type}
                  </span>
                  <span className={`text-sm ${getPriorityColor(selectedIssue.priority)}`}>
                    優先度: {selectedIssue.priority}
                  </span>
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedIssue.title}
                </h2>
                
                <div className="mt-2 text-sm text-gray-600">
                  ID: {selectedIssue.id}
                </div>
              </div>
            </div>
          </div>

          {/* Issue Details */}
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">説明</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedIssue.description || '説明がありません'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">プロジェクトID</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedIssue.projectId}
                </dd>
              </div>

              {selectedIssue.parentIssueId && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">親Issue</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <Link 
                      href={`/issues/${selectedIssue.parentIssueId}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {selectedIssue.parentIssueId}
                    </Link>
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">担当者</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedIssue.assigneeId || '未割り当て'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">見積もり</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedIssue.estimateValue}{selectedIssue.estimateUnit}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">実績時間</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedIssue.spent}h
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">進捗率</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${selectedIssue.progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="ml-2 text-sm">{selectedIssue.progress}%</span>
                  </div>
                </dd>
              </div>

              {selectedIssue.startDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">開始日</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(selectedIssue.startDate)}
                  </dd>
                </div>
              )}

              {selectedIssue.dueDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">期限</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(selectedIssue.dueDate)}
                  </dd>
                </div>
              )}

              {selectedIssue.labels.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">ラベル</dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-2">
                      {selectedIssue.labels.map((label, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">作成日時</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDateTime(selectedIssue.createdAt)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">更新日時</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDateTime(selectedIssue.updatedAt)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">バージョン</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedIssue.version}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}