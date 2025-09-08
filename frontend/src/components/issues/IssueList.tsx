'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Issue, IssueStatus } from '@/types/issue';

interface IssueListProps {
  issues: Issue[];
  projectId: string;
  isLoading?: boolean;
  onIssueClick?: (issue: Issue) => void;
}

const statusConfig: Record<IssueStatus, { label: string; color: string }> = {
  open: { label: 'オープン', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: '進行中', color: 'bg-yellow-100 text-yellow-800' },
  done: { label: '完了', color: 'bg-green-100 text-green-800' },
  blocked: { label: 'ブロック', color: 'bg-red-100 text-red-800' },
};

const IssueList: React.FC<IssueListProps> = ({ 
  issues, 
  projectId, 
  isLoading = false, 
  onIssueClick 
}) => {
  const router = useRouter();

  const handleIssueClick = (issue: Issue) => {
    if (onIssueClick) {
      onIssueClick(issue);
    } else {
      router.push(`/projects/${projectId}/issues/${issue.id}`);
    }
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
  };

  const getIndentStyle = (issue: Issue, level: number = 0): React.CSSProperties => {
    return {
      paddingLeft: `${level * 24 + 16}px`,
    };
  };

  const renderTreeLines = (level: number) => {
    if (level === 0) return null;
    
    const lines = [];
    for (let i = 0; i < level; i++) {
      lines.push(
        <div
          key={i}
          className="absolute w-px h-full bg-gray-200"
          style={{ left: `${i * 24 + 16}px` }}
        />
      );
    }
    
    return lines;
  };

  const renderIssue = (issue: Issue, level: number = 0): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    
    nodes.push(
      <tr
        key={issue.id}
        onClick={() => handleIssueClick(issue)}
        className="hover:bg-gray-50 cursor-pointer transition-colors relative"
      >
        <td className="py-4 pr-4 relative" style={getIndentStyle(issue, level)}>
          {renderTreeLines(level)}
          <div className="flex items-center space-x-2">
            {issue.children && issue.children.length > 0 && (
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {issue.title}
              </div>
              {issue.description_md && (
                <div className="text-xs text-gray-500 truncate mt-1">
                  {issue.description_md.replace(/#+\s*/g, '').substring(0, 100)}
                  {issue.description_md.length > 100 && '...'}
                </div>
              )}
            </div>
          </div>
        </td>
        
        <td className="py-4 px-4 text-sm">
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              statusConfig[issue.status].color
            }`}
          >
            {statusConfig[issue.status].label}
          </span>
        </td>
        
        <td className="py-4 px-4 text-sm text-gray-900">
          {issue.assignee || '-'}
        </td>
        
        <td className="py-4 px-4 text-sm text-gray-500">
          {formatDate(issue.start_date)}
        </td>
        
        <td className="py-4 px-4 text-sm text-gray-500">
          {formatDate(issue.end_date)}
        </td>
        
        <td className="py-4 px-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${issue.progress_pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 min-w-0">
              {issue.progress_pct}%
            </span>
          </div>
        </td>
      </tr>
    );
    
    // 子要素を再帰的にレンダリング
    if (issue.children && issue.children.length > 0) {
      issue.children.forEach(child => {
        nodes.push(...renderIssue(child, level + 1));
      });
    }
    
    return nodes;
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Issue一覧</h3>
        </div>
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Issue一覧</h3>
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

  // 階層構造を構築（親が存在しないIssueのみを表示）
  const rootIssues = issues.filter(issue => !issue.parent_id);

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Issue一覧</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                タイトル
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
            {rootIssues.map(issue => renderIssue(issue))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IssueList;