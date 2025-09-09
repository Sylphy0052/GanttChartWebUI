'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Project, ProjectRole } from '@/types/project';
import { projectsApi, ApiError } from '@/lib/api';
import PasswordForm from './PasswordForm';

interface ProjectListProps {
  onProjectAccess?: (project: Project, role: ProjectRole) => void;
  onProjectCreate?: () => void;
  onProjectEdit?: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  onProjectAccess,
  onProjectCreate,
  onProjectEdit,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('API_BASE_URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      const data = await projectsApi.getAll();
      setProjects(data);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(`プロジェクトの読み込みに失敗しました: ${error.message} (ステータス: ${error.status})`);
      } else {
        setError(`ネットワークエラーが発生しました: ${error?.message || String(error)}`);
      }
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleProjectClick = (project: Project) => {
    if (project.shared_password_hash) {
      setSelectedProject(project);
    } else {
      // パスワード不要の場合は直接アクセス（Editor権限）
      onProjectAccess?.(project, 'editor');
    }
  };

  const handlePasswordSuccess = (role: ProjectRole) => {
    if (selectedProject) {
      onProjectAccess?.(selectedProject, role);
      setSelectedProject(null);
    }
  };

  const handlePasswordCancel = () => {
    setSelectedProject(null);
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`プロジェクト「${project.name}」を削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    try {
      setIsDeleting(project.id);
      await projectsApi.delete(project.id);
      await loadProjects(); // リストを再読み込み
    } catch (error) {
      if (error instanceof ApiError) {
        alert(`削除に失敗しました: ${error.message}`);
      } else {
        alert('ネットワークエラーが発生しました');
      }
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">プロジェクト一覧</h2>
            <button
              onClick={onProjectCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              新規作成
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <div className="text-red-700">{error}</div>
            <button
              onClick={loadProjects}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              再試行
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-500">
              プロジェクトがありません。
              <button
                onClick={onProjectCreate}
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                新規作成
              </button>
              してください。
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {projects.map((project) => (
              <div
                key={project.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 cursor-pointer" onClick={() => handleProjectClick(project)}>
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900 hover:text-blue-600">
                        {project.name}
                      </h3>
                      {project.shared_password_hash && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          パスワード保護
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="mt-1 text-gray-600">{project.description}</p>
                    )}
                    <div className="mt-2 text-sm text-gray-500">
                      <span>作成: {formatDate(project.created_at)}</span>
                      {project.updated_at !== project.created_at && (
                        <span className="ml-4">更新: {formatDate(project.updated_at)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 ml-4">
                    <Link
                      href={`/projects/${project.id}/settings`}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      title="編集・設定"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDeleteProject(project)}
                      disabled={isDeleting === project.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="削除"
                    >
                      {isDeleting === project.id ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* パスワード入力モーダル */}
      {selectedProject && (
        <PasswordForm
          project={selectedProject}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
        />
      )}
    </>
  );
};

export default ProjectList;