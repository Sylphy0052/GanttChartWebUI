'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Issue, UpdateIssueDto } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { issuesApi } from '@/api/issues';
import { ApiError } from '@/lib/api';
import IssueForm from '@/components/issues/IssueForm';

export default function EditIssuePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const issueId = params.issueId as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 仮の権限設定（実際のアプリでは認証システムから取得）
  const [userRole] = useState<ProjectRole>('editor');

  // Editor権限チェック
  if (userRole !== 'editor') {
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">権限が不足しています</h1>
          <p className="text-gray-600 mb-4">
            Issueを編集するにはEditor権限が必要です。
          </p>
          <button
            onClick={() => router.push(`/projects/${projectId}/issues`)}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Issue一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadIssue = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const issueData = await issuesApi.getById(projectId, issueId);
        setIssue(issueData);
      } catch (error) {
        console.error('Failed to load issue:', error);
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
      loadIssue();
    }
  }, [projectId, issueId]);

  const handleSubmit = async (data: UpdateIssueDto) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      console.log('Edit submission data:', data);
      console.log('Current issue version:', issue?.version);
      
      // 親Issueが変更されている場合は、階層変更APIを呼び出す
      if (issue && data.parent_id !== issue.parent_id) {
        await issuesApi.changeHierarchy(issueId, {
          new_parent_id: data.parent_id || null,
          version: issue.version, // 現在のissueのversionを使用
        });
        
        // parent_idとversionは別APIで処理するため、updateデータから除外
        const { parent_id, version, ...updateData } = data;
        // 他に更新するフィールドがある場合のみupdate APIを呼び出す
        if (Object.keys(updateData).length > 0) {
          console.log('Update data after hierarchy change:', updateData);
          const updatedIssue = await issuesApi.update(projectId, issueId, {
            ...updateData,
            version: issue?.version, // 楽観ロック
          });
        }
      } else {
        // parent_idの変更がない場合は通常の更新
        // parent_idを除外、versionは楽観ロック用に含める
        const { parent_id, ...updateData } = data;
        console.log('Update data:', updateData);
        const updatedIssue = await issuesApi.update(projectId, issueId, {
          ...updateData,
          version: issue?.version, // 楽観ロック
        });
      }
      
      // 成功時はIssue一覧ページにリダイレクト
      router.push(`/projects/${projectId}/issues`);
    } catch (error) {
      console.error('Failed to update issue:', error);
      if (error instanceof ApiError) {
        setError(`Issueの更新に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。もう一度お試しください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
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
  if (error && !issue) {
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
              onClick={() => router.push(`/projects/${projectId}/issues`)}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Issue一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return null;
  }

  return (
    <IssueForm
      mode="edit"
      projectId={projectId}
      initialData={issue}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isSubmitting}
      error={error}
    />
  );
}