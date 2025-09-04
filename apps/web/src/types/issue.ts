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