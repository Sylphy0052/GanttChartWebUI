/**
 * Test suite for Dependency Command Pattern Implementation
 * 
 * Tests the DependencyCreateCommand and DependencyDeleteCommand classes
 * to ensure proper undo/redo functionality for dependency operations.
 */

import { 
  DependencyCreateCommand,
  DependencyDeleteCommand,
  DependencyCommandFactory,
  DependencyCommandUtils
} from '../DependencyCommand'
import { GanttDependency } from '@/types/gantt'

describe('DependencyCommand', () => {
  const mockProjectId = 'test-project'
  const mockPredecessorId = 'task-1'
  const mockSuccessorId = 'task-2'

  const mockDependency: GanttDependency = {
    id: 'dep-1',
    predecessorId: mockPredecessorId,
    successorId: mockSuccessorId,
    fromTaskId: mockPredecessorId,
    toTaskId: mockSuccessorId,
    type: 'FS',
    lag: 0,
    lagUnit: 'hours'
  }

  let mockOnExecuteCreate: jest.Mock
  let mockOnExecuteDelete: jest.Mock

  beforeEach(() => {
    mockOnExecuteCreate = jest.fn()
    mockOnExecuteDelete = jest.fn()
  })

  describe('DependencyCreateCommand', () => {
    it('should create a command with correct properties', () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyCreateCommand(params)

      expect(command.type).toBe('dependency-create')
      expect(command.description).toBe(`Create dependency: ${mockPredecessorId} → ${mockSuccessorId}`)
      expect(command.id).toMatch(/^cmd_dependency-create_/)
      expect(command.canUndo()).toBe(false) // Not executed yet
      expect(command.canRedo()).toBe(false)
    })

    it('should execute successfully and become undoable', async () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyCreateCommand(params)
      
      await command.execute()

      expect(mockOnExecuteCreate).toHaveBeenCalledWith(mockPredecessorId, mockSuccessorId)
      expect(command.canUndo()).toBe(true)
      expect(command.canRedo()).toBe(false)
      
      const createdDependency = command.getCreatedDependency()
      expect(createdDependency).toBeDefined()
      expect(createdDependency?.predecessorId).toBe(mockPredecessorId)
      expect(createdDependency?.successorId).toBe(mockSuccessorId)
    })

    it('should undo successfully', async () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyCreateCommand(params)
      
      await command.execute()
      await command.undo()

      expect(mockOnExecuteDelete).toHaveBeenCalledWith(mockPredecessorId, mockSuccessorId)
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(true)
    })

    it('should validate parameters correctly', () => {
      const validParams = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const validCommand = new DependencyCreateCommand(validParams)
      expect(validCommand.validate()).toBe(true)

      // Test invalid parameters
      const invalidParams = {
        ...validParams,
        predecessorId: mockPredecessorId,
        successorId: mockPredecessorId // Same as predecessor
      }

      const invalidCommand = new DependencyCreateCommand(invalidParams)
      expect(invalidCommand.validate()).toBe(false)
    })

    it('should throw error if callback not provided', async () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        // Missing onExecuteCreate callback
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyCreateCommand(params)
      
      await expect(command.execute()).rejects.toThrow('Create callback not provided')
    })
  })

  describe('DependencyDeleteCommand', () => {
    it('should create a command with correct properties', () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        existingDependency: mockDependency,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyDeleteCommand(params)

      expect(command.type).toBe('dependency-delete')
      expect(command.description).toBe(`Delete dependency: ${mockPredecessorId} → ${mockSuccessorId}`)
      expect(command.canUndo()).toBe(false) // Not executed yet
      expect(command.canRedo()).toBe(false)
    })

    it('should execute successfully and become undoable', async () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        existingDependency: mockDependency,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyDeleteCommand(params)
      
      await command.execute()

      expect(mockOnExecuteDelete).toHaveBeenCalledWith(mockPredecessorId, mockSuccessorId)
      expect(command.canUndo()).toBe(true)
      expect(command.canRedo()).toBe(false)
    })

    it('should undo successfully by recreating dependency', async () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        existingDependency: mockDependency,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = new DependencyDeleteCommand(params)
      
      await command.execute()
      await command.undo()

      expect(mockOnExecuteCreate).toHaveBeenCalledWith(mockPredecessorId, mockSuccessorId)
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(true)
    })

    it('should validate parameters correctly', () => {
      const validParams = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        existingDependency: mockDependency,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const validCommand = new DependencyDeleteCommand(validParams)
      expect(validCommand.validate()).toBe(true)

      // Test without existing dependency
      const invalidParams = {
        ...validParams,
        existingDependency: undefined
      }

      const invalidCommand = new DependencyDeleteCommand(invalidParams)
      expect(invalidCommand.validate()).toBe(false)
    })
  })

  describe('DependencyCommandFactory', () => {
    it('should create dependency create command', () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = DependencyCommandFactory.createDependencyCreateCommand(params)

      expect(command).toBeInstanceOf(DependencyCreateCommand)
      expect(command.type).toBe('dependency-create')
    })

    it('should create dependency delete command', () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        existingDependency: mockDependency,
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      const command = DependencyCommandFactory.createDependencyDeleteCommand(params)

      expect(command).toBeInstanceOf(DependencyDeleteCommand)
      expect(command.type).toBe('dependency-delete')
    })

    it('should throw error for delete command without existing dependency', () => {
      const params = {
        projectId: mockProjectId,
        predecessorId: mockPredecessorId,
        successorId: mockSuccessorId,
        // Missing existingDependency
        onExecuteCreate: mockOnExecuteCreate,
        onExecuteDelete: mockOnExecuteDelete
      }

      expect(() => {
        DependencyCommandFactory.createDependencyDeleteCommand(params)
      }).toThrow('Existing dependency required for delete command')
    })
  })

  describe('DependencyCommandUtils', () => {
    const mockDependencies: GanttDependency[] = [
      mockDependency,
      {
        id: 'dep-2',
        predecessorId: 'task-2',
        successorId: 'task-3',
        fromTaskId: 'task-2',
        toTaskId: 'task-3',
        type: 'FS',
        lag: 0,
        lagUnit: 'hours'
      }
    ]

    describe('canCreateDependency', () => {
      it('should allow valid dependency creation', () => {
        const result = DependencyCommandUtils.canCreateDependency(
          'task-3', 'task-4', mockDependencies
        )

        expect(result.canCreate).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('should prevent self-dependency', () => {
        const result = DependencyCommandUtils.canCreateDependency(
          'task-1', 'task-1', mockDependencies
        )

        expect(result.canCreate).toBe(false)
        expect(result.reason).toBe('Cannot create dependency from task to itself')
      })

      it('should prevent duplicate dependency', () => {
        const result = DependencyCommandUtils.canCreateDependency(
          mockPredecessorId, mockSuccessorId, mockDependencies
        )

        expect(result.canCreate).toBe(false)
        expect(result.reason).toBe('Dependency already exists')
      })

      it('should prevent direct circular dependency', () => {
        const result = DependencyCommandUtils.canCreateDependency(
          'task-3', 'task-2', mockDependencies
        )

        expect(result.canCreate).toBe(false)
        expect(result.reason).toBe('Would create circular dependency')
      })
    })

    describe('findDependency', () => {
      it('should find existing dependency', () => {
        const dependency = DependencyCommandUtils.findDependency(
          mockPredecessorId, mockSuccessorId, mockDependencies
        )

        expect(dependency).toBe(mockDependency)
      })

      it('should return undefined for non-existing dependency', () => {
        const dependency = DependencyCommandUtils.findDependency(
          'task-5', 'task-6', mockDependencies
        )

        expect(dependency).toBeUndefined()
      })
    })

    describe('getTaskDependencies', () => {
      it('should return task dependencies correctly', () => {
        const result = DependencyCommandUtils.getTaskDependencies('task-2', mockDependencies)

        expect(result.predecessors).toHaveLength(1)
        expect(result.predecessors[0]).toBe(mockDependency)
        expect(result.successors).toHaveLength(1)
        expect(result.successors[0].successorId).toBe('task-3')
      })

      it('should return empty arrays for task with no dependencies', () => {
        const result = DependencyCommandUtils.getTaskDependencies('task-5', mockDependencies)

        expect(result.predecessors).toHaveLength(0)
        expect(result.successors).toHaveLength(0)
      })
    })

    describe('validateParams', () => {
      it('should validate correct parameters', () => {
        const params = {
          projectId: mockProjectId,
          predecessorId: mockPredecessorId,
          successorId: mockSuccessorId,
          dependencyType: 'FS' as const,
          lag: 0
        }

        const result = DependencyCommandUtils.validateParams(params)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should detect missing required fields', () => {
        const params = {
          projectId: '',
          predecessorId: mockPredecessorId,
          successorId: '',
          dependencyType: 'FS' as const,
          lag: 0
        }

        const result = DependencyCommandUtils.validateParams(params)

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Project ID is required')
        expect(result.errors).toContain('Successor ID is required')
      })

      it('should detect self-dependency', () => {
        const params = {
          projectId: mockProjectId,
          predecessorId: mockPredecessorId,
          successorId: mockPredecessorId, // Same as predecessor
          dependencyType: 'FS' as const,
          lag: 0
        }

        const result = DependencyCommandUtils.validateParams(params)

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Predecessor and successor cannot be the same task')
      })

      it('should detect invalid dependency type', () => {
        const params = {
          projectId: mockProjectId,
          predecessorId: mockPredecessorId,
          successorId: mockSuccessorId,
          dependencyType: 'INVALID' as any,
          lag: 0
        }

        const result = DependencyCommandUtils.validateParams(params)

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Invalid dependency type')
      })

      it('should detect invalid lag value', () => {
        const params = {
          projectId: mockProjectId,
          predecessorId: mockPredecessorId,
          successorId: mockSuccessorId,
          dependencyType: 'FS' as const,
          lag: -5
        }

        const result = DependencyCommandUtils.validateParams(params)

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Lag must be a non-negative number')
      })
    })
  })
})

