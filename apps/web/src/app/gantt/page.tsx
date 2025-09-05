import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the client-side GanttChart component
const GanttChartClient = dynamic(() => import('@/components/gantt/GanttChartClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-lg">Loading Gantt Chart...</div>
    </div>
  ),
})

export default function GanttPage() {
  return (
    <div className="container mx-auto p-4">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <GanttChartClient />
      </Suspense>
    </div>
  )
}