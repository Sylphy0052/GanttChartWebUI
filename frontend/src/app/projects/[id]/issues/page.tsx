'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Issue, IssueFilters as IssueFiltersType } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { issuesApi, ApiError } from '@/lib/api';
import IssueList from '@/components/issues/IssueList';
import IssueFilters from '@/components/issues/IssueFilters';

export default function IssuesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<IssueFiltersType>({
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  
  // 仮の権限設定（実際のアプリでは認証システムから取得）
  const [userRole] = useState<ProjectRole>('editor');

  const loadIssues = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await issuesApi.getAll(projectId);
      
      // 階層構造を構築
      const issueMap = new Map<string, Issue>(data.map(issue => [issue.id, { ...issue, children: [] as Issue[] }]));
      const rootIssues: Issue[] = [];
      
      data.forEach(issue => {
        const issueWithChildren = issueMap.get(issue.id)!;
        
        if (issue.parent_id) {
          const parent = issueMap.get(issue.parent_id);
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(issueWithChildren);
          } else {
            // 親が見つからない場合は、ルートレベルに追加
            rootIssues.push(issueWithChildren);
          }
        } else {
          rootIssues.push(issueWithChildren);
        }
      });
      
      setIssues(rootIssues);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`Issueの読み込みに失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to load issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadIssues();
    }
  }, [projectId]);

  const handleCreateIssue = () => {
    router.push(`/projects/${projectId}/issues/create`);
  };

  const handleIssueClick = (issue: Issue) => {
    router.push(`/projects/${projectId}/issues/${issue.id}/edit`);
  };

  // フィルターされたIssueリストを計算
  const filteredIssues = useMemo(() => {
    const applyFiltersToIssues = (issueList: Issue[]): Issue[] => {
      let result = [...issueList];

      // ステータス フィルター
      if (filters.status && filters.status.length > 0) {
        const filterByStatus = (issue: Issue): boolean => {
          if (filters.status!.includes(issue.status)) return true;
          if (issue.children) {
            return issue.children.some(child => filterByStatus(child));
          }
          return false;
        };
        result = result.filter(filterByStatus);
      }

      // 担当者 フィルター
      if (filters.assignee) {
        const assigneeFilter = filters.assignee.toLowerCase();
        const filterByAssignee = (issue: Issue): boolean => {
          if (issue.assignee && issue.assignee.toLowerCase().includes(assigneeFilter)) {
            return true;
          }
          if (issue.children) {
            return issue.children.some(child => filterByAssignee(child));
          }
          return false;
        };
        result = result.filter(filterByAssignee);
      }

      // ソート（ルートレベルのIssueのみ）
      if (filters.sortBy) {
        result.sort((a, b) => {
          let aValue: any = a[filters.sortBy!];
          let bValue: any = b[filters.sortBy!];

          // 日付の場合は Date オブジェクトに変換
          if (filters.sortBy!.includes('date') || filters.sortBy!.includes('_at')) {
            aValue = aValue ? new Date(aValue) : new Date(0);
            bValue = bValue ? new Date(bValue) : new Date(0);
          }

          // 文字列の場合は小文字で比較
          if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue || '').toLowerCase();
          }

          if (aValue < bValue) {
            return filters.sortOrder === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return filters.sortOrder === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }

      return result;
    };

    return applyFiltersToIssues(issues);
  }, [issues, filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Issue管理</h1>
              <p className="mt-2 text-gray-600">
                プロジェクトのIssueを管理・追跡できます
              </p>
            </div>
            
            {userRole === 'editor' && (
              <button
                onClick={handleCreateIssue}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>新規作成</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* フィルター */}
          <IssueFilters
            filters={filters}
            onFiltersChange={setFilters}
          />

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-400 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-red-700">{error}</p>
                  <button
                    onClick={loadIssues}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    再試行
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Issue一覧 */}
          <IssueList
            issues={filteredIssues}
            projectId={projectId}
            isLoading={isLoading}
            onIssueClick={handleIssueClick}
          />

          {/* 統計情報 */}
          {!isLoading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500">総Issue数</div>
                <div className="text-2xl font-bold text-gray-900">
                  {issues.length}
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500">オープン</div>
                <div className="text-2xl font-bold text-blue-600">
                  {issues.filter(issue => issue.status === 'open').length}
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500">進行中</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {issues.filter(issue => issue.status === 'in_progress').length}
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500">完了</div>
                <div className="text-2xl font-bold text-green-600">
                  {issues.filter(issue => issue.status === 'done').length}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: 'Issue管理 - Gantt Chart Web UI',
    description: 'プロジェクトのIssue一覧ページ',
  };
}