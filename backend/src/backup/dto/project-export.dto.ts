/**
 * プロジェクトエクスポート機能のDTO定義
 */

export interface ProjectExportData {
  metadata: ExportMetadata;
  project: ProjectData;
  issues: IssueData[];
  comments: CommentData[];
  dependencies: DependencyData[];
  changeLogs: ChangeLogData[];
  imagePaths: ImagePathData[];
}

export interface ExportMetadata {
  exportedAt: string;
  version: string;
  projectId: string;
  projectName: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description_md: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IssueData {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description_md: string | null;
  assignee: string | null;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  progress_pct: number;
  effort_hours: number | null;
  is_blocked: boolean;
  sort_order: number;
  labels: string[];
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CommentData {
  id: string;
  issue_id: string;
  author: string;
  body_md: string;
  edited: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DependencyData {
  id: string;
  project_id: string;
  predecessor_issue_id: string;
  successor_issue_id: string;
  type: string;
  created_at: Date;
}

export interface ChangeLogData {
  id: string;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  diff_json: any;
  user_hint: string | null;
  created_at: Date;
}

export interface ImagePathData {
  id: string;
  issue_id: string;
  path: string;
  created_at: Date;
}