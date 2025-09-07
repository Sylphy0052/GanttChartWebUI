/**
 * Utility functions for dependency validation
 * Implements circular dependency detection and validation
 */

import { GanttDependency } from '@/types/gantt'

export interface CircularDependencyResult {
  hasCircularDependency: boolean
  circularPath?: string[]
  message?: string
}

/**
 * Check if adding a new dependency would create a circular dependency
 * Uses depth-first search to detect cycles in the dependency graph
 */
export function detectCircularDependency(
  existingDependencies: GanttDependency[],
  newPredecessorId: string,
  newSuccessorId: string
): CircularDependencyResult {
  // Early return if self-dependency
  if (newPredecessorId === newSuccessorId) {
    return {
      hasCircularDependency: true,
      circularPath: [newPredecessorId],
      message: 'A task cannot depend on itself'
    }
  }

  // Build adjacency map from existing dependencies
  const adjacencyMap = new Map<string, Set<string>>()
  
  // Add existing dependencies to the graph
  for (const dep of existingDependencies) {
    if (!adjacencyMap.has(dep.predecessorId)) {
      adjacencyMap.set(dep.predecessorId, new Set())
    }
    adjacencyMap.get(dep.predecessorId)!.add(dep.successorId)
  }

  // Add the new dependency to test
  if (!adjacencyMap.has(newPredecessorId)) {
    adjacencyMap.set(newPredecessorId, new Set())
  }
  adjacencyMap.get(newPredecessorId)!.add(newSuccessorId)

  // Detect cycles using DFS
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfsDetectCycle(node: string): boolean {
    if (recursionStack.has(node)) {
      // Found a cycle - build the circular path
      const cycleStart = path.indexOf(node)
      if (cycleStart !== -1) {
        path.splice(0, cycleStart) // Remove nodes before cycle
        path.push(node) // Complete the cycle
      }
      return true
    }

    if (visited.has(node)) {
      return false // Already processed this node
    }

    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = adjacencyMap.get(node)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (dfsDetectCycle(neighbor)) {
          return true
        }
      }
    }

    recursionStack.delete(node)
    path.pop()
    return false
  }

  // Start DFS from all unvisited nodes to handle disconnected components
  const allNodes = new Set<string>()
  for (const [pred, succs] of adjacencyMap) {
    allNodes.add(pred)
    for (const succ of succs) {
      allNodes.add(succ)
    }
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      path.length = 0 // Reset path for each component
      if (dfsDetectCycle(node)) {
        return {
          hasCircularDependency: true,
          circularPath: [...path],
          message: `Circular dependency detected: ${path.join(' → ')}`
        }
      }
    }
  }

  return {
    hasCircularDependency: false,
    message: 'No circular dependency detected'
  }
}

/**
 * Validate a dependency before creation
 */
export function validateDependency(
  existingDependencies: GanttDependency[],
  predecessorId: string,
  successorId: string
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for self-dependency
  if (predecessorId === successorId) {
    errors.push('A task cannot depend on itself')
    return { isValid: false, errors, warnings }
  }

  // Check for duplicate dependency
  const duplicateExists = existingDependencies.some(
    dep => dep.predecessorId === predecessorId && dep.successorId === successorId
  )
  if (duplicateExists) {
    errors.push('This dependency already exists')
    return { isValid: false, errors, warnings }
  }

  // Check for circular dependency
  const circularResult = detectCircularDependency(existingDependencies, predecessorId, successorId)
  if (circularResult.hasCircularDependency) {
    errors.push(circularResult.message || 'Circular dependency detected')
    return { isValid: false, errors, warnings }
  }

  // Check for reverse dependency (warning, not error)
  const reverseExists = existingDependencies.some(
    dep => dep.predecessorId === successorId && dep.successorId === predecessorId
  )
  if (reverseExists) {
    warnings.push('This creates a reverse dependency relationship')
  }

  return {
    isValid: true,
    errors,
    warnings
  }
}

/**
 * Get dependency chain for a task (all tasks this task depends on, recursively)
 */
export function getDependencyChain(
  dependencies: GanttDependency[],
  taskId: string
): string[] {
  const visited = new Set<string>()
  const chain: string[] = []

  function buildChain(currentTaskId: string) {
    if (visited.has(currentTaskId)) {
      return // Prevent infinite loops
    }
    visited.add(currentTaskId)

    const predecessors = dependencies
      .filter(dep => dep.successorId === currentTaskId)
      .map(dep => dep.predecessorId)

    for (const predId of predecessors) {
      chain.push(predId)
      buildChain(predId)
    }
  }

  buildChain(taskId)
  return Array.from(new Set(chain)) // Remove duplicates
}

/**
 * Get all tasks that depend on a given task (recursively)
 */
export function getDependents(
  dependencies: GanttDependency[],
  taskId: string
): string[] {
  const visited = new Set<string>()
  const dependents: string[] = []

  function buildDependents(currentTaskId: string) {
    if (visited.has(currentTaskId)) {
      return // Prevent infinite loops
    }
    visited.add(currentTaskId)

    const successors = dependencies
      .filter(dep => dep.predecessorId === currentTaskId)
      .map(dep => dep.successorId)

    for (const succId of successors) {
      dependents.push(succId)
      buildDependents(succId)
    }
  }

  buildDependents(taskId)
  return Array.from(new Set(dependents)) // Remove duplicates
}