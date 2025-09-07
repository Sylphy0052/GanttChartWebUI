/**
 * AC2: Token Management Service
 * 24-hour token storage in localStorage with automatic expiration handling
 */

export interface TokenInfo {
  token: string
  expiresAt: number
  refreshToken?: string
  refreshExpiresAt?: number
}

export interface StoredProjectTokens {
  [projectId: string]: TokenInfo
}

export class TokenManager {
  private static readonly STORAGE_KEY = 'project_access_tokens'
  private static readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  
  // Token expiration buffer - refresh 5 minutes before expiration
  private static readonly REFRESH_BUFFER_MS = 5 * 60 * 1000
  
  // Background refresh intervals
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map()
  private refreshPromises: Map<string, Promise<TokenInfo>> = new Map()

  /**
   * Store token with automatic expiration handling
   */
  setToken(projectId: string, tokenInfo: TokenInfo): void {
    try {
      const stored = this.getAllTokens()
      stored[projectId] = {
        ...tokenInfo,
        expiresAt: tokenInfo.expiresAt
      }
      
      localStorage.setItem(TokenManager.STORAGE_KEY, JSON.stringify(stored))
      
      // Schedule background refresh if refresh token is available
      if (tokenInfo.refreshToken) {
        this.scheduleTokenRefresh(projectId, tokenInfo)
      }
    } catch (error) {
      console.error('Failed to store token:', error)
      throw new Error('トークンの保存に失敗しました')
    }
  }

  /**
   * Get token with automatic expiration check
   */
  getToken(projectId: string): TokenInfo | null {
    try {
      const stored = this.getAllTokens()
      const tokenInfo = stored[projectId]
      
      if (!tokenInfo) {
        return null
      }

      const now = Date.now()
      
      // If token has expired
      if (tokenInfo.expiresAt <= now) {
        this.removeToken(projectId)
        return null
      }

      // If token will expire soon and we have a refresh token, trigger refresh
      if (tokenInfo.refreshToken && 
          tokenInfo.expiresAt - now < TokenManager.REFRESH_BUFFER_MS &&
          tokenInfo.refreshExpiresAt! > now) {
        
        // Don't block, just trigger background refresh
        this.refreshTokenInBackground(projectId, tokenInfo.refreshToken)
      }

      return tokenInfo
    } catch (error) {
      console.error('Failed to retrieve token:', error)
      return null
    }
  }

  /**
   * Check if token is valid and not expired
   */
  isTokenValid(projectId: string): boolean {
    const tokenInfo = this.getToken(projectId)
    return tokenInfo !== null && tokenInfo.expiresAt > Date.now()
  }

  /**
   * Check if token will expire within the refresh buffer time
   */
  willTokenExpireSoon(projectId: string): boolean {
    const tokenInfo = this.getToken(projectId)
    if (!tokenInfo) return false
    
    const now = Date.now()
    return tokenInfo.expiresAt - now <= TokenManager.REFRESH_BUFFER_MS
  }

  /**
   * Remove token and clean up scheduled refreshes
   */
  removeToken(projectId: string): void {
    try {
      const stored = this.getAllTokens()
      delete stored[projectId]
      localStorage.setItem(TokenManager.STORAGE_KEY, JSON.stringify(stored))
      
      // Clean up scheduled refresh
      this.clearTokenRefresh(projectId)
    } catch (error) {
      console.error('Failed to remove token:', error)
    }
  }

  /**
   * Clear all tokens and scheduled refreshes
   */
  clearAllTokens(): void {
    try {
      localStorage.removeItem(TokenManager.STORAGE_KEY)
      
      // Clear all scheduled refreshes
      this.refreshIntervals.forEach((interval) => {
        clearTimeout(interval)
      })
      this.refreshIntervals.clear()
      this.refreshPromises.clear()
    } catch (error) {
      console.error('Failed to clear all tokens:', error)
    }
  }

