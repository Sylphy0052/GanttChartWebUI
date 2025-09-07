/**
 * T010 AC6 & AC7 Verification Tests
 * 
 * These tests verify that:
 * - AC6: History stack management (max 20 items) works correctly
 * - AC7: Telemetry for undo/redo operations is properly sent
 */

import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from '../useUndoRedo'
import { BaseCommand } from '@/lib/commands/BaseCommand'

// Mock the audit logs API
jest.mock('@/lib/api/audit-logs', () => ({
  auditLogsApi: {
    getAuditLogs: jest.fn().mockResolvedValue({ entries: [], total: 0, hasMore: false })
  }
}))

// Mock performance monitor
jest.mock('@/lib/performance', () => ({
  ganttPerformanceMonitor: {
    startMeasurement: jest.fn(),
    endMeasurement: jest.fn(),
    getMemoryUsage: jest.fn(() => ({ heap: 1000, external: 500 })),
    getLastRenderTime: jest.fn(() => 16.7)
  }
}))

// Simple test command
class TestCommand extends BaseCommand {
  private value: number
  private executed = false

  constructor(value: number) {
    super('test', `Test command with value ${value}`)
    this.value = value
  }

  async execute() {
    this.executed = true
  }

  async undo() {
    this.executed = false
  }

  canUndo() {
    return this.executed
  }

  canRedo() {
    return !this.executed
  }
}

describe('T010 AC6: History Stack Management (Max 20 items)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear console spies
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should maintain history stack with max 20 items', async () => {
    const { result } = renderHook(() => useUndoRedo({
      maxHistorySize: 20,
      telemetryEnabled: false, // Disable for this test
      projectId: 'test-project'
    }))

    // Execute 25 commands (5 more than max)
    for (let i = 0; i < 25; i++) {
      const command = new TestCommand(i)
      await act(async () => {
        await result.current.executeCommand(command)
      })
    }

    // Should only keep the most recent 20 commands
    expect(result.current.historyCount).toBe(20)
    
    // Should be able to undo all 20
    let undoCount = 0
    while (result.current.canUndo) {
      await act(async () => {
        await result.current.undo()
      })
      undoCount++
    }
    
    expect(undoCount).toBe(20)
  })

  it('should properly clean up old commands during memory cleanup', async () => {
    const { result } = renderHook(() => useUndoRedo({
      maxHistorySize: 10,
      telemetryEnabled: false,
      projectId: 'test-project'
    }))

    // Execute 15 commands
    for (let i = 0; i < 15; i++) {
      const command = new TestCommand(i)
      await act(async () => {
        await result.current.executeCommand(command)
      })
    }

    // Should truncate to max size
    expect(result.current.historyCount).toBe(10)

    // History should contain commands 5-14 (last 10)
    const history = result.current.getHistory()
    expect(history).toHaveLength(10)
  })

  it('should handle history truncation when adding new commands after undo', async () => {
    const { result } = renderHook(() => useUndoRedo({
      maxHistorySize: 5,
      telemetryEnabled: false
    }))

    // Execute 5 commands
    for (let i = 0; i < 5; i++) {
      const command = new TestCommand(i)
      await act(async () => {
        await result.current.executeCommand(command)
      })
    }

    // Undo 2 commands
    await act(async () => {
      await result.current.undo()
      await result.current.undo()
    })

    expect(result.current.historyCount).toBe(5)
    expect(result.current.canUndo).toBe(true) // Should be at index 2

    // Execute new command - should truncate future history
    const newCommand = new TestCommand(99)
    await act(async () => {
      await result.current.executeCommand(newCommand)
    })

    expect(result.current.historyCount).toBe(4) // 0,1,2,99
    expect(result.current.canRedo).toBe(false) // No future history
  })
})

