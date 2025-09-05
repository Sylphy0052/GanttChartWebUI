import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { NotificationMessage, SSEConnectionState } from '@/lib/sse/notifications'

export interface ToastNotification extends NotificationMessage {
  visible: boolean
  dismissed: boolean
}

export interface NotificationSettings {
  enableToasts: boolean
  enableBadges: boolean
  enableSounds: boolean
  autoCloseDuration: number
  maxVisibleToasts: number
  filterByPriority: ('low' | 'medium' | 'high' | 'critical')[]
  filterByType: ('scheduling' | 'conflict' | 'audit' | 'system')[]
}

export interface NotificationState {
  // Connection state
  connectionState: SSEConnectionState
  isConnecting: boolean
  lastError: string | null
  
  // Notifications
  notifications: NotificationMessage[]
  toasts: ToastNotification[]
  unreadCount: number
  
  // Settings
  settings: NotificationSettings
  
  // UI state
  panelOpen: boolean
  activeTab: 'all' | 'scheduling' | 'conflicts' | 'audit'
  
  // Actions
  setConnectionState: (state: SSEConnectionState) => void
  setConnecting: (connecting: boolean) => void
  setError: (error: string | null) => void
  
  addNotification: (notification: NotificationMessage) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  dismissToast: (id: string) => void
  dismissAllToasts: () => void
  removeNotification: (id: string) => void
  clearNotifications: (type?: NotificationMessage['type']) => void
  
  updateSettings: (settings: Partial<NotificationSettings>) => void
  
  setPanelOpen: (open: boolean) => void
  setActiveTab: (tab: 'all' | 'scheduling' | 'conflicts' | 'audit') => void
  
  // Computed
  getVisibleToasts: () => ToastNotification[]
  getFilteredNotifications: () => NotificationMessage[]
  getUnreadByType: (type: NotificationMessage['type']) => number
  getBadgeCount: () => number
}

const defaultSettings: NotificationSettings = {
  enableToasts: true,
  enableBadges: true,
  enableSounds: false,
  autoCloseDuration: 5000,
  maxVisibleToasts: 5,
  filterByPriority: ['low', 'medium', 'high', 'critical'],
  filterByType: ['scheduling', 'conflict', 'audit', 'system']
}

