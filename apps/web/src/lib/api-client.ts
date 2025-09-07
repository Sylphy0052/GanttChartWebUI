/**
 * API Client with Advanced Error Handling & Conflict Resolution
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 * AC1: 409 conflict responses trigger automatic rollback with user notification toasts
 */

import { toast } from 'react-hot-toast'

// Error types for comprehensive handling
export interface ApiError extends Error {
  status: number
  statusText: string
  data?: any
  timestamp: number
  requestId?: string
  context?: Record<string, any>
}


export class ConflictError extends Error implements ConflictError {
  public status: 409 = 409
  public statusText: string = 'Conflict'
  public data?: any
  public timestamp: number
  public requestId?: string
  public context?: Record<string, any>
  public conflictType: 'optimistic_lock' | 'resource_conflict' | 'dependency_conflict' | 'concurrent_modification'
  public localVersion?: number
  public remoteVersion?: number
  public conflictingFields?: string[]
  public suggestedResolution?: string

  constructor(
    message: string,
    conflictType: 'optimistic_lock' | 'resource_conflict' | 'dependency_conflict' | 'concurrent_modification',
    options: {
      data?: any
      requestId?: string
      context?: Record<string, any>
      localVersion?: number
      remoteVersion?: number
      conflictingFields?: string[]
      suggestedResolution?: string
    } = {}
  ) {
    super(message)
    this.name = 'ConflictError'
    this.conflictType = conflictType
    this.timestamp = Date.now()
    this.data = options.data
    this.requestId = options.requestId
    this.context = options.context
    this.localVersion = options.localVersion
    this.remoteVersion = options.remoteVersion
    this.conflictingFields = options.conflictingFields
    this.suggestedResolution = options.suggestedResolution
  }
}

export interface StateSnapshot {
  id: string
  timestamp: number
  data: any
  operation: string
  context?: Record<string, any>
}

// State management for rollback capability
class StateManager {
  private snapshots: Map<string, StateSnapshot> = new Map()
  private maxSnapshots = 10

  createSnapshot(id: string, data: any, operation: string, context?: Record<string, any>): string {
    const snapshotId = `${id}_${Date.now()}`
    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      operation,
      context
    }

    this.snapshots.set(snapshotId, snapshot)

    // Cleanup old snapshots
    if (this.snapshots.size > this.maxSnapshots) {
      const oldestKey = Array.from(this.snapshots.keys())[0]
      this.snapshots.delete(oldestKey)
    }

    return snapshotId
  }

  getSnapshot(snapshotId: string): StateSnapshot | undefined {
    return this.snapshots.get(snapshotId)
  }

  clearSnapshots(prefix?: string): void {
    if (prefix) {
      for (const [key] of this.snapshots) {
        if (key.startsWith(prefix)) {
          this.snapshots.delete(key)
        }
      }
    } else {
      this.snapshots.clear()
    }
  }

  getAllSnapshots(): StateSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp)
  }
}

