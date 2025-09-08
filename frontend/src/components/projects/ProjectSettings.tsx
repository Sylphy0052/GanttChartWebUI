'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Project, ProjectUpdateDto } from '@/types/project';
import { projectsApi, ApiError } from '@/lib/api';

interface ProjectSettingsProps {
  projectId: string;
}

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ projectId }) => {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    removePassword: false,
  });

  // プロジェクト情報の読み込み
  const loadProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await projectsApi.getById(projectId);
      setProject(data);
      setFormData(prev => ({
        ...prev,
        name: data.name,
        description: data.description || '',
      }));
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

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    setSuccessMessage(null);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked,
    }));
    setError(null);
    setSuccessMessage(null);
  };

  // 基本情報の保存
  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('プロジェクト名は必須です');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const updateData: ProjectUpdateDto = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      const updatedProject = await projectsApi.update(projectId, updateData);
      setProject(updatedProject);
      setSuccessMessage('基本情報を保存しました');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`保存に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to save basic info:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // パスワード設定の保存
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.removePassword) {
      if (!formData.newPassword) {
        setError('新しいパスワードを入力してください');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('パスワードが一致しません');
        return;
      }
      if (formData.newPassword.length < 4) {
        setError('パスワードは4文字以上で入力してください');
        return;
      }
    }

    try {
      setIsSaving(true);
      setError(null);

      const updateData: ProjectUpdateDto = {
        shared_password: formData.removePassword ? undefined : formData.newPassword,
      };

      const updatedProject = await projectsApi.update(projectId, updateData);
      setProject(updatedProject);
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        removePassword: false,
      }));
      
      const message = formData.removePassword 
        ? 'パスワード保護を解除しました' 
        : 'パスワードを設定しました';
      setSuccessMessage(message);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`パスワード設定に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to save password:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // プロジェクト削除
  const handleDeleteProject = async () => {
    if (!project) return;

    if (!confirm(`プロジェクト「${project.name}」を削除しますか？\nこの操作は元に戻せません。`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await projectsApi.delete(projectId);
      router.push('/projects');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`削除に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to delete project:', error);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">プロジェクトが見つかりません</div>
        <button
          onClick={() => router.push('/projects')}
          className="mt-4 text-blue-600 hover:text-blue-800 underline"
        >
          プロジェクト一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="戻る"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">プロジェクト設定</h1>
        </div>
        <p className="text-gray-600">{project.name}</p>
      </div>

      {/* メッセージ表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
          {successMessage}
        </div>
      )}

      <div className="space-y-8">
        {/* 基本情報セクション */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">基本情報</h2>
          </div>
          <form onSubmit={handleSaveBasicInfo} className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  プロジェクト名 *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="プロジェクト名を入力"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="プロジェクトの説明（任意）"
                />
              </div>
            </div>
            <div className="mt-6">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? '保存中...' : '基本情報を保存'}
              </button>
            </div>
          </form>
        </div>

        {/* パスワード設定セクション */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">パスワード設定</h2>
            <p className="text-sm text-gray-500 mt-1">
              {project.shared_password_hash 
                ? 'このプロジェクトは現在パスワードで保護されています' 
                : 'パスワードを設定してプロジェクトを保護できます'
              }
            </p>
          </div>
          <form onSubmit={handleSavePassword} className="px-6 py-4">
            <div className="space-y-4">
              {project.shared_password_hash && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="removePassword"
                    name="removePassword"
                    checked={formData.removePassword}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="removePassword" className="ml-2 block text-sm text-gray-700">
                    パスワード保護を解除する
                  </label>
                </div>
              )}
              
              {!formData.removePassword && (
                <>
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      {project.shared_password_hash ? '新しいパスワード' : 'パスワード'}
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="4文字以上で入力"
                      minLength={4}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      パスワード確認
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="パスワードを再入力"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-6">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? '保存中...' : 
                  formData.removePassword ? 'パスワード保護を解除' : 'パスワードを保存'}
              </button>
            </div>
          </form>
        </div>

        {/* バックアップ・復元セクション */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">バックアップ・復元</h2>
            <p className="text-sm text-gray-500 mt-1">
              プロジェクトデータのエクスポート・インポートを実行できます
            </p>
          </div>
          <div className="px-6 py-4">
            <Link
              href={`/projects/${project.id}/backup`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zM12 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM12 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3z"
                  clipRule="evenodd"
                />
              </svg>
              バックアップ・復元画面を開く
            </Link>
            <p className="text-sm text-gray-500 mt-2">
              プロジェクトデータをZIPファイルとしてエクスポート、または他のプロジェクトからインポートできます
            </p>
          </div>
        </div>

        {/* 危険な操作セクション */}
        <div className="bg-white shadow-sm rounded-lg border border-red-200">
          <div className="px-6 py-4 border-b border-red-200">
            <h2 className="text-lg font-medium text-red-900">危険な操作</h2>
            <p className="text-sm text-red-600 mt-1">
              以下の操作は元に戻すことができません
            </p>
          </div>
          <div className="px-6 py-4">
            <button
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                  削除中...
                </div>
              ) : (
                'プロジェクトを削除'
              )}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              プロジェクトとそれに関連するすべてのデータが削除されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;