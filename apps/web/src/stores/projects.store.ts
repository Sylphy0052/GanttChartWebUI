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
import { tokenManager } from '@/services/tokenManager'

interface ProjectsStore extends ProjectsState, ProjectsActions {
  // AC4: Enhanced project access state management
  refreshProjectToken: (projectId: string) => Promise<boolean>
  validateProjectAccess: (projectId: string) => Promise<boolean>
  initializeTokenManagement: () => void
  handleTokenRefreshFailure: (projectId: string, error: string) => void
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      // State
      projects: [],
      currentProject: null,
      accessTokens: new Map<string, ProjectAccessTokenInfo>(), // Legacy - will be replaced by tokenManager
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

      // AC4: Enhanced selectProject with token management integration
      selectProject: async (projectId: string, password?: string) => {
        const { projects } = get()
        const project = projects.find(p => p.id === projectId)
        
        if (!project) {
          throw new Error('プロジェクトが見つかりません')
        }

        // If project requires password
        if (project.visibility === 'password') {
          // Check if we have a valid token
          const hasValidToken = tokenManager.isTokenValid(projectId)
          
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
              
              // Store in new token manager
              tokenManager.setToken(projectId, {
                token: accessData.accessToken,
                expiresAt: accessData.expiresAt,
                refreshToken: accessData.refreshToken,
                refreshExpiresAt: accessData.refreshExpiresAt
              })
              
              // Legacy support - also update the Map (will be removed in future)
              const { accessTokens } = get()
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

      // AC4: Enhanced access check using token manager
      checkProjectAccess: (projectId: string): boolean => {
        // First check new token manager
        if (tokenManager.isTokenValid(projectId)) {
          return true
        }

        // Fallback to legacy Map check
        const { accessTokens } = get()
        const tokenInfo = accessTokens.get(projectId)
        return tokenInfo !== undefined && tokenInfo.expiresAt > Date.now()
      },

      // AC4: Enhanced clearAccessToken that also clears from token manager
      clearAccessToken: (projectId: string) => {
        // Clear from token manager
        tokenManager.removeToken(projectId)
        
        // Legacy cleanup
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

      // AC4: New token management integration methods

      /**
       * Refresh project token manually
       */
      refreshProjectToken: async (projectId: string): Promise<boolean> => {
        try {
          const refreshedToken = await tokenManager.refreshToken(projectId)
          return refreshedToken !== null
        } catch (error) {
          console.error(`Failed to refresh token for project ${projectId}:`, error)
          return false
        }
      },

      /**
       * Validate project access and refresh if needed
       */
      validateProjectAccess: async (projectId: string): Promise<boolean> => {
        // Check if token is valid
        if (tokenManager.isTokenValid(projectId)) {
          return true
        }

        // Try to refresh if token exists but expired
        const hasToken = tokenManager.getToken(projectId) !== null
        if (hasToken) {
          return await get().refreshProjectToken(projectId)
        }

        return false
      },

      /**
       * Initialize token management system
       */
      initializeTokenManagement: () => {
        // Setup listener for token refresh failures
        if (typeof window !== 'undefined') {
          const handleTokenRefreshFailed = (event: CustomEvent) => {
            const { projectId, error } = event.detail
            get().handleTokenRefreshFailure(projectId, error)
          }

          window.addEventListener('tokenRefreshFailed', handleTokenRefreshFailed as EventListener)

          // Cleanup function (store this reference if needed for cleanup)
          return () => {
            window.removeEventListener('tokenRefreshFailed', handleTokenRefreshFailed as EventListener)
          }
        }
      },

      /**
       * Handle token refresh failure
       */
      handleTokenRefreshFailure: (projectId: string, error: string) => {
        console.warn(`Token refresh failed for project ${projectId}: ${error}`)
        
        // Clear the failed token
        get().clearAccessToken(projectId)
        
        // If this is the current project, clear it to force re-authentication
        const { currentProject } = get()
        if (currentProject?.id === projectId) {
          set({ currentProject: null })
        }

        // Set error state to notify user
        set({ 
          error: `セッションの更新に失敗しました。再度認証が必要です。` 
        })

        // Dispatch custom event for components to handle
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('projectTokenExpired', {
            detail: { projectId, error }
          }))
        }
      },
    }),
    {
      name: 'projects-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentProject: state.currentProject,
        accessTokens: Array.from(state.accessTokens.entries()), // Legacy - keep for backward compatibility
      }),
      onRehydrateStorage: () => (state) => {
        // Convert Array back to Map on rehydration
        if (state?.accessTokens && Array.isArray(state.accessTokens)) {
          state.accessTokens = new Map(state.accessTokens as any)
        }

        // Initialize token management on rehydration
        if (state) {
          state.initializeTokenManagement()
        }
      },
    }
  )
)

// Custom hook for project utilities with enhanced token management
export const useProjects = () => {
  const store = useProjectsStore()
  
  return {
    ...store,
    
    // AC4: Enhanced project headers using token manager
    getProjectHeaders: (projectId?: string): Record<string, string> => {
      if (!projectId) return {}
      
      // Use token manager first
      const tokenHeaders = tokenManager.getAuthHeaders(projectId)
      if (Object.keys(tokenHeaders).length > 0) {
        return tokenHeaders
      }

      // Fallback to legacy Map
      const tokenInfo = store.accessTokens.get(projectId)
      if (!tokenInfo || tokenInfo.expiresAt <= Date.now()) {
        return {}
      }
      
      return {
        'x-project-access-token': tokenInfo.token
      }
    },
    
    // AC4: Enhanced authentication check
    requiresAuthentication: (project: Project) => {
      if (project.visibility !== 'password') {
        return false
      }
      
      // Check both token manager and legacy store
      return !tokenManager.isTokenValid(project.id) && !store.checkProjectAccess(project.id)
    },
    
    // AC4: Enhanced accessible projects check
    getAccessibleProjects: () => {
      return store.projects.filter(project => {
        if (project.visibility === 'public' || project.visibility === 'private') {
          return true
        }
        
        // Check both token manager and legacy store for backward compatibility
        return tokenManager.isTokenValid(project.id) || store.checkProjectAccess(project.id)
      })
    },

    // AC4: New utility methods for token management
    
    /**
     * Check if project token will expire soon
     */
    willProjectTokenExpireSoon: (projectId: string) => {
      return tokenManager.willTokenExpireSoon(projectId)
    },

    /**
     * Ensure project access is valid (refresh if needed)
     */
    ensureProjectAccess: async (projectId: string): Promise<boolean> => {
      return await store.validateProjectAccess(projectId)
    },

    /**
     * Get token expiration info for UI display
     */
    getTokenExpirationInfo: (projectId: string) => {
      const token = tokenManager.getToken(projectId)
      if (!token) return null

      const now = Date.now()
      const timeToExpiry = token.expiresAt - now

      return {
        expiresAt: token.expiresAt,
        timeToExpiry,
        willExpireSoon: timeToExpiry <= 5 * 60 * 1000, // 5 minutes
        isValid: timeToExpiry > 0
      }
    }
  }
}