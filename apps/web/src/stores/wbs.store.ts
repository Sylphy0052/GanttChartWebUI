import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { WBSStore, WBSTreeNode } from '@/types/wbs'

interface WBSTreeState {
  nodes: WBSTreeNode[]
  selectedNodeId?: string
  expandedNodeIds: Set<string>
  loading: boolean
  error?: string
  reorderLoading: boolean
}

interface WBSActions {
  expandNode: (nodeId: string) => void
  collapseNode: (nodeId: string) => void
  toggleNode: (nodeId: string) => void
  selectNode: (nodeId: string) => void
  expandAll: () => void
  collapseAll: () => void
  fetchTree: (projectId?: string) => Promise<void>
  reorderNode: (nodeId: string, newIndex: number, siblingIds: string[]) => Promise<void>
  changeParent: (nodeId: string, newParentId: string | null, newIndex: number) => Promise<void>
}

export const useWBSStore = create<WBSStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        nodes: [],
        selectedNodeId: undefined,
        expandedNodeIds: new Set<string>(),
        loading: false,
        error: undefined,
        reorderLoading: false,

        // Actions
        expandNode: (nodeId: string) => {
          set((state) => ({
            expandedNodeIds: new Set([...Array.from(state.expandedNodeIds), nodeId])
          }))
          
          // Update node expansion state
          updateNodeExpansion(get, set, nodeId, true)
        },

        collapseNode: (nodeId: string) => {
          set((state) => {
            const newExpandedIds = new Set(state.expandedNodeIds)
            newExpandedIds.delete(nodeId)
            return { expandedNodeIds: newExpandedIds }
          })
          
          // Update node expansion state
          updateNodeExpansion(get, set, nodeId, false)
        },

        toggleNode: (nodeId: string) => {
          const { expandedNodeIds } = get()
          
          if (expandedNodeIds.has(nodeId)) {
            get().collapseNode(nodeId)
          } else {
            get().expandNode(nodeId)
          }
        },

        selectNode: (nodeId: string) => {
          set({ selectedNodeId: nodeId })
        },

        expandAll: () => {
          const { nodes } = get()
          const allNodeIds = getAllNodeIds(nodes)
          
          set({
            expandedNodeIds: new Set(allNodeIds)
          })
          
          // Update all nodes to expanded state
          const updatedNodes = updateAllNodesExpansion(nodes, true)
          set({ nodes: updatedNodes })
        },

        collapseAll: () => {
          set({
            expandedNodeIds: new Set<string>()
          })
          
          // Update all nodes to collapsed state
          const { nodes } = get()
          const updatedNodes = updateAllNodesExpansion(nodes, false)
          set({ nodes: updatedNodes })
        },

        reorderNode: async (nodeId: string, newIndex: number, siblingIds: string[]) => {
          set({ reorderLoading: true, error: undefined })
          
          try {
            // Call the reorder API
            const response = await fetch(`/api/v1/issues/${nodeId}/reorder`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                newIndex,
                siblingIds
              })
            })

            if (!response.ok) {
              throw new Error(`Failed to reorder task: ${response.statusText}`)
            }

            // Optimistically update the local state
            const { nodes } = get()
            const updatedNodes = reorderNodeInTree(nodes, nodeId, newIndex, siblingIds)
            
            set({
              nodes: updatedNodes,
              reorderLoading: false
            })

          } catch (error) {
            set({
              reorderLoading: false,
              error: error instanceof Error ? error.message : 'Failed to reorder task'
            })
            throw error
          }
        },

        changeParent: async (nodeId: string, newParentId: string | null, newIndex: number) => {
          set({ reorderLoading: true, error: undefined })
          
          try {
            // Call the change parent API
            const response = await fetch(`/api/v1/issues/${nodeId}/parent`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                parentId: newParentId,
                newIndex
              })
            })

            if (!response.ok) {
              throw new Error(`Failed to change parent: ${response.statusText}`)
            }

            const updatedNode = await response.json()

            // Optimistically update the local state
            const { nodes } = get()
            const updatedNodes = changeParentInTree(nodes, nodeId, newParentId, newIndex)
            
            set({
              nodes: updatedNodes,
              reorderLoading: false
            })

          } catch (error) {
            set({
              reorderLoading: false,
              error: error instanceof Error ? error.message : 'Failed to change parent'
            })
            throw error
          }
        },

        fetchTree: async (projectId?: string) => {
          set({ loading: true, error: undefined })
          
          try {
            let endpoint: string
            const params = new URLSearchParams()
            params.append('expandLevel', '2')
            params.append('includeCompleted', 'true')
            params.append('maxDepth', '10')

            if (projectId) {
              // Use project-specific endpoint: GET /issues/projects/:projectId/tree
              endpoint = `/api/v1/issues/projects/${projectId}/tree?${params.toString()}`
            } else {
              // Use global endpoint: GET /issues/tree  
              params.append('projectId', '') // Empty for all projects
              endpoint = `/api/v1/issues/tree?${params.toString()}`
            }
            
            const response = await fetch(endpoint, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            })
            
            if (!response.ok) {
              throw new Error(`Failed to fetch WBS tree: ${response.statusText}`)
            }
            
            const data = await response.json()
            
            // Convert API response to WBSTreeNode format
            const treeNodes = convertAPIDataToTreeNodes(data.nodes || [])
            
            // Initialize expanded state based on default expansion
            const expandedIds = new Set<string>()
            initializeExpandedIds(treeNodes, expandedIds)
            
            set({
              nodes: treeNodes,
              expandedNodeIds: expandedIds,
              loading: false,
              error: undefined
            })
            
          } catch (error) {
            set({
              loading: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            })
          }
        }
      }),
      {
        name: 'wbs-store',
        partialize: (state) => ({
          selectedNodeId: state.selectedNodeId,
          expandedNodeIds: Array.from(state.expandedNodeIds) // Convert Set to Array for persistence
        }),
        onRehydrateStorage: () => (state) => {
          // Convert Array back to Set after rehydration
          if (state && Array.isArray(state.expandedNodeIds)) {
            state.expandedNodeIds = new Set(state.expandedNodeIds)
          }
        }
      }
    ),
    {
      name: 'wbs-store'
    }
  )
)

