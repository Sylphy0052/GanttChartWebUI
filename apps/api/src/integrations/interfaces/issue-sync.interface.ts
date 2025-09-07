export interface SyncResult {
  success: boolean;
  message: string;
  issueId?: string;
  externalIssueId: string;
  errors?: string[];
}

export interface SyncConfiguration {
  projectMapping: {
    [repositoryName: string]: string; // repo名 → projectId
  };
  statusMapping: {
    [externalStatus: string]: IssueStatus;
  };
  defaultOptions: {
    fallbackUserId: string;
    defaultStatus: IssueStatus;
    enableAutoUserCreation: boolean;
  };
}

export type IssueStatus = 'todo' | 'in_progress' | 'done';

export interface ExternalIssueData {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee?: string;
  labels?: string[];
  created_at: string;
  updated_at: string;
}

export interface InternalIssueData {
  title: string;
  description: string;
  status: IssueStatus;
  assigneeId?: string;
  labels?: string[];
  type: 'feature' | 'bug' | 'task';
  priority: number;
  estimateValue: number;
  estimateUnit: 'h' | 'd' | 'w';
}