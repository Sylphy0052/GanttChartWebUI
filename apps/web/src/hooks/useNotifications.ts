'use client'

import { useEffect, useRef, useCallback } from 'react'
import { 
  SSENotificationClient, 
  NotificationMessage,
  getGlobalSSEClient,
  createProjectSSEClient
} from '@/lib/sse/notifications'
import { useNotificationStore } from '@/stores/notification-store'

export interface UseNotificationsOptions {
  projectId?: string
  userId?: string
  autoConnect?: boolean
  maxRetries?: number
}

export interface UseNotificationsReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  sendMessage: (message: any) => Promise<void>
  client: SSENotificationClient
}

export const useNotifications = (options: UseNotificationsOptions = {}): UseNotificationsReturn => {
  const {
    projectId,
    userId,
    autoConnect = true,
    maxRetries = 5
  } = options

  const clientRef = useRef<SSENotificationClient | null>(null)
  const unsubscribeRefs = useRef<(() => void)[]>([])

  // Store actions
  const {
    setConnectionState,
    setConnecting,
    setError,
    addNotification
  } = useNotificationStore()

  // Get or create client
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = projectId 
        ? createProjectSSEClient(projectId, userId)
        : getGlobalSSEClient()
    }
    return clientRef.current
  }, [projectId, userId])

  // Connection management
  const connect = useCallback(async () => {
    const client = getClient()
    setConnecting(true)
    setError(null)

    try {
      await client.connect()
      console.log('[useNotifications] Connected successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      console.error('[useNotifications] Connection failed:', errorMessage)
      setError(errorMessage)
    } finally {
      setConnecting(false)
    }
  }, [getClient, setConnecting, setError])

  const disconnect = useCallback(() => {
    const client = getClient()
    client.disconnect()
    
    // Clean up subscriptions
    unsubscribeRefs.current.forEach(unsubscribe => unsubscribe())
    unsubscribeRefs.current = []
    
    console.log('[useNotifications] Disconnected')
  }, [getClient])

  const sendMessage = useCallback(async (message: any) => {
    const client = getClient()
    return client.sendMessage(message)
  }, [getClient])

  // Set up subscriptions
  useEffect(() => {
    const client = getClient()

    // Subscribe to notifications
    const unsubscribeNotifications = client.subscribe((notification: NotificationMessage) => {
      console.log('[useNotifications] Received notification:', notification)
      addNotification(notification)

      // Optional: Play sound notification
      // if (notification.priority === 'critical' || notification.priority === 'high') {
      //   playNotificationSound()
      // }
    })

    // Subscribe to connection state changes
    const unsubscribeState = client.subscribeToState((state) => {
      console.log('[useNotifications] Connection state changed:', state)
      setConnectionState(state)
    })

    // Store unsubscribe functions
    unsubscribeRefs.current = [unsubscribeNotifications, unsubscribeState]

    // Auto-connect if enabled
    if (autoConnect && !client.getState().isConnected) {
      connect()
    }

    // Cleanup on unmount
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe())
      unsubscribeRefs.current = []
    }
  }, [getClient, addNotification, setConnectionState, connect, autoConnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }
  }, [])

  // Get current state
  const client = getClient()
  const state = client.getState()

  return {
    isConnected: state.isConnected,
    isConnecting: useNotificationStore(state => state.isConnecting),
    error: useNotificationStore(state => state.lastError),
    connect,
    disconnect,
    sendMessage,
    client
  }
}

// Specialized hooks for different contexts
export const useProjectNotifications = (projectId: string, userId?: string) => {
  return useNotifications({ projectId, userId, autoConnect: true })
}

export const useGlobalNotifications = () => {
  return useNotifications({ autoConnect: true })
}

// Hook for testing notifications (development only)
export const useTestNotifications = () => {
  const { addNotification } = useNotificationStore()

  const sendTestNotification = useCallback((
    type: NotificationMessage['type'] = 'system',
    priority: NotificationMessage['priority'] = 'medium'
  ) => {
    const testNotification: NotificationMessage = {
      id: `test-${Date.now()}`,
      type,
      priority,
      title: `Test ${type} notification`,
      message: `This is a test ${priority} priority notification for ${type} events.`,
      timestamp: Date.now(),
      autoClose: true,
      duration: 5000,
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    }

    addNotification(testNotification)
  }, [addNotification])

  const sendSchedulingNotification = useCallback(() => {
    const notification: NotificationMessage = {
      id: `scheduling-${Date.now()}`,
      type: 'scheduling',
      priority: 'medium',
      title: 'Schedule calculation completed',
      message: 'Project schedule has been recalculated with updated dependencies.',
      timestamp: Date.now(),
      projectId: 'project-123',
      data: {
        calculationTime: '2.3s',
        tasksProcessed: 45,
        criticalPathLength: 12
      }
    }
    addNotification(notification)
  }, [addNotification])

  const sendConflictNotification = useCallback(() => {
    const notification: NotificationMessage = {
      id: `conflict-${Date.now()}`,
      type: 'conflict',
      priority: 'high',
      title: 'Resource conflict detected',
      message: 'Multiple tasks are assigned to the same resource during overlapping periods.',
      timestamp: Date.now(),
      projectId: 'project-123',
      autoClose: false,
      data: {
        conflictType: 'resource',
        tasksInvolved: ['task-1', 'task-2'],
        resource: 'John Doe'
      }
    }
    addNotification(notification)
  }, [addNotification])

  const sendCriticalNotification = useCallback(() => {
    const notification: NotificationMessage = {
      id: `critical-${Date.now()}`,
      type: 'system',
      priority: 'critical',
      title: 'System maintenance required',
      message: 'Critical system update will be performed in 5 minutes. Save your work.',
      timestamp: Date.now(),
      autoClose: false,
      data: {
        maintenanceWindow: '5 minutes',
        affectedServices: ['scheduling', 'reporting']
      }
    }
    addNotification(notification)
  }, [addNotification])

  return {
    sendTestNotification,
    sendSchedulingNotification,
    sendConflictNotification,
    sendCriticalNotification
  }
}

// Utility function to play notification sounds
const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/notification.mp3')
    audio.volume = 0.3
    audio.play().catch(console.warn) // Ignore errors if sound fails to play
  } catch (error) {
    console.warn('[useNotifications] Could not play notification sound:', error)
  }
}