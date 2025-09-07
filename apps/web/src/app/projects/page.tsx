'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useProjects } from '@/stores/projects.store'
import { useAuthStore } from '@/stores/auth.store'
import { Project } from '@/types/project'
import { Button } from '@/components/ui/button'
import { ProjectPasswordModal } from '@/components/projects/ProjectPasswordModal'
import { ProjectCreateModal } from '@/components/projects/ProjectCreateModal'

export default function ProjectsPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [showPasswordModal, setShowPasswordModal] = React.useState<Project | null>(null)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  
  const { 
    projects, 
    loading, 
    error, 
    selectProject,
    requiresAuthentication,
    clearError 
  } = useProjects()

  const handleProjectSelect = async (project: Project) => {
    try {
      clearError()
      
      if (requiresAuthentication(project)) {
        setShowPasswordModal(project)
        return
      }

      await selectProject(project.id)
      router.push(`/projects/${project.id}/issues`)
    } catch (error) {
      console.error('プロジェクト選択エラー:', error)
    }
  }

  const getProjectIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return '🌍'
      case 'password': return '🔒'
      case 'private':
      default: return '🏢'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロジェクト選択</h1>
        {isAuthenticated && (
          <Button onClick={() => setShowCreateModal(true)}>
            新しいプロジェクト
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleProjectSelect(project)}
          >
            <div className="flex items-center mb-2">
              <span className="mr-2 text-xl">{getProjectIcon(project.visibility)}</span>
              <h3 className="font-semibold text-gray-900">{project.name}</h3>
            </div>
            <p className="text-sm text-gray-500">
              作成日: {new Date(project.createdAt).toLocaleDateString('ja-JP')}
            </p>
          </div>
        ))}
      </div>

      {projects.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">プロジェクトがありません</p>
          {isAuthenticated && (
            <Button onClick={() => setShowCreateModal(true)}>
              最初のプロジェクトを作成
            </Button>
          )}
        </div>
      )}

      <ProjectPasswordModal
        project={showPasswordModal}
        isOpen={!!showPasswordModal}
        onClose={() => setShowPasswordModal(null)}
        onSuccess={(project) => {
          setShowPasswordModal(null)
          router.push(`/projects/${project.id}/issues`)
        }}
      />

      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          // Project list will be refetched automatically
        }}
      />
    </div>
  )
}