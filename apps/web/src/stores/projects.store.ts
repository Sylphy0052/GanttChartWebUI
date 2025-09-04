import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { 
  Project, 
  ProjectsState, 
  ProjectsActions, 
  CreateProjectData, 
  UpdateProjectData,
  ProjectAccessRequest,
  ProjectAccessResponse,
  ProjectAccessTokenInfo
} from '@/types/project'
import { useAuth } from './auth.store'

interface ProjectsStore extends ProjectsState, ProjectsActions {}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      // State
      projects: [],
      currentProject: null,
      accessTokens: new Map<string, ProjectAccessTokenInfo>(),
      loading: false,
      error: null,

      // Actions
      fetchProjects: async () => {
        set({ loading: true, error: null })
        
        try {
          const authStore = useAuth()
          
          const response = await fetch(`${API_BASE_URL}/projects`, {
            headers: {
              'Content-Type': 'application/json',
              ...authStore.getAuthHeaders(),
            },
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'プロジェクトの取得に失敗しました')
          }

          const projects: Project[] = await response.json()
          
          set({
            projects,
            loading: false,
            error: null,
          })
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'プロジェクトの取得に失敗しました',
          })
        }
      },

      selectProject: async (projectId: string, password?: string) => {
        const { projects, accessTokens } = get()
        const project = projects.find(p => p.id === projectId)
        
        if (!project) {
          throw new Error('プロジェクトが見つかりません')
        }

        // If project requires password and no valid token exists
        if (project.visibility === 'password') {
          const tokenInfo = accessTokens.get(projectId)
          const hasValidToken = tokenInfo && tokenInfo.expiresAt > Date.now()
          
          if (!hasValidToken && !password) {
            throw new Error('パスワードが必要です')
          }

          if (!hasValidToken && password) {
            // Authenticate with password
            try {
              const authStore = useAuth()
              
              const response = await fetch(`${API_BASE_URL}/projects/${projectId}/access`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...authStore.getAuthHeaders(),
                },
                body: JSON.stringify({ password }),
              })

              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'パスワード認証に失敗しました')
              }

              const accessData: ProjectAccessResponse = await response.json()
              const newAccessTokens = new Map(accessTokens)
              newAccessTokens.set(projectId, {
                token: accessData.accessToken,
                expiresAt: accessData.expiresAt
              })
              
              set({ accessTokens: newAccessTokens })
            } catch (error) {
              throw error
            }
          }
        }

        set({ currentProject: project })
      },

      createProject: async (data: CreateProjectData) => {
        set({ loading: true, error: null })
        
        try {
          const authStore = useAuth()
          
          const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authStore.getAuthHeaders(),
            },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'プロジェクトの作成に失敗しました')
          }

          const newProject: Project = await response.json()
          
          set(state => ({
            projects: [...state.projects, newProject],
            loading: false,
            error: null,
          }))
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'プロジェクトの作成に失敗しました',
          })
          throw error
        }
      },

      updateProject: async (projectId: string, data: UpdateProjectData) => {
        set({ loading: true, error: null })
        
        try {
          const authStore = useAuth()
          
          const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...authStore.getAuthHeaders(),
            },
            body: JSON.stringify(data),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'プロジェクトの更新に失敗しました')
          }

          const updatedProject: Project = await response.json()
          
          set(state => ({
            projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
            currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
            loading: false,
            error: null,
          }))
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'プロジェクトの更新に失敗しました',
          })
          throw error
        }
      },

      setProjectPassword: async (projectId: string, password: string) => {
        try {
          const authStore = useAuth()
          
          const response = await fetch(`${API_BASE_URL}/projects/${projectId}/password`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...authStore.getAuthHeaders(),
            },
            body: JSON.stringify({ password }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'パスワードの設定に失敗しました')
          }

          const updatedProject: Project = await response.json()
          
          set(state => ({
            projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
            currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
          }))
        } catch (error) {
          throw error
        }
      },

      checkProjectAccess: (projectId: string): boolean => {
        const { accessTokens } = get()
        const tokenInfo = accessTokens.get(projectId)
        return tokenInfo !== undefined && tokenInfo.expiresAt > Date.now()
      },

      clearAccessToken: (projectId: string) => {
        const { accessTokens } = get()
        const newAccessTokens = new Map(accessTokens)
        newAccessTokens.delete(projectId)
        set({ accessTokens: newAccessTokens })
      },

      setCurrentProject: (project: Project | null) => {
        set({ currentProject: project })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'projects-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentProject: state.currentProject,
        accessTokens: Array.from(state.accessTokens.entries()), // Convert Map to Array for serialization
      }),
      onRehydrateStorage: () => (state) => {
        // Convert Array back to Map on rehydration
        if (state?.accessTokens && Array.isArray(state.accessTokens)) {
          state.accessTokens = new Map(state.accessTokens as any)
        }
      },
    }
  )
)

// Custom hook for project utilities
export const useProjects = () => {
  const store = useProjectsStore()
  
  return {
    ...store,
    
    // Utility function to get project access headers
    getProjectHeaders: (projectId?: string): Record<string, string> => {
      if (!projectId) return {}
      
      const tokenInfo = store.accessTokens.get(projectId)
      if (!tokenInfo || tokenInfo.expiresAt <= Date.now()) {
        return {}
      }
      
      return {
        'x-project-access-token': tokenInfo.token
      }
    },
    
    // Check if a project requires authentication
    requiresAuthentication: (project: Project) => {
      return project.visibility === 'password' && !store.checkProjectAccess(project.id)
    },
    
    // Get projects that can be accessed without additional authentication
    getAccessibleProjects: () => {
      return store.projects.filter(project => {
        if (project.visibility === 'public' || project.visibility === 'private') {
          return true
        }
        return store.checkProjectAccess(project.id)
      })
    },
  }
}