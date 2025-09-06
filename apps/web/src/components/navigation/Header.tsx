'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProjectSelector } from '@/components/projects/ProjectSelector'
import { ProjectCreateModal } from '@/components/projects/ProjectCreateModal'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'

export const Header: React.FC = () => {
  const pathname = usePathname()
  const { isAuthenticated, user, logout } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const navItems = [
    { href: '/issues', label: 'Issues', icon: '📝' },
    { href: '/wbs', label: 'WBS', icon: '📊' },
    { href: '/gantt', label: 'Gantt', icon: '📈' },
  ]
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo/Title */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="text-2xl">🎯</div>
                <h1 className="text-xl font-bold text-gray-900">Gantt WebUI</h1>
              </Link>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center space-x-8">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }
                    `}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Project Selector and Actions */}
            <div className="flex items-center space-x-4">
              {/* Project Selector */}
              <ProjectSelector />
              
              {/* Create Project Button (only for authenticated users) */}
              {isAuthenticated && (
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="hidden sm:inline">プロジェクト</span>
                </Button>
              )}
            </div>
            
            {/* User actions */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <button className="text-gray-500 hover:text-gray-700 relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                    </svg>
                  </button>
                  
                  {/* User Menu */}
                  <div className="relative">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-sm font-medium text-gray-900">
                          {user?.email?.split('@')[0] || 'ユーザー'}
                        </div>
                        <div className="text-xs text-gray-500">
                          ログイン中
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={logout}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ログアウト
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button size="sm" variant="ghost">
                      ログイン
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Project Create Modal */}
      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          // Optionally refresh project list or navigate to new project
          setShowCreateModal(false)
        }}
      />
    </>
  )
}