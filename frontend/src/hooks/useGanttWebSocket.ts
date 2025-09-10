'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { Issue } from '@/types/issue';
import { webSocketManager, WebSocketNotification } from '@/lib/websocket';

interface UseGanttWebSocketOptions {
  projectId: string;
  onIssuesUpdate?: (issues: Issue[]) => void;
  onDependencyChange?: (notification: WebSocketNotification) => void;
  onScheduleAdjustment?: (notification: WebSocketNotification) => void;
  onError?: (error: string) => void;
}

interface GanttWebSocketResult {
  isConnected: boolean;
  joinProject: () => void;
  leaveProject: () => void;
  lastNotification: WebSocketNotification | null;
}

/**
 * ガントチャート関連のWebSocket通知を処理するフック
 * 
 * 主な機能:
 * - 依存関係作成・削除通知の受信
 * - Issue日程変更・依存関係調整のリアルタイム反映
 * - 競合状態（楽観的排他制御エラー）の適切な処理
 * - 既存WebSocket通知システムとの統合
 * 
 * @param options - WebSocket設定オプション
 * @returns WebSocket接続状態と制御関数、最新通知
 */
export function useGanttWebSocket({
  projectId,
  onIssuesUpdate,
  onDependencyChange,
  onScheduleAdjustment,
  onError,
}: UseGanttWebSocketOptions): GanttWebSocketResult {
  const isProcessingRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());
  const [lastNotification, setLastNotification] = useState<WebSocketNotification | null>(null);

  // ガント関連通知を処理
  const handleGanttNotification = useCallback((notification: WebSocketNotification) => {
    // プロジェクトが一致しない通知は無視
    if (notification.data.projectId !== projectId) {
      return;
    }

    console.log('Received Gantt notification:', notification);
    setLastNotification(notification);

    // 自分の操作による更新から500ms以内の通知は無視（競合状態回避）
    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
    if (timeSinceLastUpdate < 500) {
      console.log('Ignoring Gantt notification too close to last update:', timeSinceLastUpdate);
      return;
    }

    // 重複処理防止
    if (isProcessingRef.current) {
      console.log('Already processing Gantt update, skipping...');
      return;
    }

    try {
      isProcessingRef.current = true;

      switch (notification.event) {
        case 'dependency:created':
          console.log('Processing dependency creation notification');
          if (onDependencyChange) {
            onDependencyChange(notification);
          }
          // 依存関係作成により日程調整が発生する可能性があるため、Issues更新も実行
          if (onIssuesUpdate && notification.data.affectedIssues) {
            onIssuesUpdate(notification.data.affectedIssues);
          }
          break;

        case 'dependency:deleted':
          console.log('Processing dependency deletion notification');
          if (onDependencyChange) {
            onDependencyChange(notification);
          }
          // 依存関係削除により制約が緩和される可能性があるため、Issues更新も実行
          if (onIssuesUpdate && notification.data.affectedIssues) {
            onIssuesUpdate(notification.data.affectedIssues);
          }
          break;

        case 'schedule_adjustment':
          console.log('Processing schedule adjustment notification');
          if (onScheduleAdjustment) {
            onScheduleAdjustment(notification);
          }
          // 日程調整結果でIssues更新
          if (onIssuesUpdate && notification.data.adjustedIssues) {
            onIssuesUpdate(notification.data.adjustedIssues);
          }
          break;

        case 'issue_updated':
          // Issue更新でstart_date/end_dateが変更された場合
          if (notification.data.entityType === 'issue' && 
              (notification.data.entity?.start_date || notification.data.entity?.end_date)) {
            console.log('Processing issue date change notification');
            if (onIssuesUpdate && notification.data.affectedIssues) {
              onIssuesUpdate(notification.data.affectedIssues);
            }
          }
          break;

        case 'optimistic_lock_error':
          // 楽観的排他制御エラーの処理
          console.warn('Optimistic lock error detected:', notification.data.message);
          if (onError) {
            onError(`競合が発生しました: ${notification.data.message}. データを再読み込みしてください。`);
          }
          // データを最新状態に更新
          if (onIssuesUpdate) {
            // Issues再取得は呼び出し元で処理
            console.log('Optimistic lock error requires data refresh');
          }
          break;

        default:
          // その他のガント関連更新
          console.log('Unhandled Gantt notification event:', notification.event);
          break;
      }
    } catch (error) {
      console.error('Error processing Gantt notification:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : 'ガント通知の処理中にエラーが発生しました');
      }
    } finally {
      // 短時間での重複処理を防ぐため、少し遅延してから解除
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    }
  }, [projectId, onIssuesUpdate, onDependencyChange, onScheduleAdjustment, onError]);

  // プロジェクトに参加
  const joinProject = useCallback(() => {
    webSocketManager.joinProject(projectId);
    console.log(`Joined Gantt WebSocket room for project: ${projectId}`);
  }, [projectId]);

  // プロジェクトから退出
  const leaveProject = useCallback(() => {
    webSocketManager.leaveProject(projectId);
    console.log(`Left Gantt WebSocket room for project: ${projectId}`);
  }, [projectId]);

  // WebSocket通知リスナーの設定
  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener(handleGanttNotification);

    // プロジェクトに自動参加
    joinProject();

    return () => {
      removeListener();
      leaveProject();
    };
  }, [handleGanttNotification, joinProject, leaveProject]);

  return {
    isConnected: webSocketManager.getIsConnected(),
    joinProject,
    leaveProject,
    lastNotification,
  };
}

/**
 * ガント関連の通知のみを監視するシンプルなフック
 * 
 * @param projectId - プロジェクトID
 * @returns 最新のガント関連通知
 */
export function useGanttNotifications(projectId: string) {
  const [latestNotification, setLatestNotification] = useState<WebSocketNotification | null>(null);

  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener((notification) => {
      if (
        notification.data.projectId === projectId &&
        [
          'dependency:created', 
          'dependency:deleted', 
          'schedule_adjustment',
          'optimistic_lock_error'
        ].includes(notification.event)
      ) {
        setLatestNotification(notification);
      }
    });

    webSocketManager.joinProject(projectId);

    return () => {
      removeListener();
      webSocketManager.leaveProject(projectId);
    };
  }, [projectId]);

  return latestNotification;
}