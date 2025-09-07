'use client'

import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'

// Lazy load the heavy GanttChart component
const GanttChart = lazy(() => import('@/components/gantt/GanttChart'))

// Loading fallback component
const GanttChartSkeleton = () => (
  <div className="animate-pulse bg-white border rounded-lg p-4 h-96 flex items-center justify-center">
    <div className="text-gray-500">Loading Gantt Chart...</div>
  </div>
)

// Props type inferred from the original component
type GanttChartProps = ComponentProps<typeof GanttChart>

export default function LazyGanttChart(props: GanttChartProps) {
  return (
    <Suspense fallback={<GanttChartSkeleton />}>
      <GanttChart {...props} />
    </Suspense>
  )
}

export { LazyGanttChart }