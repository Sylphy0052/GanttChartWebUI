'use client';

import { useWebSocket } from '@/lib/useWebSocket';

export default function NotificationDisplay() {
  const { isConnected, notifications, latestNotification, clearNotifications } = useWebSocket();

  const getNotificationColor = (event: string) => {
    switch (event) {
      case 'issue_created':
        return 'border-green-500 bg-green-50';
      case 'issue_updated':
        return 'border-blue-500 bg-blue-50';
      case 'issue_deleted':
        return 'border-red-500 bg-red-50';
      case 'comment_created':
        return 'border-yellow-500 bg-yellow-50';
      case 'comment_updated':
        return 'border-purple-500 bg-purple-50';
      case 'comment_deleted':
        return 'border-orange-500 bg-orange-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'issue_created':
        return '➕';
      case 'issue_updated':
        return '✏️';
      case 'issue_deleted':
        return '🗑️';
      case 'comment_created':
        return '💬';
      case 'comment_updated':
        return '📝';
      case 'comment_deleted':
        return '❌';
      default:
        return '📢';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 border rounded-lg bg-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">WebSocket通知</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? '接続中' : '切断中'}
          </span>
        </div>
      </div>

      {latestNotification && (
        <div className={`p-3 border-l-4 rounded mb-4 ${getNotificationColor(latestNotification.event)}`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{getEventIcon(latestNotification.event)}</span>
            <div className="flex-1">
              <div className="font-medium text-sm mb-1">
                最新通知
              </div>
              <div className="text-sm text-gray-700 mb-1">
                {latestNotification.data.message}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(latestNotification.data.timestamp).toLocaleString()}
              </div>
              {latestNotification.data.projectId && (
                <div className="text-xs text-blue-600 mt-1">
                  プロジェクト: {latestNotification.data.projectId}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">通知履歴 ({notifications.length})</h3>
        {notifications.length > 0 && (
          <button
            onClick={clearNotifications}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            クリア
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {notifications.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-4">
            通知はありません
          </div>
        ) : (
          notifications.map((notification, index) => (
            <div
              key={index}
              className={`p-2 border rounded text-sm ${getNotificationColor(notification.event)}`}
            >
              <div className="flex items-start gap-2">
                <span>{getEventIcon(notification.event)}</span>
                <div className="flex-1">
                  <div className="text-gray-700 mb-1">
                    {notification.data.message}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(notification.data.timestamp).toLocaleString()}
                  </div>
                  {notification.data.entityType && notification.data.entityId && (
                    <div className="text-xs text-gray-600 mt-1">
                      {notification.data.entityType}: {notification.data.entityId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}