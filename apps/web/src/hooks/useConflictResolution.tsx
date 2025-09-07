/**
 * AC3: Conflict resolution options allow users to choose between local, remote, or manual merge
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 * Integrates with all other ACs for complete conflict resolution workflow
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { ConflictError, apiClient } from '@/lib/api-client'
import { offlineSyncManager, QueuedOperation } from '@/lib/offline-sync'
import { errorLogger } from '@/lib/error-logger'
import { userErrorMessages, UserErrorMessage } from '@/lib/user-error-messages'
import { toast } from 'react-hot-toast'

interface ConflictResolutionState {
  isOpen: boolean
  conflictError: ConflictError | null
  localData: any
  remoteData: any
  entityType: string
  entityId: string
  operation: string
  userMessage: UserErrorMessage | null
  isResolving: boolean
}

interface ConflictResolutionOptions {
  showDiffModal: boolean
  allowManualMerge: boolean
  autoRetryOnFailure: boolean
  maxRetries: number
}

const DEFAULT_OPTIONS: ConflictResolutionOptions = {
  showDiffModal: true,
  allowManualMerge: true,
  autoRetryOnFailure: true,
  maxRetries: 3
}

export function useConflictResolution(options: Partial<ConflictResolutionOptions> = {}) {
  const [state, setState] = useState<ConflictResolutionState>({
    isOpen: false,
    conflictError: null,
    localData: null,
    remoteData: null,
    entityType: '',
    entityId: '',
    operation: '',
    userMessage: null,
    isResolving: false
  })

  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options }

  // Handle conflict events from API client and offline sync
  useEffect(() => {
    const handleApiConflict = (event: CustomEvent) => {
      const { error, localData, remoteData, entityType, entityId, operation } = event.detail
      showConflictResolution(error, localData, remoteData, entityType, entityId, operation)
    }

    const handleSyncConflict = (event: CustomEvent) => {
      const { operation, conflictError } = event.detail
      const { entity, entityId, data: localData, originalState } = operation as QueuedOperation
      
      // Fetch remote data for comparison
      fetchRemoteDataForConflict(entity, entityId, operation.endpoint)
        .then(remoteData => {
          showConflictResolution(
            conflictError,
            localData,
            remoteData,
            entity,
            entityId,
            operation.type
          )
        })
        .catch(error => {
          errorLogger.captureError(error, {
            level: 'component',
            context: { operation: 'fetchRemoteDataForConflict', entity, entityId }
          })
          
          // Show conflict resolution without remote data
          showConflictResolution(
            conflictError,
            localData,
            null,
            entity,
            entityId,
            operation.type
          )
        })
    }

    const handleErrorShowConflictDetails = (event: CustomEvent) => {
      const { error, context } = event.detail
      if (error.status === 409) {
        showConflictResolution(
          error,
          context?.localData,
          context?.remoteData,
          context?.entityType || 'item',
          context?.entityId || 'unknown',
          context?.operation || 'update'
        )
      }
    }

    window.addEventListener('api:conflict', handleApiConflict as EventListener)
    window.addEventListener('offline:sync_conflict', handleSyncConflict as EventListener)
    window.addEventListener('error:show_conflict_details', handleErrorShowConflictDetails as EventListener)

    return () => {
      window.removeEventListener('api:conflict', handleApiConflict as EventListener)
      window.removeEventListener('offline:sync_conflict', handleSyncConflict as EventListener)
      window.removeEventListener('error:show_conflict_details', handleErrorShowConflictDetails as EventListener)
    }
  }, [])

  const fetchRemoteDataForConflict = async (entity: string, entityId: string, endpoint: string) => {
    try {
      // Construct GET endpoint from operation endpoint
      const getEndpoint = endpoint.replace(/\/(dates|resize)$/, '').replace(/\?.*$/, '')
      return await apiClient.get(getEndpoint)
    } catch (error) {
      throw new Error(`Failed to fetch remote data: ${error}`)
    }
  }

  const showConflictResolution = useCallback((
    conflictError: ConflictError,
    localData: any,
    remoteData: any,
    entityType: string,
    entityId: string,
    operation: string
  ) => {
    // Generate user-friendly error message
    const userMessage = userErrorMessages.generateErrorMessage(conflictError, {
      operation,
      entityType,
      entityId,
      localData,
      remoteData
    })

    // Log conflict occurrence
    errorLogger.addBreadcrumb({
      category: 'custom',
      message: `Conflict resolution dialog opened for ${entityType}`,
      level: 'warning',
      data: {
        conflictType: conflictError.conflictType,
        entityType,
        entityId,
        operation
      }
    })

    setState({
      isOpen: true,
      conflictError,
      localData,
      remoteData,
      entityType,
      entityId,
      operation,
      userMessage,
      isResolving: false
    })
  }, [])

  const closeConflictResolution = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      isResolving: false
    }))
  }, [])

  const resolveConflict = useCallback(async (
    resolution: 'local' | 'remote' | 'manual',
    mergedData?: any
  ): Promise<boolean> => {
    if (!state.conflictError) return false

    setState(prev => ({ ...prev, isResolving: true }))

    try {
      let dataToSend: any

      switch (resolution) {
        case 'local':
          dataToSend = state.localData
          break
        case 'remote':
          dataToSend = state.remoteData
          break
        case 'manual':
          if (!mergedData) {
            throw new Error('Merged data is required for manual resolution')
          }
          dataToSend = mergedData
          break
        default:
          throw new Error(`Invalid resolution type: ${resolution}`)
      }

      // Add conflict resolution metadata
      const requestData = {
        ...dataToSend,
        _conflictResolution: {
          type: resolution,
          originalConflictId: state.conflictError.requestId,
          resolvedAt: new Date().toISOString(),
          conflictType: state.conflictError.conflictType,
          localVersion: state.conflictError.localVersion,
          remoteVersion: state.conflictError.remoteVersion
        }
      }

      // Determine the correct API method and endpoint
      const endpoint = state.conflictError.data?.endpoint || 
                      `/api/v1/${state.entityType}s/${state.entityId}`
      
      let result: any

      switch (state.operation) {
        case 'update':
        case 'update_task':
          result = await apiClient.put(endpoint, requestData, state.localData, `${state.operation}_resolved`)
          break
        case 'patch':
        case 'move_task':
        case 'resize_task':
          result = await apiClient.patch(endpoint, requestData, state.localData, `${state.operation}_resolved`)
          break
        case 'create':
        case 'create_dependency':
          result = await apiClient.post(endpoint, requestData, state.localData, `${state.operation}_resolved`)
          break
        case 'delete':
        case 'delete_dependency':
          result = await apiClient.delete(endpoint, state.localData, `${state.operation}_resolved`)
          break
        default:
          throw new Error(`Unsupported operation for conflict resolution: ${state.operation}`)
      }

      // Log successful resolution
      errorLogger.addBreadcrumb({
        category: 'custom',
        message: `Conflict resolved using ${resolution} strategy`,
        level: 'info',
        data: {
          resolution,
          entityType: state.entityType,
          entityId: state.entityId,
          operation: state.operation,
          conflictType: state.conflictError.conflictType
        }
      })

      // Emit resolution event for other components to handle
      window.dispatchEvent(new CustomEvent('conflict:resolved', {
        detail: {
          resolution,
          entityType: state.entityType,
          entityId: state.entityId,
          operation: state.operation,
          originalConflict: state.conflictError,
          resolvedData: dataToSend,
          result
        }
      }))

      // Show success message
      const resolutionMessages = {
        local: 'Your changes have been applied successfully',
        remote: 'Remote changes have been applied successfully',
        manual: 'Your merged changes have been applied successfully'
      }

      toast.success(resolutionMessages[resolution], {
        duration: 4000,
        id: `conflict-resolved-${state.conflictError.requestId}`
      })

      closeConflictResolution()
      return true

    } catch (error) {
      errorLogger.captureError(error as Error, {
        level: 'api',
        context: {
          operation: 'resolveConflict',
          resolution,
          entityType: state.entityType,
          entityId: state.entityId,
          conflictType: state.conflictError?.conflictType
        }
      })

      // Handle nested conflicts (conflict resolution caused another conflict)
      if (error instanceof ConflictError) {
        toast.error('Another conflict occurred during resolution. Please try again.')
        
        // Update the conflict with new data
        if (error.data?.remoteData) {
          setState(prev => ({
            ...prev,
            conflictError: error,
            remoteData: error.data.remoteData,
            isResolving: false
          }))
        }
      } else {
        toast.error(`Failed to resolve conflict: ${(error as Error).message}`)
        setState(prev => ({ ...prev, isResolving: false }))
        
        // Optionally retry if enabled
        if (resolvedOptions.autoRetryOnFailure && resolvedOptions.maxRetries > 0) {
          setTimeout(() => {
            resolveConflict(resolution, mergedData)
          }, 2000)
        }
      }

      return false
    }
  }, [state, resolvedOptions, closeConflictResolution])

  const ignoreConflict = useCallback(() => {
    if (!state.conflictError) return

    // Log conflict ignore
    errorLogger.addBreadcrumb({
      category: 'custom',
      message: `Conflict ignored by user`,
      level: 'warning',
      data: {
        entityType: state.entityType,
        entityId: state.entityId,
        operation: state.operation,
        conflictType: state.conflictError.conflictType
      }
    })

    // Emit ignore event
    window.dispatchEvent(new CustomEvent('conflict:ignored', {
      detail: {
        entityType: state.entityType,
        entityId: state.entityId,
        operation: state.operation,
        conflictError: state.conflictError
      }
    }))

    toast('Conflict ignored. Your local changes remain unchanged.', {
      icon: '⚠️',
      duration: 3000
    })

    closeConflictResolution()
  }, [state, closeConflictResolution])

  const retryOriginalOperation = useCallback(async () => {
    if (!state.conflictError) return false

    try {
      setState(prev => ({ ...prev, isResolving: true }))

      // Attempt the original operation again with fresh remote data
      const endpoint = state.conflictError.data?.endpoint || 
                      `/api/v1/${state.entityType}s/${state.entityId}`
      
      // Fetch latest remote state first
      const freshRemoteData = await fetchRemoteDataForConflict(
        state.entityType, 
        state.entityId, 
        endpoint
      )

      // Show new conflict dialog with fresh data
      showConflictResolution(
        state.conflictError,
        state.localData,
        freshRemoteData,
        state.entityType,
        state.entityId,
        state.operation
      )

      return true

    } catch (error) {
      errorLogger.captureError(error as Error, {
        level: 'api',
        context: { operation: 'retryOriginalOperation' }
      })

      toast.error('Failed to retry operation')
      setState(prev => ({ ...prev, isResolving: false }))
      return false
    }
  }, [state, showConflictResolution, fetchRemoteDataForConflict])

  // Public interface
  return {
    // State
    isConflictOpen: state.isOpen,
    conflictError: state.conflictError,
    localData: state.localData,
    remoteData: state.remoteData,
    entityType: state.entityType,
    entityId: state.entityId,
    operation: state.operation,
    userMessage: state.userMessage,
    isResolving: state.isResolving,

    // Actions
    resolveConflict,
    ignoreConflict,
    retryOriginalOperation,
    closeConflictResolution,
    
    // Manual trigger (for testing or special cases)
    showConflictResolution,

    // Configuration
    options: resolvedOptions
  }
}