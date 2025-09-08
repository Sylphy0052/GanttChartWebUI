'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ProjectRole } from '@/types/project';
import { UploadProgress, UPLOAD_CONSTRAINTS, UploadedFile } from '@/types/upload';
import { uploadsApi } from '@/lib/api';

interface ImageUploadProps {
  issueId: string;
  projectId: string;
  userRole: ProjectRole;
  onUploadComplete: (files: UploadedFile[]) => void;
  onError: (error: string) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  issueId,
  projectId,
  userRole,
  onUploadComplete,
  onError,
}) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    if (file.size > UPLOAD_CONSTRAINTS.MAX_FILE_SIZE) {
      return `ファイルサイズが制限を超えています。最大サイズ: ${UPLOAD_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    if (!UPLOAD_CONSTRAINTS.ALLOWED_TYPES.includes(file.type)) {
      return `サポートされていないファイル形式です。対応形式: ${UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}`;
    }

    return null;
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file upload with progress tracking
  const handleFilesUpload = async (files: File[]) => {
    if (userRole !== 'editor') {
      onError('アップロードには編集権限が必要です。');
      return;
    }

    const validFiles: File[] = [];
    
    // Validate all files first
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        onError(`${file.name}: ${validationError}`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return;
    }

    // Initialize progress tracking
    const initialProgress: UploadProgress[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading',
    }));

    setUploadProgress(initialProgress);

    const uploadedFiles: UploadedFile[] = [];

    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      try {
        // Update progress to show upload started
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, progress: 10 } : item
        ));

        const response = await uploadsApi.upload(projectId, issueId, file);
        
        // Update progress to completed
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { 
            ...item, 
            progress: 100, 
            status: 'completed',
            uploadedFile: response.file
          } : item
        ));

        uploadedFiles.push(response.file);
        
      } catch (error) {
        // Update progress to show error
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { 
            ...item, 
            progress: 0, 
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          } : item
        ));
        
        onError(`${file.name}のアップロードに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Clear progress after a delay
    setTimeout(() => {
      setUploadProgress([]);
    }, 3000);

    // Notify parent component of successful uploads
    if (uploadedFiles.length > 0) {
      onUploadComplete(uploadedFiles);
    }
  };

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  }, [handleFilesUpload]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  if (userRole !== 'editor') {
    return (
      <div className="text-sm text-gray-500 p-4 text-center">
        画像をアップロードするには編集権限が必要です。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={UPLOAD_CONSTRAINTS.ALLOWED_TYPES.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="ファイルを選択"
        />

        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-gray-600">
            <p className="text-sm">
              <span className="font-medium text-blue-600 hover:text-blue-500">
                クリックしてファイルを選択
              </span>
              または画像をドラッグ&ドロップ
            </p>
            <p className="text-xs text-gray-500 mt-1">
              対応形式: {UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')} 
              (最大 {UPLOAD_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">アップロード中...</h3>
          {uploadProgress.map((progress, index) => (
            <div key={index} className="bg-white p-3 rounded-md border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                    {progress.file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({formatFileSize(progress.file.size)})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {progress.status === 'uploading' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                  {progress.status === 'completed' && (
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {progress.status === 'error' && (
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.status === 'error' ? 'bg-red-600' : 
                    progress.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              
              {progress.status === 'error' && progress.error && (
                <p className="text-xs text-red-600 mt-1">{progress.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;