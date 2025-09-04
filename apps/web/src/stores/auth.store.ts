import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, AuthState, AuthActions, LoginCredentials, LoginResponse } from '@/types/auth'

interface AuthStore extends AuthState, AuthActions {}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'ログインに失敗しました')
          }

          const data: LoginResponse = await response.json()
          
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'ログインに失敗しました',
          })
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      },

      setUser: (user: User) => {
        set({ user })
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: !!token })
      },

      clearError: () => {
        set({ error: null })
      },

      checkAuth: async () => {
        const { token } = get()
        
        if (!token) {
          set({ isAuthenticated: false })
          return
        }

        set({ isLoading: true })

        try {
          const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) {
            throw new Error('認証に失敗しました')
          }

          const user: User = await response.json()
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null, // Don't show error for silent auth check
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Custom hook for easy access to auth utilities
export const useAuth = () => {
  const store = useAuthStore()
  
  return {
    ...store,
    // Utility function to get authorization headers
    getAuthHeaders: () => {
      const { token } = store
      return token ? { Authorization: `Bearer ${token}` } : {}
    },
    
    // Check if user has specific permissions (for future role-based access)
    hasPermission: (permission: string) => {
      // For now, all authenticated users have all permissions
      // This can be extended when roles are implemented
      return store.isAuthenticated
    },
  }
}