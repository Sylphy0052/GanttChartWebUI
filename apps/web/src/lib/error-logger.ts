/**
 * AC6: Comprehensive error logging captures context for debugging and monitoring
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

interface ErrorContext {
  level?: 'app' | 'page' | 'component' | 'widget' | 'api' | 'store'
  errorId?: string
  errorInfo?: any
  context?: Record<string, any>
  timestamp?: string
  userAgent?: string
  url?: string
  userId?: string | null
  sessionId?: string | null
  breadcrumbs?: ErrorBreadcrumb[]
  tags?: Record<string, string>
  fingerprint?: string[]
}

interface ErrorBreadcrumb {
  timestamp: number
  category: 'navigation' | 'http' | 'user' | 'console' | 'dom' | 'error' | 'custom'
  message: string
  level: 'error' | 'warning' | 'info' | 'debug'
  data?: Record<string, any>
}

interface ErrorLogEntry {
  id: string
  timestamp: string
  level: 'error' | 'warning' | 'info' | 'debug'
  message: string
  error: {
    name: string
    message: string
    stack?: string
  }
  context: ErrorContext
  fingerprint: string
  count: number
  firstSeen: string
  lastSeen: string
}

class ErrorLogger {
  private logs: ErrorLogEntry[] = []
  private breadcrumbs: ErrorBreadcrumb[] = []
  private maxLogs = 1000
  private maxBreadcrumbs = 50
  private isInitialized = false
  private debugMode = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize() {
    if (this.isInitialized) return

    this.debugMode = process.env.NODE_ENV === 'development' || 
                    localStorage.getItem('errorLogger.debug') === 'true'

    // Set up global error handlers
    this.setupGlobalErrorHandlers()
    
    // Set up automatic breadcrumb collection
    this.setupBreadcrumbCollection()
    
    // Load persisted logs
    this.loadPersistedLogs()
    
    this.isInitialized = true
    
    this.addBreadcrumb({
      category: 'custom',
      message: 'Error logger initialized',
      level: 'info',
      data: { debugMode: this.debugMode }
    })
  }

  private setupGlobalErrorHandlers() {
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        level: 'app',
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: 'unhandled_error'
        }
      })
    })

    // Global handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      
      this.captureError(error, {
        level: 'app',
        context: {
          type: 'unhandled_promise_rejection',
          reason: event.reason
        }
      })
    })

    // Console error interception
    const originalConsoleError = console.error
    console.error = (...args) => {
      this.addBreadcrumb({
        category: 'console',
        message: args.map(arg => String(arg)).join(' '),
        level: 'error',
        data: { args }
      })
      
      // Check if first argument is an Error object
      if (args[0] instanceof Error) {
        this.captureError(args[0], {
          level: 'component',
          context: {
            type: 'console_error',
            consoleArgs: args.slice(1)
          }
        })
      }
      
      originalConsoleError.apply(console, args)
    }
  }

  private setupBreadcrumbCollection() {
    // Navigation breadcrumbs
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      // Page navigation
      window.addEventListener('popstate', () => {
        this.addBreadcrumb({
          category: 'navigation',
          message: `Navigation to ${window.location.pathname}`,
          level: 'info',
          data: { 
            from: document.referrer,
            to: window.location.href 
          }
        })
      })

      // Click events
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement
        if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('[role="button"]')) {
          this.addBreadcrumb({
            category: 'user',
            message: `Clicked ${target.tagName.toLowerCase()}`,
            level: 'info',
            data: {
              text: target.textContent?.slice(0, 50),
              className: target.className,
              id: target.id
            }
          })
        }
      })

      // Form submissions
      document.addEventListener('submit', (event) => {
        const form = event.target as HTMLFormElement
        this.addBreadcrumb({
          category: 'user',
          message: 'Form submitted',
          level: 'info',
          data: {
            action: form.action,
            method: form.method,
            id: form.id,
            className: form.className
          }
        })
      })
    }

    // HTTP request breadcrumbs (intercept fetch)
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const [url, options] = args
      const startTime = Date.now()
      
      let urlString = typeof url === 'string' ? url : url.toString()
      
      this.addBreadcrumb({
        category: 'http',
        message: `HTTP ${options?.method || 'GET'} ${urlString}`,
        level: 'info',
        data: {
          url: urlString,
          method: options?.method || 'GET'
        }
      })

      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - startTime
        
        this.addBreadcrumb({
          category: 'http',
          message: `HTTP ${response.status} ${urlString} (${duration}ms)`,
          level: response.ok ? 'info' : 'warning',
          data: {
            url: urlString,
            method: options?.method || 'GET',
            status: response.status,
            duration
          }
        })
        
        return response
      } catch (error) {
        const duration = Date.now() - startTime
        
        this.addBreadcrumb({
          category: 'http',
          message: `HTTP error ${urlString} (${duration}ms)`,
          level: 'error',
          data: {
            url: urlString,
            method: options?.method || 'GET',
            error: error instanceof Error ? error.message : String(error),
            duration
          }
        })
        
        throw error
      }
    }
  }

  private loadPersistedLogs() {
    try {
      const persistedLogs = localStorage.getItem('errorLogger.logs')
      if (persistedLogs) {
        this.logs = JSON.parse(persistedLogs)
      }

      const persistedBreadcrumbs = localStorage.getItem('errorLogger.breadcrumbs')
      if (persistedBreadcrumbs) {
        this.breadcrumbs = JSON.parse(persistedBreadcrumbs)
      }
    } catch (error) {
      console.warn('Failed to load persisted error logs:', error)
    }
  }

  private persistLogs() {
    try {
      localStorage.setItem('errorLogger.logs', JSON.stringify(this.logs.slice(-100))) // Keep last 100
      localStorage.setItem('errorLogger.breadcrumbs', JSON.stringify(this.breadcrumbs.slice(-50))) // Keep last 50
    } catch (error) {
      console.warn('Failed to persist error logs:', error)
    }
  }

  private generateFingerprint(error: Error, context: ErrorContext): string {
    const parts = [
      error.name,
      error.message,
      context.level || 'unknown',
      window.location.pathname
    ]
    
    // Add stack trace first few lines for uniqueness
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3)
      parts.push(...stackLines)
    }
    
    return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
  }

  addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>) {
    const fullBreadcrumb: ErrorBreadcrumb = {
      timestamp: Date.now(),
      ...breadcrumb
    }

    this.breadcrumbs.push(fullBreadcrumb)
    
    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs)
    }

    if (this.debugMode) {
      console.log('[ErrorLogger] Breadcrumb:', fullBreadcrumb)
    }

    this.persistLogs()
  }

  captureError(error: Error, context: ErrorContext = {}) {
    if (!this.isInitialized) {
      this.initialize()
    }

    const errorId = context.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fingerprint = this.generateFingerprint(error, context)
    const timestamp = new Date().toISOString()

    // Check if this is a duplicate error
    const existingLog = this.logs.find(log => log.fingerprint === fingerprint)
    
    if (existingLog) {
      // Update existing log
      existingLog.count += 1
      existingLog.lastSeen = timestamp
      existingLog.context = { ...existingLog.context, ...context }
    } else {
      // Create new log entry
      const logEntry: ErrorLogEntry = {
        id: errorId,
        timestamp,
        level: 'error',
        message: error.message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context: {
          timestamp,
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
          breadcrumbs: [...this.breadcrumbs], // Copy breadcrumbs at time of error
          ...context
        },
        fingerprint,
        count: 1,
        firstSeen: timestamp,
        lastSeen: timestamp
      }

      this.logs.push(logEntry)
    }

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Add error as breadcrumb
    this.addBreadcrumb({
      category: 'error',
      message: `${error.name}: ${error.message}`,
      level: 'error',
      data: {
        errorId,
        level: context.level,
        fingerprint
      }
    })

    if (this.debugMode) {
      console.error('[ErrorLogger] Error captured:', {
        errorId,
        error,
        context,
        fingerprint
      })
    }

    // Send to monitoring services
    this.sendToMonitoring(error, context, errorId, fingerprint)

    this.persistLogs()

    return errorId
  }

  private getUserId(): string | null {
    try {
      const authData = localStorage.getItem('auth')
      return authData ? JSON.parse(authData).userId : null
    } catch {
      return null
    }
  }

  private getSessionId(): string | null {
    try {
      let sessionId = sessionStorage.getItem('sessionId')
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('sessionId', sessionId)
      }
      return sessionId
    } catch {
      return null
    }
  }

  private async sendToMonitoring(
    error: Error, 
    context: ErrorContext, 
    errorId: string, 
    fingerprint: string
  ) {
    // Send to external monitoring services
    try {
      // Google Analytics 4 event
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: error.message,
          fatal: context.level === 'app',
          custom_map: {
            error_id: errorId,
            error_level: context.level || 'unknown',
            fingerprint: fingerprint
          }
        })
      }

      // Send to API endpoint for server-side logging and analysis
      const payload = {
        errorId,
        fingerprint,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context: {
          ...context,
          breadcrumbs: this.breadcrumbs.slice(-10), // Last 10 breadcrumbs
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: this.getUserId(),
          sessionId: this.getSessionId()
        }
      }

      // Use fetch with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      await fetch('/api/v1/errors/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

    } catch (monitoringError) {
      // Silently fail monitoring - don't let error reporting break the app
      if (this.debugMode) {
        console.warn('[ErrorLogger] Failed to send to monitoring:', monitoringError)
      }
    }
  }

  // Public API methods
  getLogs(limit?: number): ErrorLogEntry[] {
    const logs = [...this.logs].reverse() // Most recent first
    return limit ? logs.slice(0, limit) : logs
  }

  getBreadcrumbs(limit?: number): ErrorBreadcrumb[] {
    const breadcrumbs = [...this.breadcrumbs].reverse() // Most recent first
    return limit ? breadcrumbs.slice(0, limit) : breadcrumbs
  }

  getLogsByLevel(level: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.context.level === level)
  }

  getLogsByFingerprint(fingerprint: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.fingerprint === fingerprint)
  }

  clearLogs() {
    this.logs = []
    this.breadcrumbs = []
    try {
      localStorage.removeItem('errorLogger.logs')
      localStorage.removeItem('errorLogger.breadcrumbs')
    } catch (error) {
      console.warn('Failed to clear persisted logs:', error)
    }
  }

  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      breadcrumbs: this.breadcrumbs,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }, null, 2)
  }

  // Debug utilities
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled
    localStorage.setItem('errorLogger.debug', enabled.toString())
  }

  getStats() {
    const stats = {
      totalLogs: this.logs.length,
      totalBreadcrumbs: this.breadcrumbs.length,
      uniqueErrors: new Set(this.logs.map(log => log.fingerprint)).size,
      errorsByLevel: {} as Record<string, number>,
      recentErrors: this.logs.filter(log => 
        Date.now() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000
      ).length
    }

    // Count errors by level
    this.logs.forEach(log => {
      const level = log.context.level || 'unknown'
      stats.errorsByLevel[level] = (stats.errorsByLevel[level] || 0) + 1
    })

    return stats
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger()

// Export types
export type { ErrorContext, ErrorBreadcrumb, ErrorLogEntry }