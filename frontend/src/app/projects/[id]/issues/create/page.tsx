'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CreateIssueDto, UpdateIssueDto } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { issuesApi, ApiError } from '@/lib/api';
import IssueForm from '@/components/issues/IssueForm';

export default function CreateIssuePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
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
            Issueを作成するにはEditor権限が必要です。
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

  const handleSubmit = async (data: CreateIssueDto | UpdateIssueDto) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Create mode では CreateIssueDto のみを受け取る
      await issuesApi.create(projectId, data as CreateIssueDto);
      
      // 成功時はIssue一覧ページにリダイレクト
      router.push(`/projects/${projectId}/issues`);
    } catch (error) {
      console.error('Failed to create issue:', error);
      if (error instanceof ApiError) {
        setError(`Issueの作成に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。もう一度お試しください。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}/issues`);
  };

  return (
    <IssueForm
      mode="create"
      projectId={projectId}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isLoading}
      error={error}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: 'Issue作成 - Gantt Chart Web UI',
    description: '新しいIssueを作成するページ',
  };
}