// API Client with conflict resolution
export class AdvancedApiClient {
  private baseUrl: string
  private stateManager: StateManager
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl
    this.stateManager = new StateManager()
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }

  // AC1: Create state snapshot before critical operations
  private async executeWithRollback<T>(
    operation: string,
    currentState: any,
    apiCall: () => Promise<Response>,
    context?: Record<string, any>
  ): Promise<T> {
    // Create snapshot before operation
    const snapshotId = this.stateManager.createSnapshot(
      operation,
      currentState,
      operation,
      context
    )

    try {
      const response = await apiCall()
      return await this.handleResponse<T>(response, snapshotId, currentState, operation)
    } catch (error) {
      // Automatic rollback on error
      await this.handleError(error, snapshotId, currentState, operation)
      throw error
    }
  }

  // AC1: Enhanced response handling with 409 conflict detection
  private async handleResponse<T>(
    response: Response,
    snapshotId: string,
    originalState: any,
    operation: string
  ): Promise<T> {
    const requestId = response.headers.get('x-request-id') || crypto.randomUUID()

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      if (response.status === 409) {
        // AC1: Handle 409 conflicts with automatic rollback
        await this.handleConflictWithRollback(response, errorData, snapshotId, originalState, operation, requestId)
      } else {
        await this.handleGenericError(response, errorData, requestId)
      }
    }

    return await response.json()
  }

  // AC1: 409 conflict handling with automatic rollback
  private async handleConflictWithRollback(
    response: Response,
    errorData: any,
    snapshotId: string,
    originalState: any,
    operation: string,
    requestId: string
  ): Promise<void> {
    const conflictError: ConflictError = {
      name: 'ConflictError',
      message: errorData.message || 'Resource conflict detected',
      status: 409,
      statusText: response.statusText,
      data: errorData,
      timestamp: Date.now(),
      requestId,
      conflictType: this.detectConflictType(errorData),
      localVersion: errorData.localVersion,
      remoteVersion: errorData.remoteVersion,
      conflictingFields: errorData.conflictingFields,
      suggestedResolution: errorData.suggestedResolution
    }

    // Automatic rollback to previous state
    const snapshot = this.stateManager.getSnapshot(snapshotId)
    if (snapshot) {
      await this.performRollback(snapshot, operation)
      
      // Log rollback action
      this.logError({
        level: 'warn',
        message: 'Automatic rollback performed due to conflict',
        operation,
        conflictType: conflictError.conflictType,
        requestId,
        snapshot: {
          id: snapshot.id,
          timestamp: snapshot.timestamp,
          operation: snapshot.operation
        }
      })
    }

    // Show user notification toast
    this.showConflictNotification(conflictError, operation)

    throw conflictError
  }

  // AC1: Detect specific conflict types for better handling
  private detectConflictType(errorData: any): ConflictError['conflictType'] {
    if (errorData.type) {
      return errorData.type
    }

    // Infer conflict type from error patterns
    const message = errorData.message?.toLowerCase() || ''
    
    if (message.includes('optimistic') || message.includes('version')) {
      return 'optimistic_lock'
    } else if (message.includes('resource') || message.includes('busy')) {
      return 'resource_conflict'
    } else if (message.includes('dependency') || message.includes('circular')) {
      return 'dependency_conflict'
    } else {
      return 'concurrent_modification'
    }
  }

  // AC1: Perform automatic rollback
  private async performRollback(snapshot: StateSnapshot, operation: string): Promise<void> {
    try {
      // Emit rollback event for components to handle state restoration
      const rollbackEvent = new CustomEvent('api:rollback', {
        detail: {
          snapshot,
          operation,
          timestamp: Date.now()
        }
      })
      
      window.dispatchEvent(rollbackEvent)

      // Additional rollback logic can be added here based on operation type
      switch (operation) {
        case 'update_task':
        case 'move_task':
        case 'resize_task':
          // Specific rollback for task operations
          window.dispatchEvent(new CustomEvent('gantt:rollback_task', {
            detail: { originalState: snapshot.data, operation }
          }))
          break
        
        case 'create_dependency':
        case 'delete_dependency':
          // Specific rollback for dependency operations
          window.dispatchEvent(new CustomEvent('gantt:rollback_dependency', {
            detail: { originalState: snapshot.data, operation }
          }))
          break
      }
    } catch (rollbackError) {
      this.logError({
        level: 'error',
        message: 'Rollback operation failed',
        operation,
        snapshot: snapshot.id,
        error: rollbackError
      })
    }
  }

  // AC1: Show user-friendly conflict notifications
  private showConflictNotification(error: ConflictError, operation: string): void {
    const operationNames: Record<string, string> = {
      'update_task': 'task update',
      'move_task': 'task move',
      'resize_task': 'task resize',
      'create_dependency': 'dependency creation',
      'delete_dependency': 'dependency deletion',
      'create_project': 'project creation',
      'update_project': 'project update'
    }

    const friendlyOperation = operationNames[operation] || operation

    const conflictTypeMessages: Record<ConflictError['conflictType'], string> = {
      'optimistic_lock': 'Someone else modified this item while you were editing it.',
      'resource_conflict': 'The resource you\'re trying to access is currently unavailable.',
      'dependency_conflict': 'This operation would create invalid dependencies.',
      'concurrent_modification': 'Another user made conflicting changes.'
    }

    const message = conflictTypeMessages[error.conflictType] || error.message
    
    toast.error(
      `${friendlyOperation} failed: ${message} Your changes have been reverted.`,
      {
        duration: 6000,
        id: `conflict-${error.requestId}`,
        style: {
          minWidth: '400px'
        }
      }
    )

    // Show additional guidance if available
    if (error.suggestedResolution) {
      setTimeout(() => {
        toast(error.suggestedResolution!, {
          icon: '💡',
          duration: 8000,
          id: `suggestion-${error.requestId}`
        })
      }, 1000)
    }
  }

  // Generic error handling
  private async handleGenericError(
    response: Response,
    errorData: any,
    requestId: string
  ): Promise<void> {
    const apiError: ApiError = {
      name: 'ApiError',
      message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      statusText: response.statusText,
      data: errorData,
      timestamp: Date.now(),
      requestId
    }

    // Log error for monitoring
    this.logError({
      level: 'error',
      message: `API request failed: ${response.status}`,
      status: response.status,
      requestId,
      errorData
    })

    // Show user notification based on error type
    switch (response.status) {
      case 400:
        toast.error('Invalid request. Please check your input and try again.')
        break
      case 401:
        toast.error('Authentication required. Please log in again.')
        break
      case 403:
        toast.error('You don\'t have permission to perform this action.')
        break
      case 404:
        toast.error('The requested resource was not found.')
        break
      case 500:
        toast.error('Server error. Please try again later.')
        break
      default:
        toast.error(`Request failed: ${apiError.message}`)
    }

    throw apiError
  }

  // Error handling for fetch failures
  private async handleError(
    error: any,
    snapshotId: string,
    originalState: any,
    operation: string
  ): Promise<void> {
    if (error instanceof Response) {
      return // Already handled by handleResponse
    }

    // Handle network errors, timeouts, etc.
    const networkError: ApiError = {
      name: 'NetworkError',
      message: error.message || 'Network request failed',
      status: 0,
      statusText: 'Network Error',
      timestamp: Date.now(),
      context: { operation }
    }

    // Attempt rollback for network errors too
    const snapshot = this.stateManager.getSnapshot(snapshotId)
    if (snapshot) {
      await this.performRollback(snapshot, operation)
    }

    this.logError({
      level: 'error',
      message: 'Network error occurred',
      operation,
      error
    })

    toast.error('Network error. Your changes have been reverted. Please check your connection and try again.')

    throw networkError
  }

  // Comprehensive error logging
  private logError(logData: {
    level: 'error' | 'warn' | 'info'
    message: string
    operation?: string
    status?: number
    requestId?: string
    conflictType?: string
    snapshot?: any
    errorData?: any
    error?: any
  }): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: logData.level,
      message: logData.message,
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...logData
      }
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console[logData.level]('[ApiClient]', logEntry)
    }

    // Send to monitoring service (implement as needed)
    // this.sendToMonitoring(logEntry)
  }

  // Public API methods with conflict resolution
  async get<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options
    })

    return this.handleResponse<T>(response, '', null, 'read')
  }

  async post<T>(
    endpoint: string,
    data: any,
    currentState?: any,
    operation: string = 'create',
    options: RequestInit = {}
  ): Promise<T> {
    return this.executeWithRollback<T>(
      operation,
      currentState,
      () => fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: JSON.stringify(data),
        ...options
      }),
      { endpoint, data }
    )
  }

  async put<T>(
    endpoint: string,
    data: any,
    currentState: any,
    operation: string = 'update',
    options: RequestInit = {}
  ): Promise<T> {
    return this.executeWithRollback<T>(
      operation,
      currentState,
      () => fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: JSON.stringify(data),
        ...options
      }),
      { endpoint, data }
    )
  }

  async patch<T>(
    endpoint: string,
    data: any,
    currentState: any,
    operation: string = 'update',
    options: RequestInit = {}
  ): Promise<T> {
    return this.executeWithRollback<T>(
      operation,
      currentState,
      () => fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: JSON.stringify(data),
        ...options
      }),
      { endpoint, data }
    )
  }

  async delete<T>(
    endpoint: string,
    currentState: any,
    operation: string = 'delete',
    options: RequestInit = {}
  ): Promise<T> {
    return this.executeWithRollback<T>(
      operation,
      currentState,
      () => fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options
      }),
      { endpoint }
    )
  }

  // State management utilities
  getStateSnapshots(): StateSnapshot[] {
    return this.stateManager.getAllSnapshots()
  }

  clearStateSnapshots(prefix?: string): void {
    this.stateManager.clearSnapshots(prefix)
  }
}

// Export singleton instance
export const apiClient = new AdvancedApiClient()

// Export types for use in components
export type { StateSnapshot, ApiError }