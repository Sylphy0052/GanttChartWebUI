'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectsApi, ApiError } from '@/lib/api';
import { ProjectCreateDto } from '@/types/project';
import MarkdownEditor from '@/components/common/MarkdownEditor';

export default function NewProjectPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description_md: '',
    shared_password_hash: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('プロジェクト名を入力してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 空文字列の場合はundefinedにする（オプショナルフィールド対応）
      const createData: ProjectCreateDto = {
        name: formData.name.trim(),
        description_md: formData.description_md?.trim() || undefined,
        shared_password_hash: formData.shared_password_hash?.trim() || undefined,
      };

      const newProject = await projectsApi.create(createData);
      
      // 作成成功後、プロジェクト一覧に戻る
      router.push('/projects');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`プロジェクト作成に失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Failed to create project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <Link href="/projects" className="hover:text-blue-600">
              プロジェクト一覧
            </Link>
            <span>/</span>
            <span className="text-gray-900">新規作成</span>
          </nav>
          
          <h1 className="text-3xl font-bold text-gray-900">プロジェクト新規作成</h1>
          <p className="mt-2 text-gray-600">
            新しいプロジェクトを作成します。必要な情報を入力してください。
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-lg">
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-700 text-sm">{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="プロジェクト名を入力してください"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明（オプション・Markdown対応）
              </label>
              <MarkdownEditor
                value={formData.description_md}
                onChange={(value) => setFormData(prev => ({ ...prev, description_md: value }))}
                placeholder="プロジェクトの説明をMarkdown形式で入力してください（任意）"
                disabled={isLoading}
                rows={4}
              />
            </div>

            <div>
              <label htmlFor="shared_password_hash" className="block text-sm font-medium text-gray-700 mb-2">
                共有パスワード（オプション）
              </label>
              <input
                type="password"
                id="shared_password_hash"
                name="shared_password_hash"
                value={formData.shared_password_hash}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="パスワードを設定する場合は入力してください（任意）"
                disabled={isLoading}
              />
              <div className="mt-2 text-sm text-gray-600">
                <p>パスワードを設定すると、他のユーザーがプロジェクトにアクセスする際に認証が必要になります。</p>
                <p>パスワードを設定しない場合は、誰でもプロジェクトにアクセスできます。</p>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Link
                href="/projects"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={isLoading || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isLoading ? '作成中...' : 'プロジェクトを作成'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}