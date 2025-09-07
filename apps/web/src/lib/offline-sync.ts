/**
 * AC4: Offline capability queues changes and syncs when connection is restored
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

import { toast } from 'react-hot-toast'
import { apiClient, ConflictError, StateSnapshot } from './api-client'
import { errorLogger } from './error-logger'

interface QueuedOperation {
  id: string
  timestamp: number
  type: 'create' | 'update' | 'delete' | 'patch'
  entity: 'task' | 'dependency' | 'project' | 'issue'
  entityId: string
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: any
  originalState?: any
  retryCount: number
  maxRetries: number
  priority: 'high' | 'medium' | 'low'
  status: 'queued' | 'syncing' | 'success' | 'failed' | 'conflict'
  errorMessage?: string
  conflictData?: any
}

interface SyncStats {
  totalOperations: number
  queuedOperations: number
  successfulOperations: number
  failedOperations: number
  conflictOperations: number
  lastSyncAttempt: number | null
  lastSuccessfulSync: number | null
  isOnline: boolean
  isSyncing: boolean
}

interface SyncOptions {
  autoRetry?: boolean
  retryDelay?: number
  maxRetries?: number
  batchSize?: number
  prioritizeByType?: boolean
}

class OfflineSyncManager {
  private operationQueue: QueuedOperation[] = []
  private syncInProgress = false
  private isOnline = navigator.onLine
  private listeners: Set<(stats: SyncStats) => void> = new Set()
  private syncOptions: Required<SyncOptions> = {
    autoRetry: true,
    retryDelay: 5000, // 5 seconds
    maxRetries: 3,
    batchSize: 5,
    prioritizeByType: true
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize() {
    // Load persisted queue
    this.loadPersistedQueue()

    // Set up online/offline event listeners
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)

    // Set up periodic sync attempts
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress && this.operationQueue.length > 0) {
        this.syncPendingOperations()
      }
    }, this.syncOptions.retryDelay)

    // Set up page unload handler to persist queue
    window.addEventListener('beforeunload', () => {
      this.persistQueue()
    })

    // Set up visibility change handler for background sync
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline && this.operationQueue.length > 0) {
        this.syncPendingOperations()
      }
    })
  }

  private handleOnline = () => {
    this.isOnline = true
    
    toast.success('Connection restored. Syncing pending changes...', {
      id: 'connection-restored'
    })

    errorLogger.addBreadcrumb({
      category: 'custom',
      message: 'Connection restored',
      level: 'info',
      data: { queuedOperations: this.operationQueue.length }
    })

    // Start sync after a short delay to allow UI to settle
    setTimeout(() => {
      if (this.operationQueue.length > 0) {
        this.syncPendingOperations()
      }
    }, 1000)

    this.notifyListeners()
  }

  private handleOffline = () => {
    this.isOnline = false
    
    toast.error('Connection lost. Changes will be saved locally and synced when connection is restored.', {
      id: 'connection-lost',
      duration: 5000
    })

    errorLogger.addBreadcrumb({
      category: 'custom',
      message: 'Connection lost',
      level: 'warning'
    })

    this.notifyListeners()
  }

  private loadPersistedQueue() {
    try {
      const persistedQueue = localStorage.getItem('offlineSync.queue')
      if (persistedQueue) {
        this.operationQueue = JSON.parse(persistedQueue)
        
        // Clean up old operations (older than 7 days)
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
        this.operationQueue = this.operationQueue.filter(op => op.timestamp > weekAgo)
      }
    } catch (error) {
      errorLogger.captureError(error as Error, {
        level: 'component',
        context: { operation: 'loadPersistedQueue' }
      })
    }
  }

  private persistQueue() {
    try {
      localStorage.setItem('offlineSync.queue', JSON.stringify(this.operationQueue))
    } catch (error) {
      errorLogger.captureError(error as Error, {
        level: 'component',
        context: { operation: 'persistQueue' }
      })
    }
  }

  private notifyListeners() {
    const stats = this.getStats()
    this.listeners.forEach(listener => {
      try {
        listener(stats)
      } catch (error) {
        console.warn('Error in sync stats listener:', error)
      }
    })
  }

  // Queue an operation for offline sync
  queueOperation(
    type: QueuedOperation['type'],
    entity: QueuedOperation['entity'],
    entityId: string,
    endpoint: string,
    method: QueuedOperation['method'],
    data?: any,
    originalState?: any,
    priority: QueuedOperation['priority'] = 'medium'
  ): string {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const operation: QueuedOperation = {
      id: operationId,
      timestamp: Date.now(),
      type,
      entity,
      entityId,
      endpoint,
      method,
      data,
      originalState,
      retryCount: 0,
      maxRetries: this.syncOptions.maxRetries,
      priority,
      status: 'queued'
    }

    // Remove any existing operation for the same entity (optimistic updates)
    if (type === 'update' || type === 'patch') {
      this.operationQueue = this.operationQueue.filter(
        op => !(op.entity === entity && op.entityId === entityId && op.type === type)
      )
    }

    this.operationQueue.push(operation)
    this.persistQueue()

    errorLogger.addBreadcrumb({
      category: 'custom',
      message: `Queued ${type} operation for ${entity}`,
      level: 'info',
      data: { operationId, entity, entityId, priority }
    })

    // If online, try to sync immediately
    if (this.isOnline && !this.syncInProgress) {
      setTimeout(() => this.syncPendingOperations(), 100)
    } else if (!this.isOnline) {
      toast('Change saved locally. Will sync when connection is restored.', {
        icon: '💾',
        duration: 3000
      })
    }

    this.notifyListeners()
    return operationId
  }

  // Sync all pending operations
  async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.operationQueue.length === 0) {
      return
    }

    this.syncInProgress = true
    this.notifyListeners()

    try {
      // Sort operations by priority and timestamp
      const sortedOperations = this.getSortedOperations()
      const batch = sortedOperations
        .filter(op => op.status === 'queued' || (op.status === 'failed' && op.retryCount < op.maxRetries))
        .slice(0, this.syncOptions.batchSize)

      if (batch.length === 0) {
        return
      }

      errorLogger.addBreadcrumb({
        category: 'custom',
        message: `Starting sync batch of ${batch.length} operations`,
        level: 'info'
      })

      const results = await Promise.allSettled(
        batch.map(operation => this.syncOperation(operation))
      )

      let successCount = 0
      let conflictCount = 0
      let errorCount = 0

      results.forEach((result, index) => {
        const operation = batch[index]
        
        if (result.status === 'fulfilled') {
          if (result.value === 'success') {
            successCount++
          } else if (result.value === 'conflict') {
            conflictCount++
          }
        } else {
          errorCount++
        }
      })

      // Show sync results
      if (successCount > 0) {
        toast.success(`Synced ${successCount} change${successCount !== 1 ? 's' : ''} successfully`)
      }

      if (conflictCount > 0) {
        toast.error(`${conflictCount} change${conflictCount !== 1 ? 's' : ''} had conflicts that need resolution`)
      }

      if (errorCount > 0 && successCount === 0 && conflictCount === 0) {
        toast.error(`Failed to sync ${errorCount} change${errorCount !== 1 ? 's' : ''}. Will retry later.`)
      }

      // Continue syncing if there are more operations
      const remainingOps = this.operationQueue.filter(
        op => op.status === 'queued' || (op.status === 'failed' && op.retryCount < op.maxRetries)
      )

      if (remainingOps.length > 0) {
        setTimeout(() => this.syncPendingOperations(), 1000)
      }

    } catch (error) {
      errorLogger.captureError(error as Error, {
        level: 'api',
        context: { operation: 'syncPendingOperations' }
      })
    } finally {
      this.syncInProgress = false
      this.persistQueue()
      this.notifyListeners()
    }
  }

  private getSortedOperations(): QueuedOperation[] {
    if (!this.syncOptions.prioritizeByType) {
      return [...this.operationQueue].sort((a, b) => a.timestamp - b.timestamp)
    }

    // Priority order: delete > create > update > patch
    const priorityOrder = { 'delete': 0, 'create': 1, 'update': 2, 'patch': 3 }
    const priorityWeight = { 'high': 0, 'medium': 1, 'low': 2 }

    return [...this.operationQueue].sort((a, b) => {
      // First by operation type priority
      const typeDiff = priorityOrder[a.type] - priorityOrder[b.type]
      if (typeDiff !== 0) return typeDiff

      // Then by priority level
      const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Finally by timestamp (oldest first)
      return a.timestamp - b.timestamp
    })
  }

  private async syncOperation(operation: QueuedOperation): Promise<'success' | 'conflict' | 'error'> {
    operation.status = 'syncing'
    
    try {
      let response: any

      switch (operation.method) {
        case 'POST':
          response = await apiClient.post(
            operation.endpoint,
            operation.data,
            operation.originalState,
            operation.type,
            {}
          )
          break
          
        case 'PUT':
          response = await apiClient.put(
            operation.endpoint,
            operation.data,
            operation.originalState,
            operation.type,
            {}
          )
          break
          
        case 'PATCH':
          response = await apiClient.patch(
            operation.endpoint,
            operation.data,
            operation.originalState,
            operation.type,
            {}
          )
          break
          
        case 'DELETE':
          response = await apiClient.delete(
            operation.endpoint,
            operation.originalState,
            operation.type,
            {}
          )
          break
          
        default:
          throw new Error(`Unsupported method: ${operation.method}`)
      }

      // Mark as successful
      operation.status = 'success'
      
      errorLogger.addBreadcrumb({
        category: 'http',
        message: `Successfully synced ${operation.type} operation`,
        level: 'info',
        data: { operationId: operation.id, entity: operation.entity }
      })

      return 'success'

    } catch (error) {
      operation.retryCount++

      if (error instanceof ConflictError) {
        operation.status = 'conflict'
        operation.conflictData = error.data
        operation.errorMessage = error.message

        errorLogger.addBreadcrumb({
          category: 'http',
          message: `Conflict detected for ${operation.type} operation`,
          level: 'warning',
          data: { 
            operationId: operation.id, 
            conflictType: error.conflictType,
            entity: operation.entity
          }
        })

        // Emit conflict event for UI to handle
        window.dispatchEvent(new CustomEvent('offline:sync_conflict', {
          detail: { operation, conflictError: error }
        }))

        return 'conflict'
      } else {
        if (operation.retryCount >= operation.maxRetries) {
          operation.status = 'failed'
          operation.errorMessage = error instanceof Error ? error.message : String(error)
        } else {
          operation.status = 'queued' // Will be retried
        }

        errorLogger.captureError(error as Error, {
          level: 'api',
          context: { 
            operation: 'syncOperation',
            operationId: operation.id,
            retryCount: operation.retryCount,
            maxRetries: operation.maxRetries
          }
        })

        return 'error'
      }
    }
  }

  // Public API methods

  // Get sync statistics
  getStats(): SyncStats {
    const now = Date.now()
    
    return {
      totalOperations: this.operationQueue.length,
      queuedOperations: this.operationQueue.filter(op => op.status === 'queued').length,
      successfulOperations: this.operationQueue.filter(op => op.status === 'success').length,
      failedOperations: this.operationQueue.filter(op => op.status === 'failed').length,
      conflictOperations: this.operationQueue.filter(op => op.status === 'conflict').length,
      lastSyncAttempt: this.operationQueue.length > 0 
        ? Math.max(...this.operationQueue.map(op => op.timestamp))
        : null,
      lastSuccessfulSync: this.operationQueue.filter(op => op.status === 'success').length > 0
        ? Math.max(...this.operationQueue.filter(op => op.status === 'success').map(op => op.timestamp))
        : null,
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress
    }
  }

  // Subscribe to sync stats updates
  subscribe(listener: (stats: SyncStats) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Get queued operations
  getQueuedOperations(): QueuedOperation[] {
    return [...this.operationQueue]
  }

  // Get operations by status
  getOperationsByStatus(status: QueuedOperation['status']): QueuedOperation[] {
    return this.operationQueue.filter(op => op.status === status)
  }

  // Remove operation from queue
  removeOperation(operationId: string): boolean {
    const initialLength = this.operationQueue.length
    this.operationQueue = this.operationQueue.filter(op => op.id !== operationId)
    
    if (this.operationQueue.length < initialLength) {
      this.persistQueue()
      this.notifyListeners()
      return true
    }
    
    return false
  }

  // Clear all operations
  clearQueue(): void {
    this.operationQueue = []
    this.persistQueue()
    this.notifyListeners()
  }

  // Clear completed operations
  clearCompleted(): void {
    this.operationQueue = this.operationQueue.filter(
      op => op.status !== 'success' && op.status !== 'failed'
    )
    this.persistQueue()
    this.notifyListeners()
  }

  // Retry failed operations
  retryFailedOperations(): void {
    this.operationQueue.forEach(operation => {
      if (operation.status === 'failed') {
        operation.status = 'queued'
        operation.retryCount = 0
        operation.errorMessage = undefined
      }
    })
    
    this.persistQueue()
    this.notifyListeners()
    
    if (this.isOnline) {
      this.syncPendingOperations()
    }
  }

  // Manually trigger sync
  forcSync(): Promise<void> {
    if (!this.isOnline) {
      toast.error('Cannot sync while offline')
      return Promise.resolve()
    }

    return this.syncPendingOperations()
  }

  // Update sync options
  updateSyncOptions(options: Partial<SyncOptions>): void {
    this.syncOptions = { ...this.syncOptions, ...options }
  }

  // Check if online
  isOnlineStatus(): boolean {
    return this.isOnline
  }
}

// Export singleton instance
export const offlineSyncManager = new OfflineSyncManager()

// Export types
export type { QueuedOperation, SyncStats, SyncOptions }