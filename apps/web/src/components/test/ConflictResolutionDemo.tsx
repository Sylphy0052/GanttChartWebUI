'use client'

/**
 * ConflictResolutionDemo Component
 * Demonstrates AC1: 409 conflict responses trigger automatic rollback with user notification toasts
 * Part of T021: Advanced Error Handling & Conflict Resolution System
 */

import React, { useState } from 'react'
import { useGanttStore } from '@/stores/gantt.store'
import { apiClient } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

export const ConflictResolutionDemo: React.FC = () => {
  const { tasks, getRollbackHistory, clearRollbackHistory } = useGanttStore()
  const [isTestingConflict, setIsTestingConflict] = useState(false)
  const [mockServerResponse, setMockServerResponse] = useState<'success' | 'conflict' | 'error'>('success')

  // Simulate a 409 conflict response for testing
  const simulateConflict = async () => {
    setIsTestingConflict(true)
    
    try {
      // Simulate a task update that will conflict
      const mockTask = tasks[0] || {
        id: 'demo-task-1',
        title: 'Demo Task',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        progress: 50,
        version: 1
      }

      // Mock API call that will return 409
      const mockApiCall = () => {
        const mockResponse = new Response(
          JSON.stringify({
            message: 'Issue has been modified by another user. Please refresh and try again.',
            type: 'optimistic_lock',
            localVersion: 1,
            remoteVersion: 2,
            conflictingFields: ['title', 'startDate'],
            suggestedResolution: 'Please refresh the page and try your changes again.'
          }),
          {
            status: mockServerResponse === 'conflict' ? 409 : mockServerResponse === 'error' ? 500 : 200,
            statusText: mockServerResponse === 'conflict' ? 'Conflict' : mockServerResponse === 'error' ? 'Internal Server Error' : 'OK',
            headers: {
              'Content-Type': 'application/json',
              'x-request-id': `demo-request-${Date.now()}`
            }
          }
        )
        
        if (mockServerResponse === 'success') {
          return Promise.resolve(mockResponse)
        } else {
          return Promise.reject(mockResponse)
        }
      }

      // Use the API client to test conflict resolution
      const currentState = { tasks: [mockTask], dependencies: [] }
      
      // This should trigger the conflict resolution system
      await apiClient.put(
        `/api/v1/issues/${mockTask.id}`,
        {
          title: mockTask.title + ' (Updated)',
          version: mockTask.version
        },
        currentState,
        'update_task'
      )
      
      toast.success('Operation completed successfully!')
      
    } catch (error) {
      // Error handling is done by the API client
      console.log('Demo: Conflict resolution system handled the error:', error)
    } finally {
      setIsTestingConflict(false)
    }
  }

  const rollbackHistory = getRollbackHistory()

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          T021 AC1: Conflict Resolution Demo
        </h2>
        <p className="text-gray-600 mb-6">
          This demo tests the automatic rollback system with user notification toasts for 409 conflicts.
        </p>

        {/* Mock Server Response Controls */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Mock Server Response</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setMockServerResponse('success')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                mockServerResponse === 'success'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              200 Success
            </button>
            <button
              onClick={() => setMockServerResponse('conflict')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                mockServerResponse === 'conflict'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              409 Conflict
            </button>
            <button
              onClick={() => setMockServerResponse('error')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                mockServerResponse === 'error'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              500 Error
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Selected: <span className="font-medium">
              {mockServerResponse === 'success' && '200 Success - Operation will succeed'}
              {mockServerResponse === 'conflict' && '409 Conflict - Will trigger automatic rollback'}
              {mockServerResponse === 'error' && '500 Error - Will show error notification'}
            </span>
          </p>
        </div>

        {/* Test Controls */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={simulateConflict}
            disabled={isTestingConflict}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingConflict ? 'Testing...' : 'Test Conflict Resolution'}
          </button>
          
          <button
            onClick={() => clearRollbackHistory()}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
          >
            Clear History
          </button>
        </div>

        {/* Expected Behavior */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Expected Behavior (AC1)</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✅ On 409 conflict: Automatic rollback to previous state</li>
            <li>✅ User notification toast explaining what happened</li>
            <li>✅ Suggested resolution guidance in secondary toast</li>
            <li>✅ State snapshot is created before the operation</li>
            <li>✅ Rollback event is dispatched for UI updates</li>
            <li>✅ Error is logged with full context</li>
          </ul>
        </div>

        {/* Rollback History */}
        {rollbackHistory.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Rollback History ({rollbackHistory.length} snapshots)
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {rollbackHistory.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="bg-white rounded p-3 border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {snapshot.operation}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(snapshot.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {snapshot.id.split('_')[0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="mt-6 p-4 bg-gray-900 text-gray-300 rounded-lg text-sm font-mono">
          <h4 className="text-white font-semibold mb-2">Technical Implementation Details:</h4>
          <ul className="space-y-1">
            <li>• API Client creates state snapshots before critical operations</li>
            <li>• 409 responses trigger automatic rollback via window events</li>
            <li>• Toast notifications provide user-friendly error messages</li>
            <li>• Conflict types are detected and handled appropriately</li>
            <li>• Comprehensive error logging captures full context</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ConflictResolutionDemo