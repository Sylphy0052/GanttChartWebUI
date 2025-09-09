'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Issue, WBSTreeNode as WBSTreeNodeType } from '@/types/issue';
import { useWBSTree } from '@/hooks/useWBSTree';
import { useIssueReorder } from '@/hooks/useIssueReorder';
import { useDragDrop, DraggableItem } from '@/hooks/useDragDrop';
import { DragPreview } from '@/components/common/DraggableWrapper';
import WBSTreeNode from './WBSTreeNode';

interface DraggableWBSTreeProps {
  issues: Issue[];
  projectId: string;
  isLoading?: boolean;
  onIssueClick?: (issue: Issue) => void;
  onIssuesUpdate?: (issues: Issue[]) => void;
  selectedIssueId?: string;
  showControls?: boolean;
  enableDragDrop?: boolean; // ドラッグ&ドロップ機能の有効/無効
}

interface DraggableWBSNode extends WBSTreeNodeType, DraggableItem {
  // DraggableItemを満たすためのid（既にWBSTreeNodeにstring型のidが存在）
}

/**
 * ドラッグ&ドロップ機能付きWBSツリービューコンポーネント
 */
export const DraggableWBSTree: React.FC<DraggableWBSTreeProps> = ({
  issues,
  projectId,
  isLoading = false,
  onIssueClick,
  onIssuesUpdate,
  selectedIssueId,
  showControls = true,
  enableDragDrop = true,
}) => {
  const router = useRouter();
  const [draggedOverId, setDraggedOverId] = useState<string | null>(null);
  const [showReorderError, setShowReorderError] = useState(false);

  const {
    visibleNodes,
    toggleExpand,
    expandAll,
    collapseAll,
    hasExpandableNodes,
  } = useWBSTree(issues);

  const {
    isReordering,
    reorderError,
    reorderByIds,
    clearError,
  } = useIssueReorder(projectId, onIssuesUpdate);

  // ドラッグ可能なノードに変換
  const draggableNodes: DraggableWBSNode[] = visibleNodes.map(node => ({
    ...node,
    // idは既にstring型で存在するのでそのまま使用
  }));

  // ドラッグ&ドロップの処理
  const handleDragEnd = useCallback(async (event: any, newItems: DraggableWBSNode[]) => {
    const { active, over } = event;
    
    if (!active || !over || active.id === over.id) {
      return;
    }

    // 同一階層チェック - visibleNodes上での同一階層チェック
    const activeNode = visibleNodes.find(node => node.id === active.id);
    const overNode = visibleNodes.find(node => node.id === over.id);
    
    if (!activeNode || !overNode) {
      return;
    }

    if (activeNode.parent_id !== overNode.parent_id) {
      setShowReorderError(true);
      return;
    }

    // 同一階層内のノードのみを対象として並び替え
    const siblings = visibleNodes.filter(node => node.parent_id === activeNode.parent_id);
    const success = await reorderByIds(siblings, active.id, over.id);
    
    if (!success && reorderError) {
      setShowReorderError(true);
    }
  }, [visibleNodes, reorderByIds, reorderError]);

  const dragDropConfig = useDragDrop(draggableNodes, {
    onDragEnd: handleDragEnd,
    onDragOver: (event) => {
      setDraggedOverId(event.over?.id as string || null);
    },
  });

  const handleIssueClick = (node: WBSTreeNodeType) => {
    if (onIssueClick) {
      onIssueClick(node);
    } else {
      router.push(`/projects/${projectId}/issues/${node.id}`);
    }
  };

  // エラー表示の自動非表示
  useEffect(() => {
    if (showReorderError) {
      const timer = setTimeout(() => {
        setShowReorderError(false);
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showReorderError, clearError]);

  // ローディング状態
  if (isLoading) {
    return (
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">WBS ツリービュー</h3>
        </div>
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 空の状態
  if (issues.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">WBS ツリービュー</h3>
        </div>
        <div className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 48 48"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0-8H5a2 2 0 00-2 2v6a2 2 0 002 2h2m0-8v8m0-8h2m-2 8h2m-2 0v4a2 2 0 002 2h2a2 2 0 002-2v-4m0 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v4a2 2 0 002 2h2"
              />
            </svg>
          </div>
          <p className="text-gray-500">
            Issueがありません。
          </p>
        </div>
      </div>
    );
  }

  const TreeContent = () => (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900">WBS ツリービュー</h3>
            {enableDragDrop && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                ドラッグ&ドロップ対応
              </span>
            )}
            {isReordering && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                並び替え中...
              </span>
            )}
          </div>
          
          {/* 展開/折りたたみコントロール */}
          {showControls && hasExpandableNodes && (
            <div className="flex items-center space-x-2">
              <button
                onClick={expandAll}
                className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                すべて展開
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={collapseAll}
                className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                すべて折りたたみ
              </button>
            </div>
          )}
        </div>
        
        {/* エラー表示 */}
        {(showReorderError || reorderError) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-700">
                {reorderError || '同一階層内でのみ並び替えが可能です'}
              </span>
              <button
                onClick={() => {
                  setShowReorderError(false);
                  clearError();
                }}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {enableDragDrop && (
                <th className="w-8 px-2 py-3"></th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-2">
                  <span>WBS</span>
                  <span>/</span>
                  <span>タイトル</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ステータス
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                担当者
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                開始日
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                終了日
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                進捗
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {draggableNodes.map(node => {
              const isDraggedOver = draggedOverId === node.id;

              return (
                <WBSTreeNode
                  key={node.id}
                  node={node}
                  onToggleExpand={toggleExpand}
                  onNodeClick={handleIssueClick}
                  isSelected={selectedIssueId === node.id}
                  enableDragHandle={enableDragDrop}
                  isDraggedOver={isDraggedOver}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* フッター情報 */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {visibleNodes.length}件 表示中 / 全{issues.reduce((acc, issue) => {
              const countIssues = (issue: Issue): number => {
                let count = 1;
                if (issue.children) {
                  count += issue.children.reduce((childAcc, child) => childAcc + countIssues(child), 0);
                }
                return count;
              };
              return acc + countIssues(issue);
            }, 0)}件
          </span>
          <div className="flex items-center space-x-4">
            {hasExpandableNodes && (
              <span>
                階層構造あり - クリックして展開/折りたたみ
              </span>
            )}
            {enableDragDrop && (
              <span className="text-blue-600">
                同一階層内でドラッグ&ドロップ可能
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ドラッグ&ドロップが有効な場合はDndContextでラップ
  if (enableDragDrop) {
    const { DndContext, SortableContext, DragOverlay } = dragDropConfig;
    
    return (
      <DndContext {...dragDropConfig.dndContextProps}>
        <SortableContext {...dragDropConfig.sortableContextProps}>
          <TreeContent />
        </SortableContext>
        <DragOverlay>
          {dragDropConfig.activeItem ? (
            <DragPreview>
              <div className="p-4 bg-white border border-gray-200 rounded-md shadow-lg">
                <div className="font-medium text-gray-900">
                  {dragDropConfig.activeItem.wbs_number} {dragDropConfig.activeItem.title}
                </div>
              </div>
            </DragPreview>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // ドラッグ&ドロップが無効な場合は通常のコンポーネント
  return <TreeContent />;
};

export default DraggableWBSTree;