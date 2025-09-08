'use client';

import React, { useState, useEffect } from 'react';
import { IssueDetailData, IssueStatus } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import { UploadedFile } from '@/types/upload';
import { uploadsApi } from '@/lib/api';
import CommentSection from './CommentSection';
import ChangeLogSection from './ChangeLogSection';
import ImageUpload from '../uploads/ImageUpload';
import ImageGallery from '../uploads/ImageGallery';

interface IssueDetailProps {
  issue: IssueDetailData;
  projectId: string;
  userRole: ProjectRole;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
  error?: string | null;
  onErrorClear: () => void;
}

const statusOptions: Array<{ value: IssueStatus; label: string; color: string }> = [
  { value: 'open', label: 'オープン', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: '進行中', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'done', label: '完了', color: 'bg-green-100 text-green-800' },
  { value: 'blocked', label: 'ブロック', color: 'bg-red-100 text-red-800' },
];

const IssueDetail: React.FC<IssueDetailProps> = ({
  issue,
  projectId,
  userRole,
  onEdit,
  onDelete,
  onBack,
  error,
  onErrorClear,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(issue.uploadedFiles || []);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const statusInfo = statusOptions.find(s => s.value === issue.status) || statusOptions[0];

  // Fetch uploaded files when component mounts or issue changes
  useEffect(() => {
    const fetchUploadedFiles = async () => {
      setIsLoadingFiles(true);
      try {
        const response = await uploadsApi.getAll(projectId, issue.id);
        setUploadedFiles(response.files || []);
      } catch (error) {
        console.error('Failed to fetch uploaded files:', error);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchUploadedFiles();
  }, [projectId, issue.id]);

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderMarkdown = (markdown: string | undefined): string => {
    if (!markdown) return '';
    // 簡易的なMarkdown変換（実際のプロダクションではmarkdown-itなどを使用）
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  // Handle successful upload
  const handleUploadComplete = (newFiles: UploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setUploadError(null);
  };

  // Handle upload error
  const handleUploadError = (error: string) => {
    setUploadError(error);
  };

  // Handle file deletion
  const handleFileDelete = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  // Clear upload error
  const clearUploadError = () => {
    setUploadError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
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
                <p className="text-red-700">{error}</p>
              </div>
              <button
                onClick={onErrorClear}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Upload Error Display */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
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
                <p className="text-red-700">{uploadError}</p>
              </div>
              <button
                onClick={clearUploadError}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ヘッダー */}
        <div className="bg-white shadow-lg rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={onBack}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {issue.title}
                  </h1>
                  <p className="text-sm text-gray-500">Issue ID: {issue.id}</p>
                </div>
              </div>
              
              {userRole === 'editor' && (
                <div className="flex space-x-3">
                  <button
                    onClick={onEdit}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    編集
                  </button>
                  <button
                    onClick={onDelete}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    削除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* メインコンテンツ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Issue詳細 */}
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">詳細情報</h2>
              
              {/* 説明 */}
              {issue.description_md && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">説明</h3>
                  <div 
                    className="prose max-w-none text-gray-900 bg-gray-50 p-4 rounded-md"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(issue.description_md) }}
                  />
                </div>
              )}

              {/* 進捗バー */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">進捗</h3>
                  <span className="text-sm text-gray-600">{issue.progress_pct}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${issue.progress_pct}%` }}
                  />
                </div>
              </div>

              {/* 子Issue一覧 */}
              {issue.children && issue.children.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">子Issue</h3>
                  <div className="space-y-2">
                    {issue.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              statusOptions.find(s => s.value === child.status)?.color || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {statusOptions.find(s => s.value === child.status)?.label || child.status}
                          </span>
                          <span className="text-sm text-gray-900">{child.title}</span>
                        </div>
                        <button
                          onClick={() => window.open(`/projects/${projectId}/issues/${child.id}`, '_blank')}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          詳細
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 画像アップロード */}
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">画像アップロード</h2>
              <ImageUpload
                issueId={issue.id}
                projectId={projectId}
                userRole={userRole}
                onUploadComplete={handleUploadComplete}
                onError={handleUploadError}
              />
            </div>

            {/* 画像ギャラリー */}
            <div className="bg-white shadow-lg rounded-lg p-6">
              <ImageGallery
                images={uploadedFiles}
                projectId={projectId}
                issueId={issue.id}
                userRole={userRole}
                onDelete={handleFileDelete}
                onError={handleUploadError}
                loading={isLoadingFiles}
              />
            </div>

            {/* コメント */}
            <CommentSection
              projectId={projectId}
              issueId={issue.id}
              comments={issue.comments || []}
              userRole={userRole}
            />
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* Issue情報 */}
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Issue情報</h2>
              
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">ステータス</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">担当者</dt>
                  <dd className="mt-1 text-sm text-gray-900">{issue.assignee || '-'}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">開始日</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(issue.start_date)}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">終了日</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(issue.end_date)}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">見積時間</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {issue.effort_hours ? `${issue.effort_hours}時間` : '-'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">作成日</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(issue.created_at)}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">更新日</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(issue.updated_at)}</dd>
                </div>

                {issue.is_blocked && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">状態</dt>
                    <dd className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ブロック中
                      </span>
                    </dd>
                  </div>
                )}

                {/* 親Issue */}
                {issue.parent && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">親Issue</dt>
                    <dd className="mt-1">
                      <button
                        onClick={() => window.open(`/projects/${projectId}/issues/${issue.parent!.id}`, '_blank')}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {issue.parent.title}
                      </button>
                    </dd>
                  </div>
                )}

                {/* ラベル */}
                {issue.labels && issue.labels.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ラベル</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {issue.labels.map((label, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {label}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}

                {/* 添付ファイル数 */}
                {uploadedFiles.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">添付画像</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {uploadedFiles.length}件
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 変更履歴 */}
            <ChangeLogSection
              projectId={projectId}
              issueId={issue.id}
              changeLog={issue.changeLog || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueDetail;