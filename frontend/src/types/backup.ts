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

export interface ExportProgress {
  phase: 'collecting' | 'creating-zip' | 'complete';
  message: string;
  progress: number; // 0-100
}

export interface ImportProgress {
  phase: 'uploading' | 'validating' | 'importing' | 'complete';
  message: string;
  progress: number; // 0-100
}

export interface BackupFile {
  file: File;
  projectName?: string;
}