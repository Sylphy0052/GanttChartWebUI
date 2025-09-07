/**
 * AC5: Error boundaries prevent application crashes with graceful fallback UIs
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { errorLogger } from '@/lib/error-logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackComponent?: React.ComponentType<ErrorFallbackProps>
  level: 'app' | 'page' | 'component' | 'widget'
  context?: Record<string, any>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  enableRecovery?: boolean
  maxRetries?: number
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  retryCount: number
  showDetails: boolean
}

interface ErrorFallbackProps {
  error: Error
  errorInfo: ErrorInfo
  errorId: string
  level: string
  context?: Record<string, any>
  retryCount: number
  onRetry: () => void
  onReport: () => void
  onHome: () => void
  showDetails: boolean
  onToggleDetails: () => void
}

// Default fallback UI components for different error levels
const AppLevelFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  onReport,
  showDetails,
  onToggleDetails,
  retryCount
}) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <CardTitle className="text-xl text-red-600">Application Error</CardTitle>
            <p className="text-sm text-gray-600">Something went wrong with the application</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-800">
            <p className="font-medium">The application encountered an unexpected error and needs to restart.</p>
            <p className="mt-1">Error ID: <code className="text-xs bg-red-100 px-1 rounded">{errorId}</code></p>
          </div>
        </div>

        <Button 
          onClick={onToggleDetails} 
          variant="outline" 
          size="sm" 
          className="w-full justify-between"
        >
          Technical Details
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showDetails && (
          <div className="bg-gray-100 border rounded-lg p-4 space-y-2">
            <div className="text-xs font-mono bg-white p-3 rounded border">
              <div className="text-red-600 font-medium">{error.name}: {error.message}</div>
              {error.stack && (
                <pre className="mt-2 text-gray-700 whitespace-pre-wrap text-xs">
                  {error.stack}
                </pre>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={onRetry} className="flex-1" disabled={retryCount >= 3}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again {retryCount > 0 && `(${retryCount}/3)`}
          </Button>
          <Button onClick={onReport} variant="outline" className="flex-1">
            <Bug className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        </div>

        <div className="text-center">
          <Button 
            onClick={() => window.location.href = '/'}
            variant="link"
            size="sm"
            className="text-gray-600"
          >
            <Home className="h-4 w-4 mr-1" />
            Return to Home
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)

const PageLevelFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  onReport,
  showDetails,
  onToggleDetails,
  retryCount
}) => (
  <div className="container mx-auto px-4 py-8">
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <div>
            <CardTitle className="text-lg text-orange-600">Page Error</CardTitle>
            <p className="text-sm text-gray-600">This page encountered an error</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-800">
            We couldn't load this page properly. You can try again or navigate to a different page.
          </p>
          <p className="text-xs text-orange-600 mt-1">
            Error ID: <code className="bg-orange-100 px-1 rounded">{errorId}</code>
          </p>
        </div>

        <Button 
          onClick={onToggleDetails} 
          variant="outline" 
          size="sm" 
          className="w-full justify-between"
        >
          Technical Details
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showDetails && (
          <div className="bg-gray-50 border rounded p-3">
            <div className="text-xs font-mono bg-white p-2 rounded">
              <div className="text-orange-600 font-medium">{error.message}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onRetry} size="sm" disabled={retryCount >= 3}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
          <Button onClick={onReport} variant="outline" size="sm">
            <Bug className="h-4 w-4 mr-1" />
            Report
          </Button>
          <Button onClick={() => history.back()} variant="outline" size="sm">
            Go Back
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)

const ComponentLevelFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  showDetails,
  onToggleDetails,
  retryCount
}) => (
  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-yellow-800">Component Error</h4>
        <p className="text-xs text-yellow-700 mt-1">This component failed to render properly</p>
        
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={onRetry} size="sm" variant="outline" disabled={retryCount >= 2}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button onClick={onToggleDetails} size="sm" variant="ghost">
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        </div>

        {showDetails && (
          <div className="mt-3 p-2 bg-white border rounded text-xs">
            <code className="text-red-600">{error.message}</code>
            <div className="text-gray-500 mt-1">ID: {errorId}</div>
          </div>
        )}
      </div>
    </div>
  </div>
)

const WidgetLevelFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  retryCount
}) => (
  <div className="border border-gray-200 bg-gray-50 rounded p-3 text-center">
    <AlertTriangle className="h-4 w-4 text-gray-500 mx-auto mb-2" />
    <p className="text-xs text-gray-600 mb-2">Widget unavailable</p>
    <Button onClick={onRetry} size="sm" variant="outline" disabled={retryCount >= 2}>
      <RefreshCw className="h-3 w-3 mr-1" />
      Retry
    </Button>
  </div>
)

const DEFAULT_FALLBACKS = {
  app: AppLevelFallback,
  page: PageLevelFallback,
  component: ComponentLevelFallback,
  widget: WidgetLevelFallback
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { level, context, onError } = this.props
    const errorId = this.state.errorId!

    this.setState({
      errorInfo
    })

    // Log error with comprehensive context
    errorLogger.captureError(error, {
      level,
      errorId,
      errorInfo,
      context: {
        ...context,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        retryCount: this.state.retryCount,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.getUserId(),
        sessionId: this.getSessionId()
      }
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Report to monitoring services
    this.reportToMonitoring(error, errorInfo, errorId)
  }

  private getUserId(): string | null {
    // Get user ID from auth store or localStorage
    try {
      const authData = localStorage.getItem('auth')
      return authData ? JSON.parse(authData).userId : null
    } catch {
      return null
    }
  }

  private getSessionId(): string | null {
    // Get or create session ID
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

  private reportToMonitoring(error: Error, errorInfo: ErrorInfo, errorId: string) {
    // Report to external monitoring service (Sentry, LogRocket, etc.)
    try {
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: error.message,
          fatal: this.props.level === 'app',
          custom_map: {
            error_id: errorId,
            error_level: this.props.level,
            component_stack: errorInfo.componentStack
          }
        })
      }

      // Send to API for server-side logging
      fetch('/api/v1/errors/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorId,
          level: this.props.level,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          context: this.props.context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silently fail - don't let error reporting break the error boundary
      })
    } catch (reportingError) {
      console.warn('Failed to report error to monitoring:', reportingError)
    }
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
        showDetails: false
      }))
    }
  }

  private handleReport = () => {
    const { error, errorId, errorInfo } = this.state
    
    // Open issue reporting interface
    const issueUrl = `mailto:support@ganttchart.app?subject=Error Report: ${errorId}&body=${encodeURIComponent(`
Error ID: ${errorId}
Level: ${this.props.level}
Error: ${error?.message}
URL: ${window.location.href}
Time: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:


Technical details:
${error?.stack}
    `)}`
    
    window.open(issueUrl, '_blank')
  }

  private handleHome = () => {
    window.location.href = '/'
  }

  private handleToggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }))
  }

  render() {
    const { hasError, error, errorInfo, errorId, retryCount, showDetails } = this.state
    const { children, fallbackComponent, level, context, enableRecovery = true } = this.props

    if (hasError && error && errorId) {
      const FallbackComponent = fallbackComponent || DEFAULT_FALLBACKS[level]
      
      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo!}
          errorId={errorId}
          level={level}
          context={context}
          retryCount={retryCount}
          onRetry={enableRecovery ? this.handleRetry : () => {}}
          onReport={this.handleReport}
          onHome={this.handleHome}
          showDetails={showDetails}
          onToggleDetails={this.handleToggleDetails}
        />
      )
    }

    return children
  }
}

// Convenience HOC for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for components to manually trigger error boundary
export function useErrorHandler() {
  return (error: Error, context?: Record<string, any>) => {
    // This will trigger the nearest error boundary
    throw error
  }
}