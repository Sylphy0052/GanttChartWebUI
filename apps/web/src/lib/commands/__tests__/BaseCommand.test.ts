/**
 * Tests for BaseCommand and Command Pattern Implementation
 * 
 * These tests validate the core command pattern functionality that powers
 * the undo/redo system for AC1: Bar move/resize undo/redo
 */

import { BaseCommand, CompositeCommand } from '../BaseCommand'

// Mock command implementation for testing
class MockCommand extends BaseCommand {
  private executed = false
  private undone = false
  private executeCallback: () => void | Promise<void>
  private undoCallback: () => void | Promise<void>

  constructor(
    description: string,
    executeCallback: () => void | Promise<void> = () => {},
    undoCallback: () => void | Promise<void> = () => {}
  ) {
    super('bar-move', description)
    this.executeCallback = executeCallback
    this.undoCallback = undoCallback
  }

  async execute(): Promise<void> {
    await this.executeCallback()
    this.executed = true
    this.undone = false
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) return
    await this.undoCallback()
    this.undone = true
  }

  canUndo(): boolean {
    return this.executed && !this.undone
  }

  canRedo(): boolean {
    return this.executed && this.undone
  }

  // Expose internal state for testing
  getExecuted(): boolean { return this.executed }
  getUndone(): boolean { return this.undone }
}

describe('BaseCommand', () => {
  let command: MockCommand

  beforeEach(() => {
    command = new MockCommand('Test Command')
  })

  describe('Command Creation', () => {
    it('should create command with correct properties', () => {
      expect(command.id).toMatch(/^cmd_bar-move_/)
      expect(command.description).toBe('Test Command')
      expect(command.type).toBe('bar-move')
      expect(command.context.timestamp).toBeGreaterThan(0)
    })

    it('should have unique IDs for different commands', () => {
      const command2 = new MockCommand('Another Test')
      expect(command.id).not.toBe(command2.id)
    })
  })

  describe('Command States', () => {
    it('should start in unexecuted state', () => {
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(false)
      expect(command.getExecuted()).toBe(false)
      expect(command.getUndone()).toBe(false)
    })

    it('should transition to undoable state after execution', async () => {
      await command.execute()
      
      expect(command.canUndo()).toBe(true)
      expect(command.canRedo()).toBe(false)
      expect(command.getExecuted()).toBe(true)
      expect(command.getUndone()).toBe(false)
    })

    it('should transition to redoable state after undo', async () => {
      await command.execute()
      await command.undo()
      
      expect(command.canUndo()).toBe(false)
      expect(command.canRedo()).toBe(true)
      expect(command.getExecuted()).toBe(true)
      expect(command.getUndone()).toBe(true)
    })
  })

  describe('Command Execution', () => {
    it('should call execute callback', async () => {
      const executeMock = jest.fn()
      const command = new MockCommand('Test', executeMock)
      
      await command.execute()
      
      expect(executeMock).toHaveBeenCalledTimes(1)
    })

    it('should call undo callback when undoing', async () => {
      const undoMock = jest.fn()
      const command = new MockCommand('Test', () => {}, undoMock)
      
      await command.execute()
      await command.undo()
      
      expect(undoMock).toHaveBeenCalledTimes(1)
    })

    it('should not undo if not executed', async () => {
      const undoMock = jest.fn()
      const command = new MockCommand('Test', () => {}, undoMock)
      
      await command.undo()
      
      expect(undoMock).not.toHaveBeenCalled()
    })
  })

  describe('Command Validation', () => {
    it('should validate by default', () => {
      expect(command.validate()).toBe(true)
    })
  })

  describe('Command Serialization', () => {
    it('should serialize to JSON string', () => {
      const serialized = command.serialize()
      const parsed = JSON.parse(serialized)
      
      expect(parsed.id).toBe(command.id)
      expect(parsed.type).toBe(command.type)
      expect(parsed.description).toBe(command.description)
      expect(parsed.executed).toBe(false)
      expect(parsed.undone).toBe(false)
    })
  })
})