describe('T010 AC7: Telemetry for Undo/Redo Operations', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should record telemetry for execute operations', async () => {
    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    const command = new TestCommand(42)
    await act(async () => {
      await result.current.executeCommand(command)
    })

    // Check that telemetry was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Undo/Redo EXECUTE Telemetry:'),
      expect.objectContaining({
        operation: 'execute',
        commandType: 'test',
        success: true,
        executionTime: expect.any(Number),
        historySize: expect.any(Number),
        sessionMetrics: expect.objectContaining({
          totalCommands: expect.any(Number),
          maxHistorySize: expect.any(Number)
        }),
        performanceMetrics: expect.objectContaining({
          renderTime: expect.any(Number),
          averageExecutionTime: expect.any(Number)
        })
      })
    )
  })

  it('should record telemetry for undo operations', async () => {
    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    const command = new TestCommand(42)
    await act(async () => {
      await result.current.executeCommand(command)
    })

    // Clear previous logs
    consoleSpy.mockClear()

    await act(async () => {
      await result.current.undo()
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Undo/Redo UNDO Telemetry:'),
      expect.objectContaining({
        operation: 'undo',
        commandType: 'test',
        success: true,
        executionTime: expect.any(Number)
      })
    )
  })

  it('should record telemetry for redo operations', async () => {
    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    const command = new TestCommand(42)
    await act(async () => {
      await result.current.executeCommand(command)
      await result.current.undo()
    })

    // Clear previous logs
    consoleSpy.mockClear()

    await act(async () => {
      await result.current.redo()
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Undo/Redo REDO Telemetry:'),
      expect.objectContaining({
        operation: 'redo',
        commandType: 'test',
        success: true,
        executionTime: expect.any(Number)
      })
    )
  })

  it('should record telemetry for failed operations', async () => {
    // Create a command that will fail
    class FailingCommand extends BaseCommand {
      constructor() {
        super('failing-test', 'Command that fails')
      }

      async execute() {
        throw new Error('Test error')
      }

      async undo() {
        // Won't be called
      }
    }

    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    const command = new FailingCommand()
    
    await act(async () => {
      try {
        await result.current.executeCommand(command)
      } catch (error) {
        // Expected to fail
      }
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Undo/Redo EXECUTE Telemetry:'),
      expect.objectContaining({
        operation: 'execute',
        success: false,
        error: 'Test error',
        errorStack: expect.any(String)
      })
    )
  })

  it('should batch telemetry entries and flush when batch size is reached', async () => {
    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    // Execute 6 commands (more than TELEMETRY_BATCH_SIZE = 5)
    for (let i = 0; i < 6; i++) {
      const command = new TestCommand(i)
      await act(async () => {
        await result.current.executeCommand(command)
      })
    }

    // Should have logged batch flush
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Successfully sent'),
      expect.stringContaining('undo/redo telemetry entries')
    )
  })

  it('should include comprehensive metrics in telemetry', async () => {
    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    const command = new TestCommand(42)
    await act(async () => {
      await result.current.executeCommand(command)
    })

    const telemetryCall = consoleSpy.mock.calls.find(call => 
      call[0].includes('📊 Undo/Redo EXECUTE Telemetry:')
    )
    
    expect(telemetryCall).toBeDefined()
    const telemetryData = telemetryCall[1]
    
    // Verify comprehensive metrics
    expect(telemetryData).toMatchObject({
      operation: 'execute',
      commandId: expect.any(String),
      commandType: 'test',
      description: expect.any(String),
      executionTime: expect.any(Number),
      success: true,
      historySize: expect.any(Number),
      currentIndex: expect.any(Number),
      context: expect.any(Object),
      timestamp: expect.any(String),
      memoryUsage: expect.objectContaining({
        heap: expect.any(Number),
        external: expect.any(Number)
      }),
      sessionMetrics: expect.objectContaining({
        totalCommands: expect.any(Number),
        undoableCommands: expect.any(Number),
        redoableCommands: expect.any(Number),
        maxHistorySize: expect.any(Number)
      }),
      performanceMetrics: expect.objectContaining({
        renderTime: expect.any(Number),
        operationsPerSecond: expect.any(Number),
        averageExecutionTime: expect.any(Number)
      })
    })
  })

  it('should handle telemetry when no projectId is provided', async () => {
    const { result } = renderHook(() => useUndoRedo({
      telemetryEnabled: true,
      // No projectId provided
    }))

    const command = new TestCommand(42)
    await act(async () => {
      await result.current.executeCommand(command)
    })

    // Should still log telemetry locally but not send to API
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Undo/Redo EXECUTE Telemetry:'),
      expect.any(Object)
    )
  })
})

describe('T010 Integration: AC6 & AC7 Combined', () => {
  it('should maintain telemetry accuracy when history stack is truncated', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    const { result } = renderHook(() => useUndoRedo({
      maxHistorySize: 3,
      telemetryEnabled: true,
      projectId: 'test-project'
    }))

    // Execute 5 commands to trigger truncation
    for (let i = 0; i < 5; i++) {
      const command = new TestCommand(i)
      await act(async () => {
        await result.current.executeCommand(command)
      })
    }

    expect(result.current.historyCount).toBe(3)

    // Verify telemetry recorded all operations even though history was truncated
    const telemetryCalls = consoleSpy.mock.calls.filter(call => 
      call[0].includes('📊 Undo/Redo EXECUTE Telemetry:')
    )
    
    expect(telemetryCalls).toHaveLength(5) // All 5 operations should have been logged

    // Verify session metrics are accurate
    const lastTelemetry = telemetryCalls[telemetryCalls.length - 1][1]
    expect(lastTelemetry.sessionMetrics.maxHistorySize).toBe(3)
    
    consoleSpy.mockRestore()
  })
})