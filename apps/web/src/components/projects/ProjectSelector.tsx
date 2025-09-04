'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Project } from '@/types/project'
import { useProjects } from '@/stores/projects.store'
import { Button } from '@/components/ui/button'
import { ProjectPasswordModal } from './ProjectPasswordModal'

interface ProjectSelectorProps {
  onProjectSelect?: (project: Project | null) => void
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onProjectSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState<Project | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { 
    projects, 
    currentProject, 
    loading, 
    error, 
    fetchProjects, 
    selectProject,
    requiresAuthentication,
    clearError 
  } = useProjects()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleProjectClick = async (project: Project) => {
    try {
      clearError()
      
      if (requiresAuthentication(project)) {
        setShowPasswordModal(project)
        setIsOpen(false)
        return
      }

      await selectProject(project.id)
      onProjectSelect?.(project)
      setIsOpen(false)
    } catch (error) {
      console.error('プロジェクト選択エラー:', error)
    }
  }

  const getProjectIcon = (visibility: string) => {
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

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'パブリック'
      case 'password':
        return 'パスワード'
      case 'private':
      default:
        return 'プライベート'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Project Selector Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between min-w-48 text-left"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center">
            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full mr-2"></div>
            読み込み中...
          </span>
        ) : currentProject ? (
          <span className="flex items-center">
            <span className="mr-2">{getProjectIcon(currentProject.visibility)}</span>
            <span className="truncate">{currentProject.name}</span>
          </span>
        ) : (
          <span className="text-gray-500">プロジェクトを選択</span>
        )}
        
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {error && (
            <div className="px-3 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}
          
          {projects.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              プロジェクトがありません
            </div>
          ) : (
            <>
              {/* Clear Selection Option */}
              <div
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                onClick={() => {
                  onProjectSelect?.(null)
                  setIsOpen(false)
                }}
              >
                <span className="flex items-center">
                  <span className="mr-2">❌</span>
                  プロジェクト選択を解除
                </span>
              </div>
              
              {/* Project List */}
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                    currentProject?.id === project.id ? 'bg-blue-50 text-blue-900' : 'text-gray-700'
                  }`}
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <span className="mr-2 flex-shrink-0">{getProjectIcon(project.visibility)}</span>
                      <span className="truncate font-medium">{project.name}</span>
                    </div>
                    <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                      {getVisibilityLabel(project.visibility)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    作成: {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Password Modal */}
      <ProjectPasswordModal
        project={showPasswordModal}
        isOpen={!!showPasswordModal}
        onClose={() => setShowPasswordModal(null)}
        onSuccess={(project) => {
          onProjectSelect?.(project)
          setShowPasswordModal(null)
        }}
      />
    </div>
  )
}