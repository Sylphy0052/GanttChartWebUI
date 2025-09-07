/**
 * Hook for Dependency Operations with Undo/Redo Support
 * 
 * This hook provides dependency management capabilities with full undo/redo functionality.
 * It includes circular dependency detection, validation, and performance optimizations.
 * 
 * Features:
 * - Create/delete dependencies with undo/redo
 * - Circular dependency detection and prevention
 * - Batch dependency operations
 * - Real-time validation
 * - Performance telemetry integration
 */

'use client'

import { useCallback, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { useDependencies } from '@/hooks/useDependencies'
import { DependencyCreateCommand, DependencyDeleteCommand } from '@/lib/commands/DependencyCommand'
import { validateDependencyChain } from '@/lib/dependency-validation'
import type { Dependency, DependencyType } from '@/types/gantt'

export interface DependencyWithUndoState {
  dependencies: Dependency[]
  validationErrors: Record<string, string[]>
  operationInProgress: boolean
  circularDependencies: string[]
  lastValidation?: {
    isValid: boolean
    errors: string[]
    timestamp: number
  }
}

export interface DependencyWithUndoResult {
  // State
  dependencies: Dependency[]
  validationErrors: Record<string, string[]>
  operationInProgress: boolean
  circularDependencies: string[]
  
  // Dependency Operations with Undo/Redo
  createDependency: (fromTaskId: string, toTaskId: string, type?: DependencyType) => Promise<void>
  deleteDependency: (dependencyId: string) => Promise<void>
  updateDependency: (dependencyId: string, updates: Partial<Dependency>) => Promise<void>
  
  // Batch Operations
  createDependencies: (dependencies: Array<{fromTaskId: string, toTaskId: string, type?: DependencyType}>) => Promise<void>
  deleteDependencies: (dependencyIds: string[]) => Promise<void>
  
  // Validation
  validateDependencies: () => Promise<boolean>
  hasCircularDependency: (fromTaskId: string, toTaskId: string) => boolean
  getDependencyPath: (fromTaskId: string, toTaskId: string) => string[]
  
  // Undo/Redo Controls
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
  
  // Loading states
  isLoading: boolean
}

interface UseDependenciesWithUndoOptions {
  projectId?: string // Required for telemetry
  maxHistorySize?: number
  enableUndo?: boolean
  telemetryEnabled?: boolean
  validateOnCreate?: boolean
  preventCircularDependencies?: boolean
  onDependencyCreated?: (dependency: Dependency) => void
  onDependencyDeleted?: (dependencyId: string) => void
  onValidationError?: (errors: string[]) => void
  onCircularDependencyDetected?: (path: string[]) => void
}

export const useDependenciesWithUndo = (options: UseDependenciesWithUndoOptions = {}): DependencyWithUndoResult => {
  const {
    projectId,
    maxHistorySize = 20,
    enableUndo = true,
    telemetryEnabled = true,
    validateOnCreate = true,
    preventCircularDependencies = true,
    onDependencyCreated,
    onDependencyDeleted,
    onValidationError,
    onCircularDependencyDetected
  } = options

  const {
    dependencies,
    createDependency: baseDependencyCreate,
    deleteDependency: baseDependencyDelete,
    isLoading
  } = useDependencies()

  const [state, setState] = useState<DependencyWithUndoState>({
    dependencies: [],
    validationErrors: {},
    operationInProgress: false,
    circularDependencies: []
  })

  const {
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    isUndoing,
    isRedoing
  } = useUndoRedo({
    maxHistorySize,
    enableKeyboardShortcuts: enableUndo,
    telemetryEnabled,
    projectId, // Pass projectId for audit log integration
    onCommandExecuted: (command, result) => {
      if (result.success) {
        console.log(`✅ Dependency command executed: ${command.description}`)
      } else {
        console.error(`❌ Dependency command failed: ${command.description}`, result.error)
      }
    }
  })

  /**
   * Create dependency with undo support
   */
  const createDependencyWithUndo = useCallback(async (
    fromTaskId: string,
    toTaskId: string,
    type: DependencyType = 'finish-to-start'
  ) => {
    if (state.operationInProgress) {
      throw new Error('Another dependency operation is in progress')
    }

    setState(prev => ({ ...prev, operationInProgress: true }))

    try {
      // Pre-validation
      if (validateOnCreate) {
        const validationResult = validateDependencyChain(dependencies, {
          fromTaskId,
          toTaskId,
          type
        })

        if (!validationResult.isValid) {
          setState(prev => ({
            ...prev,
            validationErrors: {
              ...prev.validationErrors,
              [`${fromTaskId}-${toTaskId}`]: validationResult.errors
            }
          }))

          if (onValidationError) {
            onValidationError(validationResult.errors)
          }
          
          throw new Error(`Dependency validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      // Check for circular dependencies
      if (preventCircularDependencies) {
        const isCircular = hasCircularDependencyCheck(fromTaskId, toTaskId)
        if (isCircular) {
          const path = getDependencyPathCheck(fromTaskId, toTaskId)
          
          setState(prev => ({
            ...prev,
            circularDependencies: [...prev.circularDependencies, `${fromTaskId}-${toTaskId}`]
          }))

          if (onCircularDependencyDetected) {
            onCircularDependencyDetected(path)
          }

          throw new Error(`Circular dependency detected: ${path.join(' → ')}`)
        }
      }

      // Create the dependency command
      const command = new DependencyCreateCommand({
        fromTaskId,
        toTaskId,
        type,
        onExecute: async (dependency: Dependency) => {
          const createdDependency = await baseDependencyCreate(dependency.fromTaskId, dependency.toTaskId, dependency.type)
          
          setState(prev => ({
            ...prev,
            dependencies: [...prev.dependencies, createdDependency],
            validationErrors: {
              ...prev.validationErrors,
              [`${fromTaskId}-${toTaskId}`]: []
            }
          }))

          if (onDependencyCreated) {
            onDependencyCreated(createdDependency)
          }

          return createdDependency
        },
        context: {
          projectId,
          validation: validateOnCreate,
          preventCircular: preventCircularDependencies
        }
      })

      await executeCommand(command)

    } catch (error) {
      console.error('Failed to create dependency:', error)
      throw error
    } finally {
      setState(prev => ({ ...prev, operationInProgress: false }))
    }
  }, [
    state.operationInProgress, 
    dependencies, 
    validateOnCreate, 
    preventCircularDependencies,
    baseDependencyCreate,
    executeCommand,
    onValidationError,
    onCircularDependencyDetected,
    onDependencyCreated,
    projectId
  ])

  /**
   * Delete dependency with undo support
   */
  const deleteDependencyWithUndo = useCallback(async (dependencyId: string) => {
    if (state.operationInProgress) {
      throw new Error('Another dependency operation is in progress')
    }

    setState(prev => ({ ...prev, operationInProgress: true }))

    try {
      const existingDependency = dependencies.find(dep => dep.id === dependencyId)
      if (!existingDependency) {
        throw new Error(`Dependency with ID ${dependencyId} not found`)
      }

      // Create the delete command
      const command = new DependencyDeleteCommand({
        dependency: existingDependency,
        onExecute: async (dep: Dependency) => {
          await baseDependencyDelete(dep.id)
          
          setState(prev => ({
            ...prev,
            dependencies: prev.dependencies.filter(d => d.id !== dep.id),
            circularDependencies: prev.circularDependencies.filter(
              circular => circular !== `${dep.fromTaskId}-${dep.toTaskId}`
            )
          }))

          if (onDependencyDeleted) {
            onDependencyDeleted(dep.id)
          }
        },
        context: {
          projectId
        }
      })

      await executeCommand(command)

    } catch (error) {
      console.error('Failed to delete dependency:', error)
      throw error
    } finally {
      setState(prev => ({ ...prev, operationInProgress: false }))
    }
  }, [
    state.operationInProgress,
    dependencies,
    baseDependencyDelete,
    executeCommand,
    onDependencyDeleted,
    projectId
  ])

  /**
   * Update dependency (for future implementation)
   */
  const updateDependencyWithUndo = useCallback(async (
    dependencyId: string, 
    updates: Partial<Dependency>
  ) => {
    // This would be implemented similar to create/delete with proper command pattern
    console.warn('Dependency update with undo not yet implemented')
    throw new Error('Dependency update with undo not yet implemented')
  }, [])

  /**
   * Create multiple dependencies in batch
   */
  const createDependenciesWithUndo = useCallback(async (
    dependenciesToCreate: Array<{fromTaskId: string, toTaskId: string, type?: DependencyType}>
  ) => {
    setState(prev => ({ ...prev, operationInProgress: true }))

    try {
      for (const depConfig of dependenciesToCreate) {
        await createDependencyWithUndo(
          depConfig.fromTaskId,
          depConfig.toTaskId,
          depConfig.type || 'finish-to-start'
        )
      }
    } catch (error) {
      console.error('Batch dependency creation failed:', error)
      throw error
    } finally {
      setState(prev => ({ ...prev, operationInProgress: false }))
    }
  }, [createDependencyWithUndo])

  /**
   * Delete multiple dependencies in batch
   */
  const deleteDependenciesWithUndo = useCallback(async (dependencyIds: string[]) => {
    setState(prev => ({ ...prev, operationInProgress: true }))

    try {
      for (const depId of dependencyIds) {
        await deleteDependencyWithUndo(depId)
      }
    } catch (error) {
      console.error('Batch dependency deletion failed:', error)
      throw error
    } finally {
      setState(prev => ({ ...prev, operationInProgress: false }))
    }
  }, [deleteDependencyWithUndo])

  /**
   * Validate all dependencies
   */
  const validateAllDependencies = useCallback(async (): Promise<boolean> => {
    const validationResults = dependencies.map(dep => 
      validateDependencyChain(dependencies, dep)
    )

    const allValid = validationResults.every(result => result.isValid)
    const allErrors = validationResults.flatMap(result => result.errors)

    setState(prev => ({
      ...prev,
      lastValidation: {
        isValid: allValid,
        errors: allErrors,
        timestamp: Date.now()
      }
    }))

    if (!allValid && onValidationError) {
      onValidationError(allErrors)
    }

    return allValid
  }, [dependencies, onValidationError])

  /**
   * Check for circular dependency
   */
  const hasCircularDependencyCheck = useCallback((fromTaskId: string, toTaskId: string): boolean => {
    const visited = new Set<string>()
    const path = new Set<string>()

    const hasCircle = (currentId: string, targetId: string): boolean => {
      if (path.has(currentId)) return true
      if (visited.has(currentId)) return false

      visited.add(currentId)
      path.add(currentId)

      const dependsOn = dependencies
        .filter(dep => dep.toTaskId === currentId)
        .map(dep => dep.fromTaskId)

      for (const depId of dependsOn) {
        if (depId === targetId || hasCircle(depId, targetId)) {
          return true
        }
      }

      path.delete(currentId)
      return false
    }

    return hasCircle(toTaskId, fromTaskId)
  }, [dependencies])

  /**
   * Get dependency path for circular detection
   */
  const getDependencyPathCheck = useCallback((fromTaskId: string, toTaskId: string): string[] => {
    const visited = new Set<string>()
    const path: string[] = []

    const findPath = (currentId: string, targetId: string): boolean => {
      if (currentId === targetId) {
        path.push(currentId)
        return true
      }

      if (visited.has(currentId)) return false
      visited.add(currentId)

      const dependents = dependencies
        .filter(dep => dep.fromTaskId === currentId)
        .map(dep => dep.toTaskId)

      for (const depId of dependents) {
        if (findPath(depId, targetId)) {
          path.unshift(currentId)
          return true
        }
      }

      return false
    }

    findPath(fromTaskId, toTaskId)
    return path
  }, [dependencies])

  return {
    // State
    dependencies: state.dependencies.length > 0 ? state.dependencies : dependencies,
    validationErrors: state.validationErrors,
    operationInProgress: state.operationInProgress,
    circularDependencies: state.circularDependencies,

    // Dependency Operations with Undo/Redo
    createDependency: createDependencyWithUndo,
    deleteDependency: deleteDependencyWithUndo,
    updateDependency: updateDependencyWithUndo,

    // Batch Operations
    createDependencies: createDependenciesWithUndo,
    deleteDependencies: deleteDependenciesWithUndo,

    // Validation
    validateDependencies: validateAllDependencies,
    hasCircularDependency: hasCircularDependencyCheck,
    getDependencyPath: getDependencyPathCheck,

    // Undo/Redo Controls
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,

    // Loading states
    isLoading: isLoading || isUndoing || isRedoing
  }
}