const defaultConnectionState: SSEConnectionState = {
  isConnected: false,
  retryCount: 0,
  maxRetries: 5
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      connectionState: defaultConnectionState,
      isConnecting: false,
      lastError: null,
      
      notifications: [],
      toasts: [],
      unreadCount: 0,
      
      settings: defaultSettings,
      
      panelOpen: false,
      activeTab: 'all',
      
      // Connection actions
      setConnectionState: (state) => 
        set({ connectionState: state }),
      
      setConnecting: (connecting) => 
        set({ isConnecting: connecting }),
      
      setError: (error) => 
        set({ lastError: error }),
      
      // Notification actions
      addNotification: (notification) => {
        const state = get()
        const notifications = [notification, ...state.notifications]
        const unreadCount = state.unreadCount + 1
        
        // Create toast if enabled and passes filters
        let toasts = state.toasts
        if (state.settings.enableToasts && shouldShowAsToast(notification, state.settings)) {
          const toast: ToastNotification = {
            ...notification,
            visible: true,
            dismissed: false
          }
          toasts = [toast, ...toasts.filter(t => t.visible)]
            .slice(0, state.settings.maxVisibleToasts)
        }
        
        set({
          notifications: notifications.slice(0, 1000), // Keep max 1000 notifications
          toasts,
          unreadCount
        })
        
        // Auto-close toast if configured
        if (notification.autoClose !== false) {
          const duration = notification.duration || state.settings.autoCloseDuration
          setTimeout(() => {
            get().dismissToast(notification.id)
          }, duration)
        }
      },
      
      markAsRead: (id) => {
        const state = get()
        const notification = state.notifications.find(n => n.id === id)
        if (!notification) return
        
        set({
          unreadCount: Math.max(0, state.unreadCount - 1)
        })
      },
      
      markAllAsRead: () => 
        set({ unreadCount: 0 }),
      
      dismissToast: (id) =>
        set(state => ({
          toasts: state.toasts.map(t => 
            t.id === id ? { ...t, visible: false, dismissed: true } : t
          )
        })),
      
      dismissAllToasts: () =>
        set(state => ({
          toasts: state.toasts.map(t => ({ ...t, visible: false, dismissed: true }))
        })),
      
      removeNotification: (id) =>
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id),
          toasts: state.toasts.filter(t => t.id !== id)
        })),
      
      clearNotifications: (type) =>
        set(state => ({
          notifications: type 
            ? state.notifications.filter(n => n.type !== type)
            : [],
          toasts: type 
            ? state.toasts.filter(t => t.type !== type)
            : [],
          unreadCount: type
            ? state.notifications.filter(n => n.type === type).length < state.unreadCount
              ? state.unreadCount - state.notifications.filter(n => n.type === type).length
              : 0
            : 0
        })),
      
      // Settings actions
      updateSettings: (newSettings) =>
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        })),
      
      // UI actions
      setPanelOpen: (open) => {
        set({ panelOpen: open })
        if (open) {
          // Mark all as read when panel is opened
          setTimeout(() => get().markAllAsRead(), 1000)
        }
      },
      
      setActiveTab: (tab) => 
        set({ activeTab: tab }),
      
      // Computed getters
      getVisibleToasts: () => {
        const state = get()
        return state.toasts.filter(t => t.visible && !t.dismissed)
      },
      
      getFilteredNotifications: () => {
        const state = get()
        const { settings, activeTab } = state
        
        let filtered = state.notifications
        
        // Filter by tab
        if (activeTab !== 'all') {
          const typeMap = {
            scheduling: 'scheduling',
            conflicts: 'conflict',
            audit: 'audit'
          } as const
          filtered = filtered.filter(n => n.type === typeMap[activeTab])
        }
        
        // Filter by settings
        filtered = filtered.filter(n => 
          settings.filterByType.includes(n.type) &&
          settings.filterByPriority.includes(n.priority)
        )
        
        return filtered
      },
      
      getUnreadByType: (type) => {
        const state = get()
        return state.notifications.filter(n => n.type === type).length
      },
      
      getBadgeCount: () => {
        const state = get()
        if (!state.settings.enableBadges) return 0
        
        const filteredNotifications = state.getFilteredNotifications()
        return Math.min(filteredNotifications.length, 99) // Cap at 99 for display
      }
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 100), // Persist only last 100 notifications
        settings: state.settings,
        unreadCount: state.unreadCount
      })
    }
  )
)

// Helper functions
function shouldShowAsToast(
  notification: NotificationMessage, 
  settings: NotificationSettings
): boolean {
  return (
    settings.filterByType.includes(notification.type) &&
    settings.filterByPriority.includes(notification.priority)
  )
}

// Utility hooks
export const useNotificationSettings = () => {
  const settings = useNotificationStore(state => state.settings)
  const updateSettings = useNotificationStore(state => state.updateSettings)
  return [settings, updateSettings] as const
}

export const useNotificationConnection = () => {
  const connectionState = useNotificationStore(state => state.connectionState)
  const isConnecting = useNotificationStore(state => state.isConnecting)
  const lastError = useNotificationStore(state => state.lastError)
  
  return {
    connectionState,
    isConnecting,
    lastError,
    isConnected: connectionState.isConnected
  }
}

export const useToastNotifications = () => {
  const toasts = useNotificationStore(state => state.getVisibleToasts())
  const dismissToast = useNotificationStore(state => state.dismissToast)
  const dismissAllToasts = useNotificationStore(state => state.dismissAllToasts)
  
  return {
    toasts,
    dismissToast,
    dismissAllToasts
  }
}

export const useNotificationPanel = () => {
  const panelOpen = useNotificationStore(state => state.panelOpen)
  const activeTab = useNotificationStore(state => state.activeTab)
  const notifications = useNotificationStore(state => state.getFilteredNotifications())
  const badgeCount = useNotificationStore(state => state.getBadgeCount())
  const unreadCount = useNotificationStore(state => state.unreadCount)
  
  const setPanelOpen = useNotificationStore(state => state.setPanelOpen)
  const setActiveTab = useNotificationStore(state => state.setActiveTab)
  const markAllAsRead = useNotificationStore(state => state.markAllAsRead)
  const clearNotifications = useNotificationStore(state => state.clearNotifications)
  
  return {
    panelOpen,
    activeTab,
    notifications,
    badgeCount,
    unreadCount,
    setPanelOpen,
    setActiveTab,
    markAllAsRead,
    clearNotifications
  }
}