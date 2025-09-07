/**
 * Auto-Scheduling Command Tests - T010 AC4 & AC5 Verification
 * 
 * These tests verify that the auto-scheduling system correctly implements:
 * - AC4: Predecessor move triggers successor auto-shift
 * - AC5: Auto-adjustment results are included in undo operations
 */

import { AutoSchedulingCommand, createAutoSchedulingCommand } from '../AutoSchedulingCommand'
import { BarMoveCommand } from '../BarOperationCommand'
import { DependencyScheduler } from '../../scheduling/dependencyScheduler'
import { GanttTask, GanttDependency } from '@/types/gantt'

// Mock the performance monitor
jest.mock('@/lib/performance', () => ({
  ganttPerformanceMonitor: {
    startMeasurement: jest.fn(),
    endMeasurement: jest.fn(),
    recordMetrics: jest.fn()
  }
}))

describe('AutoSchedulingCommand - T010 AC4 & AC5', () => {
  let mockTasks: GanttTask[]
  let mockDependencies: GanttDependency[]
  let mockOnTaskUpdate: jest.MockedFunction<(taskId: string, startDate: Date, endDate: Date) => Promise<void>>

  beforeEach(() => {
    // Create test data with dependency chain: Task A → Task B → Task C
    mockTasks = [
      {
        id: 'task-a',
        title: 'Task A',
        startDate: '2024-01-01',
        endDate: '2024-01-03',
        progress: 0,
        assignee: 'user1',
        priority: 'medium',
        status: 'todo'
      },
      {
        id: 'task-b',
        title: 'Task B',
        startDate: '2024-01-04', // Starts after Task A ends
        endDate: '2024-01-06',
        progress: 0,
        assignee: 'user2',
        priority: 'medium',
        status: 'todo'
      },
      {
        id: 'task-c',
        title: 'Task C',
        startDate: '2024-01-07', // Starts after Task B ends
        endDate: '2024-01-09',
        progress: 0,
        assignee: 'user3',
        priority: 'medium',
        status: 'todo'
      }
    ]

    mockDependencies = [
      {
        id: 'dep-1',
        predecessorId: 'task-a',
        successorId: 'task-b',
        fromTaskId: 'task-a',
        toTaskId: 'task-b',
        type: 'FS',
        lag: 0,
        lagUnit: 'hours'
      },
      {
        id: 'dep-2',
        predecessorId: 'task-b',
        successorId: 'task-c',
        fromTaskId: 'task-b',
        toTaskId: 'task-c',
        type: 'FS',
        lag: 0,
        lagUnit: 'hours'
      }
    ]

    mockOnTaskUpdate = jest.fn().mockResolvedValue(undefined)
    jest.clearAllMocks()
  })

  describe('AC4: Predecessor move triggers successor auto-shift', () => {
    it('should automatically shift successor tasks when predecessor moves', async () => {
      // Create primary command to move Task A forward by 2 days
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-03'), // Move forward by 2 days
        newEndDate: new Date('2024-01-05'),
        onExecute: mockOnTaskUpdate
      })

      // Create auto-scheduling command
      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      // Execute the command
      await autoSchedulingCommand.execute()

      // Verify that all tasks were updated
      expect(mockOnTaskUpdate).toHaveBeenCalledTimes(3) // Task A + Task B + Task C

      // Verify Task A was moved to new dates
      expect(mockOnTaskUpdate).toHaveBeenCalledWith(
        'task-a',
        new Date('2024-01-03'),
        new Date('2024-01-05')
      )

      // Verify Task B was automatically shifted to start after Task A ends
      expect(mockOnTaskUpdate).toHaveBeenCalledWith(
        'task-b',
        new Date('2024-01-05'), // Should start when Task A ends
        expect.any(Date)
      )

      // Verify Task C was automatically shifted to start after Task B ends
      expect(mockOnTaskUpdate).toHaveBeenCalledWith(
        'task-c',
        expect.any(Date),
        expect.any(Date)
      )

      // Verify affected tasks were identified
      const affectedTaskIds = autoSchedulingCommand.getAffectedTaskIds()
      expect(affectedTaskIds).toContain('task-b')
      expect(affectedTaskIds).toContain('task-c')

      // Verify dependency chain was tracked
      const dependencyChain = autoSchedulingCommand.getDependencyChain()
      expect(dependencyChain).toEqual(['task-a', 'task-b', 'task-c'])
    })

    it('should handle cascading dependencies correctly', async () => {
      // Create primary command to move Task A
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-05'),
        newEndDate: new Date('2024-01-07'),
        onExecute: mockOnTaskUpdate
      })

      // Create auto-scheduling command
      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      await autoSchedulingCommand.execute()

      // Get the scheduling result
      const schedulingResult = autoSchedulingCommand.getSchedulingResult()
      
      expect(schedulingResult).toBeTruthy()
      expect(schedulingResult!.totalAffectedTasks).toBe(2) // Task B and Task C
      expect(schedulingResult!.cascadingLevels).toBeGreaterThan(0)
      expect(schedulingResult!.dependencyChain).toEqual(['task-a', 'task-b', 'task-c'])
    })

    it('should not trigger auto-scheduling when no dependencies exist', async () => {
      // Create primary command for a task with no successors
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-c',
        originalStartDate: new Date('2024-01-07'),
        originalEndDate: new Date('2024-01-09'),
        newStartDate: new Date('2024-01-10'),
        newEndDate: new Date('2024-01-12'),
        onExecute: mockOnTaskUpdate
      })

      // Create auto-scheduling command
      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      await autoSchedulingCommand.execute()

      // Only the primary task should be updated
      expect(mockOnTaskUpdate).toHaveBeenCalledTimes(1)
      expect(mockOnTaskUpdate).toHaveBeenCalledWith(
        'task-c',
        new Date('2024-01-10'),
        new Date('2024-01-12')
      )

      // No affected tasks
      const affectedTaskIds = autoSchedulingCommand.getAffectedTaskIds()
      expect(affectedTaskIds).toHaveLength(0)
    })
  })

  describe('AC5: Auto-adjustment results are included in undo operations', () => {
    it('should undo all changes (primary + auto-scheduled) in a single operation', async () => {
      // Create and execute auto-scheduling command
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-03'),
        newEndDate: new Date('2024-01-05'),
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      await autoSchedulingCommand.execute()

      // Clear mock calls from execute
      mockOnTaskUpdate.mockClear()

      // Verify command can be undone
      expect(autoSchedulingCommand.canUndo()).toBe(true)

      // Perform undo
      await autoSchedulingCommand.undo()

      // Verify all tasks were reverted (same number of calls as execute)
      expect(mockOnTaskUpdate).toHaveBeenCalledTimes(3) // All 3 tasks reverted

      // Verify Task A was reverted to original dates
      expect(mockOnTaskUpdate).toHaveBeenCalledWith(
        'task-a',
        new Date('2024-01-01'),
        new Date('2024-01-03')
      )

      // Verify other tasks were also reverted
      expect(mockOnTaskUpdate).toHaveBeenCalledWith('task-b', expect.any(Date), expect.any(Date))
      expect(mockOnTaskUpdate).toHaveBeenCalledWith('task-c', expect.any(Date), expect.any(Date))

      // Verify command is now undone
      expect(autoSchedulingCommand.canUndo()).toBe(false)
      expect(autoSchedulingCommand.canRedo()).toBe(true)
    })

    it('should maintain atomicity - if undo fails partway, all changes should be attempted', async () => {
      // Create command that will partially fail during undo
      mockOnTaskUpdate
        .mockResolvedValueOnce(undefined) // Task A execute - success
        .mockResolvedValueOnce(undefined) // Task B execute - success  
        .mockResolvedValueOnce(undefined) // Task C execute - success
        .mockRejectedValueOnce(new Error('Task A undo failed')) // Task A undo - fail
        .mockResolvedValueOnce(undefined) // Task B undo - success
        .mockResolvedValueOnce(undefined) // Task C undo - success

      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-03'),
        newEndDate: new Date('2024-01-05'),
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      await autoSchedulingCommand.execute()
      mockOnTaskUpdate.mockClear()

      // Undo should fail but attempt all reverts
      await expect(autoSchedulingCommand.undo()).rejects.toThrow('Task A undo failed')

      // All tasks should have been attempted to undo
      expect(mockOnTaskUpdate).toHaveBeenCalledTimes(3)
    })

    it('should handle redo after undo correctly', async () => {
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-03'),
        newEndDate: new Date('2024-01-05'),
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      // Execute -> Undo -> Execute (redo)
      await autoSchedulingCommand.execute()
      await autoSchedulingCommand.undo()
      
      mockOnTaskUpdate.mockClear()
      
      // Re-execute should work like redo
      await autoSchedulingCommand.execute()

      // Verify all tasks are updated again
      expect(mockOnTaskUpdate).toHaveBeenCalledTimes(3)
      
      // Verify Task A moved to new position again
      expect(mockOnTaskUpdate).toHaveBeenCalledWith(
        'task-a',
        new Date('2024-01-03'),
        new Date('2024-01-05')
      )
    })
  })

  describe('Command validation and error handling', () => {
    it('should validate primary command before execution', () => {
      // Create invalid primary command (end before start)
      const invalidPrimaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-05'),
        newEndDate: new Date('2024-01-02'), // Invalid: end before start
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand: invalidPrimaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      expect(autoSchedulingCommand.validate()).toBe(false)
    })

    it('should handle circular dependencies gracefully', () => {
      // Create circular dependency: A → B → C → A
      const circularDependencies: GanttDependency[] = [
        ...mockDependencies,
        {
          id: 'dep-3',
          predecessorId: 'task-c',
          successorId: 'task-a',
          fromTaskId: 'task-c',
          toTaskId: 'task-a',
          type: 'FS',
          lag: 0,
          lagUnit: 'hours'
        }
      ]

      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-03'),
        newEndDate: new Date('2024-01-05'),
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: circularDependencies,
        onTaskUpdate: mockOnTaskUpdate,
        schedulingOptions: {
          enableCircularDetection: true
        }
      })

      // Should detect circular dependencies during planning
      // Implementation may vary - could throw error or handle gracefully
      // This test ensures the system doesn't crash
      expect(() => autoSchedulingCommand.validate()).not.toThrow()
    })
  })

  describe('Performance and telemetry', () => {
    it('should record telemetry for scheduling operations', async () => {
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-03'),
        newEndDate: new Date('2024-01-05'),
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      // Mock console.log to capture telemetry
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await autoSchedulingCommand.execute()

      // Verify telemetry was recorded
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-Scheduling Planning Telemetry'),
        expect.any(Object)
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-Scheduling Command EXECUTE Telemetry'),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should provide detailed scheduling result information', async () => {
      const primaryCommand = new BarMoveCommand({
        taskId: 'task-a',
        originalStartDate: new Date('2024-01-01'),
        originalEndDate: new Date('2024-01-03'),
        newStartDate: new Date('2024-01-05'),
        newEndDate: new Date('2024-01-07'),
        onExecute: mockOnTaskUpdate
      })

      const autoSchedulingCommand = createAutoSchedulingCommand({
        primaryCommand,
        tasks: mockTasks,
        dependencies: mockDependencies,
        onTaskUpdate: mockOnTaskUpdate
      })

      await autoSchedulingCommand.execute()

      const result = autoSchedulingCommand.getSchedulingResult()
      
      expect(result).toMatchObject({
        affectedTasks: expect.arrayContaining([
          expect.objectContaining({
            taskId: 'task-b',
            originalStartDate: expect.any(Date),
            newStartDate: expect.any(Date),
            reason: expect.stringContaining('FS dependency')
          })
        ]),
        dependencyChain: expect.arrayContaining(['task-a', 'task-b']),
        totalAffectedTasks: expect.any(Number),
        cascadingLevels: expect.any(Number)
      })
    })
  })
})