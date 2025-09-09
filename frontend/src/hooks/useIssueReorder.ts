import { useState, useCallback } from 'react';
import { Issue, WBSTreeNode } from '@/types/issue';
import { issuesApi, IssueReorderDto, ApiError } from '@/api/issues';

/**
 * Issue並び替え機能のカスタムフック
 * 同一階層内でのドラッグ&ドロップ並び替えとAPI連携を提供
 */
export function useIssueReorder(projectId: string, onIssuesUpdate?: (issues: Issue[]) => void) {
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [lastReorderTime, setLastReorderTime] = useState(0);

  /**
   * sort_orderを自動計算する
   * @param items 並び替え対象のアイテム
   * @param startOrder 開始オーダー（デフォルト: 100）
   * @param increment 増分（デフォルト: 100）
   * @returns 新しいsort_order配列
   */
  const calculateSortOrders = (
    items: (Issue | WBSTreeNode)[],
    startOrder: number = 100,
    increment: number = 100
  ): number[] => {
    return items.map((_, index) => startOrder + index * increment);
  };

  /**
   * 同一階層内での並び替えを実行
   * @param draggedNode ドラッグされたノード
   * @param targetNode ドロップ先ノード
   * @param allNodes 全ノードのリスト
   * @param insertPosition ドロップ位置（'before' | 'after'）
   * @returns 成功時はtrue、失敗時はfalse
   */
  const reorderIssues = useCallback(async (
    draggedNode: WBSTreeNode,
    targetNode: WBSTreeNode,
    allNodes: WBSTreeNode[],
    insertPosition: 'before' | 'after' = 'after'
  ): Promise<boolean> => {
    // デバウンス処理 - 500ms以内の重複リクエストを防ぐ
    const currentTime = Date.now();
    if (currentTime - lastReorderTime < 500) {
      console.log('Reorder request debounced - too frequent');
      return false;
    }
    setLastReorderTime(currentTime);

    // 既に処理中の場合はスキップ
    if (isReordering) {
      console.log('Reorder already in progress - skipping');
      return false;
    }

    setIsReordering(true);
    setReorderError(null);

    try {
      // 同一階層チェック
      if (draggedNode.parent_id !== targetNode.parent_id) {
        setReorderError('同一階層内でのみ並び替えが可能です');
        return false;
      }

      // 同じアイテムの場合はスキップ
      if (draggedNode.id === targetNode.id) {
        return true;
      }

      // 同一階層のノードを取得してソート
      const siblings = allNodes
        .filter(node => node.parent_id === draggedNode.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order);

      // ドラッグされたアイテムを除去
      const withoutDragged = siblings.filter(node => node.id !== draggedNode.id);
      
      // ターゲット位置を見つける
      const targetIndex = withoutDragged.findIndex(node => node.id === targetNode.id);
      if (targetIndex === -1) {
        setReorderError('ドロップ先が見つかりません');
        return false;
      }

      // 新しい位置にドラッグされたアイテムを挿入
      const newOrder = [...withoutDragged];
      const insertIndex = insertPosition === 'before' ? targetIndex : targetIndex + 1;
      newOrder.splice(insertIndex, 0, draggedNode);

      // 新しいsort_orderを計算
      const newSortOrders = calculateSortOrders(newOrder);

      // API送信用のデータを作成
      const reorderData: IssueReorderDto = {
        issues: newOrder.map((node, index) => ({
          id: node.id,
          sort_order: newSortOrders[index],
          version: node.version || 1,
        })),
      };

      // バックエンドAPIを呼び出し
      await issuesApi.reorder(projectId, reorderData);

      // 並び替え後、全Issueを再取得して親コンポーネントに通知
      if (onIssuesUpdate) {
        const allIssues = await issuesApi.getAll(projectId);
        onIssuesUpdate(allIssues);
      }

      return true;
    } catch (error) {
      console.error('Issue並び替えエラー:', error);
      
      if (error instanceof ApiError && error.status === 409) {
        // 楽観的排他制御エラーの場合、最新データの取得を促す
        setReorderError('データが他のユーザーによって更新されました。ページを再読み込みして最新データを取得してください。');
        
        // 親コンポーネントに最新データの取得を要求
        if (onIssuesUpdate) {
          try {
            const latestIssues = await issuesApi.getAll(projectId);
            onIssuesUpdate(latestIssues);
          } catch (fetchError) {
            console.error('最新データ取得エラー:', fetchError);
          }
        }
      } else if (error instanceof ApiError) {
        setReorderError(`並び替えに失敗しました: ${error.message}`);
      } else {
        setReorderError('並び替えに失敗しました');
      }
      
      return false;
    } finally {
      setIsReordering(false);
    }
  }, [projectId, onIssuesUpdate]);

  /**
   * 配列の順序を変更して新しいsort_orderを計算・API送信
   * @param items 並び替え対象のアイテム配列
   * @param activeId ドラッグされたアイテムのID  
   * @param overId ドロップ先アイテムのID
   * @returns 成功時はtrue、失敗時はfalse
   */
  const reorderByIds = useCallback(async (
    items: (Issue | WBSTreeNode)[],
    activeId: string,
    overId: string
  ): Promise<boolean> => {
    // デバウンス処理 - 500ms以内の重複リクエストを防ぐ
    const currentTime = Date.now();
    if (currentTime - lastReorderTime < 500) {
      console.log('Reorder request debounced - too frequent');
      return false;
    }
    setLastReorderTime(currentTime);

    // 既に処理中の場合はスキップ
    if (isReordering) {
      console.log('Reorder already in progress - skipping');
      return false;
    }

    setIsReordering(true);
    setReorderError(null);

    try {
      const activeIndex = items.findIndex(item => item.id === activeId);
      const overIndex = items.findIndex(item => item.id === overId);

      if (activeIndex === -1 || overIndex === -1) {
        setReorderError('ドラッグ対象またはドロップ先が見つかりません');
        return false;
      }

      // 同一階層チェック
      const activeItem = items[activeIndex];
      const overItem = items[overIndex];
      
      if (activeItem.parent_id !== overItem.parent_id) {
        setReorderError('同一階層内でのみ並び替えが可能です');
        return false;
      }

      // アイテムを新しい位置に移動
      const newItems = [...items];
      const [removed] = newItems.splice(activeIndex, 1);
      newItems.splice(overIndex, 0, removed);

      // 新しいsort_orderを計算
      const newSortOrders = calculateSortOrders(newItems);

      // API送信用のデータを作成
      const reorderData: IssueReorderDto = {
        issues: newItems.map((item, index) => {
          const version = item.version || 1;
          return {
            id: item.id,
            sort_order: newSortOrders[index],
            version: version,
          };
        }),
      };

      // バックエンドAPIを呼び出し
      await issuesApi.reorder(projectId, reorderData);

      // 並び替え後、全Issueを再取得して親コンポーネントに通知
      if (onIssuesUpdate) {
        const allIssues = await issuesApi.getAll(projectId);
        onIssuesUpdate(allIssues);
      }

      return true;
    } catch (error) {
      console.error('Issue並び替えエラー:', error);
      
      if (error instanceof ApiError && error.status === 409) {
        // 楽観的排他制御エラーの場合、最新データの取得を促す
        setReorderError('データが他のユーザーによって更新されました。ページを再読み込みして最新データを取得してください。');
        
        // 親コンポーネントに最新データの取得を要求
        if (onIssuesUpdate) {
          try {
            const latestIssues = await issuesApi.getAll(projectId);
            onIssuesUpdate(latestIssues);
          } catch (fetchError) {
            console.error('最新データ取得エラー:', fetchError);
          }
        }
      } else if (error instanceof ApiError) {
        setReorderError(`並び替えに失敗しました: ${error.message}`);
      } else {
        setReorderError('並び替えに失敗しました');
      }
      
      return false;
    } finally {
      setIsReordering(false);
    }
  }, [projectId, onIssuesUpdate]);

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setReorderError(null);
  }, []);

  return {
    // 状態
    isReordering,
    reorderError,
    
    // アクション
    reorderIssues,
    reorderByIds,
    clearError,
    
    // ユーティリティ
    calculateSortOrders,
  };
}