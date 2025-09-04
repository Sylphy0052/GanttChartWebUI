import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { WBSStore, WBSTreeNode } from '@/types/wbs'

interface WBSTreeState {
  nodes: WBSTreeNode[]
  selectedNodeId?: string
  expandedNodeIds: Set<string>
  loading: boolean
  error?: string
}

interface WBSActions {
  expandNode: (nodeId: string) => void
  collapseNode: (nodeId: string) => void
  toggleNode: (nodeId: string) => void
  selectNode: (nodeId: string) => void
  expandAll: () => void
  collapseAll: () => void
  fetchTree: (projectId?: string) => Promise<void>
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

        fetchTree: async (projectId?: string) => {
          set({ loading: true, error: undefined })
          
          try {
            const params = new URLSearchParams()
            if (projectId) params.append('projectId', projectId)
            params.append('expandLevel', '2')
            params.append('includeCompleted', 'true')
            
            const response = await fetch(`/api/v1/issues/tree?${params.toString()}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            })
            
            if (!response.ok) {
              throw new Error(`Failed to fetch WBS tree: ${response.statusText}`)
            }
            
            const data = await response.json()
            
            // Convert API response to WBSTreeNode format
            const treeNodes = convertAPIDataToTreeNodes(data.nodes)
            
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