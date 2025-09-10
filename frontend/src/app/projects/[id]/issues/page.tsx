'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Issue, IssueFilters as IssueFiltersType } from '@/types/issue';
import { Project, ProjectRole } from '@/types/project';
import { issuesApi, ApiError } from '@/lib/api';
import IssueList from '@/components/issues/IssueList';
import DraggableWBSTree from '@/components/issues/DraggableWBSTree';
import GanttChart from '@/components/gantt/GanttChart';
import IssueFilters from '@/components/issues/IssueFilters';
import { useWBSWebSocket } from '@/hooks/useWBSWebSocket';
import NotificationHandler from '@/components/websocket/NotificationHandler';
import { WebSocketNotification } from '@/lib/websocket';

type ViewMode = 'list' | 'wbs' | 'gantt';

export default function IssuesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [userRole, setUserRole] = useState<ProjectRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('wbs'); // デフォルトでWBSビューを使用
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filters, setFilters] = useState<IssueFiltersType>({
    sortBy: 'created_at',
    sortOrder: 'desc',
    status: 'all',
    assignee: 'all',
    searchTerm: '',
  });

  // WebSocket接続
  const { isConnected: wsConnected } = useWBSWebSocket(projectId, (notification: WebSocketNotification) => {
    // WebSocket通知を受信したときの処理
    console.log('WebSocket notification received:', notification);
    
    // データが変更された場合は一覧を更新
    if (notification.type === 'issue_updated' || 
        notification.type === 'issue_created' || 
        notification.type === 'issue_deleted') {
      loadIssues();
    }
  });

  // Issues一覧取得
  const loadIssues = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await issuesApi.getByProject(projectId);
      setIssues(data.issues || data); // APIレスポンス形式に柔軟に対応

      // user_roleも一緒に取得される場合
      if (data.user_role) {
        setUserRole(data.user_role);
      }
    } catch (error) {
      console.error('Issues取得エラー:', error);
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setError('プロジェクトが見つかりません');
        } else if (error.status === 403) {
          setError('このプロジェクトにアクセスする権限がありません');
        } else {
          setError(`Issues取得に失敗しました: ${error.message}`);
        }
      } else {
        setError('Issues取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // 初期データ取得
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  // フィルター変更
  const handleFiltersChange = (newFilters: IssueFiltersType) => {
    setFilters(newFilters);
  };

  // Issue詳細画面へのナビゲーション
  const handleIssueClick = (issue: Issue) => {
    router.push(`/projects/${projectId}/issues/${issue.id}`);
  };

  // WBSツリーからのIssues更新ハンドラー（ドラッグ&ドロップ）
  const handleIssuesUpdateFromDrop = useCallback((updatedIssues: Issue[]) => {
    setIssues(updatedIssues);
  }, []);

  // Issue作成画面へのナビゲーション
  const handleCreateIssue = () => {
    router.push(`/projects/${projectId}/issues/create`);
  };

  // ガント統合ページへのナビゲーション
  const handleGanttLayoutPage = () => {
    router.push(`/projects/${projectId}/gantt`);
  };

  // ガントチャートからのIssue選択
  const handleGanttTaskSelect = useCallback((issue: Issue | null) => {
    setSelectedIssue(issue);
  }, []);

  // ガントチャートからのIssue変更
  const handleGanttTaskChange = useCallback(async (issueId: string, changes: Partial<Issue>) => {
    try {
      // 楽観ロック用にversionを取得
      const currentIssue = issues.find(i => i.id === issueId);
      if (!currentIssue) return;

      // API呼び出し
      const updatedIssue = await issuesApi.update(issueId, {
        ...changes,
        version: currentIssue.version, // 楽観ロック
      });

      // ローカル状態更新
      setIssues(prev => prev.map(i => i.id === issueId ? updatedIssue : i));
      
    } catch (error) {
      console.error('Issue更新エラー:', error);
      if (error instanceof ApiError) {
        setError(`Issue更新に失敗しました: ${error.message}`);
      } else {
        setError('Issue更新に失敗しました');
      }
    }
  }, [issues]);

  // フィルター適用
  const applyFilters = (issues: Issue[]): Issue[] => {
    let filtered = [...issues];

    // ステータスフィルター
    if (filters.status !== 'all') {
      filtered = filtered.filter(issue => issue.status === filters.status);
    }

    // 担当者フィルター
    if (filters.assignee !== 'all') {
      filtered = filtered.filter(issue => issue.assignee === filters.assignee);
    }

    // 検索フィルター
    if (filters.searchTerm.trim()) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(issue =>
        issue.title.toLowerCase().includes(searchTerm) ||
        (issue.description_md && issue.description_md.toLowerCase().includes(searchTerm)) ||
        (issue.assignee && issue.assignee.toLowerCase().includes(searchTerm)) ||
        (issue.wbs_number && issue.wbs_number.toLowerCase().includes(searchTerm))
      );
    }

    // ソート
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sortBy) {
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'assignee':
          aValue = a.assignee || '';
          bValue = b.assignee || '';
          break;
        case 'start_date':
          aValue = a.start_date ? new Date(a.start_date).getTime() : 0;
          bValue = b.start_date ? new Date(b.start_date).getTime() : 0;
          break;
        case 'end_date':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0;
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0;
          break;
        case 'progress_pct':
          aValue = a.progress_pct;
          bValue = b.progress_pct;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const filteredIssues = applyFilters(issues);

  // エラー状態
  if (error) {
    return (
      <>
        <NotificationHandler />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">エラー</h3>
                <div className="mt-2 text-sm text-gray-500">
                  {error}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                再試行
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NotificationHandler />
      
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/projects')}
                  className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  プロジェクト一覧に戻る
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Issues</h1>
              </div>
              
              {/* 接続状態とプロジェクト情報 */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-xs text-gray-500">
                    {wsConnected ? 'リアルタイム同期中' : '接続中...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* フィルター・ビュー切り替え・操作ボタン */}
          <div className="mb-6 space-y-4">
            {/* フィルター */}
            <IssueFilters
              filters={filters}
              onChange={handleFiltersChange}
              availableAssignees={[...new Set(issues.map(issue => issue.assignee).filter(Boolean))]}
            />
            
            {/* ビュー切り替えと操作ボタン */}
            <div className="flex items-center justify-between">
              {/* ビュー切り替え */}
              <div className="flex items-center space-x-4">
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
                    onClick={() => setViewMode('gantt')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'gantt'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ガント
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

                {/* ガント統合ページへのリンク */}
                <button
                  onClick={handleGanttLayoutPage}
                  className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <span>ガント統合レイアウト</span>
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
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>新規Issue作成</span>
                </button>
              )}
            </div>

            {/* 統計情報 */}
            <div className="text-sm text-gray-600 flex items-center space-x-6">
              <span>全{issues.length}件</span>
              <span>表示中{filteredIssues.length}件</span>
              {filteredIssues.length !== issues.length && (
                <span className="text-blue-600">フィルタ適用中</span>
              )}
              {viewMode === 'gantt' && filteredIssues.some(issue => !issue.start_date || !issue.end_date) && (
                <span className="text-yellow-600">
                  ⚠ 開始日・終了日未設定のIssueがあります
                </span>
              )}
            </div>
          </div>

          {/* Issues表示 */}
          {!isLoading && (
            <div className="bg-white rounded-lg shadow-sm">
              {viewMode === 'wbs' && (
                <DraggableWBSTree
                  projectId={projectId}
                  issues={filteredIssues}
                  isLoading={isLoading}
                  onIssuesUpdate={handleIssuesUpdateFromDrop}
                  userRole={userRole}
                />
              )}

              {viewMode === 'gantt' && (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">ガントチャート</h2>
                    {selectedIssue && (
                      <div className="text-sm text-gray-600">
                        選択中: <span className="font-medium">{selectedIssue.title}</span>
                        <button
                          onClick={() => handleIssueClick(selectedIssue)}
                          className="ml-2 text-blue-600 hover:text-blue-800 underline"
                        >
                          詳細を見る
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <GanttChart
                    issues={filteredIssues}
                    onTaskChange={handleGanttTaskChange}
                    onTaskSelect={handleGanttTaskSelect}
                    height={500}
                    readOnly={userRole !== 'editor'}
                    loading={isLoading}
                    options={{
                      viewMode: 'Week',
                      locale: 'ja-JP',
                      allowDrag: userRole === 'editor',
                      allowResize: userRole === 'editor',
                      allowProgressChange: userRole === 'editor',
                    }}
                    displaySettings={{
                      showHierarchy: true,
                      showProgress: true,
                      showDependencies: true,
                      timeScale: 'day',
                    }}
                  />
                </div>
              )}

              {viewMode === 'list' && (
                <IssueList
                  issues={filteredIssues}
                  onIssueClick={handleIssueClick}
                />
              )}
            </div>
          )}

          {/* ローディング */}
          {isLoading && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">読み込み中...</p>
            </div>
          )}

          {/* 空の状態 */}
          {!isLoading && filteredIssues.length === 0 && issues.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Issueがありません</h3>
              <p className="text-gray-500 mb-6">
                最初のIssueを作成してプロジェクトを始めましょう。
              </p>
              {userRole === 'editor' && (
                <button
                  onClick={handleCreateIssue}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
                >
                  最初のIssue作成
                </button>
              )}
            </div>
          )}

          {/* フィルター結果が空の状態 */}
          {!isLoading && filteredIssues.length === 0 && issues.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">該当するIssueがありません</h3>
              <p className="text-gray-500">
                フィルター条件を変更してもう一度お試しください。
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}