'use client'

import { useState, useEffect } from 'react'
import { Issue, UpdateIssueData, IssueStatus, IssueType, EstimateUnit } from '@/types/issue'
import { useIssues } from '@/stores/issues.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'

interface IssueDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  issue: Issue | null
}

const statusOptions: { value: IssueStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'doing', label: 'Doing' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' }
]

const typeOptions: { value: IssueType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'spike', label: 'Spike' },
  { value: 'chore', label: 'Chore' }
]

const estimateUnitOptions: { value: EstimateUnit; label: string }[] = [
  { value: 'h', label: '時間' },
  { value: 'd', label: '日' }
]

export function IssueDetailPanel({ isOpen, onClose, issue }: IssueDetailPanelProps) {
  const { updateIssue, deleteIssue, isLoading, error } = useIssues()
  
  // Form state
  const [formData, setFormData] = useState<UpdateIssueData>({})
  const [isEditing, setIsEditing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Initialize form data when issue changes
  useEffect(() => {
    if (issue) {
      setFormData({
        title: issue.title,
        description: issue.description,
        status: issue.status,
        type: issue.type,
        priority: issue.priority,
        estimateValue: issue.estimateValue,
        estimateUnit: issue.estimateUnit,
        assigneeId: issue.assigneeId || '',
        startDate: issue.startDate ? issue.startDate.split('T')[0] : '',
        dueDate: issue.dueDate ? issue.dueDate.split('T')[0] : '',
        progress: issue.progress,
        labels: issue.labels,
        version: issue.version
      })
      setIsEditing(false)
      setLocalError(null)
    }
  }, [issue])

  // Handle form field changes
  const handleFieldChange = (field: keyof UpdateIssueData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issue) return

    setLocalError(null)
    
    try {
      // Prepare data for submission
      const updateData: UpdateIssueData = {
        ...formData,
        // Convert empty strings to undefined
        assigneeId: formData.assigneeId || undefined,
        startDate: formData.startDate || undefined,
        dueDate: formData.dueDate || undefined,
        // Ensure progress is within valid range
        progress: Math.min(Math.max(formData.progress || 0, 0), 100),
        // Ensure priority is within valid range
        priority: Math.min(Math.max(formData.priority || 0, 0), 100)
      }

      await updateIssue(issue.id, updateData)
      setIsEditing(false)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Issue更新に失敗しました')
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!issue) return
    
    if (window.confirm('このIssueを削除しますか？この操作は取り消せません。')) {
      try {
        await deleteIssue(issue.id)
        onClose()
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Issue削除に失敗しました')
      }
    }
  }

  // Handle cancel editing
  const handleCancelEdit = () => {
    if (issue) {
      // Reset form data to original values
      setFormData({
        title: issue.title,
        description: issue.description,
        status: issue.status,
        type: issue.type,
        priority: issue.priority,
        estimateValue: issue.estimateValue,
        estimateUnit: issue.estimateUnit,
        assigneeId: issue.assigneeId || '',
        startDate: issue.startDate ? issue.startDate.split('T')[0] : '',
        dueDate: issue.dueDate ? issue.dueDate.split('T')[0] : '',
        progress: issue.progress,
        labels: issue.labels,
        version: issue.version
      })
    }
    setIsEditing(false)
    setLocalError(null)
  }

  if (!isOpen || !issue) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Issue詳細
            </h2>
            <div className="flex items-center space-x-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    編集
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    loading={isLoading}
                  >
                    削除
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    form="issue-form"
                    size="sm"
                    loading={isLoading}
                  >
                    保存
                  </Button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Error message */}
            {(error || localError) && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">
                  {localError || error}
                </div>
              </div>
            )}

            {isEditing ? (
              /* Edit Form */
              <form id="issue-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タイトル *
                  </label>
                  <Input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ステータス
                    </label>
                    <Select
                      value={formData.status || ''}
                      onValueChange={(value) => handleFieldChange('status', value)}
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      タイプ
                    </label>
                    <Select
                      value={formData.type || ''}
                      onValueChange={(value) => handleFieldChange('type', value)}
                    >
                      {typeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    優先度 (0-100)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority || 0}
                    onChange={(e) => handleFieldChange('priority', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      見積もり
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.estimateValue || 0}
                      onChange={(e) => handleFieldChange('estimateValue', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      単位
                    </label>
                    <Select
                      value={formData.estimateUnit || 'h'}
                      onValueChange={(value) => handleFieldChange('estimateUnit', value)}
                    >
                      {estimateUnitOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者
                  </label>
                  <Input
                    type="text"
                    value={formData.assigneeId || ''}
                    onChange={(e) => handleFieldChange('assigneeId', e.target.value)}
                    placeholder="担当者IDを入力"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始日
                    </label>
                    <Input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      期限
                    </label>
                    <Input
                      type="date"
                      value={formData.dueDate || ''}
                      onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    進捗 (0-100%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress || 0}
                    onChange={(e) => handleFieldChange('progress', parseInt(e.target.value) || 0)}
                  />
                </div>
              </form>
            ) : (
              /* Read-only View */
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {issue.title}
                  </h3>
                  {issue.description && (
                    <p className="text-gray-600 whitespace-pre-wrap">
                      {issue.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ステータス</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${issue.status === 'done' ? 'bg-green-100 text-green-800' : issue.status === 'doing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {issue.status}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">タイプ</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {issue.type}
                    </dd>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">優先度</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {issue.priority}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">担当者</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {issue.assigneeId || '未割り当て'}
                    </dd>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">開始日</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {issue.startDate ? formatDate(issue.startDate) : '未設定'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">期限</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {issue.dueDate ? formatDate(issue.dueDate) : '未設定'}
                    </dd>
                  </div>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">見積もり・進捗</dt>
                  <dd className="mt-1">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-900">
                        {issue.estimateValue} {issue.estimateUnit} 見積もり
                      </span>
                      <span className="text-sm text-gray-900">
                        実績 {issue.spent}h
                      </span>
                      <div className="flex items-center flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(issue.progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500">
                          {issue.progress}%
                        </span>
                      </div>
                    </div>
                  </dd>
                </div>

                {issue.labels && issue.labels.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ラベル</dt>
                    <dd className="mt-1">
                      <div className="flex flex-wrap gap-2">
                        {issue.labels.map((label, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </dd>
                  </div>
                )}

                <div className="border-t pt-4 text-xs text-gray-500">
                  <p>作成日: {formatDate(issue.createdAt)}</p>
                  <p>更新日: {formatDate(issue.updatedAt)}</p>
                  <p>バージョン: {issue.version}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}