// Helper functions
function updateNodeExpansion(
  get: () => WBSStore,
  set: (partial: Partial<WBSStore>) => void,
  nodeId: string,
  isExpanded: boolean
) {
  const { nodes } = get()
  const updatedNodes = updateNodeInTree(nodes, nodeId, { isExpanded })
  set({ nodes: updatedNodes })
}

function updateNodeInTree(
  nodes: WBSTreeNode[],
  nodeId: string,
  updates: Partial<WBSTreeNode>
): WBSTreeNode[] {
  return nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, ...updates }
    }
    
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeId, updates)
      }
    }
    
    return node
  })
}

function reorderNodeInTree(
  nodes: WBSTreeNode[],
  nodeId: string,
  newIndex: number,
  siblingIds: string[]
): WBSTreeNode[] {
  // Find the parent that contains the node to reorder
  function reorderInLevel(nodeList: WBSTreeNode[]): WBSTreeNode[] {
    // Check if any node in this level is the one we want to move
    const nodeIndex = nodeList.findIndex(node => node.id === nodeId)
    
    if (nodeIndex >= 0) {
      // This level contains the node to reorder
      const node = nodeList[nodeIndex]
      const otherNodes = nodeList.filter(n => n.id !== nodeId)
      
      // Create the reordered array based on siblingIds
      const reorderedNodes: WBSTreeNode[] = []
      siblingIds.forEach(id => {
        if (id === nodeId) {
          reorderedNodes.push(node)
        } else {
          const siblingNode = otherNodes.find(n => n.id === id)
          if (siblingNode) {
            reorderedNodes.push(siblingNode)
          }
        }
      })
      
      // Update the order property for each node
      return reorderedNodes.map((node, index) => ({
        ...node,
        order: index
      }))
    }
    
    // Not in this level, check children
    return nodeList.map(node => ({
      ...node,
      children: reorderInLevel(node.children)
    }))
  }
  
  return reorderInLevel(nodes)
}

