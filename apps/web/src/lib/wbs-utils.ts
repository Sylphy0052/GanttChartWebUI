import { IssueHierarchy, IssueTreeNode, IssueTreeValidation, Issue } from '@/types/issue'
import { WBSNode, WBSTreeNode } from '@/types/wbs'

export class WBSUtils {
  /**
   * Convert flat issue list to hierarchical tree structure
   */
  static buildHierarchy(issues: Issue[]): IssueHierarchy[] {
    const issueMap = new Map<string, IssueHierarchy>()
    const roots: IssueHierarchy[] = []

    // Initialize hierarchy nodes
    issues.forEach(issue => {
      issueMap.set(issue.id, {
        ...issue,
        children: [],
        level: 0,
        path: [issue.id],
        hasChildren: false,
        isExpanded: false,
        order: 0
      })
    })

    // Build tree structure
    issues.forEach(issue => {
      const node = issueMap.get(issue.id)!
      
      if (issue.parentIssueId) {
        const parent = issueMap.get(issue.parentIssueId)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
          parent.hasChildren = true
          
          // Update level and path
          node.level = parent.level + 1
          node.path = [...parent.path, node.id]
        } else {
          // Orphaned node - add to roots
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    })

    // Sort children and assign orders
    WBSUtils.sortHierarchy(roots)
    WBSUtils.assignOrders(roots)

    return roots
  }

  /**
   * Convert issue hierarchy to WBS tree nodes
   */
  static issueToWBSTree(hierarchy: IssueHierarchy[]): WBSTreeNode[] {
    return hierarchy.map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      parentId: issue.parentIssueId,
      projectId: issue.projectId,
      assigneeId: issue.assigneeId,
      status: issue.status.toUpperCase() as any,
      startDate: issue.startDate ? new Date(issue.startDate) : undefined,
      dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
      estimatedHours: issue.estimateValue * (issue.estimateUnit === 'h' ? 1 : 8),
      progress: issue.progress,
      version: issue.version,
      level: issue.level,
      order: issue.order,
      isExpanded: issue.isExpanded || false,
      children: issue.children ? WBSUtils.issueToWBSTree(issue.children) : [],
      hasChildren: issue.hasChildren,
      isVisible: true,
      path: issue.path
    }))
  }

  /**
   * Flatten tree structure to visible nodes only
   */
  static flattenVisibleNodes(nodes: WBSTreeNode[]): WBSTreeNode[] {
    const result: WBSTreeNode[] = []
    
    function traverse(nodeList: WBSTreeNode[], isVisible = true) {
      nodeList.forEach(node => {
        if (isVisible) {
          result.push(node)
        }
        
        if (node.isExpanded && node.children.length > 0) {
          traverse(node.children, isVisible)
        }
      })
    }
    
    traverse(nodes)
    return result
  }

  /**
   * Find node by ID in tree
   */
  static findNodeById(nodes: WBSTreeNode[], id: string): WBSTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node
      
      if (node.children.length > 0) {
        const found = WBSUtils.findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  /**
   * Get all ancestor IDs for a node
   */
  static getAncestorIds(nodes: WBSTreeNode[], nodeId: string): string[] {
    const node = WBSUtils.findNodeById(nodes, nodeId)
    return node ? node.path.slice(0, -1) : []
  }

  /**
   * Get all descendant IDs for a node
   */
  static getDescendantIds(node: WBSTreeNode): string[] {
    const result: string[] = []
    
    function traverse(n: WBSTreeNode) {
      result.push(n.id)
      n.children.forEach(child => traverse(child))
    }
    
    node.children.forEach(child => traverse(child))
    return result
  }

  /**
   * Validate tree structure for circular dependencies
   */
  static validateHierarchy(issues: Issue[]): IssueTreeValidation {
    const validation: IssueTreeValidation = {
      isValid: true,
      errors: [],
      warnings: []
    }

    const visited = new Set<string>()
    const inProgress = new Set<string>()

    function detectCycle(issueId: string, parentId?: string): boolean {
      if (inProgress.has(issueId)) {
        validation.errors.push({
          type: 'circular',
          issueId,
          message: `Circular dependency detected: ${issueId}`
        })
        return true
      }

      if (visited.has(issueId)) return false

      visited.add(issueId)
      inProgress.add(issueId)

      // Check children
      const children = issues.filter(i => i.parentIssueId === issueId)
      for (const child of children) {
        if (detectCycle(child.id, issueId)) {
          return true
        }
      }

      inProgress.delete(issueId)
      return false
    }

    // Check for circular dependencies
    const rootIssues = issues.filter(i => !i.parentIssueId)
    for (const root of rootIssues) {
      detectCycle(root.id)
    }

    // Check for orphaned issues
    issues.forEach(issue => {
      if (issue.parentIssueId) {
        const parent = issues.find(i => i.id === issue.parentIssueId)
        if (!parent) {
          validation.errors.push({
            type: 'orphan',
            issueId: issue.id,
            message: `Parent issue not found: ${issue.parentIssueId}`
          })
        }
      }
    })

    // Check depth warnings
    const hierarchy = WBSUtils.buildHierarchy(issues)
    WBSUtils.checkDepthWarnings(hierarchy, validation)

    validation.isValid = validation.errors.length === 0
    return validation
  }

  /**
   * Check for depth warnings
   */
  private static checkDepthWarnings(nodes: IssueHierarchy[], validation: IssueTreeValidation, currentDepth = 0) {
    const MAX_RECOMMENDED_DEPTH = 10
    const PERFORMANCE_WARNING_DEPTH = 15

    nodes.forEach(node => {
      if (currentDepth > MAX_RECOMMENDED_DEPTH) {
        validation.warnings.push({
          type: 'depth',
          issueId: node.id,
          message: `Deep nesting detected (level ${currentDepth}). Consider restructuring.`
        })
      }

      if (currentDepth > PERFORMANCE_WARNING_DEPTH) {
        validation.warnings.push({
          type: 'performance',
          issueId: node.id,
          message: `Very deep nesting (level ${currentDepth}) may impact performance.`
        })
      }

      if (node.children && node.children.length > 0) {
        WBSUtils.checkDepthWarnings(node.children, validation, currentDepth + 1)
      }
    })
  }

  /**
   * Sort hierarchy by priority and title
   */
  private static sortHierarchy(nodes: IssueHierarchy[]) {
    nodes.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority // Higher priority first
      }
      return a.title.localeCompare(b.title)
    })

    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        WBSUtils.sortHierarchy(node.children)
      }
    })
  }

  /**
   * Assign order values to hierarchy nodes
   */
  private static assignOrders(nodes: IssueHierarchy[], startOrder = 0): number {
    let order = startOrder
    
    nodes.forEach(node => {
      node.order = order++
      
      if (node.children && node.children.length > 0) {
        order = WBSUtils.assignOrders(node.children, order)
      }
    })
    
    return order
  }

  /**
   * Calculate aggregated progress for parent nodes
   */
  static calculateAggregatedProgress(nodes: WBSTreeNode[]): void {
    function calculateNodeProgress(node: WBSTreeNode): number {
      if (!node.children || node.children.length === 0) {
        return node.progress
      }

      // Calculate weighted average based on estimated hours
      let totalHours = 0
      let progressHours = 0

      node.children.forEach(child => {
        const childProgress = calculateNodeProgress(child)
        const childHours = child.estimatedHours || 1
        
        totalHours += childHours
        progressHours += (childProgress / 100) * childHours
      })

      const aggregatedProgress = totalHours > 0 ? (progressHours / totalHours) * 100 : 0
      node.progress = Math.round(aggregatedProgress)
      
      return node.progress
    }

    nodes.forEach(node => calculateNodeProgress(node))
  }

  /**
   * Search nodes by title or description
   */
  static searchNodes(nodes: WBSTreeNode[], query: string): WBSTreeNode[] {
    const results: WBSTreeNode[] = []
    const lowerQuery = query.toLowerCase()

    function search(nodeList: WBSTreeNode[]) {
      nodeList.forEach(node => {
        const titleMatch = node.title.toLowerCase().includes(lowerQuery)
        const descriptionMatch = node.description?.toLowerCase().includes(lowerQuery)
        
        if (titleMatch || descriptionMatch) {
          results.push(node)
        }
        
        if (node.children.length > 0) {
          search(node.children)
        }
      })
    }

    search(nodes)
    return results
  }

  /**
   * Get tree statistics
   */
  static getTreeStats(nodes: WBSTreeNode[]) {
    let totalNodes = 0
    let maxDepth = 0
    let leafNodes = 0
    
    function traverse(nodeList: WBSTreeNode[], depth = 0) {
      nodeList.forEach(node => {
        totalNodes++
        maxDepth = Math.max(maxDepth, depth)
        
        if (node.children.length === 0) {
          leafNodes++
        } else {
          traverse(node.children, depth + 1)
        }
      })
    }
    
    traverse(nodes)
    
    return {
      totalNodes,
      maxDepth: maxDepth + 1,
      leafNodes,
      branchNodes: totalNodes - leafNodes
    }
  }
}