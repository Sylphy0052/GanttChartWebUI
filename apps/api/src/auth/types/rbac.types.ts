// RBAC role definitions for project-level access control
export enum ProjectRole {
  OWNER = 'owner',      // Full access, can delete project, manage all settings
  ADMIN = 'admin',      // Manage project settings, users, can't delete project  
  MEMBER = 'member',    // Edit assigned issues, view all project data
  VIEWER = 'viewer',    // Read-only access to project data
}

// Permission levels mapped to actions
export interface RolePermissions {
  // Project management
  deleteProject: boolean;
  updateProjectSettings: boolean;
  inviteUsers: boolean;
  removeUsers: boolean;
  
  // Issue management  
  createIssues: boolean;
  editAllIssues: boolean;
  editAssignedIssues: boolean;
  deleteIssues: boolean;
  
  // Scheduling
  runScheduler: boolean;
  editSchedule: boolean;
  
  // Data access
  viewProject: boolean;
}

// Role permission matrix
export const ROLE_PERMISSIONS: Record<ProjectRole, RolePermissions> = {
  [ProjectRole.OWNER]: {
    deleteProject: true,
    updateProjectSettings: true,
    inviteUsers: true,
    removeUsers: true,
    createIssues: true,
    editAllIssues: true,
    editAssignedIssues: true,
    deleteIssues: true,
    runScheduler: true,
    editSchedule: true,
    viewProject: true,
  },
  [ProjectRole.ADMIN]: {
    deleteProject: false,
    updateProjectSettings: true,
    inviteUsers: true,
    removeUsers: true,
    createIssues: true,
    editAllIssues: true,
    editAssignedIssues: true,
    deleteIssues: true,
    runScheduler: true,
    editSchedule: true,
    viewProject: true,
  },
  [ProjectRole.MEMBER]: {
    deleteProject: false,
    updateProjectSettings: false,
    inviteUsers: false,
    removeUsers: false,
    createIssues: true,
    editAllIssues: false,
    editAssignedIssues: true,
    deleteIssues: false,
    runScheduler: false,
    editSchedule: false,
    viewProject: true,
  },
  [ProjectRole.VIEWER]: {
    deleteProject: false,
    updateProjectSettings: false,
    inviteUsers: false,
    removeUsers: false,
    createIssues: false,
    editAllIssues: false,
    editAssignedIssues: false,
    deleteIssues: false,
    runScheduler: false,
    editSchedule: false,
    viewProject: true,
  },
};

// Helper function to check permissions
export function hasPermission(
  role: ProjectRole,
  permission: keyof RolePermissions
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

// User context with project role  
export interface UserProjectContext {
  userId: string;
  projectId: string;
  role: ProjectRole;
}