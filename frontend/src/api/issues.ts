import { Issue, CreateIssueDto, UpdateIssueDto } from '@/types/issue';

// Docker環境では内部通信用、ブラウザでは外部アクセス用のURLを使用
const getApiBaseUrl = () => {
  // サーバーサイド（Docker内部）では backend サービス名を使用
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://backend:3002';
  }
  // クライアントサイド（ブラウザ）では localhost を使用
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3012';
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

// Issue並び替え用の型定義
export interface IssueReorderItem {
  id: string;
  sort_order: number;
  version: number;
}

export interface IssueReorderDto {
  issues: IssueReorderItem[];
}

// 階層変更用の型定義
export interface IssueHierarchyChangeDto {
  parent_id?: string | null;
  version: number;
}

export interface IssueHierarchyChangeResponse {
  updatedIssue: Issue;
  affectedIssues: Issue[];
}

// Issue API関数群
export const issuesApi = {
  // Issue一覧取得
  getAll: (projectId: string): Promise<Issue[]> => {
    return apiRequest<Issue[]>(`/projects/${projectId}/issues`);
  },

  // Issue詳細取得
  getById: (projectId: string, id: string): Promise<Issue> => {
    return apiRequest<Issue>(`/projects/${projectId}/issues/${id}`);
  },

  // Issue作成
  create: (projectId: string, data: CreateIssueDto): Promise<Issue> => {
    return apiRequest<Issue>(`/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Issue更新
  update: (projectId: string, id: string, data: UpdateIssueDto): Promise<Issue> => {
    return apiRequest<Issue>(`/projects/${projectId}/issues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Issue削除（論理削除）
  delete: (projectId: string, id: string): Promise<void> => {
    return apiRequest<void>(`/projects/${projectId}/issues/${id}`, {
      method: 'DELETE',
    });
  },

  // Issue並び替え
  reorder: (projectId: string, data: IssueReorderDto): Promise<Issue[]> => {
    return apiRequest<Issue[]>(`/issues/reorder`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Issue階層変更
  changeHierarchy: (id: string, data: IssueHierarchyChangeDto): Promise<IssueHierarchyChangeResponse> => {
    return apiRequest<IssueHierarchyChangeResponse>(`/issues/${id}/hierarchy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};