import { Project, ProjectCreateDto, ProjectUpdateDto, PasswordVerificationDto, AuthenticationResult } from '@/types/project';
import { HolidaySettingsResponse, UpdateHolidaySettingsDto } from '@/types/settings';
import { ImportResult } from '@/types/backup';
import { Issue, CreateIssueDto, UpdateIssueDto, Comment, CreateCommentDto, UpdateCommentDto, ChangeLogEntry, IssueDetailData } from '@/types/issue';
import { UploadedFile, FileUploadResponse } from '@/types/upload';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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
  const url = `${API_BASE_URL}${endpoint}`;
  
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

// ファイルダウンロード用の特殊なリクエスト関数
async function downloadRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Blob> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
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

  return response.blob();
}

// ファイルアップロード用の特殊なリクエスト関数
async function uploadRequest<T>(
  endpoint: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
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

export const projectsApi = {
  // プロジェクト一覧取得
  getAll: (): Promise<Project[]> => {
    return apiRequest<Project[]>('/projects');
  },

  // プロジェクト詳細取得
  getById: (id: string): Promise<Project> => {
    return apiRequest<Project>(`/projects/${id}`);
  },

  // プロジェクト作成
  create: (data: ProjectCreateDto): Promise<Project> => {
    return apiRequest<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // プロジェクト更新
  update: (id: string, data: ProjectUpdateDto): Promise<Project> => {
    return apiRequest<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // プロジェクト削除（論理削除）
  delete: (id: string): Promise<void> => {
    return apiRequest<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // パスワード認証
  verifyPassword: (id: string, data: PasswordVerificationDto): Promise<AuthenticationResult> => {
    return apiRequest<AuthenticationResult>(`/projects/${id}/verify-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const issuesApi = {
  // Issue一覧取得
  getAll: (projectId: string): Promise<Issue[]> => {
    return apiRequest<Issue[]>(`/projects/${projectId}/issues`);
  },

  // Issue詳細取得
  getById: (projectId: string, id: string): Promise<Issue> => {
    return apiRequest<Issue>(`/projects/${projectId}/issues/${id}`);
  },

  // Issue詳細取得（コメント・変更履歴込み）
  getDetailById: (projectId: string, id: string): Promise<IssueDetailData> => {
    return apiRequest<IssueDetailData>(`/projects/${projectId}/issues/${id}/detail`);
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
};

export const commentsApi = {
  // コメント一覧取得
  getAll: (projectId: string, issueId: string): Promise<Comment[]> => {
    return apiRequest<Comment[]>(`/projects/${projectId}/issues/${issueId}/comments`);
  },

  // コメント作成
  create: (projectId: string, issueId: string, data: CreateCommentDto): Promise<Comment> => {
    return apiRequest<Comment>(`/projects/${projectId}/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // コメント更新
  update: (projectId: string, issueId: string, commentId: string, data: UpdateCommentDto): Promise<Comment> => {
    return apiRequest<Comment>(`/projects/${projectId}/issues/${issueId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // コメント削除
  delete: (projectId: string, issueId: string, commentId: string): Promise<void> => {
    return apiRequest<void>(`/projects/${projectId}/issues/${issueId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  },
};

export const changeLogApi = {
  // 変更履歴取得
  getAll: (projectId: string, issueId: string): Promise<ChangeLogEntry[]> => {
    return apiRequest<ChangeLogEntry[]>(`/projects/${projectId}/issues/${issueId}/changelog`);
  },
};

export const uploadsApi = {
  // アップロード済みファイル一覧取得
  getAll: (projectId: string, issueId: string): Promise<{ files: UploadedFile[] }> => {
    return apiRequest<{ files: UploadedFile[] }>(`/projects/${projectId}/issues/${issueId}/uploads`);
  },

  // ファイルアップロード
  upload: (projectId: string, issueId: string, file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('issueId', issueId);

    return uploadRequest<FileUploadResponse>(`/projects/${projectId}/issues/${issueId}/uploads`, formData);
  },

  // ファイル削除
  delete: (projectId: string, issueId: string, fileId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/projects/${projectId}/issues/${issueId}/uploads/${fileId}`, {
      method: 'DELETE',
    });
  },

  // ファイルダウンロード
  download: async (projectId: string, issueId: string, fileId: string): Promise<Blob> => {
    return downloadRequest(`/projects/${projectId}/issues/${issueId}/uploads/${fileId}/download`);
  },
};

export const settingsApi = {
  // 休日設定取得
  getHolidaySettings: (): Promise<HolidaySettingsResponse> => {
    return apiRequest<HolidaySettingsResponse>('/settings/holidays');
  },

  // 休日設定更新
  updateHolidaySettings: (data: UpdateHolidaySettingsDto): Promise<HolidaySettingsResponse> => {
    return apiRequest<HolidaySettingsResponse>('/settings/holidays', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

export const backupApi = {
  // プロジェクトエクスポート
  exportProject: async (projectId: string): Promise<Blob> => {
    return downloadRequest(`/backup/export/${projectId}`, {
      method: 'POST',
    });
  },

  // プロジェクトインポート
  importProject: async (file: File, projectName?: string): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectName) {
      formData.append('projectName', projectName);
    }

    const url = `${API_BASE_URL}/backup/import`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
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
  },
};