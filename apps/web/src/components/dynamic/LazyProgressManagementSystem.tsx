'use client'

import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'

// Lazy load the ProgressManagementSystem component
const ProgressManagementSystem = lazy(() => import('@/components/gantt/ProgressManagementSystem'))

// Loading fallback component
const ProgressSystemSkeleton = () => (
  <div className="animate-pulse bg-white border rounded-lg p-6 h-96">
    <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-8 bg-gray-200 rounded"></div>
      ))}
    </div>
    <div className="mt-4 text-sm text-gray-500 text-center">
      Loading Progress Management System...
    </div>
  </div>
)

// Props type inferred from the original component
type ProgressManagementSystemProps = ComponentProps<typeof ProgressManagementSystem>

export default function LazyProgressManagementSystem(props: ProgressManagementSystemProps) {
  return (
    <Suspense fallback={<ProgressSystemSkeleton />}>
      <ProgressManagementSystem {...props} />
    </Suspense>
  )
}

export { LazyProgressManagementSystem }