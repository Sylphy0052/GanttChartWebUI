import { useEffect, useState, useCallback } from 'react';
import { webSocketManager, WebSocketNotification } from './websocket';

/**
 * WebSocket通知を受信するためのReact Hook
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(webSocketManager.getIsConnected());
  const [notifications, setNotifications] = useState<WebSocketNotification[]>([]);
  const [latestNotification, setLatestNotification] = useState<WebSocketNotification | null>(null);

  useEffect(() => {
    // 接続状態の監視
    const removeConnectionListener = webSocketManager.addConnectionListener((connected) => {
      setIsConnected(connected);
    });

    // 通知の監視
    const removeNotificationListener = webSocketManager.addNotificationListener((notification) => {
      setLatestNotification(notification);
      setNotifications(prev => [notification, ...prev.slice(0, 99)]); // 最新100件まで保持
    });

    return () => {
      removeConnectionListener();
      removeNotificationListener();
    };
  }, []);

  const joinProject = useCallback((projectId: string) => {
    webSocketManager.joinProject(projectId);
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    webSocketManager.leaveProject(projectId);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setLatestNotification(null);
  }, []);

  return {
    isConnected,
    notifications,
    latestNotification,
    joinProject,
    leaveProject,
    clearNotifications,
  };
}

/**
 * 特定のイベント種別の通知のみを監視するHook
 */
export function useWebSocketEvent(eventType: WebSocketNotification['event']) {
  const [notification, setNotification] = useState<WebSocketNotification | null>(null);

  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener((notif) => {
      if (notif.event === eventType) {
        setNotification(notif);
      }
    });

    return removeListener;
  }, [eventType]);

  return notification;
}

/**
 * Issue関連の通知を監視するHook
 */
export function useIssueNotifications() {
  const [issueNotifications, setIssueNotifications] = useState<WebSocketNotification[]>([]);

  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener((notification) => {
      if (['issue_created', 'issue_updated', 'issue_deleted'].includes(notification.event)) {
        setIssueNotifications(prev => [notification, ...prev.slice(0, 49)]); // 最新50件まで保持
      }
    });

    return removeListener;
  }, []);

  return issueNotifications;
}

/**
 * Comment関連の通知を監視するHook
 */
export function useCommentNotifications() {
  const [commentNotifications, setCommentNotifications] = useState<WebSocketNotification[]>([]);

  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener((notification) => {
      if (['comment_created', 'comment_updated', 'comment_deleted'].includes(notification.event)) {
        setCommentNotifications(prev => [notification, ...prev.slice(0, 49)]); // 最新50件まで保持
      }
    });

    return removeListener;
  }, []);

  return commentNotifications;
}