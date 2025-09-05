'use client'

import React, { useEffect, useState } from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { ToastNotification } from '@/stores/notification-store'

interface ToastProps {
  notification: ToastNotification
  onDismiss: (id: string) => void
  position?: 'top' | 'bottom'
  index?: number
}

const priorityConfig = {
  low: {
    icon: InformationCircleIcon,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-800'
  },
  medium: {
    icon: InformationCircleIcon,
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    iconColor: 'text-gray-600',
    textColor: 'text-gray-800'
  },
  high: {
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800'
  },
  critical: {
    icon: XCircleIcon,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    textColor: 'text-red-800'
  }
}

const typeConfig = {
  scheduling: {
    icon: '📊',
    label: 'Scheduling'
  },
  conflict: {
    icon: '⚠️',
    label: 'Conflict'
  },
  audit: {
    icon: '📋',
    label: 'Audit'
  },
  system: {
    icon: '⚙️',
    label: 'System'
  }
}

export const Toast: React.FC<ToastProps> = ({ 
  notification, 
  onDismiss, 
  position = 'top',
  index = 0 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const config = priorityConfig[notification.priority]
  const typeInfo = typeConfig[notification.type]
  const IconComponent = config.icon

  useEffect(() => {
    // Entry animation
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      onDismiss(notification.id)
    }, 200) // Match exit animation duration
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit'
    })
  }

  const positionClasses = position === 'top' 
    ? `top-4 ${4 + index * 80}px` 
    : `bottom-4 ${4 + index * 80}px`

  return (
    <div 
      className={`
        fixed right-4 z-50 w-96 max-w-sm transition-all duration-300 ease-in-out
        ${positionClasses}
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
      `}
      style={{ 
        [position]: `${4 + index * 80}px`
      }}
    >
      <div 
        className={`
          relative rounded-lg border shadow-lg p-4
          ${config.bgColor} ${config.borderColor}
          ${isExiting ? 'animate-pulse' : ''}
        `}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className={`
            absolute top-2 right-2 p-1 rounded-full hover:bg-white/50 transition-colors
            ${config.iconColor}
          `}
          aria-label="Dismiss notification"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start space-x-3 pr-6">
          {/* Icon */}
          <div className="flex-shrink-0">
            <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium">
                {typeInfo.icon} {typeInfo.label}
              </span>
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-medium
                ${notification.priority === 'critical' 
                  ? 'bg-red-100 text-red-800' 
                  : notification.priority === 'high'
                  ? 'bg-amber-100 text-amber-800'
                  : notification.priority === 'medium'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-blue-100 text-blue-800'
                }
              `}>
                {notification.priority.toUpperCase()}
              </span>
            </div>

            {/* Title */}
            <h4 className={`text-sm font-semibold ${config.textColor} leading-tight`}>
              {notification.title}
            </h4>

            {/* Message */}
            <p className={`text-sm ${config.textColor} mt-1 leading-relaxed`}>
              {notification.message}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span>
                {formatTimestamp(notification.timestamp)}
              </span>
              
              {notification.projectId && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  Project: {notification.projectId.slice(0, 8)}
                </span>
              )}
            </div>

            {/* Action data preview */}
            {notification.data && (
              <div className="mt-3 p-2 bg-white/50 rounded text-xs">
                <pre className="text-gray-600 overflow-hidden text-ellipsis">
                  {JSON.stringify(notification.data, null, 2).slice(0, 100)}
                  {JSON.stringify(notification.data, null, 2).length > 100 && '...'}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar (for auto-close) */}
        {notification.autoClose !== false && (
          <ToastProgressBar 
            duration={notification.duration || 5000}
            onComplete={handleDismiss}
            paused={isExiting}
            priority={notification.priority}
          />
        )}
      </div>
    </div>
  )
}

interface ToastProgressBarProps {
  duration: number
  onComplete: () => void
  paused: boolean
  priority: ToastNotification['priority']
}

const ToastProgressBar: React.FC<ToastProgressBarProps> = ({ 
  duration, 
  onComplete, 
  paused,
  priority 
}) => {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (paused) return

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (duration / 100))
        if (newProgress <= 0) {
          clearInterval(interval)
          onComplete()
          return 0
        }
        return newProgress
      })
    }, 100)

    return () => clearInterval(interval)
  }, [duration, onComplete, paused])

  const barColor = priority === 'critical' 
    ? 'bg-red-400' 
    : priority === 'high'
    ? 'bg-amber-400'
    : priority === 'medium'
    ? 'bg-gray-400'
    : 'bg-blue-400'

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
      <div 
        className={`h-full transition-all duration-100 ease-linear ${barColor}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default Toast