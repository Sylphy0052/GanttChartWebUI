'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/types/project'
import { useProjects } from '@/stores/projects.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProjectPasswordModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (project: Project) => void
}

export const ProjectPasswordModal: React.FC<ProjectPasswordModalProps> = ({
  project,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  
  const { selectProject } = useProjects()

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError('')
      setAttempts(0)
    }
  }, [isOpen])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!project || !password.trim()) {
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await selectProject(project.id, password.trim())
      onSuccess?.(project)
      onClose()
    } catch (error: any) {
      setAttempts(prev => prev + 1)
      
      // Handle different error types
      if (error.message?.includes('Too many')) {
        setError('試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。')
      } else if (error.message?.includes('Invalid password')) {
        const remaining = 5 - attempts - 1
        setError(`パスワードが正しくありません。${remaining > 0 ? `残り${remaining}回まで試行可能です。` : ''}`)
      } else {
        setError(error.message || '認証に失敗しました。再度お試しください。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !project) {
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
          className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                プロジェクトアクセス
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                このプロジェクトはパスワードで保護されています
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Project Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🔒</span>
                <div>
                  <h3 className="font-medium text-gray-900">{project.name}</h3>
                  <p className="text-sm text-gray-600">パスワード保護プロジェクト</p>
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="mb-6">
              <Input
                type="password"
                label="パスワード"
                placeholder="プロジェクトのパスワードを入力してください"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error}
                required
                disabled={isLoading}
                autoFocus
                helperText="パスワードは24時間有効なアクセストークンとして保存されます。"
              />
            </div>

            {/* Rate Limiting Info */}
            {attempts > 0 && (
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">セキュリティ制限</p>
                    <p>15分間に5回までのパスワード試行が可能です。</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                loading={isLoading}
                disabled={!password.trim() || isLoading}
              >
                認証する
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}