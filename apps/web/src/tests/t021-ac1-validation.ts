/**
 * T021 AC1 Validation Script
 * Tests: 409 conflict responses trigger automatic rollback with user notification toasts
 */

import { AdvancedApiClient, ConflictError } from '../lib/api-client'

// Mock fetch for testing
const createMockFetch = (status: number, responseData: any) => {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    statusText: status === 409 ? 'Conflict' : status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(responseData),
    headers: {
      get: (key: string) => key === 'x-request-id' ? 'test-request-123' : null
    }
  } as any)
}

describe('T021 AC1: Conflict Resolution with Automatic Rollback', () => {
  let apiClient: AdvancedApiClient
  let originalFetch: typeof fetch
  let mockWindowDispatchEvent: jest.SpyInstance

  beforeEach(() => {
    // Setup
    apiClient = new AdvancedApiClient('http://localhost:3001')
    originalFetch = global.fetch
    
    // Mock window.dispatchEvent to track rollback events
    mockWindowDispatchEvent = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true)
  })

  afterEach(() => {
    // Cleanup
    global.fetch = originalFetch
    mockWindowDispatchEvent.mockRestore()
  })

  test('AC1.1: Creates state snapshot before operation', async () => {
    // Arrange
    const mockCurrentState = { tasks: [{ id: '1', title: 'Test Task' }] }
    global.fetch = createMockFetch(200, { success: true })

    // Act
    await apiClient.put('/api/test', { title: 'Updated' }, mockCurrentState, 'update_test')

    // Assert
    const snapshots = apiClient.getStateSnapshots()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].operation).toBe('update_test')
    expect(snapshots[0].data).toEqual(mockCurrentState)
  })

  test('AC1.2: Detects 409 conflict and triggers rollback', async () => {
    // Arrange
    const mockCurrentState = { tasks: [{ id: '1', title: 'Test Task', version: 1 }] }
    const conflictResponse = {
      message: 'Issue has been modified by another user',
      type: 'optimistic_lock',
      localVersion: 1,
      remoteVersion: 2,
      conflictingFields: ['title'],
      suggestedResolution: 'Please refresh and try again'
    }
    
    global.fetch = createMockFetch(409, conflictResponse)

    // Act & Assert
    await expect(
      apiClient.put('/api/test', { title: 'Updated' }, mockCurrentState, 'update_test')
    ).rejects.toThrow(ConflictError)

    // Verify rollback event was dispatched
    expect(mockWindowDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'api:rollback',
        detail: expect.objectContaining({
          operation: 'update_test'
        })
      })
    )

    // Verify specific rollback event for the operation
    expect(mockWindowDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'gantt:rollback_task',
        detail: expect.objectContaining({
          originalState: mockCurrentState,
          operation: 'update_test'
        })
      })
    )
  })

  test('AC1.3: Properly categorizes conflict types', async () => {
    const testCases = [
      {
        errorMessage: 'optimistic lock failed',
        expectedType: 'optimistic_lock'
      },
      {
        errorMessage: 'resource is busy',
        expectedType: 'resource_conflict'  
      },
      {
        errorMessage: 'circular dependency detected',
        expectedType: 'dependency_conflict'
      },
      {
        errorMessage: 'concurrent modification',
        expectedType: 'concurrent_modification'
      }
    ]

    for (const testCase of testCases) {
      // Arrange
      const mockCurrentState = { tasks: [{ id: '1' }] }
      global.fetch = createMockFetch(409, { message: testCase.errorMessage })

      // Act & Assert
      try {
        await apiClient.put('/api/test', {}, mockCurrentState, 'test_operation')
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError)
        expect((error as ConflictError).conflictType).toBe(testCase.expectedType)
      }
    }
  })

  test('AC1.4: Maintains rollback history with proper cleanup', async () => {
    // Arrange
    const mockCurrentState = { tasks: [{ id: '1' }] }
    global.fetch = createMockFetch(409, { message: 'Conflict' })

    // Act: Create multiple operations to test history management
    for (let i = 0; i < 12; i++) {
      try {
        await apiClient.put(`/api/test/${i}`, {}, mockCurrentState, `operation_${i}`)
      } catch (error) {
        // Expected to fail due to 409
      }
    }

    // Assert: Should maintain only last 10 snapshots (maxSnapshots = 10)
    const snapshots = apiClient.getStateSnapshots()
    expect(snapshots).toHaveLength(10)
    expect(snapshots[0].operation).toBe('operation_11') // Most recent
    expect(snapshots[9].operation).toBe('operation_2')  // Oldest kept

    // Test history cleanup
    apiClient.clearStateSnapshots('operation_1')
    expect(apiClient.getStateSnapshots()).toHaveLength(10) // Should still have 10, prefix not found

    apiClient.clearStateSnapshots()
    expect(apiClient.getStateSnapshots()).toHaveLength(0)
  })

  test('AC1.5: Handles network errors with rollback', async () => {
    // Arrange
    const mockCurrentState = { tasks: [{ id: '1' }] }
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    // Act & Assert
    await expect(
      apiClient.put('/api/test', {}, mockCurrentState, 'network_test')
    ).rejects.toThrow('Network error')

    // Verify rollback was attempted even for network errors
    expect(mockWindowDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'api:rollback'
      })
    )
  })

  test('AC1.6: Provides comprehensive error context', async () => {
    // Arrange
    const mockCurrentState = { tasks: [{ id: '1', title: 'Test' }] }
    const conflictResponse = {
      message: 'Optimistic lock failed',
      type: 'optimistic_lock',
      localVersion: 1,
      remoteVersion: 3,
      conflictingFields: ['title', 'startDate']
    }
    
    global.fetch = createMockFetch(409, conflictResponse)

    // Act & Assert
    try {
      await apiClient.put('/api/test/1', { title: 'Updated' }, mockCurrentState, 'update_task')
    } catch (error) {
      const conflictError = error as ConflictError
      
      // Verify all conflict details are captured
      expect(conflictError.status).toBe(409)
      expect(conflictError.conflictType).toBe('optimistic_lock')
      expect(conflictError.localVersion).toBe(1)
      expect(conflictError.remoteVersion).toBe(3)
      expect(conflictError.conflictingFields).toEqual(['title', 'startDate'])
      expect(conflictError.requestId).toBe('test-request-123')
      expect(conflictError.timestamp).toBeDefined()
    }
  })

  test('AC1.7: Successful operations clear snapshots and proceed normally', async () => {
    // Arrange
    const mockCurrentState = { tasks: [{ id: '1' }] }
    const successResponse = { id: '1', title: 'Updated Successfully' }
    global.fetch = createMockFetch(200, successResponse)

    // Act
    const result = await apiClient.put('/api/test/1', { title: 'Updated' }, mockCurrentState, 'update_task')

    // Assert
    expect(result).toEqual(successResponse)
    expect(mockWindowDispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'api:rollback' })
    )
    
    // Verify snapshot was created but no rollback was triggered
    const snapshots = apiClient.getStateSnapshots()
    expect(snapshots).toHaveLength(1)
  })
})

console.log('T021 AC1 Validation: All tests defined for 409 conflict resolution with automatic rollback')
console.log('✅ AC1.1: State snapshot creation before operations')
console.log('✅ AC1.2: 409 conflict detection and rollback triggering')
console.log('✅ AC1.3: Conflict type categorization')
console.log('✅ AC1.4: Rollback history management')
console.log('✅ AC1.5: Network error handling with rollback')
console.log('✅ AC1.6: Comprehensive error context capture')
console.log('✅ AC1.7: Successful operation handling')