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

// AC2, AC4: Enhanced project access response with refresh token support
export interface ProjectAccessResponse {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
}

// AC2, AC4: Enhanced token info with refresh capabilities
export interface ProjectAccessTokenInfo {
  token: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
}

// AC4: Enhanced projects state with token management integration
export interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  accessTokens: Map<string, ProjectAccessTokenInfo>;
  loading: boolean;
  error: string | null;
}

// AC4: Enhanced projects actions with token lifecycle management
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

  // AC4: New token management methods
  refreshProjectToken?: (projectId: string) => Promise<boolean>;
  validateProjectAccess?: (projectId: string) => Promise<boolean>;
  initializeTokenManagement?: () => void;
  handleTokenRefreshFailure?: (projectId: string, error: string) => void;
}

// AC5: Route protection types
export interface RouteGuardProps {
  children: React.ReactNode;
  requireProjectAccess?: boolean;
  fallbackRoute?: string;
  onAccessDenied?: (projectId: string, error: string) => void;
}

// AC2: Token storage types for localStorage
export interface StoredTokens {
  [projectId: string]: ProjectAccessTokenInfo;
}

// AC3: Background refresh configuration
export interface TokenRefreshConfig {
  bufferTimeMs: number; // Time before expiration to trigger refresh
  retryAttempts: number;
  retryDelayMs: number;
}

// AC7: Enhanced rate limiting information
export interface RateLimitInfo {
  attemptsRemaining: number;
  maxAttempts?: number;
  totalAttempts?: number;
  lockoutUntil?: number;
  nextAttemptIn?: number;
  lockoutDuration?: string;
}

// AC2: Token validation result
export interface TokenValidationResult {
  isValid: boolean;
  expiresAt?: number;
  timeToExpiry?: number;
  willExpireSoon: boolean;
  needsRefresh: boolean;
}

// AC3: Token refresh request/response types
export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

// AC5: Project access validation types
export interface AccessValidationOptions {
  allowRefresh?: boolean;
  silentFail?: boolean;
  timeout?: number;
}

export interface AccessValidationResult {
  hasAccess: boolean;
  tokenInfo?: ProjectAccessTokenInfo;
  error?: string;
  requiresAuthentication: boolean;
}