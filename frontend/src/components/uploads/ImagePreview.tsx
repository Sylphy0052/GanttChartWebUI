'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { UploadedFile } from '@/types/upload';

interface ImagePreviewProps {
  images: UploadedFile[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDownload: (file: UploadedFile) => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onDownload,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentImage = images[currentIndex];

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        onPrevious();
        break;
      case 'ArrowRight':
        onNext();
        break;
    }
  }, [onClose, onNext, onPrevious]);

  // Setup keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Reset loading state when image changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);
  }, [currentIndex]);

  // Handle image load
  const handleImageLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  // Handle image error
  const handleImageError = () => {
    setIsLoading(false);
    setError('画像の読み込みに失敗しました');
  };

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!currentImage) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
    >
      <div className="relative max-w-full max-h-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all duration-200"
          aria-label="閉じる"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            {/* Previous Button */}
            <button
              onClick={onPrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all duration-200"
              aria-label="前の画像"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Next Button */}
            <button
              onClick={onNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all duration-200"
              aria-label="次の画像"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}

        {/* Image Container */}
        <div className="flex flex-col items-center justify-center min-h-0">
          {/* Main Image */}
          <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            )}

            {error ? (
              <div className="flex flex-col items-center justify-center p-8 text-white">
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-lg">{error}</p>
              </div>
            ) : (
              <img
                src={currentImage.url}
                alt={currentImage.original_name}
                className="max-w-full max-h-full object-contain"
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{ display: isLoading ? 'none' : 'block' }}
              />
            )}
          </div>

          {/* Image Info Panel */}
          <div className="mt-4 bg-black bg-opacity-50 rounded-lg p-4 max-w-full">
            <div className="flex items-start justify-between space-x-4 text-white">
              <div className="flex-1 min-w-0">
                <h2
                  id="image-preview-title"
                  className="text-lg font-medium truncate"
                  title={currentImage.original_name}
                >
                  {currentImage.original_name}
                </h2>
                <div className="mt-2 space-y-1 text-sm text-gray-300">
                  <p>サイズ: {formatFileSize(currentImage.file_size)}</p>
                  <p>アップロード日時: {formatDate(currentImage.created_at)}</p>
                  {images.length > 1 && (
                    <p>{currentIndex + 1} / {images.length}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Download Button */}
                <button
                  onClick={() => onDownload(currentImage)}
                  className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
                  title="ダウンロード"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="absolute bottom-4 left-4 text-white text-xs opacity-70">
          <p>ESC: 閉じる</p>
          {images.length > 1 && (
            <>
              <p>← →: 画像切替</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;