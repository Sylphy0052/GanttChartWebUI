'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { useProjectContext } from '@/components/providers/ProjectProvider'

export default function ProjectIssuesPage() {
  const params = useParams()
  const projectId = params.id as string
  const { currentProject } = useProjectContext()

  // Show loading if project is not loaded yet
  if (!currentProject || currentProject.id !== projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Issues - {currentProject.name}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Issues 機能</h2>
            <p className="text-gray-500 mb-4">
              このプロジェクトのIssue管理画面です。
            </p>
            <p className="text-sm text-gray-400">実装予定の機能です。</p>
          </div>
        </div>
      </div>
    </div>
  )
}