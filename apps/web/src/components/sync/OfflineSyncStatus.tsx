/**
 * AC4: Offline capability - UI component showing sync status and queue management
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Trash2,
  Eye,
  X
} from 'lucide-react'
import { offlineSyncManager, SyncStats, QueuedOperation } from '@/lib/offline-sync'
import { toast } from 'react-hot-toast'

interface OfflineSyncStatusProps {
  variant?: 'compact' | 'full'
  showDetails?: boolean
  className?: string
}

export const OfflineSyncStatus: React.FC<OfflineSyncStatusProps> = ({
  variant = 'compact',
  showDetails = false,
  className = ''
}) => {
  const [stats, setStats] = useState<SyncStats>({
    totalOperations: 0,
    queuedOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    conflictOperations: 0,
    lastSyncAttempt: null,
    lastSuccessfulSync: null,
    isOnline: navigator.onLine,
    isSyncing: false
  })
  const [operations, setOperations] = useState<QueuedOperation[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Initial load
    setStats(offlineSyncManager.getStats())
    setOperations(offlineSyncManager.getQueuedOperations())

    // Subscribe to updates
    const unsubscribe = offlineSyncManager.subscribe((newStats) => {
      setStats(newStats)
      setOperations(offlineSyncManager.getQueuedOperations())
    })

    return unsubscribe
  }, [])

  const getStatusColor = () => {
    if (!stats.isOnline) return 'destructive'
    if (stats.isSyncing) return 'default'
    if (stats.conflictOperations > 0) return 'destructive'
    if (stats.failedOperations > 0) return 'destructive'
    if (stats.queuedOperations > 0) return 'secondary'
    return 'default'
  }

  const getStatusIcon = () => {
    if (!stats.isOnline) return <WifiOff className="h-4 w-4" />
    if (stats.isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (stats.conflictOperations > 0) return <AlertCircle className="h-4 w-4" />
    if (stats.failedOperations > 0) return <AlertCircle className="h-4 w-4" />
    if (stats.queuedOperations > 0) return <Clock className="h-4 w-4" />
    return <Wifi className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (!stats.isOnline) return 'Offline'
    if (stats.isSyncing) return 'Syncing...'
    if (stats.conflictOperations > 0) return `${stats.conflictOperations} conflicts`
    if (stats.failedOperations > 0) return `${stats.failedOperations} failed`
    if (stats.queuedOperations > 0) return `${stats.queuedOperations} pending`
    return 'Synced'
  }

  const handleForceSync = async () => {
    try {
      await offlineSyncManager.forcSync()
      toast.success('Sync initiated')
    } catch (error) {
      toast.error('Failed to start sync')
    }
  }

  const handleRetryFailed = () => {
    offlineSyncManager.retryFailedOperations()
    toast.success('Retrying failed operations')
  }

  const handleClearCompleted = () => {
    offlineSyncManager.clearCompleted()
    toast.success('Cleared completed operations')
  }

  const handleRemoveOperation = (operationId: string) => {
    if (offlineSyncManager.removeOperation(operationId)) {
      toast.success('Operation removed')
    }
  }

  const formatOperationType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const getOperationIcon = (operation: QueuedOperation) => {
    switch (operation.status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  if (variant === 'compact') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={`gap-2 ${className}`}>
            {getStatusIcon()}
            <Badge variant={getStatusColor() as any} className="text-xs">
              {getStatusText()}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Sync Status</h4>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {stats.isOnline ? (
                  <div className="flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-green-600" />
                    Online
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <WifiOff className="h-3 w-3 text-red-600" />
                    Offline
                  </div>
                )}
              </div>
            </div>

            {stats.totalOperations > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{stats.successfulOperations} / {stats.totalOperations}</span>
                </div>
                <Progress 
                  value={stats.totalOperations > 0 ? (stats.successfulOperations / stats.totalOperations) * 100 : 0}
                  className="h-2"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Queued:</span>
                  <span className="font-medium">{stats.queuedOperations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success:</span>
                  <span className="font-medium text-green-600">{stats.successfulOperations}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Failed:</span>
                  <span className="font-medium text-red-600">{stats.failedOperations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Conflicts:</span>
                  <span className="font-medium text-orange-600">{stats.conflictOperations}</span>
                </div>
              </div>
            </div>

            {stats.lastSyncAttempt && (
              <div className="text-xs text-gray-500">
                Last sync: {formatTimestamp(stats.lastSyncAttempt)}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleForceSync} 
                size="sm" 
                disabled={!stats.isOnline || stats.isSyncing}
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {stats.isSyncing ? 'Syncing...' : 'Force Sync'}
              </Button>
              {stats.failedOperations > 0 && (
                <Button onClick={handleRetryFailed} size="sm" variant="outline">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </div>

            {operations.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium">Recent Operations</h5>
                  <Button onClick={handleClearCompleted} size="sm" variant="ghost">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {operations.slice(0, 5).map((operation) => (
                    <div key={operation.id} className="flex items-center justify-between text-xs p-1 rounded hover:bg-gray-50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getOperationIcon(operation)}
                        <span className="truncate">
                          {formatOperationType(operation.type)} {operation.entity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {operation.priority}
                        </Badge>
                        {operation.status === 'queued' && (
                          <Button
                            onClick={() => handleRemoveOperation(operation.id)}
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Full variant for dedicated sync management pages
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Offline Sync Status
          <Badge variant={getStatusColor() as any}>
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            {stats.isOnline ? (
              <>
                <Wifi className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Online</div>
                  <div className="text-sm text-gray-600">Changes sync automatically</div>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">Offline</div>
                  <div className="text-sm text-gray-600">Changes saved locally</div>
                </div>
              </>
            )}
          </div>
          <Button onClick={handleForceSync} disabled={!stats.isOnline || stats.isSyncing}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {stats.isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Sync Progress */}
        {stats.totalOperations > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <h4 className="font-medium">Sync Progress</h4>
              <span className="text-sm text-gray-600">
                {stats.successfulOperations} of {stats.totalOperations} completed
              </span>
            </div>
            <Progress 
              value={stats.totalOperations > 0 ? (stats.successfulOperations / stats.totalOperations) * 100 : 0}
              className="h-3"
            />
          </div>
        )}

        {/* Operation Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.queuedOperations}</div>
            <div className="text-sm text-blue-700">Queued</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.successfulOperations}</div>
            <div className="text-sm text-green-700">Success</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.failedOperations}</div>
            <div className="text-sm text-red-700">Failed</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.conflictOperations}</div>
            <div className="text-sm text-orange-700">Conflicts</div>
          </div>
        </div>

        {/* Operations List */}
        {operations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Operations Queue</h4>
              <div className="flex gap-2">
                <Button onClick={handleRetryFailed} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Failed
                </Button>
                <Button onClick={handleClearCompleted} size="sm" variant="outline">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Completed
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {operations.map((operation) => (
                <div key={operation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    {getOperationIcon(operation)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {formatOperationType(operation.type)} {operation.entity}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {operation.entityId} • {formatTimestamp(operation.timestamp)}
                      </div>
                      {operation.errorMessage && (
                        <div className="text-xs text-red-600 mt-1">
                          {operation.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {operation.priority}
                    </Badge>
                    <Badge variant={operation.status === 'success' ? 'default' : 'secondary'}>
                      {operation.status}
                    </Badge>
                    {operation.status === 'queued' && (
                      <Button
                        onClick={() => handleRemoveOperation(operation.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Sync Information */}
        <div className="text-sm text-gray-600 space-y-1">
          {stats.lastSyncAttempt && (
            <div>Last sync attempt: {formatTimestamp(stats.lastSyncAttempt)}</div>
          )}
          {stats.lastSuccessfulSync && (
            <div>Last successful sync: {formatTimestamp(stats.lastSuccessfulSync)}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}