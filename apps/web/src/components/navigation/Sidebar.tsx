'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProjectContext } from '@/components/providers/ProjectProvider'
import { 
  HomeIcon,
  ListBulletIcon,
  ChartBarIcon,
  Squares2X2Icon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

interface SidebarItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiresProject?: boolean
}

const sidebarItems: SidebarItem[] = [
  {
    label: 'ホーム',
    href: '/',
    icon: HomeIcon,
  },
  {
    label: 'プロジェクト選択',
    href: '/projects',
    icon: Squares2X2Icon,
  },
  {
    label: 'Issues',
    href: '/projects/[id]/issues',
    icon: ListBulletIcon,
    requiresProject: true,
  },
  {
    label: 'WBS',
    href: '/projects/[id]/wbs',
    icon: ChartBarIcon,
    requiresProject: true,
  },
  {
    label: 'ガント',
    href: '/projects/[id]/gantt',
    icon: ChartBarIcon,
    requiresProject: true,
  },
  {
    label: '設定',
    href: '/projects/[id]/settings',
    icon: Cog6ToothIcon,
    requiresProject: true,
  },
]

export const Sidebar: React.FC = () => {
  const pathname = usePathname()
  const { currentProject, isProjectSelected } = useProjectContext()

  const getHref = (item: SidebarItem) => {
    if (!item.requiresProject) {
      return item.href
    }
    
    if (!currentProject) {
      return '/projects' // Redirect to project selection if no project selected
    }
    
    return item.href.replace('[id]', currentProject.id)
  }

  const isItemActive = (item: SidebarItem) => {
    const href = getHref(item)
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href.replace('[id]', currentProject?.id || ''))
  }

  const isItemDisabled = (item: SidebarItem) => {
    return item.requiresProject && !isProjectSelected
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon
          const isActive = isItemActive(item)
          const isDisabled = isItemDisabled(item)
          const href = getHref(item)

          return (
            <Link
              key={item.label}
              href={href}
              className={`
                flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                ${isActive
                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                  : isDisabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }
              `}
              onClick={isDisabled ? (e) => e.preventDefault() : undefined}
            >
              <Icon className={`mr-3 h-5 w-5 ${isDisabled ? 'text-gray-300' : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      
      {/* Project Info */}
      {currentProject && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">現在のプロジェクト</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {currentProject.name}
          </div>
        </div>
      )}
    </aside>
  )
}