function changeParentInTree(
  nodes: WBSTreeNode[],
  nodeId: string,
  newParentId: string | null,
  newIndex: number
): WBSTreeNode[] {
  let nodeToMove: WBSTreeNode | null = null

  // First, find and remove the node from its current location
  function removeNode(nodeList: WBSTreeNode[]): WBSTreeNode[] {
    return nodeList.reduce((acc, node) => {
      if (node.id === nodeId) {
        nodeToMove = node
        return acc // Don't include this node
      }
      
      return [
        ...acc,
        {
          ...node,
          children: removeNode(node.children)
        }
      ]
    }, [] as WBSTreeNode[])
  }

  // Remove the node from its current position
  const nodesWithoutTarget = removeNode(nodes)

  if (!nodeToMove) {
    return nodes // Node not found, return unchanged
  }

  // At this point, nodeToMove is guaranteed to be non-null
  const movedNode = nodeToMove as WBSTreeNode

  // Update the node's level and parentId (convert null to undefined for type compatibility)
  const updatedNode: WBSTreeNode = {
    ...movedNode,
    parentId: newParentId || undefined,
    level: newParentId ? findNodeLevel(nodesWithoutTarget, newParentId) + 1 : 0
  }

  // Insert the node at the new location
  function insertNode(nodeList: WBSTreeNode[], targetParentId: string | null): WBSTreeNode[] {
    if (targetParentId === null) {
      // Insert at root level
      const result = [...nodeList]
      result.splice(newIndex, 0, updatedNode)
      return result.map((node, index) => ({ ...node, order: index }))
    }

    return nodeList.map(node => {
      if (node.id === targetParentId) {
        // Insert into this node's children
        const newChildren = [...node.children]
        newChildren.splice(newIndex, 0, updatedNode)
        return {
          ...node,
          children: newChildren.map((child, index) => ({ ...child, order: index })),
          hasChildren: true
        }
      }
      
      return {
        ...node,
        children: insertNode(node.children, targetParentId)
      }
    })
  }

  return insertNode(nodesWithoutTarget, newParentId)
}

function findNodeLevel(nodes: WBSTreeNode[], nodeId: string, level: number = 0): number {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return level
    }
    
    if (node.children.length > 0) {
      const childLevel = findNodeLevel(node.children, nodeId, level + 1)
      if (childLevel !== -1) {
        return childLevel
      }
    }
  }
  
  return -1 // Not found
}

function updateAllNodesExpansion(nodes: WBSTreeNode[], isExpanded: boolean): WBSTreeNode[] {
  return nodes.map(node => ({
    ...node,
    isExpanded,
    children: updateAllNodesExpansion(node.children, isExpanded)
  }))
}

function getAllNodeIds(nodes: WBSTreeNode[]): string[] {
  const ids: string[] = []
  
  function traverse(nodeList: WBSTreeNode[]) {
    nodeList.forEach(node => {
      ids.push(node.id)
      if (node.children.length > 0) {
        traverse(node.children)
      }
    })
  }
  
  traverse(nodes)
  return ids
}

function convertAPIDataToTreeNodes(apiNodes: any[]): WBSTreeNode[] {
  return apiNodes.map(apiNode => ({
    id: apiNode.id,
    title: apiNode.title,
    description: apiNode.description,
    parentId: apiNode.parentId,
    projectId: apiNode.projectId,
    assigneeId: apiNode.assigneeId,
    status: apiNode.status,
    startDate: apiNode.startDate ? new Date(apiNode.startDate) : undefined,
    dueDate: apiNode.dueDate ? new Date(apiNode.dueDate) : undefined,
    estimatedHours: apiNode.estimatedHours,
    progress: apiNode.progress,
    version: apiNode.version,
    level: apiNode.level,
    order: apiNode.order,
    isExpanded: apiNode.isExpanded,
    children: apiNode.children ? convertAPIDataToTreeNodes(apiNode.children) : [],
    hasChildren: apiNode.hasChildren,
    isVisible: apiNode.isVisible,
    path: apiNode.path
  }))
}

function initializeExpandedIds(nodes: WBSTreeNode[], expandedIds: Set<string>) {
  nodes.forEach(node => {
    if (node.isExpanded) {
      expandedIds.add(node.id)
    }
    if (node.children.length > 0) {
      initializeExpandedIds(node.children, expandedIds)
    }
  })
}

