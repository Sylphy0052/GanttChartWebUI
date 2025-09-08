export interface UploadedFile {
  id: string;
  issue_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  url: string;
  thumbnail_url?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  uploadedFile?: UploadedFile;
}

export interface FileUploadResponse {
  file: UploadedFile;
  message: string;
}

export interface FileUploadError {
  error: string;
  details?: {
    field?: string;
    code?: string;
  };
}

// File validation constraints
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif'],
} as const;