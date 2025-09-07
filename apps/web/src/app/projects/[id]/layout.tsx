/**
 * AC5: Protected project layout with token validation
 * Layout component that ensures project access before rendering child routes
 */

'use client'

import React from 'react'
import { ProjectRouteGuard } from '@/components/auth/ProjectRouteGuard'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: {
    id: string
  }
}

export default function ProjectLayout({
  children,
  params
}: ProjectLayoutProps) {
  return (
    <ProjectRouteGuard
      requireProjectAccess={true}
      fallbackRoute="/projects"
      onAccessDenied={(projectId, error) => {
        console.warn(`Access denied for project ${projectId}:`, error)
        // Could add analytics tracking here
      }}
    >
      {children}
    </ProjectRouteGuard>
  )
}