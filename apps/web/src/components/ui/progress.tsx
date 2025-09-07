/**
 * Progress UI component for sync status display
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

'use client'

import * as React from 'react'

interface ProgressProps {
  value: number
  className?: string
  max?: number
}

export const Progress: React.FC<ProgressProps> = ({ value, className = '', max = 100 }) => {
  const percentage = Math.min(Math.max(value, 0), max)

  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-gray-200 ${className}`}>
      <div
        className="h-full w-full flex-1 bg-blue-600 transition-all duration-300 ease-in-out"
        style={{
          transform: `translateX(-${100 - (percentage / max) * 100}%)`
        }}
      />
    </div>
  )
}