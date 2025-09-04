import { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'WBS - Work Breakdown Structure',
  description: 'Work Breakdown Structure for project task management',
}

export default function WBSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* WBS-specific layout */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}