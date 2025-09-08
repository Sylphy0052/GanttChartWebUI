/**
 * プロジェクトインポート機能のDTO定義
 */

export interface ImportResult {
  success: boolean;
  projectId: string;
  message: string;
  importedCounts: {
    issues: number;
    comments: number;
    dependencies: number;
    changeLogs: number;
    images: number;
  };
}

export interface ImportValidationError {
  field: string;
  message: string;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: ImportValidationError[];
  warnings: string[];
}

/**
 * インポート用のデータ構造（エクスポートデータと同じ形式）
 * IDを新規生成するため、インポート時は元のIDは無視される
 */
export interface ImportProjectData {
  name: string;
  description_md: string | null;
}

export interface ImportIssueData {
  parent_id: string | null; // 親子関係は後で解決
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
  originalId: string; // 元のIDを記録（関連データの紐づけ用）
}

export interface ImportCommentData {
  originalIssueId: string; // 元のIssueIDを記録
  author: string;
  body_md: string;
  edited: boolean;
}

export interface ImportDependencyData {
  originalPredecessorId: string;
  originalSuccessorId: string;
  type: string;
}

export interface ImportChangeLogData {
  entity_type: string;
  originalEntityId: string;
  diff_json: any;
  user_hint: string | null;
}

export interface ImportImagePathData {
  originalIssueId: string;
  path: string;
  fileName: string; // ZIPファイル内の実際のファイル名
}