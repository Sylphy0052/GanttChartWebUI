'use client'

import React, { memo } from 'react'
import { CircularDependencyResult } from '@/lib/dependency-validation'

interface CircularDependencyWarningProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  circularResult: CircularDependencyResult
  fromTaskTitle: string
  toTaskTitle: string
}

/**
 * Modal component to warn about circular dependencies
 * Shows the circular path and allows user to cancel or force create
 */
export const CircularDependencyWarning = memo<CircularDependencyWarningProps>(({
  isOpen,
  onClose,
  onConfirm,
  circularResult,
  fromTaskTitle,
  toTaskTitle
}) => {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg 
                  className="w-5 h-5 text-red-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">
                Circular Dependency Detected
              </h3>
              <p className="text-sm text-red-600">
                This dependency would create a circular reference
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-gray-700 text-sm mb-3">
              Creating a dependency from <strong>"{fromTaskTitle}"</strong> to <strong>"{toTaskTitle}"</strong> would create a circular dependency.
            </p>
            
            {circularResult.message && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                <p className="text-red-800 text-sm font-medium">
                  {circularResult.message}
                </p>
              </div>
            )}

            {circularResult.circularPath && circularResult.circularPath.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Circular Path Detected:
                </h4>
                <div className="space-y-2">
                  {circularResult.circularPath.map((taskId, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <div className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="ml-3 font-mono text-gray-700">
                        {taskId}
                      </div>
                      {circularResult.circularPath && index < circularResult.circularPath.length - 1 && (
                        <div className="ml-2 text-gray-400">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <div className="flex items-start">
              <svg 
                className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <div className="ml-2">
                <h4 className="text-sm font-medium text-amber-800">
                  What are circular dependencies?
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  Circular dependencies occur when tasks depend on each other in a loop, 
                  making it impossible to determine the correct execution order.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              onClick={onConfirm}
              title="Create dependency despite circular reference warning"
            >
              Force Create
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong>Force Create</strong> will create the dependency anyway. 
            This may cause scheduling issues.
          </p>
        </div>
      </div>
    </div>
  )
})

CircularDependencyWarning.displayName = 'CircularDependencyWarning'