'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  DetectedConflict,
  ConflictResolutionResult,
  ResolutionStrategy,
  ResolutionOptions,
  ConflictType,
  DateResolutionRule,
  ProgressResolutionRule,
  AssigneeResolutionRule,
  PriorityResolutionRule,
  MergeRules,
} from '@/types/scheduling'
import { conflictsApi } from '@/lib/api/conflicts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ConflictResolutionDialogProps {
  projectId: string
  conflicts: DetectedConflict[]
  isOpen: boolean
  onClose: () => void
  onResolved?: (result: ConflictResolutionResult) => void
  userId: string
}

interface PreviewResult {
  previewResult: ConflictResolutionResult;
  estimatedChanges: Array<{
    entityType: 'TASK' | 'DEPENDENCY' | 'RESOURCE';
    entityId: string;
    changes: Record<string, { from: any; to: any }>;
  }>;
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    specificRisks: Array<{
      type: 'DATA_LOSS' | 'SCHEDULE_DISRUPTION' | 'RESOURCE_CONFLICT' | 'DEPENDENCY_BREAK';
      description: string;
      mitigation: string;
    }>;
  };
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  projectId,
  conflicts,
  isOpen,
  onClose,
  onResolved,
  userId,
}) => {
  // State
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionStrategy>({
    type: 'CURRENT',
    bulkApply: conflicts.length > 1,
    preserveUserChanges: true,
  })
  
  const [resolutionOptions, setResolutionOptions] = useState<ResolutionOptions>({
    validateAfterResolution: true,
    recalculateSchedule: true,
    notifyStakeholders: false,
    createBackup: true,
  })

  const [mergeRules, setMergeRules] = useState<MergeRules>({
    startDate: DateResolutionRule.CURRENT,
    endDate: DateResolutionRule.CURRENT,
    progress: ProgressResolutionRule.MAX,
    assignee: AssigneeResolutionRule.MERGE,
    priority: PriorityResolutionRule.HIGHEST,
  })

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'strategy' | 'preview' | 'risks'>('details')

  // Memoized values
  const conflictIds = useMemo(() => conflicts.map(c => c.id), [conflicts])
  const isBulkResolution = conflicts.length > 1
  const highRiskConflicts = useMemo(() => 
    conflicts.filter(c => c.severity === 'HIGH' || c.severity === 'CRITICAL'),
    [conflicts]
  )

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('')
      setPreviewResult(null)
      setActiveTab('details')
      setSelectedStrategy({
        type: 'CURRENT',
        bulkApply: conflicts.length > 1,
        preserveUserChanges: true,
      })
    }
  }, [isOpen, conflicts.length])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handlePreview = async () => {
    setIsPreviewing(true)
    setError('')
    
    try {
      const options = selectedStrategy.type === 'MERGE' 
        ? { ...resolutionOptions, mergeRules }
        : resolutionOptions

      const result = await conflictsApi.previewResolution(
        projectId,
        conflictIds,
        selectedStrategy,
        options
      )
      
      setPreviewResult(result)
      setActiveTab('preview')
    } catch (error: any) {
      setError(error.message || 'Failed to preview resolution')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleApply = async () => {
    setIsApplying(true)
    setError('')
    
    try {
      const options = selectedStrategy.type === 'MERGE' 
        ? { ...resolutionOptions, mergeRules }
        : resolutionOptions

      let result: ConflictResolutionResult
      
      if (isBulkResolution) {
        result = await conflictsApi.resolveBulkConflicts(
          projectId,
          conflictIds,
          selectedStrategy,
          options,
          userId
        )
      } else {
        result = await conflictsApi.resolveConflict(
          projectId,
          conflictIds[0],
          selectedStrategy,
          options,
          userId
        )
      }
      
      onResolved?.(result)
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to apply resolution')
    } finally {
      setIsApplying(false)
    }
  }

  const getConflictIcon = (type: ConflictType) => {
    const icons = {
      OPTIMISTIC_LOCKING: '🔒',
      SCHEDULING_CONFLICT: '📅',
      RESOURCE_OVERALLOCATION: '👥',
      CIRCULAR_DEPENDENCY: '🔄',
      DATE_CONSTRAINT_VIOLATION: '⏰',
      DEPENDENCY_MISMATCH: '🔗',
      DATA_INTEGRITY: '⚠️',
    }
    return icons[type] || '❓'
  }

  const getSeverityColor = (severity: string) => {
    const colors = {
      LOW: 'text-green-600 bg-green-50',
      MEDIUM: 'text-yellow-600 bg-yellow-50',
      HIGH: 'text-orange-600 bg-orange-50',
      CRITICAL: 'text-red-600 bg-red-50',
    }
    return colors[severity as keyof typeof colors] || 'text-gray-600 bg-gray-50'
  }

  const getRiskColor = (risk: string) => {
    const colors = {
      LOW: 'text-green-600',
      MEDIUM: 'text-yellow-600',
      HIGH: 'text-orange-600',
      CRITICAL: 'text-red-600',
    }
    return colors[risk as keyof typeof colors] || 'text-gray-600'
  }

  if (!isOpen || conflicts.length === 0) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                競合解決 {isBulkResolution && `(${conflicts.length}件)`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isBulkResolution 
                  ? '複数の競合を一括で解決します' 
                  : '競合の解決方法を選択してください'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading || isApplying}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex px-6 space-x-8">
              {['details', 'strategy', 'preview', 'risks'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'details' && '競合詳細'}
                  {tab === 'strategy' && '解決戦略'}
                  {tab === 'preview' && 'プレビュー'}
                  {tab === 'risks' && 'リスク評価'}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-medium">エラーが発生しました</p>
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                {highRiskConflicts.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-red-800">高リスク競合が検出されました</span>
                    </div>
                    <p className="text-sm text-red-700">
                      {highRiskConflicts.length}件の競合が重要度「HIGH」または「CRITICAL」に分類されています。慎重に解決方法を選択してください。
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {conflicts.map((conflict) => (
                    <div key={conflict.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <span className="text-2xl">{getConflictIcon(conflict.type)}</span>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900">
                                {conflict.entityType} ({conflict.entityId})
                              </h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(conflict.severity)}`}>
                                {conflict.severity}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{conflict.description}</p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="font-medium text-gray-500">現在値:</span>
                                <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(conflict.currentValue, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">競合値:</span>
                                <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(conflict.conflictingValue, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'strategy' && (
              <div className="space-y-6">
                {/* Strategy Selection */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">解決戦略</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { type: 'CURRENT', label: '現在値を保持', desc: '既存の値をそのまま保持します' },
                      { type: 'INCOMING', label: '新着値を適用', desc: '競合する新しい値を適用します' },
                      { type: 'MANUAL', label: '手動選択', desc: '各項目を個別に選択します' },
                      { type: 'MERGE', label: 'インテリジェント統合', desc: 'システムが最適な統合を実行します' },
                    ].map((strategy) => (
                      <div
                        key={strategy.type}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedStrategy.type === strategy.type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedStrategy(prev => ({ ...prev, type: strategy.type as any }))}
                      >
                        <div className="flex items-center mb-2">
                          <input
                            type="radio"
                            checked={selectedStrategy.type === strategy.type}
                            onChange={() => {}}
                            className="mr-3"
                          />
                          <span className="font-medium text-gray-900">{strategy.label}</span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{strategy.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Merge Rules (shown only for MERGE strategy) */}
                {selectedStrategy.type === 'MERGE' && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">統合ルール</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          開始日
                        </label>
                        <select
                          value={mergeRules.startDate}
                          onChange={(e) => setMergeRules(prev => ({ 
                            ...prev, 
                            startDate: e.target.value as DateResolutionRule 
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={DateResolutionRule.CURRENT}>現在値</option>
                          <option value={DateResolutionRule.INCOMING}>新着値</option>
                          <option value={DateResolutionRule.EARLIEST}>最も早い日付</option>
                          <option value={DateResolutionRule.LATEST}>最も遅い日付</option>
                          <option value={DateResolutionRule.AVERAGE}>平均値</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          終了日
                        </label>
                        <select
                          value={mergeRules.endDate}
                          onChange={(e) => setMergeRules(prev => ({ 
                            ...prev, 
                            endDate: e.target.value as DateResolutionRule 
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={DateResolutionRule.CURRENT}>現在値</option>
                          <option value={DateResolutionRule.INCOMING}>新着値</option>
                          <option value={DateResolutionRule.EARLIEST}>最も早い日付</option>
                          <option value={DateResolutionRule.LATEST}>最も遅い日付</option>
                          <option value={DateResolutionRule.AVERAGE}>平均値</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          進捗率
                        </label>
                        <select
                          value={mergeRules.progress}
                          onChange={(e) => setMergeRules(prev => ({ 
                            ...prev, 
                            progress: e.target.value as ProgressResolutionRule 
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={ProgressResolutionRule.CURRENT}>現在値</option>
                          <option value={ProgressResolutionRule.INCOMING}>新着値</option>
                          <option value={ProgressResolutionRule.MAX}>最大値</option>
                          <option value={ProgressResolutionRule.MIN}>最小値</option>
                          <option value={ProgressResolutionRule.AVERAGE}>平均値</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          優先度
                        </label>
                        <select
                          value={mergeRules.priority}
                          onChange={(e) => setMergeRules(prev => ({ 
                            ...prev, 
                            priority: e.target.value as PriorityResolutionRule 
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={PriorityResolutionRule.CURRENT}>現在値</option>
                          <option value={PriorityResolutionRule.INCOMING}>新着値</option>
                          <option value={PriorityResolutionRule.HIGHEST}>最も高い</option>
                          <option value={PriorityResolutionRule.LOWEST}>最も低い</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resolution Options */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">解決オプション</h4>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={resolutionOptions.validateAfterResolution}
                        onChange={(e) => setResolutionOptions(prev => ({ 
                          ...prev, 
                          validateAfterResolution: e.target.checked 
                        }))}
                        className="mr-3"
                      />
                      <span className="text-sm text-gray-700">解決後に検証を実行</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={resolutionOptions.recalculateSchedule}
                        onChange={(e) => setResolutionOptions(prev => ({ 
                          ...prev, 
                          recalculateSchedule: e.target.checked 
                        }))}
                        className="mr-3"
                      />
                      <span className="text-sm text-gray-700">スケジュールを再計算</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={resolutionOptions.createBackup}
                        onChange={(e) => setResolutionOptions(prev => ({ 
                          ...prev, 
                          createBackup: e.target.checked 
                        }))}
                        className="mr-3"
                      />
                      <span className="text-sm text-gray-700">バックアップを作成</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={resolutionOptions.notifyStakeholders}
                        onChange={(e) => setResolutionOptions(prev => ({ 
                          ...prev, 
                          notifyStakeholders: e.target.checked 
                        }))}
                        className="mr-3"
                      />
                      <span className="text-sm text-gray-700">関係者に通知</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-6">
                {!previewResult ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">解決のプレビュー</h3>
                    <p className="text-gray-600 mb-4">プレビューボタンをクリックして変更内容を確認してください</p>
                    <Button
                      onClick={handlePreview}
                      loading={isPreviewing}
                      disabled={isPreviewing}
                    >
                      プレビューを生成
                    </Button>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">変更プレビュー</h3>
                    
                    {/* Resolution Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium text-blue-800">
                          {previewResult.previewResult.resolvedConflicts.length}件の競合が解決されます
                        </span>
                      </div>
                      {previewResult.previewResult.remainingConflicts.length > 0 && (
                        <p className="text-sm text-blue-700">
                          {previewResult.previewResult.remainingConflicts.length}件の競合は未解決のまま残ります
                        </p>
                      )}
                    </div>

                    {/* Estimated Changes */}
                    {previewResult.estimatedChanges.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-gray-900 mb-3">予想される変更</h4>
                        <div className="space-y-3">
                          {previewResult.estimatedChanges.map((change, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-3">
                              <div className="font-medium text-gray-900 mb-2">
                                {change.entityType} ({change.entityId})
                              </div>
                              <div className="space-y-2">
                                {Object.entries(change.changes).map(([field, { from, to }]) => (
                                  <div key={field} className="flex items-center text-sm">
                                    <span className="w-20 text-gray-600">{field}:</span>
                                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded mr-2">
                                      {JSON.stringify(from)}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded ml-2">
                                      {JSON.stringify(to)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {previewResult.previewResult.warnings.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-gray-900 mb-3">警告</h4>
                        <div className="space-y-2">
                          {previewResult.previewResult.warnings.map((warning, index) => (
                            <div key={index} className={`p-3 rounded-lg ${getSeverityColor(warning.severity)}`}>
                              <div className="font-medium">{warning.message}</div>
                              {warning.suggestedAction && (
                                <div className="text-sm mt-1">推奨: {warning.suggestedAction}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'risks' && (
              <div className="space-y-6">
                {previewResult?.riskAssessment ? (
                  <div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">総合リスク評価</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(previewResult.riskAssessment.overallRisk)} bg-opacity-10`}>
                          {previewResult.riskAssessment.overallRisk}
                        </span>
                      </div>
                    </div>

                    {previewResult.riskAssessment.specificRisks.length > 0 && (
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">特定リスク</h4>
                        <div className="space-y-3">
                          {previewResult.riskAssessment.specificRisks.map((risk, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-2">
                                <span className="font-medium text-gray-900">{risk.type}</span>
                                <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">
                                  リスク
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{risk.description}</p>
                              <div className="bg-green-50 p-2 rounded text-sm">
                                <span className="font-medium text-green-800">対策: </span>
                                <span className="text-green-700">{risk.mitigation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">リスク評価</h3>
                    <p className="text-gray-600 mb-4">プレビューを生成してリスク評価を確認してください</p>
                    <Button
                      onClick={handlePreview}
                      loading={isPreviewing}
                      disabled={isPreviewing}
                    >
                      リスク評価を実行
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {isBulkResolution && `${conflicts.length}件の競合を一括処理`}
            </div>
            
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading || isApplying}
              >
                キャンセル
              </Button>
              
              {activeTab !== 'preview' && (
                <Button
                  onClick={handlePreview}
                  variant="outline"
                  loading={isPreviewing}
                  disabled={isPreviewing || isApplying}
                >
                  プレビュー
                </Button>
              )}
              
              <Button
                onClick={handleApply}
                loading={isApplying}
                disabled={isApplying || isPreviewing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                解決を適用
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}