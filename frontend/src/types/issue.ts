import { UploadedFile } from './upload';

export type IssueStatus = 'open' | 'in_progress' | 'done' | 'blocked';

export interface Issue {
  id: string;
  project_id: string;
  parent_id?: string;
  title: string;
  description_md?: string;
  assignee?: string;
  status: IssueStatus;
  start_date?: Date | string;
  end_date?: Date | string;
  progress_pct: number;
  effort_hours?: number;
  is_blocked: boolean;
  sort_order: number;
  labels: string[];
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
  children?: Issue[];
  parent?: Issue;
  wbs_number?: string; // WBS番号（1.1.1形式）
}

export interface CreateIssueDto {
  parent_id?: string;
  title: string;
  description_md?: string;
  assignee?: string;
  status?: IssueStatus;
  start_date?: Date | string;
  end_date?: Date | string;
  progress_pct?: number;
  effort_hours?: number;
  is_blocked?: boolean;
  labels?: string[];
}

export interface UpdateIssueDto {
  parent_id?: string;
  title?: string;
  description_md?: string;
  assignee?: string;
  status?: IssueStatus;
  start_date?: Date | string;
  end_date?: Date | string;
  progress_pct?: number;
  effort_hours?: number;
  is_blocked?: boolean;
  labels?: string[];
  version?: number; // 楽観ロック用
}

export interface IssueFilters {
  status?: IssueStatus[];
  assignee?: string;
  searchTerm?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'start_date' | 'end_date';
  sortOrder?: 'asc' | 'desc';
}

// WBS関連の型定義
export interface WBSTreeNode extends Issue {
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isVisible: boolean;
}

export interface WBSTreeState {
  expandedNodes: Set<string>;
  visibleNodes: Set<string>;
}

// Comment types
export interface Comment {
  id: string;
  issue_id: string;
  author: string;
  body_md: string;
  created_at: Date | string;
  updated_at: Date | string;
  is_edited: boolean;
}

export interface CreateCommentDto {
  body_md: string;
}

export interface UpdateCommentDto {
  body_md: string;
}

// Change log types
export interface ChangeLogEntry {
  id: string;
  issue_id: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  user_hint?: string;
  created_at: Date | string;
}

export interface IssueDetailData extends Issue {
  comments?: Comment[];
  changeLog?: ChangeLogEntry[];
  uploadedFiles?: UploadedFile[];
}