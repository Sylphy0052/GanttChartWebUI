'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Issue } from '@/types/issue';
import { Project, ProjectRole } from '@/types/project';
import { issuesApi, projectsApi, ApiError } from '@/lib/api';
import { useGanttWebSocket } from '@/hooks/useGanttWebSocket';
import GanttLayout from '@/components/gantt/GanttLayout';
import GanttNotificationHandler from '@/components/gantt/GanttNotificationHandler';

/**
 * ガント専用ページ
 * WBS-ガント統合レイアウトを提供する専用ページ
 */
export default function GanttPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [userRole, setUserRole] = useState<ProjectRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ガント専用のWebSocket接続
  const { isConnected: wsConnected } = useGanttWebSocket({
    projectId,
    onIssuesUpdate: (updatedIssues: Issue[]) => {
      console.log('Issues updated from WebSocket:', updatedIssues);
      setIssues(updatedIssues);
    },
    onError: (errorMessage: string) => {
      console.error('Gantt WebSocket error:', errorMessage);
      setError(errorMessage);
    },
  });

  // プロジェクト情報とIssues情報を取得
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // プロジェクト情報取得
      const projectData = await projectsApi.getById(projectId);
      setProject(projectData);
      setUserRole(projectData.role || 'viewer');

      // Issues取得
      const issuesData = await issuesApi.getAll(projectId);
      setIssues(issuesData);
    } catch (error) {
      console.error('データ取得エラー:', error);
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setError('プロジェクトが見つかりません');
        } else if (error.status === 403) {
          setError('このプロジェクトにアクセスする権限がありません');
        } else {
          setError(`データの取得に失敗しました: ${error.message}`);
        }
      } else {
        setError('データの取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Issues情報のみを再取得
  const loadIssues = useCallback(async () => {
    try {
      const issuesData = await issuesApi.getAll(projectId);
      setIssues(issuesData);
    } catch (error) {
      console.error('Issues取得エラー:', error);
    }
  }, [projectId]);

  // 初期データ取得
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Issue詳細へのナビゲーション
  const handleIssueClick = useCallback((issue: Issue) => {
    router.push(`/projects/${projectId}/issues/${issue.id}`);
  }, [router, projectId]);

  // ガントチャートからのIssue変更
  const handleTaskChange = useCallback(async (issueId: string, changes: Partial<Issue>) => {
    try {
      // 楽観ロック用にversionを取得
      const currentIssue = issues.find(i => i.id === issueId);
      if (!currentIssue) return;

      // API呼び出し
      const updatedIssue = await issuesApi.update(issueId, {
        ...changes,
        version: currentIssue.version,
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

  // WBSツリーからのIssues更新
  const handleIssuesUpdate = useCallback((updatedIssues: Issue[]) => {
    setIssues(updatedIssues);
  }, []);

  // ガントチャート更新
  const handleGanttUpdate = useCallback(() => {
    // ガントチャートの依存関係線やタスクバーを再描画
    console.log('Gantt chart updated due to WebSocket notification');
    // 必要に応じてガントチャートの状態を更新
  }, []);

  // エラー表示
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    );
  }

  return (
    <>
      {/* ガントチャート専用WebSocket通知ハンドラー */}
      <GanttNotificationHandler
        projectId={projectId}
        onIssuesUpdate={handleIssuesUpdate}
        onGanttUpdate={handleGanttUpdate}
        onError={(errorMessage) => setError(errorMessage)}
      />

      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                {/* 戻るボタン */}
                <button
                  onClick={() => router.push(`/projects/${projectId}/issues`)}
                  className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Issues一覧に戻る
                </button>

                {/* プロジェクト情報 */}
                {project && (
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
                    <p className="text-sm text-gray-500">ガントチャート</p>
                  </div>
                )}
              </div>

              {/* 接続状態インジケーター */}
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-xs text-gray-500">
                  {wsConnected ? 'リアルタイム同期中' : '接続中...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="h-[calc(100vh-4rem)]">
          <GanttLayout
            projectId={projectId}
            issues={issues}
            userRole={userRole}
            onIssueClick={handleIssueClick}
            onIssuesUpdate={handleIssuesUpdate}
            onTaskChange={handleTaskChange}
            isLoading={isLoading}
          />
        </div>
      </div>
    </>
  );
}