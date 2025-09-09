import { useEffect, useCallback, useRef, useState } from 'react';
import { Issue } from '@/types/issue';
import { webSocketManager, WebSocketNotification } from '@/lib/websocket';
import { issuesApi } from '@/api/issues';

interface UseWBSWebSocketOptions {
  projectId: string;
  onIssuesUpdate: (issues: Issue[]) => void;
  onError?: (error: string) => void;
}

interface WBSWebSocketResult {
  isConnected: boolean;
  joinProject: () => void;
  leaveProject: () => void;
}

/**
 * WBS関連のWebSocket通知を処理するフック
 * 
 * @param options - WebSocket設定オプション
 * @returns WebSocket接続状態と制御関数
 */
export function useWBSWebSocket({
  projectId,
  onIssuesUpdate,
  onError,
}: UseWBSWebSocketOptions): WBSWebSocketResult {
  const isProcessingRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());

  // Issues一覧を再取得する関数
  const refreshIssues = useCallback(async () => {
    if (isProcessingRef.current) {
      console.log('Already processing WBS update, skipping...');
      return;
    }

    try {
      isProcessingRef.current = true;
      lastUpdateRef.current = Date.now();
      
      console.log(`Refreshing issues for project ${projectId} due to WBS change`);
      const updatedIssues = await issuesApi.getAll(projectId);
      onIssuesUpdate(updatedIssues);
      
    } catch (error) {
      console.error('Failed to refresh issues after WBS change:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : 'Issues更新に失敗しました');
      }
    } finally {
      // 短時間での重複処理を防ぐため、少し遅延してから解除
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    }
  }, [projectId, onIssuesUpdate, onError]);

  // WBS関連の通知を処理
  const handleWBSNotification = useCallback((notification: WebSocketNotification) => {
    // 自分の操作による更新から500ms以内の通知は無視（競合状態回避）
    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
    if (timeSinceLastUpdate < 500) {
      console.log('Ignoring WBS notification too close to last update:', timeSinceLastUpdate);
      return;
    }

    console.log('Received WBS notification:', notification);

    switch (notification.event) {
      case 'issues_reordered':
        console.log('Processing issue reorder notification');
        if (notification.data.affectedIssues) {
          // バックエンドから直接受信した更新データがある場合はそれを使用
          onIssuesUpdate(notification.data.affectedIssues);
        } else {
          // データがない場合は全体を再取得
          refreshIssues();
        }
        break;

      case 'issue_hierarchy_changed':
        console.log('Processing issue hierarchy change notification');
        if (notification.data.affectedIssues) {
          // バックエンドから直接受信した更新データがある場合はそれを使用
          onIssuesUpdate(notification.data.affectedIssues);
        } else {
          // データがない場合は全体を再取得
          refreshIssues();
        }
        break;

      case 'issue_updated':
        // 通常のIssue更新もWBS番号に影響する可能性があるため処理
        if (notification.data.wbsChangeType) {
          console.log('Processing issue update with WBS impact');
          refreshIssues();
        }
        break;

      default:
        // その他のWBS関連更新
        break;
    }
  }, [refreshIssues, onIssuesUpdate]);

  // プロジェクトに参加
  const joinProject = useCallback(() => {
    webSocketManager.joinProject(projectId);
  }, [projectId]);

  // プロジェクトから退出
  const leaveProject = useCallback(() => {
    webSocketManager.leaveProject(projectId);
  }, [projectId]);

  // WebSocket通知リスナーの設定
  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener(handleWBSNotification);

    // プロジェクトに自動参加
    joinProject();

    return () => {
      removeListener();
      leaveProject();
    };
  }, [handleWBSNotification, joinProject, leaveProject]);

  return {
    isConnected: webSocketManager.getIsConnected(),
    joinProject,
    leaveProject,
  };
}

/**
 * WBS関連の通知のみを監視するシンプルなフック
 * 
 * @param projectId - プロジェクトID
 * @returns 最新のWBS関連通知
 */
export function useWBSNotifications(projectId: string) {
  const [latestNotification, setLatestNotification] = useState<WebSocketNotification | null>(null);

  useEffect(() => {
    const removeListener = webSocketManager.addNotificationListener((notification) => {
      if (
        notification.data.projectId === projectId &&
        ['issues_reordered', 'issue_hierarchy_changed'].includes(notification.event)
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