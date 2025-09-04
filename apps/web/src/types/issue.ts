export type IssueStatus = 'todo' | 'doing' | 'blocked' | 'review' | 'done';
export type IssueType = 'feature' | 'bug' | 'spike' | 'chore';
export type EstimateUnit = 'h' | 'd';

export interface Issue {
  id: string;
  projectId: string;
  parentIssueId?: string;
  title: string;
  description: string;
  status: IssueStatus;
  type: IssueType;
  priority: number;
  estimateValue: number;
  estimateUnit: EstimateUnit;
  spent: number;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  progress: number;
  labels: string[];
  version: number;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueData {
  projectId: string;
  parentIssueId?: string;
  title: string;
  description?: string;
  status: IssueStatus;
  type: IssueType;
  priority: number;
  estimateValue: number;
  estimateUnit: EstimateUnit;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  progress?: number;
  labels?: string[];
}

export interface UpdateIssueData {
  title?: string;
  description?: string;
  status?: IssueStatus;
  type?: IssueType;
  priority?: number;
  estimateValue?: number;
  estimateUnit?: EstimateUnit;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  progress?: number;
  labels?: string[];
  version?: number;
}

export interface IssueFilters {
  projectId?: string;
  assigneeId?: string;
  status?: IssueStatus;
  type?: IssueType;
  label?: string;
  priorityMin?: number;
  priorityMax?: number;
  startDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  includeDeleted?: boolean;
}

export interface PaginatedIssues {
  items: Issue[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface IssuesState {
  issues: Issue[];
  selectedIssue: Issue | null;
  isLoading: boolean;
  error: string | null;
  filters: IssueFilters;
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

export interface IssuesActions {
  fetchIssues: (filters?: IssueFilters, append?: boolean) => Promise<void>;
  fetchIssue: (id: string) => Promise<void>;
  createIssue: (data: CreateIssueData) => Promise<Issue>;
  updateIssue: (id: string, data: UpdateIssueData) => Promise<Issue>;
  deleteIssue: (id: string) => Promise<void>;
  setSelectedIssue: (issue: Issue | null) => void;
  setFilters: (filters: IssueFilters) => void;
  clearError: () => void;
  resetPagination: () => void;
}

// UI helper types
export interface IssueFormData {
  title: string;
  description: string;
  status: IssueStatus;
  type: IssueType;
  priority: number;
  estimateValue: number;
  estimateUnit: EstimateUnit;
  assigneeId: string;
  startDate: string;
  dueDate: string;
  progress: number;
  labels: string[];
}

export interface BulkOperation {
  operation: 'update' | 'move' | 'delete';
  id: string;
  fields?: UpdateIssueData;
}

export interface BulkOperationResponse {
  successCount: number;
  errorCount: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

// Hierarchy and WBS extensions
export interface IssueHierarchy extends Issue {
  children?: IssueHierarchy[];
  level: number;
  path: string[];
  hasChildren: boolean;
  isExpanded?: boolean;
  order: number;
}

export interface IssueTreeNode {
  issue: Issue;
  children: IssueTreeNode[];
  parent?: IssueTreeNode;
  level: number;
  isVisible: boolean;
  isExpanded: boolean;
}

// Gantt integration types
export interface IssueGantt extends Issue {
  dependencies: IssueDependency[];
  actualStartDate?: string;
  actualEndDate?: string;
  baseline?: {
    startDate: string;
    endDate: string;
    progress: number;
  };
}

export interface IssueDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
  lagUnit: 'days' | 'hours';
}

// Tree operations
export interface IssueTreeOperation {
  type: 'move' | 'reorder' | 'expand' | 'collapse';
  issueId: string;
  targetParentId?: string;
  targetPosition?: number;
  newLevel?: number;
}

// Bulk tree operations
export interface IssueTreeBulkOperation {
  operations: IssueTreeOperation[];
  validateHierarchy: boolean;
  preventCircular: boolean;
}

// Tree validation
export interface IssueTreeValidation {
  isValid: boolean;
  errors: Array<{
    type: 'circular' | 'depth' | 'orphan' | 'duplicate';
    issueId: string;
    message: string;
  }>;
  warnings: Array<{
    type: 'performance' | 'depth';
    issueId: string;
    message: string;
  }>;
}

// Extended filters for tree views
export interface IssueTreeFilters extends IssueFilters {
  rootsOnly?: boolean;
  maxDepth?: number;
  expandLevel?: number;
  includeSubtasks?: boolean;
  sortBy?: 'order' | 'priority' | 'startDate' | 'dueDate' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// Performance monitoring
export interface IssueTreeMetrics {
  nodeCount: number;
  maxDepth: number;
  visibleNodes: number;
  renderTime: number;
  memoryUsage?: number;
}