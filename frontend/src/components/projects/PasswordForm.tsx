'use client';

import React, { useState } from 'react';
import { Project, ProjectRole } from '@/types/project';
import { projectsApi, ApiError } from '@/lib/api';

interface PasswordFormProps {
  project: Project;
  onSuccess: (role: ProjectRole) => void;
  onCancel: () => void;
}

const PasswordForm: React.FC<PasswordFormProps> = ({
  project,
  onSuccess,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('パスワードを入力してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await projectsApi.verifyPassword(project.id, {
        password: password.trim(),
      });
      
      onSuccess(result.role);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setError('パスワードが間違っています');
        } else if (error.status === 404) {
          setError('プロジェクトが見つかりません');
        } else {
          setError('認証エラーが発生しました');
        }
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Password verification failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          プロジェクトアクセス認証
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>{project.name}</strong>
          </p>
          {project.description && (
            <p className="text-gray-600 text-sm">{project.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              共有パスワード
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="パスワードを入力"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '認証中...' : 'アクセス'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordForm;