export type ProjectVisibility = 'private' | 'password' | 'public';

export interface Project {
  id: string;
  name: string;
  visibility: ProjectVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  name: string;
  visibility?: ProjectVisibility;
}

export interface UpdateProjectData {
  name?: string;
  visibility?: ProjectVisibility;
}

export interface ProjectAccessRequest {
  password: string;
}

export interface ProjectAccessResponse {
  accessToken: string;
  expiresAt: number;
}

export interface ProjectAccessTokenInfo {
  token: string;
  expiresAt: number;
}

export interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  accessTokens: Map<string, ProjectAccessTokenInfo>;
  loading: boolean;
  error: string | null;
}

export interface ProjectsActions {
  fetchProjects: () => Promise<void>;
  selectProject: (projectId: string, password?: string) => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<void>;
  updateProject: (projectId: string, data: UpdateProjectData) => Promise<void>;
  setProjectPassword: (projectId: string, password: string) => Promise<void>;
  checkProjectAccess: (projectId: string) => boolean;
  clearAccessToken: (projectId: string) => void;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}