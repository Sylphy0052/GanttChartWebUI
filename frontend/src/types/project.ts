export type Project = {
  id: string;
  name: string;
  description: string | null;
  shared_password_hash: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectCreateDto = {
  name: string;
  description_md?: string;
  shared_password_hash?: string;
};

export type ProjectUpdateDto = {
  name?: string;
  description_md?: string;
  shared_password_hash?: string;
};

export type PasswordVerificationDto = {
  password: string;
};

export type ProjectRole = 'viewer' | 'editor';

export type AuthenticationResult = {
  role: ProjectRole;
  project: Project;
};