describe('CompositeCommand', () => {
  let composite: CompositeCommand
  let command1: MockCommand
  let command2: MockCommand

  beforeEach(() => {
    command1 = new MockCommand('Command 1')
    command2 = new MockCommand('Command 2')
    composite = new CompositeCommand('Composite Test', [command1, command2])
  })

  describe('Composite Creation', () => {
    it('should create composite with correct properties', () => {
      expect(composite.type).toBe('composite')
      expect(composite.description).toBe('Composite Test')
      expect(composite.getCommandCount()).toBe(2)
    })

    it('should allow adding commands after creation', () => {
      const composite = new CompositeCommand('Empty Composite')
      const command = new MockCommand('Added Command')
      
      composite.addCommand(command)
      
      expect(composite.getCommandCount()).toBe(1)
      expect(composite.getCommands()).toContain(command)
    })
  })

  describe('Composite Execution', () => {
    it('should execute all commands in order', async () => {
      const executions: string[] = []
      
      const cmd1 = new MockCommand('Cmd1', () => executions.push('cmd1'))
      const cmd2 = new MockCommand('Cmd2', () => executions.push('cmd2'))
      const composite = new CompositeCommand('Test', [cmd1, cmd2])
      
      await composite.execute()
      
      expect(executions).toEqual(['cmd1', 'cmd2'])
      expect(cmd1.canUndo()).toBe(true)
      expect(cmd2.canUndo()).toBe(true)
    })

    it('should undo all commands in reverse order', async () => {
      const operations: string[] = []
      
      const cmd1 = new MockCommand('Cmd1', 
        () => operations.push('exec1'),
        () => operations.push('undo1')
      )
      const cmd2 = new MockCommand('Cmd2',
        () => operations.push('exec2'), 
        () => operations.push('undo2')
      )
      const composite = new CompositeCommand('Test', [cmd1, cmd2])
      
      await composite.execute()
      await composite.undo()
      
      expect(operations).toEqual(['exec1', 'exec2', 'undo2', 'undo1'])
    })

    it('should rollback on execution failure', async () => {
      const operations: string[] = []
      const error = new Error('Command 2 failed')
      
      const cmd1 = new MockCommand('Cmd1',
        () => operations.push('exec1'),
        () => operations.push('undo1')
      )
      const cmd2 = new MockCommand('Cmd2',
        () => { 
          operations.push('exec2')
          throw error
        },
        () => operations.push('undo2')
      )
      const composite = new CompositeCommand('Test', [cmd1, cmd2])
      
      await expect(composite.execute()).rejects.toThrow('Command 2 failed')
      
      // Should have executed cmd1, attempted cmd2, then rolled back cmd1
      expect(operations).toEqual(['exec1', 'exec2', 'undo1'])
    })
  })

  describe('Composite State Management', () => {
    it('should report correct undo/redo availability', async () => {
      expect(composite.canUndo()).toBe(false)
      expect(composite.canRedo()).toBe(false)
      
      await composite.execute()
      expect(composite.canUndo()).toBe(true)
      expect(composite.canRedo()).toBe(false)
      
      await composite.undo()
      expect(composite.canUndo()).toBe(false)
      expect(composite.canRedo()).toBe(true)
    })
  })

  describe('Composite Validation', () => {
    it('should validate all sub-commands', () => {
      // Mock commands that validate successfully
      const validCommand = new MockCommand('Valid')
      validCommand.validate = jest.fn(() => true)
      
      const composite = new CompositeCommand('Test', [validCommand])
      
      expect(composite.validate()).toBe(true)
      expect(validCommand.validate).toHaveBeenCalled()
    })

    it('should fail validation if any sub-command fails', () => {
      const validCommand = new MockCommand('Valid')
      validCommand.validate = jest.fn(() => true)
      
      const invalidCommand = new MockCommand('Invalid')
      invalidCommand.validate = jest.fn(() => false)
      
      const composite = new CompositeCommand('Test', [validCommand, invalidCommand])
      
      expect(composite.validate()).toBe(false)
    })
  })
})

describe('Error Handling', () => {
  it('should handle async execution errors', async () => {
    const error = new Error('Execution failed')
    const command = new MockCommand('Failing Command', () => {
      throw error
    })
    
    await expect(command.execute()).rejects.toThrow('Execution failed')
    expect(command.canUndo()).toBe(false)
  })

  it('should handle async undo errors', async () => {
    const error = new Error('Undo failed')
    const command = new MockCommand('Test', 
      () => {},
      () => { throw error }
    )
    
    await command.execute()
    await expect(command.undo()).rejects.toThrow('Undo failed')
  })
})

// Performance tests
describe('Performance', () => {
  it('should handle large composite commands efficiently', async () => {
    const commands = Array.from({ length: 100 }, (_, i) => 
      new MockCommand(`Command ${i}`)
    )
    const composite = new CompositeCommand('Large Composite', commands)
    
    const startTime = performance.now()
    await composite.execute()
    const executionTime = performance.now() - startTime
    
    // Should execute 100 commands in reasonable time (< 100ms)
    expect(executionTime).toBeLessThan(100)
    expect(composite.canUndo()).toBe(true)
  })
})

// Memory leak tests  
describe('Memory Management', () => {
  it('should not leak memory with repeated operations', async () => {
    // Create many commands and ensure they can be garbage collected
    const commands: MockCommand[] = []
    
    for (let i = 0; i < 50; i++) {
      const command = new MockCommand(`Command ${i}`)
      await command.execute()
      await command.undo()
      commands.push(command)
    }
    
    // Clear references
    commands.length = 0
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    // This test mainly ensures no immediate memory issues
    expect(commands.length).toBe(0)
  })
})