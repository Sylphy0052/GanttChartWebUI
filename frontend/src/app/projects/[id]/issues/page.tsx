'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Issue, IssueFilters as IssueFiltersType } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { issuesApi, ApiError } from '@/lib/api';
import IssueList from '@/components/issues/IssueList';
import DraggableWBSTree from '@/components/issues/DraggableWBSTree';
import IssueFilters from '@/components/issues/IssueFilters';
import { useWBSWebSocket } from '@/hooks/useWBSWebSocket';
import NotificationHandler from '@/components/websocket/NotificationHandler';
import { WebSocketNotification } from '@/lib/websocket';

type ViewMode = 'list' | 'wbs';

export default function IssuesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('wbs'); // デフォルトでWBSビューを使用
  const [filters, setFilters] = useState<IssueFiltersType>({
    sortBy: 'created_at',
    sortOrder: 'desc',
    status: undefined,
    assignee: undefined,
    searchTerm: undefined,
  });

  // プロジェクト権限（実際の実装では認証情報から取得）
  const [userRole] = useState<ProjectRole>('editor');

  // Issues一覧取得
  const fetchIssues = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await issuesApi.getAll(projectId);
      setIssues(data);
    } catch (error) {
      console.error('Issues取得エラー:', error);
      if (error instanceof ApiError) {
        setError(`Issues取得に失敗しました: ${error.message}`);
      } else {
        setError('Issues取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // 初期データ取得
  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // WebSocket通知によるIssues更新のハンドリング
  const handleIssuesUpdate = useCallback((updatedIssues: Issue[]) => {
    console.log('Updating issues from WebSocket:', updatedIssues.length);
    setIssues(updatedIssues);
  }, []);

  // WebSocket通知によるエラーハンドリング
  const handleWebSocketError = useCallback((error: string) => {
    console.error('WebSocket error:', error);
    setError(error);
  }, []);

  // WBS関連のWebSocket通知処理
  const handleWBSChange = useCallback((notification: WebSocketNotification) => {
    console.log('WBS change notification received:', notification);
    
    // 通知にIssueデータが含まれている場合はそれを使用
    if (notification.data.affectedIssues) {
      handleIssuesUpdate(notification.data.affectedIssues);
    }
    // データがない場合は全体再取得（useWBSWebSocketで処理される）
  }, [handleIssuesUpdate]);

  // WebSocket接続設定
  const { isConnected } = useWBSWebSocket({
    projectId,
    onIssuesUpdate: handleIssuesUpdate,
    onError: handleWebSocketError,
  });

  // ドラッグ&ドロップ後のIssues更新コールバック
  const handleIssuesUpdateFromDrop = useCallback((updatedIssues: Issue[]) => {
    setIssues(updatedIssues);
  }, []);

  // Issue詳細画面への遷移
  const handleIssueClick = (issue: Issue) => {
    router.push(`/projects/${projectId}/issues/${issue.id}`);
  };

  // 新規Issue作成
  const handleCreateIssue = () => {
    router.push(`/projects/${projectId}/issues/create`);
  };

  // フィルター適用
  const applyFilters = (issues: Issue[]): Issue[] => {
    let filtered = [...issues];

    // 検索語句でフィルター
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(issue => 
        issue.title.toLowerCase().includes(term) ||
        (issue.description_md && issue.description_md.toLowerCase().includes(term))
      );
    }

    // ステータスでフィルター（複数選択対応）
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(issue => filters.status!.includes(issue.status));
    }

    // 担当者でフィルター（前方一致）
    if (filters.assignee) {
      const assigneeTerm = filters.assignee.toLowerCase();
      filtered = filtered.filter(issue => 
        issue.assignee && issue.assignee.toLowerCase().startsWith(assigneeTerm)
      );
    }

    return filtered;
  };

  // ソート適用
  const applySorting = (issues: Issue[]): Issue[] => {
    const sorted = [...issues];
    
    switch (filters.sortBy) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'status':
        sorted.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'assignee':
        sorted.sort((a, b) => (a.assignee || '').localeCompare(b.assignee || ''));
        break;
      case 'start_date':
        sorted.sort((a, b) => {
          const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
          const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'end_date':
        sorted.sort((a, b) => {
          const dateA = a.end_date ? new Date(a.end_date).getTime() : 0;
          const dateB = b.end_date ? new Date(b.end_date).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'created_at':
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return filters.sortOrder === 'desc' ? sorted.reverse() : sorted;
  };

  // フィルターとソートを適用したIssues
  const filteredIssues = applySorting(applyFilters(issues));

  return (
    <>
      {/* WebSocket通知ハンドラー */}
      <NotificationHandler
        projectId={projectId}
        onWBSChange={handleWBSChange}
        showToast={true}
      />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ブレッドクラム */}
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <button
                  onClick={() => router.push('/projects')}
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  プロジェクト一覧
                </button>
              </li>
              <li>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li>
                <span className="text-gray-900 font-medium">Issues</span>
              </li>
            </ol>
          </nav>

          {/* ヘッダー */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Issues</h1>
                <p className="mt-2 text-gray-600">
                  プロジェクトのタスクとIssueを管理します
                </p>
                {/* WebSocket接続状態表示 */}
                <div className="mt-2 flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-500">
                    リアルタイム更新: {isConnected ? '有効' : '無効'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* ビューモード切り替え */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex">
                  <button
                    onClick={() => setViewMode('wbs')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'wbs'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    WBSツリー
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    リスト
                  </button>
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
          </div>

          {/* フィルター */}
          <div className="mb-6">
            <IssueFilters
              filters={filters}
              onFiltersChange={setFilters}
              projectId={projectId}
            />
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-700">{error}</p>
                    <button
                      onClick={fetchIssues}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      再試行
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ローディング表示 */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">読み込み中...</span>
            </div>
          )}

          {/* Issues表示 */}
          {!isLoading && (
            <div className="bg-white rounded-lg shadow-sm">
              {viewMode === 'wbs' ? (
                <DraggableWBSTree
                  projectId={projectId}
                  issues={filteredIssues}
                  onIssueClick={handleIssueClick}
                  onIssuesUpdate={handleIssuesUpdateFromDrop}
                  userRole={userRole}
                />
              ) : (
                <IssueList
                  issues={filteredIssues}
                  onIssueClick={handleIssueClick}
                  userRole={userRole}
                />
              )}

              {/* 空のIssues表示 */}
              {filteredIssues.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    Issueが見つかりません
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    新しいIssueを作成するか、フィルター条件を変更してください
                  </p>
                  {userRole === 'editor' && (
                    <div className="mt-6">
                      <button
                        onClick={handleCreateIssue}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <svg
                          className="-ml-1 mr-2 h-5 w-5"
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
                        新規作成
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}