// Selectors for computed values
export const useWBSSelectors = () => {
  const store = useWBSStore()
  
  return {
    visibleNodes: () => {
      const getVisibleNodes = (nodes: WBSTreeNode[]): WBSTreeNode[] => {
        const result: WBSTreeNode[] = []
        
        nodes.forEach(node => {
          if (node.isVisible) {
            result.push(node)
            
            if (node.isExpanded && node.children.length > 0) {
              result.push(...getVisibleNodes(node.children))
            }
          }
        })
        
        return result
      }
      
      return getVisibleNodes(store.nodes)
    },

    // Helper to get siblings of a node for drag & drop
    getSiblings: (nodeId: string) => {
      const findParentAndSiblings = (nodes: WBSTreeNode[], targetId: string, parentId?: string): { siblings: WBSTreeNode[], parentId?: string } | null => {
        // Check if any node in this level is the target
        const nodeIndex = nodes.findIndex(node => node.id === targetId)
        if (nodeIndex >= 0) {
          return {
            siblings: nodes,
            parentId
          }
        }
        
        // Search in children
        for (const node of nodes) {
          if (node.children.length > 0) {
            const result = findParentAndSiblings(node.children, targetId, node.id)
            if (result) {
              return result
            }
          }
        }
        
        return null
      }
      
      const result = findParentAndSiblings(store.nodes, nodeId)
      return result || { siblings: [], parentId: undefined }
    },
    
    selectedNode: () => {
      if (!store.selectedNodeId) return null
      
      const findNodeById = (nodes: WBSTreeNode[], id: string): WBSTreeNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node
          
          if (node.children.length > 0) {
            const found = findNodeById(node.children, id)
            if (found) return found
          }
        }
        return null
      }
      
      return findNodeById(store.nodes, store.selectedNodeId)
    },

    // Validation helpers for parent change operations
    canChangeParent: (nodeId: string, newParentId: string | null) => {
      const findNodeById = (nodes: WBSTreeNode[], id: string): WBSTreeNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node
          if (node.children.length > 0) {
            const found = findNodeById(node.children, id)
            if (found) return found
          }
        }
        return null
      }

      const isAncestor = (ancestorId: string, descendantId: string, nodes: WBSTreeNode[]): boolean => {
        const descendant = findNodeById(nodes, descendantId)
        if (!descendant) return false
        
        let current = descendant
        while (current.parentId) {
          if (current.parentId === ancestorId) return true
          current = findNodeById(nodes, current.parentId) as WBSTreeNode
          if (!current) break
        }
        return false
      }

      const getNodeDepth = (id: string | null, nodes: WBSTreeNode[]): number => {
        if (!id) return 0
        const node = findNodeById(nodes, id)
        return node ? node.level + 1 : 0
      }

      // Prevent circular relationships (node becoming ancestor of itself)
      if (newParentId && isAncestor(nodeId, newParentId, store.nodes)) {
        return { canChange: false, reason: 'Circular parent-child relationship detected' }
      }

      // Check max depth constraint (5 levels)
      const newDepth = getNodeDepth(newParentId, store.nodes) + 1
      if (newDepth > 5) {
        return { canChange: false, reason: 'Maximum nesting depth of 5 levels exceeded' }
      }

      return { canChange: true }
    },
    
    treeStats: () => {
      let totalNodes = 0
      let visibleNodes = 0
      let expandedNodes = 0
      let maxDepth = 0
      
      const calculateStats = (nodes: WBSTreeNode[], depth = 0) => {
        nodes.forEach(node => {
          totalNodes++
          maxDepth = Math.max(maxDepth, depth)
          
          if (node.isVisible) {
            visibleNodes++
          }
          
          if (node.isExpanded) {
            expandedNodes++
          }
          
          if (node.children.length > 0) {
            calculateStats(node.children, depth + 1)
          }
        })
      }
      
      calculateStats(store.nodes)
      
      return {
        totalNodes,
        visibleNodes,
        expandedNodes,
        maxDepth: maxDepth + 1
      }
    }
  }
}