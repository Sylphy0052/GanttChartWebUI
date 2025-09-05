'use client'

import React, { useEffect, useState } from 'react'
import { 
  BellIcon,
  Cog6ToothIcon,
  TrashIcon,
  XMarkIcon,
  WifiIcon,
  SignalSlashIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useNotificationPanel, useNotificationConnection } from '@/stores/notification-store'
import { NotificationMessage } from '@/lib/sse/notifications'
import { Button } from '@/components/ui/button'

interface NotificationCenterProps {
  className?: string
  position?: 'left' | 'right'
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  className = '',
  position = 'right'
}) => {
  const {
    panelOpen,
    activeTab,
    notifications,
    badgeCount,
    unreadCount,
    setPanelOpen,
    setActiveTab,
    markAllAsRead,
    clearNotifications
  } = useNotificationPanel()

  const { isConnected, isConnecting, lastError } = useNotificationConnection()

  const [showSettings, setShowSettings] = useState(false)

  const togglePanel = () => {
    setPanelOpen(!panelOpen)
  }

  const positionClasses = position === 'right' 
    ? 'right-0' 
    : 'left-0'

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        onClick={togglePanel}
        className={`
          relative p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 
          transition-colors ${panelOpen ? 'bg-gray-100' : ''}
        `}
        title="Notifications"
      >
        <BellIcon className="w-5 h-5 text-gray-600" />
        
        {/* Badge */}
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}

        {/* Connection status indicator */}
        <div className={`
          absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white
          ${isConnected ? 'bg-green-400' : isConnecting ? 'bg-yellow-400' : 'bg-red-400'}
        `} />
      </button>

      {/* Notification Panel */}
      {panelOpen && (
        <div className={`
          absolute top-full mt-2 w-96 bg-white rounded-lg border border-gray-200 
          shadow-xl z-50 ${positionClasses}
        `}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
              </button>
              
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Close"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Connection Status */}
          <ConnectionStatus 
            isConnected={isConnected} 
            isConnecting={isConnecting} 
            error={lastError} 
          />

          {/* Settings Panel */}
          {showSettings && (
            <NotificationSettings onClose={() => setShowSettings(false)} />
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <Tab
              active={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              count={notifications.length}
            >
              All
            </Tab>
            <Tab
              active={activeTab === 'scheduling'}
              onClick={() => setActiveTab('scheduling')}
              count={notifications.filter(n => n.type === 'scheduling').length}
            >
              📊 Schedule
            </Tab>
            <Tab
              active={activeTab === 'conflicts'}
              onClick={() => setActiveTab('conflicts')}
              count={notifications.filter(n => n.type === 'conflict').length}
            >
              ⚠️ Conflicts
            </Tab>
            <Tab
              active={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              count={notifications.filter(n => n.type === 'audit').length}
            >
              📋 Audit
            </Tab>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-3 bg-gray-50 text-sm">
            <button
              onClick={markAllAsRead}
              className="text-blue-600 hover:text-blue-800 font-medium"
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
            
            <button
              onClick={() => clearNotifications(activeTab === 'all' ? undefined : 
                activeTab === 'scheduling' ? 'scheduling' :
                activeTab === 'conflicts' ? 'conflict' : 'audit'
              )}
              className="text-red-600 hover:text-red-800 font-medium flex items-center space-x-1"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Clear {activeTab}</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <BellIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface TabProps {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}

const Tab: React.FC<TabProps> = ({ active, onClick, count, children }) => (
  <button
    onClick={onClick}
    className={`
      flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors
      ${active 
        ? 'border-blue-500 text-blue-600 bg-blue-50' 
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }
    `}
  >
    <div className="flex items-center justify-center space-x-1">
      <span>{children}</span>
      {count > 0 && (
        <span className={`
          text-xs px-1.5 py-0.5 rounded-full
          ${active ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}
        `}>
          {count}
        </span>
      )}
    </div>
  </button>
)

interface ConnectionStatusProps {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  isConnected, 
  isConnecting, 
  error 
}) => {
  if (isConnected) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-green-50 text-green-700 text-sm border-b border-green-100">
        <WifiIcon className="w-4 h-4" />
        <span>Connected - Real-time notifications active</span>
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-yellow-50 text-yellow-700 text-sm border-b border-yellow-100">
        <ClockIcon className="w-4 h-4 animate-spin" />
        <span>Connecting...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-700 text-sm border-b border-red-100">
      <SignalSlashIcon className="w-4 h-4" />
      <div className="flex-1">
        <span>Disconnected</span>
        {error && (
          <p className="text-xs mt-1 text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}

interface NotificationItemProps {
  notification: NotificationMessage
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getPriorityColor = (priority: NotificationMessage['priority']) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50'
      case 'high': return 'border-l-amber-500 bg-amber-50'
      case 'medium': return 'border-l-gray-500 bg-gray-50'
      case 'low': return 'border-l-blue-500 bg-blue-50'
    }
  }

  const getTypeIcon = (type: NotificationMessage['type']) => {
    switch (type) {
      case 'scheduling': return '📊'
      case 'conflict': return '⚠️'
      case 'audit': return '📋'
      case 'system': return '⚙️'
    }
  }

  return (
    <div className={`
      border-l-4 p-4 hover:bg-gray-50 transition-colors
      ${getPriorityColor(notification.priority)}
    `}>
      <div className="flex items-start space-x-3">
        <span className="text-lg">{getTypeIcon(notification.type)}</span>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {notification.title}
            </h4>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatTimestamp(notification.timestamp)}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 leading-relaxed">
            {notification.message}
          </p>
          
          {notification.data && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(notification.data, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
            <span className={`
              px-2 py-1 rounded-full font-medium
              ${notification.priority === 'critical' ? 'bg-red-100 text-red-700' :
                notification.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                notification.priority === 'medium' ? 'bg-gray-100 text-gray-700' :
                'bg-blue-100 text-blue-700'
              }
            `}>
              {notification.priority.toUpperCase()}
            </span>
            
            {notification.projectId && (
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Project: {notification.projectId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface NotificationSettingsProps {
  onClose: () => void
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  // This would contain settings UI - simplified for now
  return (
    <div className="p-4 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Settings</h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3 text-sm">
        <label className="flex items-center space-x-3">
          <input type="checkbox" className="rounded" defaultChecked />
          <span>Enable toast notifications</span>
        </label>
        
        <label className="flex items-center space-x-3">
          <input type="checkbox" className="rounded" defaultChecked />
          <span>Show badge count</span>
        </label>
        
        <label className="flex items-center space-x-3">
          <input type="checkbox" className="rounded" />
          <span>Enable sound alerts</span>
        </label>
      </div>
    </div>
  )
}

export default NotificationCenter