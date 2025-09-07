'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { useProjectContext } from '@/components/providers/ProjectProvider'
import { GanttChart } from '@/components/gantt/GanttChart'

export default function ProjectGanttPage() {
  const params = useParams()
  const projectId = params.id as string
  const { currentProject } = useProjectContext()

  // Show loading if project is not loaded yet
  if (!currentProject || currentProject.id !== projectId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">プロジェクトを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex-none px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              ガント チャート
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              プロジェクト: {currentProject.name}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            SVG描画・ズーム/スクロール対応
          </div>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="flex-1 min-h-0 bg-gray-50">
        <div className="h-full p-6">
          <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <GanttChart
              projectId={projectId}
              height={800} // Fixed height for now, could be dynamic
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex-none px-6 py-2 bg-white border-t border-gray-200">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <div className="space-x-4">
            <span>📊 SVGベース高性能描画</span>
            <span>🔍 ズーム・スクロール対応</span>
            <span>⚡ 1000+ Issue対応</span>
          </div>
          <div>
            <span>今日のライン表示 | レスポンシブ対応 (最小幅: 1200px)</span>
          </div>
        </div>
      </div>
    </div>
  )
}