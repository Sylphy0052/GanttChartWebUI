'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectsApi, ApiError } from '@/lib/api';
import { Project } from '@/types/project';
import ExportSection from '@/components/backup/ExportSection';
import ImportSection from '@/components/backup/ImportSection';

export default function BackupPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const projectData = await projectsApi.getById(projectId);
        setProject(projectData);
      } catch (error) {
        if (error instanceof ApiError) {
          setError(`プロジェクトの読み込みに失敗しました: ${error.message}`);
        } else {
          setError('ネットワークエラーが発生しました');
        }
        console.error('Failed to load project:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const handleImportSuccess = (newProjectId: string) => {
    // インポート成功時にプロジェクト一覧画面に遷移
    router.push('/projects');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  エラーが発生しました
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/projects"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              プロジェクト一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <div>
                  <Link
                    href="/projects"
                    className="text-gray-400 hover:text-gray-500"
                  >
                    プロジェクト一覧
                  </Link>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <svg
                    className="flex-shrink-0 h-5 w-5 text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                  </svg>
                  <Link
                    href={`/projects/${project.id}/settings`}
                    className="ml-4 text-gray-400 hover:text-gray-500"
                  >
                    {project.name}
                  </Link>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <svg
                    className="flex-shrink-0 h-5 w-5 text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                  </svg>
                  <span className="ml-4 text-gray-500">バックアップ・復元</span>
                </div>
              </li>
            </ol>
          </nav>

          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">
              バックアップ・復元
            </h1>
            <p className="mt-2 text-gray-600">
              プロジェクト「{project.name}」のデータをエクスポート・インポートできます
            </p>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="space-y-8">
          {/* エクスポートセクション */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              データエクスポート
            </h2>
            <ExportSection project={project} />
          </div>

          {/* 区切り線 */}
          <div className="border-t border-gray-200"></div>

          {/* インポートセクション */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              データインポート
            </h2>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>注意:</strong> インポートにより新しいプロジェクトが作成されます。
                    既存のプロジェクトは変更されません。
                  </p>
                </div>
              </div>
            </div>
            <ImportSection onImportSuccess={handleImportSuccess} />
          </div>
        </div>

        {/* フッター */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <Link
              href={`/projects/${project.id}/settings`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              設定に戻る
            </Link>

            <Link
              href="/projects"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              プロジェクト一覧
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}