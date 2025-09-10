'use client';

import { useEffect, useState } from 'react';
import { WebSocketNotification } from '@/lib/websocket';
import { useGanttWebSocket } from '@/hooks/useGanttWebSocket';
import { Issue } from '@/types/issue';

interface GanttNotificationHandlerProps {
  projectId: string;
  onIssuesUpdate?: (issues: Issue[]) => void;
  onGanttUpdate?: () => void;
  onError?: (error: string) => void;
  showToast?: boolean;
}

/**
 * ガントチャート専用のWebSocket通知ハンドラーコンポーネント
 * 
 * 機能:
 * - 依存関係作成・削除のSocket.IO通知受信
 * - Issue日程変更・依存関係調整のリアルタイム反映
 * - 受信通知によるガントチャートUI即座更新
 * - 競合状態（楽観的排他制御エラー）の適切な処理
 * - 通知データ構造定義（dependency, schedule_adjustment）
 * - 既存WebSocket通知システムとの統合
 */
export default function GanttNotificationHandler({
  projectId,
  onIssuesUpdate,
  onGanttUpdate,
  onError,
  showToast = true,
}: GanttNotificationHandlerProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');

  // ガントチャート専用のWebSocket接続
  const { isConnected, lastNotification } = useGanttWebSocket({
    projectId,
    onIssuesUpdate,
    onDependencyChange: (notification) => {
      console.log('Dependency change notification received:', notification);
      
      // ガントチャートの依存関係線を更新
      if (onGanttUpdate) {
        onGanttUpdate();
      }

      // トーストメッセージ表示
      if (showToast) {
        const message = getDependencyToastMessage(notification);
        showToastMessage(message, 'success');
      }
    },
    onScheduleAdjustment: (notification) => {
      console.log('Schedule adjustment notification received:', notification);
      
      // ガントチャートのタスクバー位置を更新
      if (onGanttUpdate) {
        onGanttUpdate();
      }

      // トーストメッセージ表示
      if (showToast) {
        const message = getScheduleAdjustmentToastMessage(notification);
        showToastMessage(message, 'success');
      }
    },
    onError: (error) => {
      console.error('Gantt WebSocket error:', error);
      
      if (onError) {
        onError(error);
      }

      // エラートーストメッセージ表示
      if (showToast) {
        showToastMessage(error, 'error');
      }
    },
  });

  // トーストメッセージの表示
  const showToastMessage = (message: string, type: 'success' | 'warning' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    
    // 3秒後にトーストを非表示
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 依存関係通知のトーストメッセージ生成
  const getDependencyToastMessage = (notification: WebSocketNotification): string => {
    switch (notification.event) {
      case 'dependency:created':
        return '🔗 依存関係が作成されました';
      case 'dependency:deleted':
        return '❌ 依存関係が削除されました';
      default:
        return '🔄 依存関係が更新されました';
    }
  };

  // 日程調整通知のトーストメッセージ生成
  const getScheduleAdjustmentToastMessage = (notification: WebSocketNotification): string => {
    const adjustedCount = notification.data.adjustedIssues?.length || 0;
    if (adjustedCount > 0) {
      return `📅 ${adjustedCount}個のタスクの日程が自動調整されました`;
    }
    return '📅 依存関係に基づいて日程が調整されました';
  };

  // 楽観的排他制御エラーの処理
  useEffect(() => {
    if (lastNotification?.event === 'optimistic_lock_error') {
      console.warn('Optimistic lock error detected, showing warning');
      if (showToast) {
        showToastMessage(
          '⚠️ データが他のユーザーによって変更されました。画面を更新してください。',
          'warning'
        );
      }
    }
  }, [lastNotification, showToast]);

  // トーストメッセージの表示
  if (showToast && toastMessage) {
    const toastColors = {
      success: {
        bg: 'bg-green-50 border-green-200',
        text: 'text-green-900',
        icon: '✅',
      },
      warning: {
        bg: 'bg-yellow-50 border-yellow-200',
        text: 'text-yellow-900',
        icon: '⚠️',
      },
      error: {
        bg: 'bg-red-50 border-red-200',
        text: 'text-red-900',
        icon: '❌',
      },
    };

    const colors = toastColors[toastType];

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className={`${colors.bg} border rounded-lg shadow-lg p-4 max-w-sm`}>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className={`text-sm font-medium ${colors.text}`}>
              ガントチャート更新
            </span>
          </div>
          <div className={`mt-2 text-sm ${colors.text} flex items-center space-x-2`}>
            <span>{colors.icon}</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      </div>
    );
  }

  // 開発環境では接続状態のインジケーターを表示
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-16 right-4 z-40">
        <div className={`px-2 py-1 text-xs rounded ${
          isConnected 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          Gantt WS: {isConnected ? '接続' : '切断'}
        </div>
      </div>
    );
  }

  return null;
}

/**
 * ガント専用の軽量通知ハンドラー（トースト非表示）
 */
export function GanttNotificationHandlerSilent({
  projectId,
  onIssuesUpdate,
  onGanttUpdate,
  onError,
}: Omit<GanttNotificationHandlerProps, 'showToast'>) {
  return (
    <GanttNotificationHandler
      projectId={projectId}
      onIssuesUpdate={onIssuesUpdate}
      onGanttUpdate={onGanttUpdate}
      onError={onError}
      showToast={false}
    />
  );
}