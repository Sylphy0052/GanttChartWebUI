/**
 * Issue Edit Demo Component
 * 
 * This component demonstrates the Issue editing with undo/redo functionality.
 * It showcases T010_AC3 implementation with professional UX patterns.
 * 
 * Features:
 * - Issue detail panel with undo/redo support
 * - Form validation and error handling
 * - Keyboard shortcuts (Ctrl+Z/Y)
 * - Auto-save and manual save modes
 * - Professional status indicators
 */

'use client'

import { useState, useCallback } from 'react'
import { Issue } from '@/types/issue'
import { IssueDetailPanelWithUndo } from './IssueDetailPanelWithUndo'
import { Button } from '@/components/ui/button'

// Sample issue data for demonstration
const sampleIssue: Issue = {
  id: 'demo-issue-1',
  projectId: 'demo-project-1',
  title: 'Implement Gantt Chart Undo/Redo System',
  description: 'Add comprehensive undo/redo functionality for all Gantt chart operations including issue editing, bar movements, and dependency management.',
  status: 'doing',
  type: 'feature',
  priority: 85,
  estimateValue: 16,
  estimateUnit: 'h',
  spent: 6,
  assigneeId: 'dev-001',
  startDate: '2024-09-05T00:00:00Z',
  dueDate: '2024-09-10T00:00:00Z',
  progress: 40,
  labels: ['frontend', 'ux', 'high-priority'],
  version: 3,
  createdAt: '2024-09-05T09:00:00Z',
  updatedAt: '2024-09-06T14:30:00Z'
}

interface IssueEditDemoProps {
  className?: string
}

export function IssueEditDemo({ className = '' }: IssueEditDemoProps) {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [enableAutoSave, setEnableAutoSave] = useState(false)
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'success' | 'info' | 'warning'
    message: string
    timestamp: Date
  }>>([])

  /**
   * Open issue detail panel
   */
  const handleOpenIssue = useCallback(() => {
    setSelectedIssue(sampleIssue)
    setIsPanelOpen(true)
  }, [])

  /**
   * Close issue detail panel
   */
  const handleCloseIssue = useCallback(() => {
    setIsPanelOpen(false)
    // Don't clear selectedIssue immediately to allow smooth transitions
    setTimeout(() => {
      if (!isPanelOpen) {
        setSelectedIssue(null)
      }
    }, 300)
  }, [isPanelOpen])

  /**
   * Handle issue updates
   */
  const handleIssueUpdated = useCallback((updatedIssue: Issue) => {
    setSelectedIssue(updatedIssue)
    
    // Add notification
    const notification = {
      id: `update-${Date.now()}`,
      type: 'success' as const,
      message: `Issue「${updatedIssue.title}」が更新されました`,
      timestamp: new Date()
    }
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]) // Keep only 5 most recent
    
    // Auto-remove notification after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
    }, 3000)
  }, [])

  /**
   * Toggle auto-save mode
   */
  const handleToggleAutoSave = useCallback(() => {
    setEnableAutoSave(prev => {
      const newValue = !prev
      const notification = {
        id: `autosave-${Date.now()}`,
        type: 'info' as const,
        message: `自動保存が${newValue ? '有効' : '無効'}になりました`,
        timestamp: new Date()
      }
      
      setNotifications(prev => [notification, ...prev.slice(0, 4)])
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id))
      }, 2000)
      
      return newValue
    })
  }, [])

  /**
   * Clear all notifications
   */
  const handleClearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <div className={`issue-edit-demo ${className}`}>
      {/* Demo Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Issue編集 Undo/Redo デモ
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              T010_AC3: Issue編集操作のUndo/Redo機能をテストできます
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={enableAutoSave}
                onChange={handleToggleAutoSave}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">自動保存</span>
            </label>
            
            <Button
              onClick={handleOpenIssue}
              size="sm"
            >
              Issue詳細を開く
            </Button>
          </div>
        </div>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded">
            <h4 className="font-medium text-blue-900 mb-1">📝 編集機能</h4>
            <p className="text-blue-700">
              すべてのフィールドがUndo/Redo対応
            </p>
          </div>
          
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-medium text-green-900 mb-1">⌨️ ショートカット</h4>
            <p className="text-green-700">
              Ctrl+Z (元に戻す), Ctrl+Y (やり直し)
            </p>
          </div>
          
          <div className="bg-purple-50 p-3 rounded">
            <h4 className="font-medium text-purple-900 mb-1">🔄 保存モード</h4>
            <p className="text-purple-700">
              手動保存 / 自動保存の切り替え
            </p>
          </div>
        </div>
      </div>

      {/* Current Issue Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">デモ用Issue</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">タイトル</dt>
            <dd className="mt-1 text-sm text-gray-900">{sampleIssue.title}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">ステータス</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {sampleIssue.status}
              </span>
            </dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">優先度</dt>
            <dd className="mt-1 text-sm text-gray-900">{sampleIssue.priority}/100</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">進捗</dt>
            <dd className="mt-1">
              <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${sampleIssue.progress}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">{sampleIssue.progress}%</span>
              </div>
            </dd>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            <strong>使い方:</strong> 
            「Issue詳細を開く」をクリックして編集パネルを開き、
            「編集」ボタンでフィールドを変更してください。
            Ctrl+Z/Yでundo/redoを試すことができます。
          </p>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">通知</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearNotifications}
              className="text-xs"
            >
              クリア
            </Button>
          </div>
          
          <div className="space-y-2">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-3 rounded-md text-sm ${
                  notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                  notification.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                  'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{notification.message}</span>
                  <span className="text-xs opacity-60">
                    {notification.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          🧪 テスト手順
        </h3>
        
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <span>「Issue詳細を開く」ボタンをクリック</span>
          </div>
          
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <span>パネルで「編集」ボタンをクリック</span>
          </div>
          
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
            <span>任意のフィールド（タイトル、優先度、進捗など）を変更</span>
          </div>
          
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
            <span>
              <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Z</kbd> で元に戻す、
              <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs ml-1">Ctrl+Y</kbd> でやり直しを試す
            </span>
          </div>
          
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">5</span>
            <span>自動保存モードのON/OFFを切り替えて動作の違いを確認</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-white bg-opacity-60 rounded">
          <p className="text-xs text-gray-600">
            <strong>注意:</strong> このデモでは実際のAPI呼び出しは行われません。
            ブラウザコンソールで操作ログを確認できます。
          </p>
        </div>
      </div>

      {/* Issue Detail Panel */}
      <IssueDetailPanelWithUndo
        isOpen={isPanelOpen}
        onClose={handleCloseIssue}
        issue={selectedIssue}
        enableAutoSave={enableAutoSave}
        onIssueUpdated={handleIssueUpdated}
      />
    </div>
  )
}