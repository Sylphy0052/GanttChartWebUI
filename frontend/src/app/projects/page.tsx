'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProjectRole } from '@/types/project';
import ProjectList from '@/components/projects/ProjectList';

export default function ProjectsPage() {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<{
    project: Project;
    role: ProjectRole;
  } | null>(null);

  const handleProjectAccess = (project: Project, role: ProjectRole) => {
    // プロジェクトアクセス成功時の処理
    setSelectedProject({ project, role });
    // プロジェクトのIssue管理ページにリダイレクト
    router.push(`/projects/${project.id}/issues`);
  };

  const handleProjectCreate = () => {
    // プロジェクト作成画面へ遷移
    router.push('/projects/new');
  };

  const handleProjectEdit = (project: Project) => {
    // プロジェクト編集画面へ遷移
    router.push(`/projects/${project.id}/settings`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ガントチャート WebUI</h1>
          <p className="mt-2 text-gray-600">
            プロジェクトを選択してガントチャート管理を開始してください
          </p>
        </div>

        <ProjectList
          onProjectAccess={handleProjectAccess}
          onProjectCreate={handleProjectCreate}
          onProjectEdit={handleProjectEdit}
        />

        {/* デバッグ用: 選択されたプロジェクト情報表示 */}
        {selectedProject && (
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              アクセス情報（デバッグ用）
            </h3>
            <div className="text-blue-800">
              <p><strong>プロジェクト:</strong> {selectedProject.project.name}</p>
              <p><strong>権限:</strong> {selectedProject.role === 'editor' ? '編集者' : '閲覧者'}</p>
              <p><strong>ID:</strong> {selectedProject.project.id}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}