'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { WBSTree } from '@/components/wbs/WBSTree'

export default function WBSTreeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined
  
  // Calculate available height for the tree
  const [treeHeight, setTreeHeight] = useState(600)
  
  useEffect(() => {
    const calculateHeight = () => {
      const windowHeight = window.innerHeight
      const headerHeight = 64 // Approximate header height
      const padding = 32
      setTreeHeight(windowHeight - headerHeight - padding)
    }
    
    calculateHeight()
    window.addEventListener('resize', calculateHeight)
    
    return () => window.removeEventListener('resize', calculateHeight)
  }, [])

  return (
    <WBSTree 
      projectId={projectId}
      height={treeHeight}
      className="w-full"
    />
  )
}