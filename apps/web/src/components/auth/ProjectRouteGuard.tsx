/**
 * AC5: Token validation on protected route navigation works reliably
 * Route protection component that validates project access tokens
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useProjects } from '@/stores/projects.store'
import { Project } from '@/types/project'
import { ProjectPasswordModal } from '@/components/projects/ProjectPasswordModal'
import { tokenManager } from '@/services/tokenManager'

interface ProjectRouteGuardProps {
  children: React.ReactNode
  requireProjectAccess?: boolean
  fallbackRoute?: string
  onAccessDenied?: (projectId: string, error: string) => void
}

interface RouteGuardState {
  isLoading: boolean
  hasAccess: boolean
  requiresAuth: boolean
  project: Project | null
  error: string | null
}

export const ProjectRouteGuard: React.FC<ProjectRouteGuardProps> = ({
  children,
  requireProjectAccess = true,
  fallbackRoute = '/projects',
  onAccessDenied
}) => {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const {
    projects,
    currentProject,
    loading: projectsLoading,
    error: projectsError,
    selectProject,
    ensureProjectAccess,
    requiresAuthentication,
    clearError
  } = useProjects()

  const [state, setState] = useState<RouteGuardState>({
    isLoading: true,
    hasAccess: false,
    requiresAuth: false,
    project: null,
    error: null
  })

  const [showPasswordModal, setShowPasswordModal] = useState(false)

  /**
   * Handle token expiration events
   */
  const handleTokenExpired = useCallback((event: CustomEvent) => {
    const { projectId: expiredProjectId, error } = event.detail
    
    if (expiredProjectId === projectId) {
      console.warn(`Project token expired for ${projectId}:`, error)
      
      setState(prev => ({
        ...prev,
        hasAccess: false,
        requiresAuth: true,
        error: 'セッションが期限切れです。再度認証してください。'
      }))

      // Show authentication modal if on protected route
      if (requireProjectAccess) {
        setShowPasswordModal(true)
      } else {
        // Navigate to fallback route
        router.push(fallbackRoute)
      }
      
      onAccessDenied?.(expiredProjectId, error)
    }
  }, [projectId, requireProjectAccess, router, fallbackRoute, onAccessDenied])

  /**
   * Handle token refresh failure events
   */
  const handleTokenRefreshFailed = useCallback((event: CustomEvent) => {
    const { projectId: failedProjectId, error } = event.detail
    
    if (failedProjectId === projectId) {
      console.warn(`Token refresh failed for ${projectId}:`, error)
      
      setState(prev => ({
        ...prev,
        hasAccess: false,
        requiresAuth: true,
        error: 'セッションの更新に失敗しました。再度認証してください。'
      }))
      
      setShowPasswordModal(true)
      onAccessDenied?.(failedProjectId, error)
    }
  }, [projectId, onAccessDenied])

  /**
   * Setup event listeners for token management
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('projectTokenExpired', handleTokenExpired as EventListener)
      window.addEventListener('tokenRefreshFailed', handleTokenRefreshFailed as EventListener)

      return () => {
        window.removeEventListener('projectTokenExpired', handleTokenExpired as EventListener)
        window.removeEventListener('tokenRefreshFailed', handleTokenRefreshFailed as EventListener)
      }
    }
  }, [handleTokenExpired, handleTokenRefreshFailed])

  /**
   * Validate project access
   */
  const validateAccess = useCallback(async () => {
    if (!projectId || !requireProjectAccess) {
      setState({
        isLoading: false,
        hasAccess: true,
        requiresAuth: false,
        project: null,
        error: null
      })
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Find project in store
      const project = projects.find(p => p.id === projectId)
      
      if (!project) {
        // Project not found in store, might need to fetch
        if (!projectsLoading) {
          throw new Error('プロジェクトが見つかりません')
        }
        return // Wait for projects to load
      }

      // Check if project is public or private (no authentication needed)
      if (project.visibility === 'public' || project.visibility === 'private') {
        setState({
          isLoading: false,
          hasAccess: true,
          requiresAuth: false,
          project,
          error: null
        })
        return
      }

      // For password-protected projects, validate token
      if (project.visibility === 'password') {
        // First try to ensure access (this will refresh token if needed)
        const hasValidAccess = await ensureProjectAccess(projectId)
        
        if (hasValidAccess) {
          setState({
            isLoading: false,
            hasAccess: true,
            requiresAuth: false,
            project,
            error: null
          })
          return
        }

        // Check if project requires authentication
        const needsAuth = requiresAuthentication(project)
        
        if (needsAuth) {
          setState({
            isLoading: false,
            hasAccess: false,
            requiresAuth: true,
            project,
            error: null
          })
          setShowPasswordModal(true)
          return
        }

        // Has access but not via our validation - shouldn't happen
        setState({
          isLoading: false,
          hasAccess: true,
          requiresAuth: false,
          project,
          error: null
        })
      }

    } catch (error) {
      console.error('Access validation failed:', error)
      
      setState({
        isLoading: false,
        hasAccess: false,
        requiresAuth: false,
        project: null,
        error: error instanceof Error ? error.message : '認証に失敗しました'
      })

      // Navigate to fallback route on error
      setTimeout(() => {
        router.push(fallbackRoute)
      }, 2000)
    }
  }, [
    projectId, 
    requireProjectAccess, 
    projects, 
    projectsLoading, 
    ensureProjectAccess, 
    requiresAuthentication, 
    router, 
    fallbackRoute
  ])

  /**
   * Validate access when dependencies change
   */
  useEffect(() => {
    validateAccess()
  }, [validateAccess])

  /**
   * Handle successful password authentication
   */
  const handlePasswordSuccess = async (project: Project) => {
    setShowPasswordModal(false)
    
    // Re-validate access after successful authentication
    await validateAccess()
    
    clearError()
  }

  /**
   * Handle password modal close
   */
  const handlePasswordModalClose = () => {
    setShowPasswordModal(false)
    
    // If access is still required, navigate to fallback
    if (state.requiresAuth && !state.hasAccess) {
      router.push(fallbackRoute)
    }
  }

  // Show loading state
  if (state.isLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
          <p className="text-gray-600">アクセス権限を確認中...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (state.error && !state.requiresAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">アクセスエラー</h2>
          <p className="text-gray-600 max-w-md">{state.error}</p>
          <button
            onClick={() => router.push(fallbackRoute)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            プロジェクト一覧に戻る
          </button>
        </div>
      </div>
    )
  }

  // Show access denied state (shouldn't happen with password modal)
  if (!state.hasAccess && !state.requiresAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">アクセス拒否</h2>
          <p className="text-gray-600">このプロジェクトにアクセスする権限がありません。</p>
          <button
            onClick={() => router.push(fallbackRoute)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            プロジェクト一覧に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Render children if access is granted */}
      {state.hasAccess && children}

      {/* Password authentication modal */}
      <ProjectPasswordModal
        project={state.project}
        isOpen={showPasswordModal}
        onClose={handlePasswordModalClose}
        onSuccess={handlePasswordSuccess}
      />
    </>
  )
}

