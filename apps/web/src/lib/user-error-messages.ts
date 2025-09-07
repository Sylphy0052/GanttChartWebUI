/**
 * AC7: User-friendly error messages provide clear guidance for resolution actions
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

import { ConflictError, ApiError } from './api-client'

interface UserErrorMessage {
  title: string
  message: string
  actions: ErrorAction[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'network' | 'authentication' | 'permission' | 'validation' | 'conflict' | 'system'
  canRetry: boolean
  canIgnore: boolean
}

interface ErrorAction {
  label: string
  action: 'retry' | 'refresh' | 'login' | 'contact' | 'navigate' | 'custom'
  primary?: boolean
  url?: string
  handler?: () => void
  icon?: string
}

// Error pattern matching for intelligent error classification
interface ErrorPattern {
  pattern: RegExp | string
  matches: (error: Error | ApiError | ConflictError) => boolean
  category: UserErrorMessage['category']
  severity: UserErrorMessage['severity']
}

class UserErrorMessageService {
  private patterns: ErrorPattern[] = [
    // Network errors
    {
      pattern: /network|fetch|connection|timeout/i,
      matches: (error) => error.name === 'NetworkError' || error.message.includes('fetch'),
      category: 'network',
      severity: 'medium'
    },
    
    // Authentication errors
    {
      pattern: /unauthorized|authentication|token|login/i,
      matches: (error) => 'status' in error && error.status === 401,
      category: 'authentication',
      severity: 'high'
    },
    
    // Permission errors
    {
      pattern: /forbidden|permission|access denied/i,
      matches: (error) => 'status' in error && error.status === 403,
      category: 'permission',
      severity: 'high'
    },
    
    // Validation errors
    {
      pattern: /validation|invalid|bad request/i,
      matches: (error) => 'status' in error && error.status === 400,
      category: 'validation',
      severity: 'medium'
    },
    
    // Conflict errors
    {
      pattern: /conflict|version|concurrent/i,
      matches: (error) => 'status' in error && error.status === 409,
      category: 'conflict',
      severity: 'high'
    },
    
    // Server errors
    {
      pattern: /server|internal|500|503/i,
      matches: (error) => 'status' in error && error.status >= 500,
      category: 'system',
      severity: 'high'
    }
  ]

  // Predefined user-friendly messages for common error scenarios
  private messageTemplates = {
    network: {
      connection_lost: {
        title: 'Connection Lost',
        message: 'It looks like you\'ve lost your internet connection. Your changes are being saved locally and will sync automatically when your connection is restored.',
        actions: [
          { label: 'Check Connection', action: 'custom', primary: true, icon: '🌐', handler: this.checkConnection },
          { label: 'Work Offline', action: 'custom', icon: '💾' }
        ],
        severity: 'medium' as const,
        category: 'network' as const,
        canRetry: true,
        canIgnore: true
      },
      
      slow_connection: {
        title: 'Slow Connection',
        message: 'Your internet connection seems slow. Operations may take longer than usual.',
        actions: [
          { label: 'Continue', action: 'custom', primary: true }
        ],
        severity: 'low' as const,
        category: 'network' as const,
        canRetry: false,
        canIgnore: true
      },
      
      request_timeout: {
        title: 'Request Timeout',
        message: 'The request took too long to complete. This might be due to a slow connection or server issues.',
        actions: [
          { label: 'Try Again', action: 'retry', primary: true, icon: '🔄' },
          { label: 'Check Status', action: 'navigate', url: '/status', icon: '📊' }
        ],
        severity: 'medium' as const,
        category: 'network' as const,
        canRetry: true,
        canIgnore: false
      }
    },

    authentication: {
      session_expired: {
        title: 'Session Expired',
        message: 'Your session has expired for security reasons. Please log in again to continue.',
        actions: [
          { label: 'Log In', action: 'login', primary: true, icon: '🔑' },
          { label: 'Go to Home', action: 'navigate', url: '/', icon: '🏠' }
        ],
        severity: 'high' as const,
        category: 'authentication' as const,
        canRetry: false,
        canIgnore: false
      },
      
      invalid_credentials: {
        title: 'Authentication Failed',
        message: 'Your credentials appear to be invalid. Please check your username and password and try again.',
        actions: [
          { label: 'Try Again', action: 'retry', primary: true, icon: '🔄' },
          { label: 'Reset Password', action: 'navigate', url: '/reset-password', icon: '🔒' }
        ],
        severity: 'high' as const,
        category: 'authentication' as const,
        canRetry: true,
        canIgnore: false
      }
    },

    permission: {
      access_denied: {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action. Please contact your administrator if you believe this is an error.',
        actions: [
          { label: 'Contact Admin', action: 'contact', primary: true, icon: '📧' },
          { label: 'Go Back', action: 'custom', icon: '⬅️', handler: () => window.history.back() }
        ],
        severity: 'high' as const,
        category: 'permission' as const,
        canRetry: false,
        canIgnore: false
      },
      
      insufficient_privileges: {
        title: 'Insufficient Privileges',
        message: 'Your account doesn\'t have the necessary privileges to access this feature. Please upgrade your account or contact support.',
        actions: [
          { label: 'Upgrade Account', action: 'navigate', url: '/upgrade', primary: true, icon: '⭐' },
          { label: 'Contact Support', action: 'contact', icon: '💬' }
        ],
        severity: 'high' as const,
        category: 'permission' as const,
        canRetry: false,
        canIgnore: false
      }
    },

    validation: {
      invalid_data: {
        title: 'Invalid Data',
        message: 'Some of the information you entered is not valid. Please check your input and try again.',
        actions: [
          { label: 'Review & Fix', action: 'custom', primary: true, icon: '✏️' },
          { label: 'Cancel', action: 'custom', icon: '❌' }
        ],
        severity: 'medium' as const,
        category: 'validation' as const,
        canRetry: true,
        canIgnore: true
      },
      
      required_fields: {
        title: 'Required Information Missing',
        message: 'Please fill in all required fields before continuing.',
        actions: [
          { label: 'Review Form', action: 'custom', primary: true, icon: '📝' }
        ],
        severity: 'medium' as const,
        category: 'validation' as const,
        canRetry: true,
        canIgnore: false
      }
    },

    conflict: {
      concurrent_edit: {
        title: 'Conflicting Changes',
        message: 'Someone else modified this item while you were editing it. You can choose to keep your changes, use their changes, or merge both.',
        actions: [
          { label: 'Resolve Conflict', action: 'custom', primary: true, icon: '🔀' },
          { label: 'Discard My Changes', action: 'custom', icon: '🗑️' }
        ],
        severity: 'high' as const,
        category: 'conflict' as const,
        canRetry: false,
        canIgnore: false
      },
      
      resource_locked: {
        title: 'Resource Locked',
        message: 'This resource is currently being edited by another user. Please wait a moment and try again.',
        actions: [
          { label: 'Wait & Retry', action: 'retry', primary: true, icon: '⏰' },
          { label: 'View Read-Only', action: 'custom', icon: '👁️' }
        ],
        severity: 'medium' as const,
        category: 'conflict' as const,
        canRetry: true,
        canIgnore: true
      }
    },

    system: {
      server_error: {
        title: 'Server Error',
        message: 'We\'re experiencing technical difficulties. Our team has been notified and is working on a fix.',
        actions: [
          { label: 'Try Again', action: 'retry', primary: true, icon: '🔄' },
          { label: 'Check Status', action: 'navigate', url: '/status', icon: '📊' },
          { label: 'Report Issue', action: 'contact', icon: '🐛' }
        ],
        severity: 'high' as const,
        category: 'system' as const,
        canRetry: true,
        canIgnore: false
      },
      
      maintenance: {
        title: 'Maintenance Mode',
        message: 'The system is currently undergoing scheduled maintenance. Please check back in a few minutes.',
        actions: [
          { label: 'Check Back Later', action: 'refresh', primary: true, icon: '🔄' },
          { label: 'View Status', action: 'navigate', url: '/status', icon: '📊' }
        ],
        severity: 'medium' as const,
        category: 'system' as const,
        canRetry: true,
        canIgnore: false
      }
    }
  }

  // Generate user-friendly error message from error object
  generateErrorMessage(
    error: Error | ApiError | ConflictError,
    context?: Record<string, any>
  ): UserErrorMessage {
    // Special handling for ConflictError
    if ('status' in error && error.status === 409) {
      return this.generateConflictMessage(error as ConflictError, context)
    }

    // Try to match against known patterns
    const pattern = this.patterns.find(p => p.matches(error))
    
    if (pattern) {
      return this.generateCategorizedMessage(error, pattern, context)
    }

    // Fallback to generic error message
    return this.generateGenericMessage(error, context)
  }

  private generateConflictMessage(error: ConflictError, context?: Record<string, any>): UserErrorMessage {
    const conflictTypeMessages = {
      optimistic_lock: this.messageTemplates.conflict.concurrent_edit,
      resource_conflict: this.messageTemplates.conflict.resource_locked,
      dependency_conflict: {
        ...this.messageTemplates.validation.invalid_data,
        title: 'Dependency Conflict',
        message: 'This change would create invalid task dependencies. Please review and adjust the task relationships.'
      },
      concurrent_modification: this.messageTemplates.conflict.concurrent_edit
    }

    const baseMessage = conflictTypeMessages[error.conflictType] || this.messageTemplates.conflict.concurrent_edit

    return {
      ...baseMessage,
      message: error.suggestedResolution || baseMessage.message,
      actions: [
        ...baseMessage.actions,
        { 
          label: 'View Details', 
          action: 'custom', 
          icon: '🔍',
          handler: () => this.showConflictDetails(error, context)
        }
      ]
    }
  }

  private generateCategorizedMessage(
    error: Error | ApiError,
    pattern: ErrorPattern,
    context?: Record<string, any>
  ): UserErrorMessage {
    // Select appropriate template based on category and specific error details
    let template: UserErrorMessage | null = null

    switch (pattern.category) {
      case 'network':
        if (error.message.includes('timeout')) {
          template = this.messageTemplates.network.request_timeout
        } else if (navigator.onLine === false) {
          template = this.messageTemplates.network.connection_lost
        } else {
          template = this.messageTemplates.network.slow_connection
        }
        break

      case 'authentication':
        if (error.message.includes('expired')) {
          template = this.messageTemplates.authentication.session_expired
        } else {
          template = this.messageTemplates.authentication.invalid_credentials
        }
        break

      case 'permission':
        if (error.message.includes('upgrade') || error.message.includes('privilege')) {
          template = this.messageTemplates.permission.insufficient_privileges
        } else {
          template = this.messageTemplates.permission.access_denied
        }
        break

      case 'validation':
        if (error.message.includes('required')) {
          template = this.messageTemplates.validation.required_fields
        } else {
          template = this.messageTemplates.validation.invalid_data
        }
        break

      case 'system':
        if (error.message.includes('maintenance')) {
          template = this.messageTemplates.system.maintenance
        } else {
          template = this.messageTemplates.system.server_error
        }
        break
    }

    if (template) {
      return {
        ...template,
        // Enhance message with specific error details if helpful
        message: this.enhanceMessageWithContext(template.message, error, context)
      }
    }

    return this.generateGenericMessage(error, context)
  }

  private generateGenericMessage(error: Error | ApiError, context?: Record<string, any>): UserErrorMessage {
    return {
      title: 'Something Went Wrong',
      message: this.sanitizeErrorMessage(error.message) || 'An unexpected error occurred. Please try again.',
      actions: [
        { label: 'Try Again', action: 'retry', primary: true, icon: '🔄' },
        { label: 'Report Issue', action: 'contact', icon: '🐛' }
      ],
      severity: 'medium',
      category: 'system',
      canRetry: true,
      canIgnore: true
    }
  }

  private enhanceMessageWithContext(
    baseMessage: string,
    error: Error | ApiError,
    context?: Record<string, any>
  ): string {
    let enhancedMessage = baseMessage

    // Add contextual information if available
    if (context?.operation) {
      enhancedMessage = enhancedMessage.replace(
        /this action/gi,
        `this ${context.operation.replace('_', ' ')}`
      )
    }

    if (context?.entityType) {
      enhancedMessage = enhancedMessage.replace(
        /this item/gi,
        `this ${context.entityType}`
      )
    }

    return enhancedMessage
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove technical jargon and stack traces
    const sanitized = message
      .replace(/Error:\s*/gi, '')
      .replace(/at \w+.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Don't show very technical or long messages to users
    if (sanitized.length > 200 || 
        sanitized.includes('Cannot read property') ||
        sanitized.includes('undefined') ||
        sanitized.includes('null')) {
      return 'An unexpected error occurred'
    }

    return sanitized
  }

  private showConflictDetails(error: ConflictError, context?: Record<string, any>) {
    // Emit event to show conflict resolution modal
    window.dispatchEvent(new CustomEvent('error:show_conflict_details', {
      detail: { error, context }
    }))
  }

  private checkConnection() {
    // Perform connection check
    fetch('/api/health', { method: 'HEAD' })
      .then(() => {
        alert('Connection is working properly')
      })
      .catch(() => {
        alert('Connection issues detected. Please check your internet connection.')
      })
  }

  // Generate contextual help based on user's current activity
  getContextualHelp(
    error: Error | ApiError | ConflictError,
    userContext: {
      currentPage?: string
      lastAction?: string
      userRole?: string
      feature?: string
    }
  ): string[] {
    const helpTips: string[] = []

    // Page-specific help
    if (userContext.currentPage === '/gantt') {
      helpTips.push('💡 Try refreshing the Gantt chart to reload the latest data')
      helpTips.push('💡 Check if other users are editing the same tasks')
    }

    if (userContext.currentPage === '/projects') {
      helpTips.push('💡 Ensure you have the necessary permissions to modify projects')
    }

    // Action-specific help
    if (userContext.lastAction === 'save' && 'status' in error && error.status === 409) {
      helpTips.push('💡 Someone else may have saved changes to this item while you were editing')
    }

    if (userContext.lastAction === 'delete' && 'status' in error && error.status === 403) {
      helpTips.push('💡 Items with dependencies or special status may require admin permissions to delete')
    }

    // Role-specific help
    if (userContext.userRole === 'viewer' && 'status' in error && error.status === 403) {
      helpTips.push('💡 Your account has view-only access. Contact an admin to request edit permissions')
    }

    // General help
    helpTips.push('💡 Clear your browser cache if you continue experiencing issues')
    helpTips.push('💡 Try the action again in a few moments - temporary issues often resolve themselves')

    return helpTips.slice(0, 3) // Limit to top 3 most relevant tips
  }
}

// Export singleton instance
export const userErrorMessages = new UserErrorMessageService()

// Export types
export type { UserErrorMessage, ErrorAction }