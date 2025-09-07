'use client'

import React, { useState } from 'react'
import { ProgressInput } from '@/components/ui/ProgressInput'

/**
 * Demo page for AC1: Progress input field with percentage validation (0-100%) for leaf tasks only
 * 
 * This page demonstrates:
 * - Progress input validation for leaf tasks
 * - Read-only display for parent tasks
 * - Validation feedback and error handling
 * - Different input states and configurations
 */
export default function ProgressDemoPage() {
  const [leafTaskProgress, setLeafTaskProgress] = useState(75)
  const [parentTaskProgress] = useState(60) // Computed from children
  const [invalidProgress, setInvalidProgress] = useState(50)
  const [decimalProgress, setDecimalProgress] = useState(25.5)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            T015 Progress Management UI Demo
          </h1>
          <p className="text-gray-600 mb-8">
            AC1: Progress input field with percentage validation (0-100%) for leaf tasks only
          </p>

          <div className="space-y-8">
            {/* Leaf Task Progress Input */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Leaf Task Progress Input (Editable)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Basic Progress Input
                  </label>
                  <ProgressInput
                    value={leafTaskProgress}
                    onChange={setLeafTaskProgress}
                    isLeafTask={true}
                    data-testid="leaf-task-progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current value: {leafTaskProgress}%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Progress with Success Message
                  </label>
                  <ProgressInput
                    value={leafTaskProgress}
                    onChange={setLeafTaskProgress}
                    isLeafTask={true}
                    successMessage={leafTaskProgress >= 75 ? 'On track!' : undefined}
                    data-testid="success-progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Shows success message when ≥ 75%
                  </p>
                </div>
              </div>
            </div>

            {/* Parent Task Progress (Read-only) */}
            <div className="border rounded-lg p-6 bg-blue-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Parent Task Progress (Read-only, Computed)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Computed from Children
                  </label>
                  <ProgressInput
                    value={50}
                    onChange={() => {}} // Won't be called
                    isLeafTask={false}
                    hasChildren={true}
                    computedValue={parentTaskProgress}
                    isComputed={true}
                    data-testid="parent-task-progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This field is automatically calculated from subtask progress
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Read-only Task
                  </label>
                  <ProgressInput
                    value={25}
                    onChange={() => {}}
                    readOnly={true}
                    data-testid="readonly-progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Explicitly set to read-only
                  </p>
                </div>
              </div>
            </div>

            {/* Validation Examples */}
            <div className="border rounded-lg p-6 bg-red-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Validation Examples
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Validation Message
                  </label>
                  <ProgressInput
                    value={invalidProgress}
                    onChange={setInvalidProgress}
                    isLeafTask={true}
                    validationMessage={invalidProgress < 30 ? 'Progress too low for this phase' : undefined}
                    data-testid="custom-validation-progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Shows error when &lt; 30%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Decimal Values (Allowed)
                  </label>
                  <ProgressInput
                    value={decimalProgress}
                    onChange={setDecimalProgress}
                    isLeafTask={true}
                    allowDecimal={true}
                    data-testid="decimal-progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current value: {decimalProgress}%
                  </p>
                </div>
              </div>
            </div>

            {/* Disabled/Different Sizes */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Size & State Variations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Small Size
                  </label>
                  <ProgressInput
                    value={45}
                    onChange={() => {}}
                    size="sm"
                    isLeafTask={true}
                    data-testid="small-progress"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medium Size (Default)
                  </label>
                  <ProgressInput
                    value={65}
                    onChange={() => {}}
                    size="md"
                    isLeafTask={true}
                    data-testid="medium-progress"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Large Size
                  </label>
                  <ProgressInput
                    value={85}
                    onChange={() => {}}
                    size="lg"
                    isLeafTask={true}
                    data-testid="large-progress"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Disabled State
                </label>
                <ProgressInput
                  value={30}
                  onChange={() => {}}
                  disabled={true}
                  isLeafTask={true}
                  data-testid="disabled-progress"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This input is disabled
                </p>
              </div>
            </div>

            {/* Testing Instructions */}
            <div className="border rounded-lg p-6 bg-yellow-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Testing Instructions
              </h2>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li>Try entering values outside 0-100 range to see validation errors</li>
                <li>Use arrow keys (↑/↓) to increment/decrement values</li>
                <li>Hold Shift + arrow keys to increment/decrement by 10</li>
                <li>Press Enter to commit changes, Escape to cancel</li>
                <li>Try entering decimal values in non-decimal inputs</li>
                <li>Notice that parent tasks are read-only with lock icons</li>
                <li>Observe different validation states and icons</li>
              </ul>
            </div>

            {/* Implementation Details */}
            <div className="border rounded-lg p-6 bg-green-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                AC1 Implementation Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">✅ Implemented Features</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Progress validation (0-100%) for leaf tasks</li>
                    <li>• Read-only mode for parent tasks</li>
                    <li>• Visual feedback with icons and colors</li>
                    <li>• Real-time validation</li>
                    <li>• Keyboard shortcuts</li>
                    <li>• Decimal precision control</li>
                    <li>• Accessibility support</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">🎯 Validation Rules</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Range: 0-100%</li>
                    <li>• Leaf tasks only (editable)</li>
                    <li>• Parent tasks computed from children</li>
                    <li>• Decimal support configurable</li>
                    <li>• Custom validation messages</li>
                    <li>• Error state persistence</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}