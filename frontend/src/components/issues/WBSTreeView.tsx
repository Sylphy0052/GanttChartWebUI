'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Issue, WBSTreeNode as WBSTreeNodeType } from '@/types/issue';
import { useWBSTree } from '@/hooks/useWBSTree';
import WBSTreeNode from './WBSTreeNode';

interface WBSTreeViewProps {
  issues: Issue[];
  projectId: string;
  isLoading?: boolean;
  onIssueClick?: (issue: Issue) => void;
  selectedIssueId?: string;
  showControls?: boolean; // 展開/折りたたみコントロールの表示
}

/**
 * WBSツリービューコンポーネント
 * 階層構造を持つIssueをツリー形式で表示し、展開/折りたたみ機能を提供
 */
export const WBSTreeView: React.FC<WBSTreeViewProps> = ({
  issues,
  projectId,
  isLoading = false,
  onIssueClick,
  selectedIssueId,
  showControls = true,
}) => {
  const router = useRouter();
  const {
    visibleNodes,
    toggleExpand,
    expandAll,
    collapseAll,
    hasExpandableNodes,
  } = useWBSTree(issues);

  const handleIssueClick = (node: WBSTreeNodeType) => {
    if (onIssueClick) {
      onIssueClick(node);
    } else {
      router.push(`/projects/${projectId}/issues/${node.id}`);
    }
  };

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

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">WBS ツリービュー</h3>
          
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
      </div>
      
      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
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
            {visibleNodes.map(node => (
              <WBSTreeNode
                key={node.id}
                node={node}
                onToggleExpand={toggleExpand}
                onNodeClick={handleIssueClick}
                isSelected={selectedIssueId === node.id}
              />
            ))}
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
          {hasExpandableNodes && (
            <span>
              階層構造あり - クリックして展開/折りたたみ
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WBSTreeView;