import { io, Socket } from 'socket.io-client';

export interface WebSocketNotification {
  event: 'settings_changed' | 'issue_created' | 'issue_updated' | 'issue_deleted' | 
         'comment_created' | 'comment_updated' | 'comment_deleted' |
         'issues_reordered' | 'issue_hierarchy_changed' |
         'dependency:created' | 'dependency:deleted' | 
         'schedule_adjustment' | 'optimistic_lock_error';
  data: {
    message: string;
    timestamp: string;
    projectId?: string;
    requiresReauth?: boolean;
    entityType?: 'issue' | 'comment' | 'dependency';
    entityId?: string;
    entity?: any;
    // WBS関連の追加データ
    affectedIssues?: any[];
    wbsChangeType?: 'reorder' | 'hierarchy';
    // ガント関連の追加データ
    adjustedIssues?: any[];
    dependencyId?: string;
    scheduleAdjustmentResult?: any;
    conflictInfo?: {
      conflictedEntity: string;
      conflictedVersion: number;
      currentVersion: number;
    };
  };
}

export interface WebSocketConnection {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

/**
 * WebSocket接続管理クラス
 */
class WebSocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private listeners: ((notification: WebSocketNotification) => void)[] = [];
  private connectionListeners: ((isConnected: boolean) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  connect() {
    if (this.socket?.connected) {
      return;
    }

    // WebSocket用のURLを設定
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8090';
    const backendUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    
    console.log('Connecting to WebSocket:', backendUrl);
    
    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected to:', backendUrl);
      this.isConnected = true;
      this.connectionListeners.forEach(listener => listener(true));
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.connectionListeners.forEach(listener => listener(false));
    });

    this.socket.on('connection_established', (data) => {
      console.log('Connection established:', data);
    });

    this.socket.on('notification', (notification: WebSocketNotification) => {
      console.log('Received notification:', notification);
      this.listeners.forEach(listener => listener(notification));
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionListeners.forEach(listener => listener(false));
    }
  }

  joinProject(projectId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_project', projectId);
      console.log(`Joined project room: ${projectId}`);
    }
  }

  leaveProject(projectId: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave_project', projectId);
      console.log(`Left project room: ${projectId}`);
    }
  }

  addNotificationListener(listener: (notification: WebSocketNotification) => void) {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  addConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.push(listener);
    
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  getSocket() {
    return this.socket;
  }

  getIsConnected() {
    const socketConnected = this.socket?.connected || false;
    console.log('WebSocket status check:', {
      isConnected: this.isConnected,
      socketExists: !!this.socket,
      socketConnected,
      socketReadyState: this.socket?.connected ? 'connected' : 'disconnected'
    });
    return this.isConnected && socketConnected;
  }
}

// Global WebSocket manager instance
export const webSocketManager = new WebSocketManager();