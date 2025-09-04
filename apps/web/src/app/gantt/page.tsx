'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GanttChart } from '@/components/gantt/GanttChart'

export default function GanttPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined
  
  // Calculate available height for the chart
  const [chartHeight, setChartHeight] = useState(600)
  
  useEffect(() => {
    const calculateHeight = () => {
      const windowHeight = window.innerHeight
      const headerHeight = 64 // Approximate header height
      const padding = 32
      setChartHeight(windowHeight - headerHeight - padding)
    }
    
    calculateHeight()
    window.addEventListener('resize', calculateHeight)
    
    return () => window.removeEventListener('resize', calculateHeight)
  }, [])

  return (
    <div className="container mx-auto p-4">
      <GanttChart 
        projectId={projectId}
        height={chartHeight}
        className="w-full"
      />
    </div>
  )
}