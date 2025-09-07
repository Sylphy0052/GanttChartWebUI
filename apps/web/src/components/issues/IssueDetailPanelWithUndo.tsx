/**
 * Issue Detail Panel with Undo/Redo Support
 * 
 * Enhanced version of IssueDetailPanel that integrates with the undo/redo system.
 * Provides seamless issue editing with full undo support, form validation,
 * and professional error handling.
 * 
 * Features:
 * - Field-level undo/redo for all issue modifications
 * - Form state management with history tracking
 * - Real-time validation with visual feedback
 * - Keyboard shortcuts (Ctrl+Z/Y) integrated
 * - Professional UX with loading states and error handling
 * - Optimistic updates with rollback on API failure
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Issue, UpdateIssueData, IssueStatus, IssueType, EstimateUnit } from '@/types/issue'
import { useIssues } from '@/stores/issues.store'
import { useIssueWithUndo } from '@/hooks/useIssueWithUndo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'

interface IssueDetailPanelWithUndoProps {
  isOpen: boolean
  onClose: () => void
  issue: Issue | null
  enableAutoSave?: boolean
  onIssueUpdated?: (issue: Issue) => void
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

export function IssueDetailPanelWithUndo({ 
  isOpen, 
  onClose, 
  issue, 
  enableAutoSave = false,
  onIssueUpdated 
}: IssueDetailPanelWithUndoProps) {
  const { deleteIssue, isLoading, error } = useIssues()
  const [isEditing, setIsEditing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Initialize undo/redo hook
  const issueWithUndo = useIssueWithUndo({
    issue,
    enableAutoSave,
    autoSaveDelay: 1500,
    onIssueUpdated: (updatedIssue, command) => {
      console.log(`✅ Issue updated via undo/redo: ${command.description}`)
      if (onIssueUpdated) {
        onIssueUpdated(updatedIssue)
      }
    },
    onError: (error, command) => {
      console.error(`❌ Issue edit error: ${error.message}`, { command: command?.description })
      setLocalError(error.message)
    },
    onStateChanged: (state) => {
      // Could show indicators for pending changes, etc.
      if (state.isDirty) {
        console.log(`📝 Issue has pending changes: ${issueWithUndo.getPendingChangesSummary()}`)
      }
    }
  })

  /**
   * Handle field changes with undo support
   */
  const handleFieldChange = useCallback(async (field: keyof UpdateIssueData, value: any) => {
    if (!isEditing) return

    setLocalError(null)

    try {
      // For immediate mode, update immediately; for auto-save mode, add to pending changes
      await issueWithUndo.updateIssueField(field, value, { 
        immediate: !enableAutoSave 
      })
    } catch (error) {
      console.error(`Field update failed for ${field}:`, error)
      // Error is already handled by the hook's onError callback
    }
  }, [isEditing, enableAutoSave, issueWithUndo])

  /**
   * Handle form submission (for non-auto-save mode)
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issue || !isEditing) return

    setLocalError(null)

    try {
      // Submit any pending changes
      await issueWithUndo.submitPendingChanges()
      setIsEditing(false)
      
      console.log(`✅ Issue form submitted successfully`)
    } catch (error) {
      console.error('Form submission failed:', error)
      // Error is already handled by the hook's onError callback
    }
  }, [issue, isEditing, issueWithUndo])

  /**
   * Handle delete operation
   */
  const handleDelete = useCallback(async () => {
    if (!issue) return
    
    const confirmMessage = 'このIssueを削除しますか？この操作は取り消せません。'
    if (window.confirm(confirmMessage)) {
      try {
        await deleteIssue(issue.id)
        onClose()
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Issue削除に失敗しました')
      }
    }
  }, [issue, deleteIssue, onClose])

  /**
   * Handle cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    issueWithUndo.cancelPendingChanges()
    setIsEditing(false)
    setLocalError(null)
  }, [issueWithUndo])

  /**
   * Handle undo operation
   */
  const handleUndo = useCallback(async () => {
    try {
      const success = await issueWithUndo.undoLastEdit()
      if (success) {
        console.log('✅ Successfully undid last edit')
      }
    } catch (error) {
      console.error('Undo failed:', error)
      setLocalError('Undo操作に失敗しました')
    }
  }, [issueWithUndo])

  /**
   * Handle redo operation
   */
  const handleRedo = useCallback(async () => {
    try {
      const success = await issueWithUndo.redoLastEdit()
      if (success) {
        console.log('✅ Successfully redid last edit')
      }
    } catch (error) {
      console.error('Redo failed:', error)
      setLocalError('Redo操作に失敗しました')
    }
  }, [issueWithUndo])

  /**
   * Reset state when issue changes or panel closes
   */
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
      setLocalError(null)
      issueWithUndo.resetState()
    }
  }, [isOpen, issueWithUndo])

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    if (!isEditing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSubmit(e as any)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, handleSubmit])

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
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Issue詳細
              </h2>
              {issueWithUndo.state.isDirty && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  未保存の変更あり
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Undo/Redo buttons (only show in edit mode) */}
              {isEditing && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={!issueWithUndo.canUndoEdit}
                    title="元に戻す (Ctrl+Z)"
                  >
                    ↶
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    disabled={!issueWithUndo.canRedoEdit}
                    title="やり直し (Ctrl+Y)"
                  >
                    ↷
                  </Button>
                  <div className="w-px h-4 bg-gray-300" />
                </>
              )}

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
                    disabled={isLoading}
                  >
                    キャンセル
                  </Button>
                  {!enableAutoSave && (
                    <Button
                      type="submit"
                      form="issue-form"
                      size="sm"
                      loading={isLoading}
                      disabled={Object.keys(issueWithUndo.validateForm()).length > 0}
                    >
                      保存
                    </Button>
                  )}
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

            {/* Success message for auto-save */}
            {enableAutoSave && !issueWithUndo.state.isDirty && issueWithUndo.state.isModified && (
              <div className="mb-4 rounded-md bg-green-50 p-4">
                <div className="text-sm text-green-800">
                  変更が自動保存されました
                </div>
              </div>
            )}

            {isEditing ? (
              /* Edit Form with Undo Support */
              <form id="issue-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タイトル *
                    {issueWithUndo.isFieldModified('title') && (
                      <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                    )}
                  </label>
                  <Input
                    type="text"
                    value={issueWithUndo.getFieldValue('title') || ''}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    required
                    className={issueWithUndo.state.validationErrors.title ? 'border-red-500' : ''}
                  />
                  {issueWithUndo.state.validationErrors.title && (
                    <p className="mt-1 text-xs text-red-600">
                      {issueWithUndo.state.validationErrors.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                    {issueWithUndo.isFieldModified('description') && (
                      <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                    )}
                  </label>
                  <textarea
                    value={issueWithUndo.getFieldValue('description') || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={4}
                    className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                      issueWithUndo.state.validationErrors.description ? 'border-red-500' : ''
                    }`}
                  />
                  {issueWithUndo.state.validationErrors.description && (
                    <p className="mt-1 text-xs text-red-600">
                      {issueWithUndo.state.validationErrors.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ステータス
                      {issueWithUndo.isFieldModified('status') && (
                        <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                      )}
                    </label>
                    <Select
                      value={issueWithUndo.getFieldValue('status') || ''}
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
                      {issueWithUndo.isFieldModified('type') && (
                        <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                      )}
                    </label>
                    <Select
                      value={issueWithUndo.getFieldValue('type') || ''}
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
                    {issueWithUndo.isFieldModified('priority') && (
                      <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                    )}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={issueWithUndo.getFieldValue('priority') || 0}
                    onChange={(e) => handleFieldChange('priority', parseInt(e.target.value) || 0)}
                    className={issueWithUndo.state.validationErrors.priority ? 'border-red-500' : ''}
                  />
                  {issueWithUndo.state.validationErrors.priority && (
                    <p className="mt-1 text-xs text-red-600">
                      {issueWithUndo.state.validationErrors.priority}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      見積もり
                      {issueWithUndo.isFieldModified('estimateValue') && (
                        <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                      )}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={issueWithUndo.getFieldValue('estimateValue') || 0}
                      onChange={(e) => handleFieldChange('estimateValue', parseFloat(e.target.value) || 0)}
                      className={issueWithUndo.state.validationErrors.estimateValue ? 'border-red-500' : ''}
                    />
                    {issueWithUndo.state.validationErrors.estimateValue && (
                      <p className="mt-1 text-xs text-red-600">
                        {issueWithUndo.state.validationErrors.estimateValue}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      単位
                      {issueWithUndo.isFieldModified('estimateUnit') && (
                        <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                      )}
                    </label>
                    <Select
                      value={issueWithUndo.getFieldValue('estimateUnit') || 'h'}
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
                    {issueWithUndo.isFieldModified('assigneeId') && (
                      <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                    )}
                  </label>
                  <Input
                    type="text"
                    value={issueWithUndo.getFieldValue('assigneeId') || ''}
                    onChange={(e) => handleFieldChange('assigneeId', e.target.value)}
                    placeholder="担当者IDを入力"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始日
                      {issueWithUndo.isFieldModified('startDate') && (
                        <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                      )}
                    </label>
                    <Input
                      type="date"
                      value={issueWithUndo.getFieldValue('startDate')?.split('T')[0] || ''}
                      onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      期限
                      {issueWithUndo.isFieldModified('dueDate') && (
                        <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                      )}
                    </label>
                    <Input
                      type="date"
                      value={issueWithUndo.getFieldValue('dueDate')?.split('T')[0] || ''}
                      onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    進捗 (0-100%)
                    {issueWithUndo.isFieldModified('progress') && (
                      <span className="text-blue-600 text-xs ml-1">(変更済み)</span>
                    )}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={issueWithUndo.getFieldValue('progress') || 0}
                    onChange={(e) => handleFieldChange('progress', parseInt(e.target.value) || 0)}
                    className={issueWithUndo.state.validationErrors.progress ? 'border-red-500' : ''}
                  />
                  {issueWithUndo.state.validationErrors.progress && (
                    <p className="mt-1 text-xs text-red-600">
                      {issueWithUndo.state.validationErrors.progress}
                    </p>
                  )}
                </div>

                {/* Help text */}
                <div className="text-xs text-gray-500 pt-2 border-t">
                  <p>💡 ヒント: Ctrl+Z/Yで元に戻す・やり直しができます</p>
                  {enableAutoSave && <p>🔄 自動保存が有効です</p>}
                  {!enableAutoSave && <p>💾 Ctrl+Sで保存できます</p>}
                </div>
              </form>
            ) : (
              /* Read-only View - Same as original */
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        issue.status === 'done' ? 'bg-green-100 text-green-800' : 
                        issue.status === 'doing' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
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