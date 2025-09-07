/**
 * Tests for IssueEditCommand
 * 
 * This test suite verifies the undo/redo functionality for issue editing operations.
 * It tests both single-field and multi-field updates with proper validation and
 * error handling.
 */

import { IssueEditCommand, createFieldSpecificCommand, createCompositeIssueEditCommand } from '../IssueEditCommand'
import { Issue, UpdateIssueData } from '@/types/issue'

// Mock data
const mockIssue: Issue = {
  id: 'test-issue-1',
  projectId: 'test-project-1',
  title: 'Original Title',
  description: 'Original description',
  status: 'todo',
  type: 'feature',
  priority: 50,
  estimateValue: 8,
  estimateUnit: 'h',
  spent: 0,
  assigneeId: 'user1',
  startDate: '2024-01-01T00:00:00Z',
  dueDate: '2024-01-08T00:00:00Z',
  progress: 0,
  labels: ['frontend', 'important'],
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}

describe('IssueEditCommand', () => {
  let mockUpdateFunction: jest.Mock
  let mockOnSuccess: jest.Mock
  let mockOnError: jest.Mock
  let updatedIssue: Issue

  beforeEach(() => {
    updatedIssue = {
      ...mockIssue,
      version: 2,
      updatedAt: '2024-01-02T00:00:00Z'
    }

    mockUpdateFunction = jest.fn().mockResolvedValue(updatedIssue)
    mockOnSuccess = jest.fn()
    mockOnError = jest.fn()

    jest.clearAllMocks()
    console.log = jest.fn() // Mock console.log
    console.error = jest.fn() // Mock console.error
  })

  describe('Single Field Updates', () => {
    it('should successfully update a single field', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'title',
        mockIssue.title,
        'Updated Title',
        mockUpdateFunction,
        { onSuccess: mockOnSuccess, onError: mockOnError }
      )

      // Verify initial state
      expect(command.type).toBe('issue-edit')
      expect(command.description).toContain('title')
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(false)
      expect(command.validate()).toBe(true)

      // Execute command
      await command.execute()

      // Verify execution
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { title: 'Updated Title' })
      expect(mockOnSuccess).toHaveBeenCalledWith(updatedIssue)
      expect(command.canUndo()).toBe(true)
      expect(command.canRedo()).toBe(false)

      // Test undo
      const reverseUpdatedIssue = { ...mockIssue, title: 'Original Title' }
      mockUpdateFunction.mockResolvedValueOnce(reverseUpdatedIssue)

      await command.undo()

      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { title: 'Original Title' })
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(true)
    })

    it('should handle priority field updates with validation', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'priority',
        mockIssue.priority,
        75,
        mockUpdateFunction,
        { onSuccess: mockOnSuccess, onError: mockOnError }
      )

      await command.execute()

      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { priority: 75 })
      expect(command.getModifiedFields()).toEqual(['priority'])
      expect(command.wasFieldModified('priority')).toBe(true)
      expect(command.getOriginalFieldValue('priority')).toBe(50)
      expect(command.getUpdatedFieldValue('priority')).toBe(75)
    })

    it('should handle status changes correctly', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'status',
        mockIssue.status,
        'doing',
        mockUpdateFunction,
        { onSuccess: mockOnSuccess, onError: mockOnError }
      )

      await command.execute()
      
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { status: 'doing' })
      
      // Test undo
      mockUpdateFunction.mockResolvedValueOnce({ ...mockIssue, status: 'todo' })
      await command.undo()
      
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { status: 'todo' })
    })
  })

  describe('Multi-Field Updates', () => {
    it('should successfully update multiple fields', async () => {
      const updateData: UpdateIssueData = {
        title: 'New Title',
        priority: 80,
        status: 'doing',
        progress: 25
      }

      const command = createCompositeIssueEditCommand(
        mockIssue.id,
        mockIssue,
        updateData,
        mockUpdateFunction,
        { onSuccess: mockOnSuccess, onError: mockOnError }
      )

      // Verify initial state
      expect(command.description).toContain('4個のフィールド')
      expect(command.validate()).toBe(true)

      // Execute command
      await command.execute()

      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', updateData)
      expect(mockOnSuccess).toHaveBeenCalledWith(updatedIssue)
      expect(command.getModifiedFields()).toEqual(['title', 'priority', 'status', 'progress'])

      // Test undo
      const reverseData: UpdateIssueData = {
        title: mockIssue.title,
        priority: mockIssue.priority,
        status: mockIssue.status,
        progress: mockIssue.progress
      }

      mockUpdateFunction.mockResolvedValueOnce({ ...mockIssue, ...reverseData })
      await command.undo()

      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', reverseData)
    })

    it('should handle partial field updates correctly', async () => {
      const updateData: UpdateIssueData = {
        description: 'Updated description',
        estimateValue: 12
      }

      const command = createCompositeIssueEditCommand(
        mockIssue.id,
        mockIssue,
        updateData,
        mockUpdateFunction
      )

      await command.execute()

      // Verify only specified fields are updated
      expect(command.getModifiedFields()).toEqual(['description', 'estimateValue'])
      expect(command.wasFieldModified('description')).toBe(true)
      expect(command.wasFieldModified('estimateValue')).toBe(true)
      expect(command.wasFieldModified('title')).toBe(false)
    })
  })

  describe('Validation', () => {
    it('should validate title field correctly', () => {
      const command = new IssueEditCommand({
        issueId: 'test',
        originalData: { title: 'Original' },
        updatedData: { title: '' }, // Invalid empty title
        updateFunction: mockUpdateFunction
      })

      expect(command.validate()).toBe(false)
    })

    it('should validate priority range', () => {
      const command = new IssueEditCommand({
        issueId: 'test',
        originalData: { priority: 50 },
        updatedData: { priority: 150 }, // Invalid - over 100
        updateFunction: mockUpdateFunction
      })

      expect(command.validate()).toBe(false)
    })

    it('should validate progress range', () => {
      const command = new IssueEditCommand({
        issueId: 'test',
        originalData: { progress: 0 },
        updatedData: { progress: -10 }, // Invalid - negative
        updateFunction: mockUpdateFunction
      })

      expect(command.validate()).toBe(false)
    })

    it('should validate status values', () => {
      const command = new IssueEditCommand({
        issueId: 'test',
        originalData: { status: 'todo' },
        updatedData: { status: 'invalid-status' as any }, // Invalid status
        updateFunction: mockUpdateFunction
      })

      expect(command.validate()).toBe(false)
    })

    it('should allow valid data', () => {
      const command = new IssueEditCommand({
        issueId: 'test',
        originalData: { title: 'Old', priority: 30 },
        updatedData: { title: 'New Title', priority: 70 },
        updateFunction: mockUpdateFunction
      })

      expect(command.validate()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle execution errors properly', async () => {
      const error = new Error('API update failed')
      mockUpdateFunction.mockRejectedValueOnce(error)

      const command = createFieldSpecificCommand(
        mockIssue.id,
        'title',
        mockIssue.title,
        'New Title',
        mockUpdateFunction,
        { onSuccess: mockOnSuccess, onError: mockOnError }
      )

      await expect(command.execute()).rejects.toThrow('API update failed')
      expect(mockOnError).toHaveBeenCalledWith(error)
      expect(mockOnSuccess).not.toHaveBeenCalled()
      expect(command.canUndo()).toBe(false)
    })

    it('should handle undo errors properly', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'title',
        mockIssue.title,
        'New Title',
        mockUpdateFunction,
        { onSuccess: mockOnSuccess, onError: mockOnError }
      )

      // First execute successfully
      await command.execute()
      expect(command.canUndo()).toBe(true)

      // Then fail on undo
      const undoError = new Error('Undo API failed')
      mockUpdateFunction.mockRejectedValueOnce(undoError)

      await expect(command.undo()).rejects.toThrow('Undo API failed')
      expect(mockOnError).toHaveBeenCalledWith(undoError)
    })

    it('should not allow undo when not executable', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'title',
        mockIssue.title,
        'New Title',
        mockUpdateFunction
      )

      // Try to undo without executing
      await expect(command.undo()).rejects.toThrow('Cannot undo: command not in undoable state')
    })
  })

  describe('Command State Management', () => {
    it('should track execution state correctly', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'title',
        mockIssue.title,
        'New Title',
        mockUpdateFunction
      )

      // Initial state
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(false)

      // After execution
      await command.execute()
      expect(command.canUndo()).toBe(true)
      expect(command.canRedo()).toBe(false)

      // After undo
      await command.undo()
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(true)
    })

    it('should provide correct preview data', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'title',
        'Original Title',
        'New Title',
        mockUpdateFunction
      )

      expect(command.getUndoPreview()).toEqual({ title: 'Original Title' })
      expect(command.getRedoPreview()).toEqual({ title: 'New Title' })
    })

    it('should serialize command data properly', () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'priority',
        50,
        75,
        mockUpdateFunction
      )

      const serialized = JSON.parse(command.serialize())
      
      expect(serialized.type).toBe('issue-edit')
      expect(serialized.issueId).toBe('test-issue-1')
      expect(serialized.fieldName).toBe('priority')
      expect(serialized.originalData).toEqual({ priority: 50 })
      expect(serialized.updatedData).toEqual({ priority: 75 })
      expect(serialized.modifiedFields).toEqual(['priority'])
    })
  })

  describe('Field-Specific Operations', () => {
    it('should handle date field updates', async () => {
      const newDate = '2024-02-01'
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'startDate',
        mockIssue.startDate,
        newDate,
        mockUpdateFunction
      )

      await command.execute()
      
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { startDate: newDate })
      expect(command.getOriginalFieldValue('startDate')).toBe(mockIssue.startDate)
      expect(command.getUpdatedFieldValue('startDate')).toBe(newDate)
    })

    it('should handle assignee updates', async () => {
      const command = createFieldSpecificCommand(
        mockIssue.id,
        'assigneeId',
        mockIssue.assigneeId,
        'user2',
        mockUpdateFunction
      )

      await command.execute()
      
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { assigneeId: 'user2' })
      
      // Test undo
      await command.undo()
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', { assigneeId: 'user1' })
    })

    it('should handle estimate updates', async () => {
      const updateData = {
        estimateValue: 16,
        estimateUnit: 'd' as const
      }

      const command = createCompositeIssueEditCommand(
        mockIssue.id,
        mockIssue,
        updateData,
        mockUpdateFunction
      )

      await command.execute()
      
      expect(mockUpdateFunction).toHaveBeenCalledWith('test-issue-1', updateData)
      expect(command.getModifiedFields()).toEqual(['estimateValue', 'estimateUnit'])
    })
  })
})