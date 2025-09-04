export interface WBSNode {
  id: string
  title: string
  description?: string
  parentId?: string
  projectId: string
  assigneeId?: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  startDate?: Date
  dueDate?: Date
  estimatedHours?: number
  progress: number
  version: number
  level: number
  order: number
  isExpanded: boolean
  children?: WBSNode[]
}

export interface WBSTreeNode extends WBSNode {
  children: WBSTreeNode[]
  hasChildren: boolean
  isVisible: boolean
  path: string[]
}

export interface WBSTreeState {
  nodes: WBSTreeNode[]
  selectedNodeId?: string
  expandedNodeIds: Set<string>
  loading: boolean
  error?: string
}

export interface WBSActions {
  expandNode: (nodeId: string) => void
  collapseNode: (nodeId: string) => void
  toggleNode: (nodeId: string) => void
  selectNode: (nodeId: string) => void
  expandAll: () => void
  collapseAll: () => void
  fetchTree: (projectId?: string) => Promise<void>
}

export type WBSStore = WBSTreeState & WBSActions

export interface WBSNodeOperation {
  type: 'expand' | 'collapse' | 'select' | 'move' | 'create' | 'update' | 'delete'
  nodeId: string
  data?: Partial<WBSNode>
  targetParentId?: string
  targetIndex?: number
}

export interface WBSTreeConfig {
  showProgress: boolean
  showDates: boolean
  showAssignees: boolean
  showEstimatedHours: boolean
  maxDepth: number
  virtualizeThreshold: number
}

export interface WBSTreeMetrics {
  totalNodes: number
  visibleNodes: number
  maxDepth: number
  renderTime: number
}