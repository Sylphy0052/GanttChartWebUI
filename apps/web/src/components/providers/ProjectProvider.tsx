'use client'

import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { Project } from '@/types/project'
import { useProjects } from '@/stores/projects.store'
import { useAuthStore, useAuth } from '@/stores/auth.store'

interface ProjectContextValue {
  currentProject: Project | null
  isProjectSelected: boolean
  requiresProjectSelection: boolean
  projectHeaders: Record<string, string>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

interface ProjectProviderProps {
  children: ReactNode
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  const { 
    currentProject, 
    fetchProjects, 
    getProjectHeaders 
  } = useProjects()

  // Fetch projects when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects()
    }
  }, [isAuthenticated, fetchProjects])

  const contextValue: ProjectContextValue = {
    currentProject,
    isProjectSelected: !!currentProject,
    requiresProjectSelection: isAuthenticated && !currentProject,
    projectHeaders: currentProject ? getProjectHeaders(currentProject.id) : {}
  }

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
      
      {/* Project Selection Reminder */}
      {contextValue.requiresProjectSelection && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
            <div className="flex items-start">
              <div className="mr-3 mt-1">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium">プロジェクトを選択してください</h4>
                <p className="text-sm text-blue-100 mt-1">
                  ヘッダーのプロジェクトセレクターから作業するプロジェクトを選択してください。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProjectContext.Provider>
  )
}

// Custom hook to use project context
export const useProjectContext = () => {
  const context = useContext(ProjectContext)
  
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider')
  }
  
  return context
}

// Utility hook for project-aware API calls
export const useProjectAPI = () => {
  const { currentProject, projectHeaders } = useProjectContext()
  const authStore = useAuth()
  
  const getAPIHeaders = () => ({
    'Content-Type': 'application/json',
    ...authStore.getAuthHeaders(),
    ...projectHeaders,
  })
  
  const getProjectId = () => {
    if (!currentProject) {
      throw new Error('プロジェクトが選択されていません')
    }
    return currentProject.id
  }
  
  return {
    currentProject,
    projectId: currentProject?.id,
    getAPIHeaders,
    getProjectId,
    hasProject: !!currentProject,
  }
}