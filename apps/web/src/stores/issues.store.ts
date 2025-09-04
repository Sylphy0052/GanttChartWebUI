import { create } from 'zustand'
import { 
  Issue, 
  IssuesState, 
  IssuesActions, 
  CreateIssueData, 
  UpdateIssueData, 
  IssueFilters,
  PaginatedIssues
} from '@/types/issue'

interface IssuesStore extends IssuesState, IssuesActions {}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const useIssuesStore = create<IssuesStore>((set, get) => ({
  // State
  issues: [],
  selectedIssue: null,
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    cursor: null,
    hasMore: false,
    total: 0,
  },

  // Actions
  fetchIssues: async (filters = {}, append = false) => {
    const { pagination } = get()
    set({ isLoading: true, error: null })

    try {
      // Build query string
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value))
        }
      })

      // Add pagination cursor if appending
      if (append && pagination.cursor) {
        params.append('cursor', pagination.cursor)
      }

      // Add default limit
      if (!params.has('limit')) {
        params.append('limit', '50')
      }

      const response = await fetch(`${API_BASE_URL}/issues?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Issue一覧の取得に失敗しました')
      }

      const data: PaginatedIssues = await response.json()

      set(state => ({
        issues: append ? [...state.issues, ...data.items] : data.items,
        filters: { ...state.filters, ...filters },
        pagination: {
          cursor: data.nextCursor,
          hasMore: data.hasMore,
          total: data.total,
        },
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Issue一覧の取得に失敗しました',
        isLoading: false,
      })
    }
  },

  fetchIssue: async (id: string) => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_BASE_URL}/issues/${id}`, {
        headers: {
          ...getAuthHeaders(),
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Issue詳細の取得に失敗しました')
      }

      const issue: Issue = await response.json()
      
      set({
        selectedIssue: issue,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Issue詳細の取得に失敗しました',
        isLoading: false,
      })
    }
  },

  createIssue: async (data: CreateIssueData) => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_BASE_URL}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Issue作成に失敗しました')
      }

      const newIssue: Issue = await response.json()
      
      set(state => ({
        issues: [newIssue, ...state.issues],
        isLoading: false,
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
      }))

      return newIssue
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Issue作成に失敗しました',
        isLoading: false,
      })
      throw error
    }
  },

  updateIssue: async (id: string, data: UpdateIssueData) => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_BASE_URL}/issues/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Issue更新に失敗しました')
      }

      const updatedIssue: Issue = await response.json()
      
      set(state => ({
        issues: state.issues.map(issue => 
          issue.id === id ? updatedIssue : issue
        ),
        selectedIssue: state.selectedIssue?.id === id ? updatedIssue : state.selectedIssue,
        isLoading: false,
      }))

      return updatedIssue
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Issue更新に失敗しました',
        isLoading: false,
      })
      throw error
    }
  },

  deleteIssue: async (id: string) => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch(`${API_BASE_URL}/issues/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Issue削除に失敗しました')
      }

      set(state => ({
        issues: state.issues.filter(issue => issue.id !== id),
        selectedIssue: state.selectedIssue?.id === id ? null : state.selectedIssue,
        isLoading: false,
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Issue削除に失敗しました',
        isLoading: false,
      })
    }
  },

  setSelectedIssue: (issue: Issue | null) => {
    set({ selectedIssue: issue })
  },

  setFilters: (filters: IssueFilters) => {
    set(state => ({
      filters: { ...state.filters, ...filters },
    }))
  },

  clearError: () => {
    set({ error: null })
  },

  resetPagination: () => {
    set({
      pagination: {
        cursor: null,
        hasMore: false,
        total: 0,
      },
    })
  },
}))

// Helper function to get auth headers (this will be moved to a shared utility later)
function getAuthHeaders() {
  // For now, we'll try to get the token from localStorage directly
  // In a real app, this should be coordinated with the auth store
  if (typeof window !== 'undefined') {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage)
        const token = parsed.state?.token
        if (token) {
          return { Authorization: `Bearer ${token}` }
        }
      } catch (error) {
        console.warn('Failed to parse auth storage:', error)
      }
    }
  }
  return {}
}

// Custom hook for Issues with additional utilities
export const useIssues = () => {
  const store = useIssuesStore()
  
  return {
    ...store,
    
    // Load more issues (pagination)
    loadMore: async () => {
      if (!store.isLoading && store.pagination.hasMore) {
        await store.fetchIssues(store.filters, true)
      }
    },
    
    // Refresh current page
    refresh: async () => {
      store.resetPagination()
      await store.fetchIssues(store.filters, false)
    },
    
    // Search issues
    search: async (searchTerm: string) => {
      const newFilters = { ...store.filters, search: searchTerm }
      store.resetPagination()
      await store.fetchIssues(newFilters, false)
    },
    
    // Filter by status
    filterByStatus: async (status: string) => {
      const newFilters = { ...store.filters, status }
      store.resetPagination()
      await store.fetchIssues(newFilters, false)
    },
  }
}