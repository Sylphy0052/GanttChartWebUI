'use client'

export interface NotificationMessage {
  id: string
  type: 'scheduling' | 'conflict' | 'audit' | 'system'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  timestamp: number
  projectId?: string
  userId?: string
  data?: any
  autoClose?: boolean
  duration?: number
}

export interface SSEConnectionState {
  isConnected: boolean
  connectionId?: string
  lastHeartbeat?: number
  retryCount: number
  maxRetries: number
}

export type NotificationCallback = (notification: NotificationMessage) => void
export type ConnectionStateCallback = (state: SSEConnectionState) => void

export class SSENotificationClient {
  private eventSource: EventSource | null = null
  private callbacks: Set<NotificationCallback> = new Set()
  private stateCallbacks: Set<ConnectionStateCallback> = new Set()
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  
  private state: SSEConnectionState = {
    isConnected: false,
    retryCount: 0,
    maxRetries: 5
  }

  private baseUrl: string
  private projectId?: string
  private userId?: string

  constructor(baseUrl: string = '/api/sse', projectId?: string, userId?: string) {
    this.baseUrl = baseUrl
    this.projectId = projectId
    this.userId = userId
  }

  // Public API
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.eventSource) {
        this.disconnect()
      }

      try {
        const url = this.buildConnectionUrl()
        console.log('[SSE] Connecting to:', url)
        
        this.eventSource = new EventSource(url)
        this.setupEventHandlers(resolve, reject)
        
        // Connection timeout
        setTimeout(() => {
          if (!this.state.isConnected) {
            reject(new Error('SSE connection timeout'))
          }
        }, 10000)
        
      } catch (error) {
        console.error('[SSE] Connection error:', error)
        reject(error)
      }
    })
  }

  disconnect(): void {
    console.log('[SSE] Disconnecting...')
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    
    this.updateState({ 
      isConnected: false,
      connectionId: undefined,
      retryCount: 0
    })
  }

  subscribe(callback: NotificationCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  subscribeToState(callback: ConnectionStateCallback): () => void {
    this.stateCallbacks.add(callback)
    callback(this.state) // Immediately call with current state
    return () => this.stateCallbacks.delete(callback)
  }

  getState(): SSEConnectionState {
    return { ...this.state }
  }

  // Send message (for bidirectional communication if needed)
  async sendMessage(message: any): Promise<void> {
    if (!this.state.isConnected) {
      throw new Error('SSE connection not established')
    }

    try {
      const response = await fetch('/api/sse/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: this.state.connectionId,
          message
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`)
      }
    } catch (error) {
      console.error('[SSE] Send message error:', error)
      throw error
    }
  }

  // Private methods
  private buildConnectionUrl(): string {
    const params = new URLSearchParams()
    
    if (this.projectId) {
      params.append('projectId', this.projectId)
    }
    
    if (this.userId) {
      params.append('userId', this.userId)
    }
    
    params.append('timestamp', Date.now().toString())
    
    return `${this.baseUrl}?${params.toString()}`
  }

  private setupEventHandlers(resolve: () => void, reject: (error: any) => void): void {
    if (!this.eventSource) return

    let resolved = false

    this.eventSource.onopen = (event) => {
      console.log('[SSE] Connection opened', event)
      this.updateState({ 
        isConnected: true,
        retryCount: 0,
        lastHeartbeat: Date.now()
      })
      
      this.startHeartbeat()
      
      if (!resolved) {
        resolved = true
        resolve()
      }
    }

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error, event.data)
      }
    }

    this.eventSource.onerror = (event) => {
      console.error('[SSE] Connection error:', event)
      
      if (!resolved) {
        resolved = true
        reject(new Error('SSE connection failed'))
      }
      
      this.handleConnectionError()
    }

    // Custom event handlers
    this.eventSource.addEventListener('notification', (event) => {
      try {
        const notification: NotificationMessage = JSON.parse(event.data)
        this.notifyCallbacks(notification)
      } catch (error) {
        console.error('[SSE] Failed to parse notification:', error)
      }
    })

    this.eventSource.addEventListener('heartbeat', (event) => {
      this.updateState({ lastHeartbeat: Date.now() })
      console.log('[SSE] Heartbeat received')
    })

    this.eventSource.addEventListener('connection', (event) => {
      try {
        const data = JSON.parse(event.data)
        this.updateState({ connectionId: data.connectionId })
        console.log('[SSE] Connection ID:', data.connectionId)
      } catch (error) {
        console.error('[SSE] Failed to parse connection data:', error)
      }
    })
  }

  private handleMessage(data: any): void {
    console.log('[SSE] Received message:', data)
    
    // Handle different message types
    switch (data.type) {
      case 'notification':
        this.notifyCallbacks(data.payload)
        break
      case 'heartbeat':
        this.updateState({ lastHeartbeat: Date.now() })
        break
      case 'connection':
        this.updateState({ connectionId: data.connectionId })
        break
      default:
        console.warn('[SSE] Unknown message type:', data.type)
    }
  }

  private handleConnectionError(): void {
    this.updateState({ isConnected: false })
    
    if (this.state.retryCount < this.state.maxRetries) {
      this.scheduleReconnect()
    } else {
      console.error('[SSE] Max retry attempts exceeded')
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 30000)
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.state.retryCount + 1}/${this.state.maxRetries})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.updateState({ retryCount: this.state.retryCount + 1 })
      this.connect().catch(error => {
        console.error('[SSE] Reconnection failed:', error)
      })
    }, delay)
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      const lastHeartbeat = this.state.lastHeartbeat || 0
      
      // Check if connection is stale (no heartbeat for 60 seconds)
      if (now - lastHeartbeat > 60000) {
        console.warn('[SSE] Connection appears stale, reconnecting...')
        this.handleConnectionError()
      }
    }, 30000) // Check every 30 seconds
  }

  private notifyCallbacks(notification: NotificationMessage): void {
    this.callbacks.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('[SSE] Callback error:', error)
      }
    })
  }

  private updateState(updates: Partial<SSEConnectionState>): void {
    this.state = { ...this.state, ...updates }
    this.stateCallbacks.forEach(callback => {
      try {
        callback(this.state)
      } catch (error) {
        console.error('[SSE] State callback error:', error)
      }
    })
  }
}

// Singleton instance for global notifications
let globalSSEClient: SSENotificationClient | null = null

export const getGlobalSSEClient = (): SSENotificationClient => {
  if (!globalSSEClient) {
    globalSSEClient = new SSENotificationClient()
  }
  return globalSSEClient
}

// Utility function to create project-specific client
export const createProjectSSEClient = (projectId: string, userId?: string): SSENotificationClient => {
  return new SSENotificationClient('/api/sse', projectId, userId)
}

export default SSENotificationClient