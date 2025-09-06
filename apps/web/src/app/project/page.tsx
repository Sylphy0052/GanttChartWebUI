import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the client-side GanttWBSLayout component
const GanttWBSLayoutClient = dynamic(() => import('@/components/gantt/GanttWBSLayoutClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-lg">Loading Project View...</div>
    </div>
  ),
})

export default function ProjectPage() {
  return (
    <div className="container mx-auto p-4">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <GanttWBSLayoutClient className="w-full" />
      </Suspense>
    </div>
  )
}