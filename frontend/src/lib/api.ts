import { Project, ProjectCreateDto, ProjectUpdateDto, PasswordVerificationDto, AuthenticationResult } from '@/types/project';
import { HolidaySettingsResponse, UpdateHolidaySettingsDto } from '@/types/settings';
import { ImportResult } from '@/types/backup';

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