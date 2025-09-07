'use client'

import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'

// Lazy load the BatchProgressUpdateModal component
const BatchProgressUpdateModal = lazy(() => import('@/components/gantt/BatchProgressUpdateModal'))

// Loading fallback component
const ModalSkeleton = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  </div>
)

// Props type inferred from the original component
type BatchProgressUpdateModalProps = ComponentProps<typeof BatchProgressUpdateModal>

export default function LazyBatchProgressUpdateModal(props: BatchProgressUpdateModalProps) {
  return (
    <Suspense fallback={<ModalSkeleton />}>
      <BatchProgressUpdateModal {...props} />
    </Suspense>
  )
}

export { LazyBatchProgressUpdateModal }