/**
 * Higher-order component for route protection
 */
export function withProjectRouteGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProjectRouteGuardProps, 'children'> = {}
) {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ProjectRouteGuard {...options}>
        <Component {...props} />
      </ProjectRouteGuard>
    )
  }

  WrappedComponent.displayName = `withProjectRouteGuard(${Component.displayName || Component.name})`

  return WrappedComponent
}

/**
 * Hook for programmatic access validation
 */
export function useProjectAccess(projectId?: string) {
  const { ensureProjectAccess, requiresAuthentication, getTokenExpirationInfo } = useProjects()
  const [isValidating, setIsValidating] = useState(false)

  const validateAccess = useCallback(async (id?: string): Promise<boolean> => {
    const targetId = id || projectId
    if (!targetId) return false

    setIsValidating(true)
    try {
      const hasAccess = await ensureProjectAccess(targetId)
      return hasAccess
    } catch (error) {
      console.error('Access validation failed:', error)
      return false
    } finally {
      setIsValidating(false)
    }
  }, [projectId, ensureProjectAccess])

  const checkTokenStatus = useCallback((id?: string) => {
    const targetId = id || projectId
    if (!targetId) return null

    return {
      tokenInfo: getTokenExpirationInfo(targetId),
      isValid: tokenManager.isTokenValid(targetId),
      willExpireSoon: tokenManager.willTokenExpireSoon(targetId)
    }
  }, [projectId, getTokenExpirationInfo])

  return {
    validateAccess,
    checkTokenStatus,
    isValidating
  }
}