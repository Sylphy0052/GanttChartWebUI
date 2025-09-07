'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth.store'
import { IssueTable } from '@/components/issues/IssueTable'

export default function IssuesPage() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href="/">
                <h1 className="text-2xl font-bold text-gray-900">
                  Gantt Chart WebUI
                </h1>
              </Link>
              <p className="mt-1 text-sm text-gray-600">
                Issue管理システム
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    こんにちは、{user?.name || user?.email}さん
                  </span>
                  <Link href="/login">
                    <Button variant="outline" size="sm">
                      ログアウト
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">ゲストモード</span>
                  <Link href="/login">
                    <Button size="sm">
                      ログイン
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Issue一覧
            </h2>
          </div>
          
          <div className="flex space-x-4">
            <Link href="/issues/create">
              <Button data-testid="create-issue-button" disabled={!isAuthenticated}>
                新しいIssue
              </Button>
            </Link>
          </div>
        </div>

        {/* Issue Table */}
        <IssueTable />
      </div>
    </div>
  )
}