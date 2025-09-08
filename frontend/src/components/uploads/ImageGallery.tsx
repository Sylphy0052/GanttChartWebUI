'use client';

import React, { useState, useCallback } from 'react';
import { ProjectRole } from '@/types/project';
import { UploadedFile } from '@/types/upload';
import { uploadsApi } from '@/lib/api';
import ImagePreview from './ImagePreview';

interface ImageGalleryProps {
  images: UploadedFile[];
  projectId: string;
  issueId: string;
  userRole: ProjectRole;
  onDelete: (fileId: string) => void;
  onError: (error: string) => void;
  loading?: boolean;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  projectId,
  issueId,
  userRole,
  onDelete,
  onError,
  loading = false,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date for display
  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle image deletion
  const handleDelete = async (file: UploadedFile) => {
    if (userRole !== 'editor') {
      onError('削除には編集権限が必要です。');
      return;
    }

    if (!window.confirm(`画像「${file.original_name}」を削除しますか？`)) {
      return;
    }

    setDeleting(file.id);

    try {
      await uploadsApi.delete(projectId, issueId, file.id);
      onDelete(file.id);
    } catch (error) {
      onError(`画像の削除に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(null);
    }
  };

  // Handle image click to open preview
  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  // Handle preview close
  const handlePreviewClose = () => {
    setSelectedImageIndex(null);
  };

  // Handle preview navigation
  const handlePreviewNext = useCallback(() => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % images.length);
    }
  }, [selectedImageIndex, images.length]);

  const handlePreviewPrevious = useCallback(() => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex(selectedImageIndex === 0 ? images.length - 1 : selectedImageIndex - 1);
    }
  }, [selectedImageIndex, images.length]);

  // Handle download
  const handleDownload = async (file: UploadedFile) => {
    try {
      const blob = await uploadsApi.download(projectId, issueId, file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      onError(`ダウンロードに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-gray-200 rounded-lg aspect-square"></div>
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">添付画像なし</h3>
        <p className="mt-1 text-sm text-gray-500">
          画像をアップロードするとここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">添付画像</h3>
        <span className="text-sm text-gray-500">{images.length}件</span>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((file, index) => (
          <div
            key={file.id}
            className="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
          >
            {/* Image Thumbnail */}
            <div
              className="aspect-square cursor-pointer"
              onClick={() => handleImageClick(index)}
            >
              <img
                src={file.thumbnail_url || file.url}
                alt={file.original_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* File Information */}
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-gray-900 truncate"
                    title={file.original_name}
                  >
                    {file.original_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.file_size)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(file.created_at)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1 ml-2">
                  {/* Download Button */}
                  <button
                    onClick={() => handleDownload(file)}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                    title="ダウンロード"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                      />
                    </svg>
                  </button>

                  {/* Delete Button (Editor Only) */}
                  {userRole === 'editor' && (
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={deleting === file.id}
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 disabled:opacity-50"
                      title="削除"
                    >
                      {deleting === file.id ? (
                        <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Image Preview Modal */}
      {selectedImageIndex !== null && (
        <ImagePreview
          images={images}
          currentIndex={selectedImageIndex}
          onClose={handlePreviewClose}
          onNext={handlePreviewNext}
          onPrevious={handlePreviewPrevious}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default ImageGallery;