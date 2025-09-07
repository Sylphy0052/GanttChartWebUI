'use client'

import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'

// Lazy load the heavy GanttBarWithUndo component
const GanttBarWithUndo = lazy(() => import('@/components/gantt/GanttBarWithUndo'))

// Loading fallback component
const GanttBarSkeleton = () => (
  <div className="animate-pulse bg-gray-200 rounded h-8 w-full" />
)

// Props type inferred from the original component
type GanttBarWithUndoProps = ComponentProps<typeof GanttBarWithUndo>

export default function LazyGanttBarWithUndo(props: GanttBarWithUndoProps) {
  return (
    <Suspense fallback={<GanttBarSkeleton />}>
      <GanttBarWithUndo {...props} />
    </Suspense>
  )
}

// Named export for backward compatibility
export { LazyGanttBarWithUndo }