  /**
   * Get all stored tokens
   */
  private getAllTokens(): StoredProjectTokens {
    try {
      const stored = localStorage.getItem(TokenManager.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Failed to parse stored tokens:', error)
      return {}
    }
  }

  /**
   * AC3: Schedule background token refresh before expiration
   */
  private scheduleTokenRefresh(projectId: string, tokenInfo: TokenInfo): void {
    // Clear any existing scheduled refresh
    this.clearTokenRefresh(projectId)
    
    if (!tokenInfo.refreshToken || !tokenInfo.refreshExpiresAt) {
      return
    }

    const now = Date.now()
    const timeToRefresh = Math.max(0, tokenInfo.expiresAt - TokenManager.REFRESH_BUFFER_MS - now)
    
    // Don't schedule if refresh token has expired
    if (tokenInfo.refreshExpiresAt <= now) {
      return
    }

    const timeout = setTimeout(() => {
      this.refreshTokenInBackground(projectId, tokenInfo.refreshToken!)
    }, timeToRefresh)

    this.refreshIntervals.set(projectId, timeout)
  }

  /**
   * AC3: Background token refresh without user interruption
   */
  private async refreshTokenInBackground(projectId: string, refreshToken: string): Promise<void> {
    // Check if refresh is already in progress
    if (this.refreshPromises.has(projectId)) {
      await this.refreshPromises.get(projectId)
      return
    }

    const refreshPromise = this.performTokenRefresh(projectId, refreshToken)
    this.refreshPromises.set(projectId, refreshPromise)

    try {
      const newTokenInfo = await refreshPromise
      this.setToken(projectId, newTokenInfo)
      
      console.log(`Token refreshed successfully for project ${projectId}`)
    } catch (error) {
      console.error(`Failed to refresh token for project ${projectId}:`, error)
      
      // If refresh fails, remove the token to force re-authentication
      this.removeToken(projectId)
      
      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('tokenRefreshFailed', {
        detail: { projectId, error: error instanceof Error ? error.message : 'Unknown error' }
      }))
    } finally {
      this.refreshPromises.delete(projectId)
    }
  }

  /**
   * Perform the actual token refresh API call
   */
  private async performTokenRefresh(projectId: string, refreshToken: string): Promise<TokenInfo> {
    const response = await fetch(`${TokenManager.API_BASE_URL}/projects/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'トークンの更新に失敗しました')
    }

    const data = await response.json()
    
    return {
      token: data.accessToken,
      expiresAt: data.expiresAt,
      refreshToken: data.refreshToken,
      refreshExpiresAt: data.refreshExpiresAt
    }
  }

  /**
   * Clear scheduled token refresh
   */
  private clearTokenRefresh(projectId: string): void {
    const interval = this.refreshIntervals.get(projectId)
    if (interval) {
      clearTimeout(interval)
      this.refreshIntervals.delete(projectId)
    }
    
    this.refreshPromises.delete(projectId)
  }

  /**
   * Get authorization headers for API requests
   */
  getAuthHeaders(projectId: string): Record<string, string> {
    const tokenInfo = this.getToken(projectId)
    
    if (!tokenInfo || tokenInfo.expiresAt <= Date.now()) {
      return {}
    }

    return {
      'x-project-access-token': tokenInfo.token
    }
  }

  /**
   * Manually refresh token (for AC3 seamless access)
   */
  async refreshToken(projectId: string): Promise<TokenInfo | null> {
    const currentToken = this.getToken(projectId)
    
    if (!currentToken?.refreshToken) {
      return null
    }

    try {
      const newTokenInfo = await this.performTokenRefresh(projectId, currentToken.refreshToken)
      this.setToken(projectId, newTokenInfo)
      return newTokenInfo
    } catch (error) {
      console.error('Manual token refresh failed:', error)
      this.removeToken(projectId)
      return null
    }
  }

  /**
   * Clean up expired tokens periodically
   */
  cleanupExpiredTokens(): void {
    try {
      const stored = this.getAllTokens()
      const now = Date.now()
      let hasChanges = false

      Object.keys(stored).forEach(projectId => {
        const tokenInfo = stored[projectId]
        
        // Remove if both access and refresh tokens are expired
        if (tokenInfo.expiresAt <= now && 
            (!tokenInfo.refreshExpiresAt || tokenInfo.refreshExpiresAt <= now)) {
          delete stored[projectId]
          this.clearTokenRefresh(projectId)
          hasChanges = true
        }
      })

      if (hasChanges) {
        localStorage.setItem(TokenManager.STORAGE_KEY, JSON.stringify(stored))
      }
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error)
    }
  }

  /**
   * Initialize token manager - restore scheduled refreshes from localStorage
   */
  initialize(): void {
    try {
      const stored = this.getAllTokens()
      
      Object.entries(stored).forEach(([projectId, tokenInfo]) => {
        // Schedule refresh for tokens that are still valid
        if (tokenInfo.refreshToken && tokenInfo.refreshExpiresAt && tokenInfo.refreshExpiresAt > Date.now()) {
          this.scheduleTokenRefresh(projectId, tokenInfo)
        }
      })

      // Setup periodic cleanup (every hour)
      setInterval(() => {
        this.cleanupExpiredTokens()
      }, 60 * 60 * 1000)
    } catch (error) {
      console.error('Failed to initialize token manager:', error)
    }
  }

  /**
   * Destroy token manager - clean up all intervals
   */
  destroy(): void {
    this.refreshIntervals.forEach(interval => clearTimeout(interval))
    this.refreshIntervals.clear()
    this.refreshPromises.clear()
  }
}

// Create singleton instance
export const tokenManager = new TokenManager()

// Initialize on first import (browser only)
if (typeof window !== 'undefined') {
  tokenManager.initialize()
}