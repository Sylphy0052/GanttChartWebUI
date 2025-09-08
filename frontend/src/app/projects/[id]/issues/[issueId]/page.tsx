'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IssueDetailData } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { issuesApi, ApiError } from '@/lib/api';
import IssueDetail from '@/components/issues/IssueDetail';

export default function IssueDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const issueId = params.issueId as string;

  const [issueDetail, setIssueDetail] = useState<IssueDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 仮の権限設定（実際のアプリでは認証システムから取得）
  const [userRole] = useState<ProjectRole>('editor');

  useEffect(() => {
    const loadIssueDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Issue詳細を取得（コメント・変更履歴込み）
        let issueData: IssueDetailData;
        try {
          // バックエンドが /detail エンドポイントをサポートしている場合
          issueData = await issuesApi.getDetailById(projectId, issueId);
        } catch (detailError) {
          // バックエンドが /detail エンドポイントをサポートしていない場合はフォールバック
          console.warn('Detail endpoint not available, using basic endpoint');
          const basicIssue = await issuesApi.getById(projectId, issueId);
          issueData = { ...basicIssue, comments: [], changeLog: [] };
        }
        
        setIssueDetail(issueData);
      } catch (error) {
        console.error('Failed to load issue detail:', error);
        if (error instanceof ApiError) {
          if (error.status === 404) {
            setError('Issueが見つかりませんでした。');
          } else {
            setError(`Issueの読み込みに失敗しました: ${error.message}`);
          }
        } else {
          setError('ネットワークエラーが発生しました。');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId && issueId) {
      loadIssueDetail();
    }
  }, [projectId, issueId]);

  const handleEdit = () => {
    router.push(`/projects/${projectId}/issues/${issueId}/edit`);
  };

  const handleDelete = async () => {
    if (!window.confirm('このIssueを削除しますか？')) {
      return;
    }

    try {
      await issuesApi.delete(projectId, issueId);
      router.push(`/projects/${projectId}/issues`);
    } catch (error) {
      console.error('Failed to delete issue:', error);
      if (error instanceof ApiError) {
        setError(`Issueの削除に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。');
      }
    }
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}/issues`);
  };

  // ローディング状態
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="flex items-center space-x-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-700">Issueを読み込んでいます...</span>
          </div>
        </div>
      </div>
    );
  }

  // エラー状態
  if (error && !issueDetail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="mx-auto h-12 w-12"
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
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">エラーが発生しました</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              再読み込み
            </button>
            <button
              onClick={handleBack}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Issue一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!issueDetail) {
    return null;
  }

  return (
    <IssueDetail
      issue={issueDetail}
      projectId={projectId}
      userRole={userRole}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onBack={handleBack}
      error={error}
      onErrorClear={() => setError(null)}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { id, issueId } = await params;
  return {
    title: 'Issue詳細 - Gantt Chart Web UI',
    description: 'Issueの詳細情報を表示するページ',
  };
}