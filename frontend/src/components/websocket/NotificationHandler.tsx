'use client';

import { useEffect, useState } from 'react';
import { WebSocketNotification } from '@/lib/websocket';
import { useWebSocket } from '@/lib/useWebSocket';

interface NotificationHandlerProps {
  projectId: string;
  onWBSChange?: (notification: WebSocketNotification) => void;
  showToast?: boolean;
}

/**
 * WebSocket通知を処理し、適切なUI更新やトーストを表示するコンポーネント
 */
export default function NotificationHandler({
  projectId,
  onWBSChange,
  showToast = false,
}: NotificationHandlerProps) {
  const { isConnected, latestNotification, joinProject, leaveProject } = useWebSocket();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // クライアント側でのみマウント状態を更新
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // プロジェクト参加/退出の制御
  useEffect(() => {
    if (isConnected && projectId) {
      joinProject(projectId);
    }
    
    return () => {
      if (projectId) {
        leaveProject(projectId);
      }
    };
  }, [isConnected, projectId, joinProject, leaveProject]);

  // 通知処理
  useEffect(() => {
    if (!latestNotification || latestNotification.data.projectId !== projectId) {
      return;
    }

    const notification = latestNotification;
    console.log('Processing notification in NotificationHandler:', notification);

    // WBS関連の通知処理
    if (['issues_reordered', 'issue_hierarchy_changed'].includes(notification.event)) {
      console.log('WBS change detected, calling onWBSChange');
      if (onWBSChange) {
        onWBSChange(notification);
      }

      // トースト表示
      if (showToast) {
        const message = getToastMessage(notification);
        setToastMessage(message);
        
        // 3秒後にトーストを非表示
        setTimeout(() => {
          setToastMessage(null);
        }, 3000);
      }
    }

    // その他のIssue関連通知も処理
    else if (['issue_created', 'issue_updated', 'issue_deleted'].includes(notification.event)) {
      if (showToast) {
        const message = getToastMessage(notification);
        setToastMessage(message);
        
        setTimeout(() => {
          setToastMessage(null);
        }, 3000);
      }
    }
  }, [latestNotification, projectId, onWBSChange, showToast]);

  // 通知メッセージの生成
  const getToastMessage = (notification: WebSocketNotification): string => {
    switch (notification.event) {
      case 'issues_reordered':
        return '🔄 Issueの並び順が更新されました';
      case 'issue_hierarchy_changed':
        return '🌳 Issue階層が変更されました';
      case 'issue_created':
        return '✅ 新しいIssueが作成されました';
      case 'issue_updated':
        return '📝 Issueが更新されました';
      case 'issue_deleted':
        return '🗑️ Issueが削除されました';
      case 'comment_created':
        return '💬 新しいコメントが追加されました';
      case 'comment_updated':
        return '✏️ コメントが更新されました';
      case 'comment_deleted':
        return '❌ コメントが削除されました';
      default:
        return notification.data.message;
    }
  };

  // トーストメッセージを表示
  if (showToast && toastMessage) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium text-gray-900">
              リアルタイム更新
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-700">
            {toastMessage}
          </div>
        </div>
      </div>
    );
  }

  // 接続状態のインジケーター（デバッグ用、通常は非表示）
  // クライアント側でのみ表示（Hydrationエラー防止）
  if (process.env.NODE_ENV === 'development' && isMounted) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className={`px-2 py-1 text-xs rounded ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          WS: {isConnected ? '接続' : '切断'}
        </div>
      </div>
    );
  }

  return null;
}

/**
 * WBS専用の通知ハンドラー（軽量版）
 */
export function WBSNotificationHandler({
  projectId,
  onWBSChange,
}: {
  projectId: string;
  onWBSChange: (notification: WebSocketNotification) => void;
}) {
  return (
    <NotificationHandler
      projectId={projectId}
      onWBSChange={onWBSChange}
      showToast={false}
    />
  );
}