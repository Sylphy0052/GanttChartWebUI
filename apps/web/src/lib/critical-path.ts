/**
 * Enhanced Critical Path Method (CPM) Implementation
 * 
 * Provides comprehensive critical path analysis including:
 * - Forward pass calculation (Earliest Start/Finish)
 * - Backward pass calculation (Latest Start/Finish)
 * - Float/slack calculation
 * - Critical path identification
 * - Resource optimization suggestions
 */

import { GanttTask, GanttDependency, GanttCriticalPath } from '@/types/gantt'

interface TaskAnalysis {
  task: GanttTask
  earliestStart: Date
  earliestFinish: Date
  latestStart: Date
  latestFinish: Date
  totalFloat: number
  freeFloat: number
  isCritical: boolean
  criticalSuccessors: string[]
}

interface NetworkNode {
  taskId: string
  predecessors: string[]
  successors: string[]
  duration: number
  earliestStart: number
  earliestFinish: number
  latestStart: number
  latestFinish: number
  totalFloat: number
}

/**
 * Enhanced Critical Path Calculator
 */
export class CriticalPathAnalyzer {
  
  /**
   * Calculate comprehensive critical path analysis
   */
  static calculateCriticalPath(tasks: GanttTask[]): GanttCriticalPath {
    if (tasks.length === 0) {
      return {
        tasks: [],
        totalDuration: 0,
        startDate: new Date(),
        endDate: new Date(),
        slackTime: 0
      }
    }

    // Build network analysis
    const analysis = this.performNetworkAnalysis(tasks)
    
    // Identify critical path
    const criticalTasks = analysis
      .filter(node => node.isCritical)
      .map(node => node.task)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    // Calculate path metrics
    const pathStartDate = criticalTasks.length > 0 ? criticalTasks[0].startDate : new Date()
    const pathEndDate = criticalTasks.length > 0 ? 
      criticalTasks[criticalTasks.length - 1].endDate : new Date()
    
    const totalDuration = Math.ceil(
      (pathEndDate.getTime() - pathStartDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calculate minimum slack time on critical path
    const slackTime = Math.min(...analysis
      .filter(node => !node.isCritical)
      .map(node => node.totalFloat))

    return {
      tasks: criticalTasks,
      totalDuration,
      startDate: pathStartDate,
      endDate: pathEndDate,
      slackTime: isFinite(slackTime) ? slackTime : 0
    }
  }

  /**
   * Get task analysis with float calculations
   */
  static getTaskAnalysis(tasks: GanttTask[]): TaskAnalysis[] {
    return this.performNetworkAnalysis(tasks)
  }

  /**
   * Get tasks that are at risk (low float)
   */
  static getAtRiskTasks(tasks: GanttTask[], floatThreshold: number = 2): TaskAnalysis[] {
    const analysis = this.performNetworkAnalysis(tasks)
    return analysis.filter(node => 
      !node.isCritical && 
      node.totalFloat <= floatThreshold && 
      node.totalFloat > 0
    )
  }

  /**
   * Perform comprehensive network analysis
   */
  private static performNetworkAnalysis(tasks: GanttTask[]): TaskAnalysis[] {
    // Build network nodes
    const nodes = this.buildNetworkNodes(tasks)
    
    // Perform forward pass (calculate earliest times)
    this.forwardPass(nodes)
    
    // Perform backward pass (calculate latest times)
    this.backwardPass(nodes)
    
    // Calculate float and identify critical path
    return this.calculateFloatAndCriticalPath(nodes, tasks)
  }

  /**
   * Build network representation of tasks
   */
  private static buildNetworkNodes(tasks: GanttTask[]): Map<string, NetworkNode> {
    const nodes = new Map<string, NetworkNode>()
    
    // Create nodes for each task
    tasks.forEach(task => {
      const duration = Math.ceil(
        (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      nodes.set(task.id, {
        taskId: task.id,
        predecessors: [],
        successors: [],
        duration,
        earliestStart: 0,
        earliestFinish: 0,
        latestStart: 0,
        latestFinish: 0,
        totalFloat: 0
      })
    })
    
    // Build predecessor/successor relationships
    tasks.forEach(task => {
      const node = nodes.get(task.id)!
      
      task.dependencies.forEach(dep => {
        const predecessor = nodes.get(dep.predecessorId)
        if (predecessor) {
          node.predecessors.push(dep.predecessorId)
          predecessor.successors.push(task.id)
        }
      })
    })
    
    return nodes
  }

  /**
   * Forward pass: Calculate earliest start and finish times
   */
  private static forwardPass(nodes: Map<string, NetworkNode>): void {
    const visited = new Set<string>()
    
    // Topological sort for forward pass
    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return
      
      const node = nodes.get(nodeId)!
      
      // Visit all predecessors first
      node.predecessors.forEach(predId => {
        if (!visited.has(predId)) {
          visit(predId)
        }
      })
      
      // Calculate earliest start
      if (node.predecessors.length === 0) {
        node.earliestStart = 0
      } else {
        node.earliestStart = Math.max(
          ...node.predecessors.map(predId => {
            const pred = nodes.get(predId)!
            return pred.earliestFinish
          })
        )
      }
      
      // Calculate earliest finish
      node.earliestFinish = node.earliestStart + node.duration
      
      visited.add(nodeId)
    }
    
    // Visit all nodes
    nodes.forEach((_, nodeId) => visit(nodeId))
  }

  /**
   * Backward pass: Calculate latest start and finish times
   */
  private static backwardPass(nodes: Map<string, NetworkNode>): void {
    const visited = new Set<string>()
    
    // Find project end time (maximum earliest finish)
    const projectEndTime = Math.max(...Array.from(nodes.values()).map(n => n.earliestFinish))
    
    // Reverse topological sort for backward pass
    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return
      
      const node = nodes.get(nodeId)!
      
      // Visit all successors first
      node.successors.forEach(succId => {
        if (!visited.has(succId)) {
          visit(succId)
        }
      })
      
      // Calculate latest finish
      if (node.successors.length === 0) {
        node.latestFinish = projectEndTime
      } else {
        node.latestFinish = Math.min(
          ...node.successors.map(succId => {
            const succ = nodes.get(succId)!
            return succ.latestStart
          })
        )
      }
      
      // Calculate latest start
      node.latestStart = node.latestFinish - node.duration
      
      visited.add(nodeId)
    }
    
    // Visit all nodes
    nodes.forEach((_, nodeId) => visit(nodeId))
  }

  /**
   * Calculate float and identify critical path
   */
  private static calculateFloatAndCriticalPath(
    nodes: Map<string, NetworkNode>,
    tasks: GanttTask[]
  ): TaskAnalysis[] {
    const taskMap = new Map(tasks.map(task => [task.id, task]))
    const analysis: TaskAnalysis[] = []
    
    nodes.forEach(node => {
      const task = taskMap.get(node.taskId)!
      
      // Calculate total float
      node.totalFloat = node.latestStart - node.earliestStart
      
      // Task is critical if total float is zero
      const isCritical = node.totalFloat === 0
      
      // Calculate free float (float available without affecting successors)
      const freeFloat = node.successors.length > 0 ?
        Math.min(...node.successors.map(succId => {
          const succ = nodes.get(succId)!
          return succ.earliestStart - node.earliestFinish
        })) : node.totalFloat
      
      // Identify critical successors
      const criticalSuccessors = node.successors.filter(succId => {
        const succ = nodes.get(succId)!
        return succ.totalFloat === 0
      })
      
      analysis.push({
        task,
        earliestStart: new Date(task.startDate.getTime() + node.earliestStart * 24 * 60 * 60 * 1000),
        earliestFinish: new Date(task.startDate.getTime() + node.earliestFinish * 24 * 60 * 60 * 1000),
        latestStart: new Date(task.startDate.getTime() + node.latestStart * 24 * 60 * 60 * 1000),
        latestFinish: new Date(task.startDate.getTime() + node.latestFinish * 24 * 60 * 60 * 1000),
        totalFloat: node.totalFloat,
        freeFloat,
        isCritical,
        criticalSuccessors
      })
    })
    
    return analysis.sort((a, b) => a.earliestStart.getTime() - b.earliestStart.getTime())
  }

  /**
   * Get critical path visualization data
   */
  static getCriticalPathVisualization(tasks: GanttTask[]) {
    const analysis = this.performNetworkAnalysis(tasks)
    const criticalTasks = analysis.filter(node => node.isCritical)
    
    return {
      criticalTasks: criticalTasks.map(node => node.task.id),
      atRiskTasks: analysis
        .filter(node => !node.isCritical && node.totalFloat <= 2)
        .map(node => node.task.id),
      floatData: analysis.map(node => ({
        taskId: node.task.id,
        totalFloat: node.totalFloat,
        freeFloat: node.freeFloat,
        isCritical: node.isCritical
      }))
    }
  }

  /**
   * Suggest schedule optimizations
   */
  static suggestOptimizations(tasks: GanttTask[]): string[] {
    const analysis = this.performNetworkAnalysis(tasks)
    const suggestions: string[] = []
    
    // Find tasks with high float that could be delayed
    const highFloatTasks = analysis.filter(node => node.totalFloat > 5)
    if (highFloatTasks.length > 0) {
      suggestions.push(
        `${highFloatTasks.length} tasks have significant slack time and could be rescheduled`
      )
    }
    
    // Find bottleneck tasks on critical path
    const criticalTasks = analysis.filter(node => node.isCritical)
    if (criticalTasks.length > 0) {
      suggestions.push(
        `Critical path contains ${criticalTasks.length} tasks - consider resource reallocation`
      )
    }
    
    // Find tasks at risk
    const atRiskTasks = analysis.filter(node => 
      !node.isCritical && node.totalFloat <= 2 && node.totalFloat > 0
    )
    if (atRiskTasks.length > 0) {
      suggestions.push(
        `${atRiskTasks.length} tasks are at risk of becoming critical`
      )
    }
    
    return suggestions
  }
}