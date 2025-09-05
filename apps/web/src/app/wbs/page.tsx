import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the client-side WBSTree component
const WBSTreeClient = dynamic(() => import('@/components/wbs/WBSTreeClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-lg">Loading WBS Tree...</div>
    </div>
  ),
})

export default function WBSPage() {
  return (
    <div className="container mx-auto p-4">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <WBSTreeClient />
      </Suspense>
    </div>
  )
}