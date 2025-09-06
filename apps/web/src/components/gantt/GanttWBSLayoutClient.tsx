'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GanttWBSLayout } from './GanttWBSLayout'

interface GanttWBSLayoutClientProps {
  className?: string
}

export default function GanttWBSLayoutClient({ className }: GanttWBSLayoutClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined
  
  // Calculate available height for the layout
  const [layoutHeight, setLayoutHeight] = useState(600)
  
  useEffect(() => {
    const calculateHeight = () => {
      const windowHeight = window.innerHeight
      const headerHeight = 64 // Approximate header height
      const padding = 32
      setLayoutHeight(windowHeight - headerHeight - padding)
    }
    
    calculateHeight()
    window.addEventListener('resize', calculateHeight)
    
    return () => window.removeEventListener('resize', calculateHeight)
  }, [])

  return (
    <GanttWBSLayout 
      projectId={projectId}
      height={layoutHeight}
      className={className}
    />
  )
}