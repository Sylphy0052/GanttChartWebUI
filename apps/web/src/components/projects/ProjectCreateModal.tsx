'use client'

import React, { useState, useEffect } from 'react'
import { ProjectVisibility } from '@/types/project'
import { useProjects } from '@/stores/projects.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProjectCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (projectId: string) => void
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    visibility: 'private' as ProjectVisibility,
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { createProject } = useProjects()

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        visibility: 'private',
        password: ''
      })
      setError('')
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
    
    if (!formData.name.trim()) {
      setError('プロジェクト名を入力してください')
      return
    }

    if (formData.visibility === 'password' && !formData.password.trim()) {
      setError('パスワード保護を選択した場合、パスワードの入力が必要です')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await createProject({
        name: formData.name.trim(),
        visibility: formData.visibility
      })

      // TODO: If password visibility, set password after creation
      // This would require getting the created project ID and calling setProjectPassword
      
      onClose()
      if (onSuccess) {
        onSuccess('newly-created-project-id') // This would be the actual project ID
      }
    } catch (error: any) {
      setError(error.message || 'プロジェクトの作成に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getVisibilityIcon = (visibility: ProjectVisibility) => {
    switch (visibility) {
      case 'public':
        return '🌍'
      case 'password':
        return '🔒'
      case 'private':
      default:
        return '🏢'
    }
  }

  const getVisibilityDescription = (visibility: ProjectVisibility) => {
    switch (visibility) {
      case 'public':
        return '誰でもアクセス可能'
      case 'password':
        return 'パスワードが必要'
      case 'private':
      default:
        return 'メンバーのみアクセス可能'
    }
  }

  if (!isOpen) {
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
                新しいプロジェクト
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                新しいプロジェクトを作成します
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
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              </div>
            )}

            {/* Project Name */}
            <div className="mb-6">
              <Input
                label="プロジェクト名"
                name="name"
                placeholder="プロジェクト名を入力してください"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoFocus
                maxLength={100}
              />
            </div>

            {/* Visibility Settings */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                公開設定
              </label>
              <div className="space-y-3">
                {(['private', 'password', 'public'] as ProjectVisibility[]).map((visibility) => (
                  <label key={visibility} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      value={visibility}
                      checked={formData.visibility === visibility}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{getVisibilityIcon(visibility)}</span>
                        <span className="font-medium text-gray-900 capitalize">
                          {visibility === 'private' ? 'プライベート' : 
                           visibility === 'password' ? 'パスワード保護' : 'パブリック'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {getVisibilityDescription(visibility)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Password Field (only show if password visibility is selected) */}
            {formData.visibility === 'password' && (
              <div className="mb-6">
                <Input
                  type="password"
                  label="プロジェクトパスワード"
                  name="password"
                  placeholder="パスワードを設定してください"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  helperText="このパスワードでプロジェクトへのアクセスを制限します"
                  minLength={6}
                />
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
                disabled={!formData.name.trim() || isLoading}
              >
                プロジェクトを作成
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}