describe('DependencyCommand Integration', () => {
  it('should handle complete create-undo-redo cycle', async () => {
    let dependencies: GanttDependency[] = []
    
    const mockOnExecuteCreate = jest.fn(async (predId: string, succId: string) => {
      const newDep: GanttDependency = {
        id: `dep_${predId}_${succId}`,
        predecessorId: predId,
        successorId: succId,
        fromTaskId: predId,
        toTaskId: succId,
        type: 'FS',
        lag: 0,
        lagUnit: 'hours'
      }
      dependencies.push(newDep)
    })
    
    const mockOnExecuteDelete = jest.fn(async (predId: string, succId: string) => {
      dependencies = dependencies.filter(dep => 
        !(dep.predecessorId === predId && dep.successorId === succId)
      )
    })

    const params = {
      projectId: 'test-project',
      predecessorId: 'task-1',
      successorId: 'task-2',
      onExecuteCreate: mockOnExecuteCreate,
      onExecuteDelete: mockOnExecuteDelete
    }

    const command = new DependencyCreateCommand(params)

    // Initial state
    expect(dependencies).toHaveLength(0)
    expect(command.canUndo()).toBe(false)

    // Execute (create dependency)
    await command.execute()
    expect(dependencies).toHaveLength(1)
    expect(command.canUndo()).toBe(true)

    // Undo (delete dependency)
    await command.undo()
    expect(dependencies).toHaveLength(0)
    expect(command.canRedo()).toBe(true)

    // Redo (recreate dependency)
    await command.execute()
    expect(dependencies).toHaveLength(1)
    expect(command.canUndo()).toBe(true)
  })
})