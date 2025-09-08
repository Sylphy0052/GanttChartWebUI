'use client';

import React, { useState, useRef } from 'react';
import { backupApi, ApiError } from '@/lib/api';
import { ImportProgress } from '@/types/backup';

interface ImportSectionProps {
  onImportSuccess?: (projectId: string) => void;
}

const ImportSection: React.FC<ImportSectionProps> = ({ onImportSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('ZIPファイルを選択してください');
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        setError('ファイルサイズは100MB以下にしてください');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('ZIPファイルを選択してください');
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        setError('ファイルサイズは100MB以下にしてください');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setIsImporting(true);
      setError(null);
      setResult(null);

      setProgress({
        phase: 'uploading',
        message: 'ファイルをアップロード中...',
        progress: 25,
      });

      setProgress({
        phase: 'validating',
        message: 'データを検証中...',
        progress: 50,
      });

      setProgress({
        phase: 'importing',
        message: 'プロジェクトをインポート中...',
        progress: 75,
      });

      const importResult = await backupApi.importProject(
        selectedFile,
        projectName.trim() || undefined
      );

      setProgress({
        phase: 'complete',
        message: 'インポート完了',
        progress: 100,
      });

      const successMessage = [
        `プロジェクト「${projectName || selectedFile.name}」をインポートしました`,
        `Issues: ${importResult.importedCounts.issues}件`,
        `コメント: ${importResult.importedCounts.comments}件`,
        `依存関係: ${importResult.importedCounts.dependencies}件`,
        `変更履歴: ${importResult.importedCounts.changeLogs}件`,
        `画像: ${importResult.importedCounts.images}件`,
      ].join('\n');

      setResult(successMessage);
      onImportSuccess?.(importResult.projectId);

      // 成功後にフォームをリセット
      setSelectedFile(null);
      setProjectName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 完了後にプログレスをクリア
      setTimeout(() => {
        setProgress(null);
      }, 2000);

    } catch (error) {
      if (error instanceof ApiError) {
        setError(`インポートに失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Import failed:', error);
      setProgress(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setProjectName('');
    setError(null);
    setResult(null);
    setProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        プロジェクトインポート
      </h3>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          エクスポートしたZIPファイルから新しいプロジェクトを作成できます。
        </p>

        {/* プロジェクト名入力 */}
        <div className="mb-4">
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
            プロジェクト名（任意）
          </label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="未入力の場合はファイル名が使用されます"
            disabled={isImporting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* ファイル選択エリア */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            selectedFile
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${isImporting ? 'pointer-events-none opacity-50' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div>
              <div className="flex items-center justify-center mb-2">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm text-green-800 font-medium">
                {selectedFile.name}
              </p>
              <p className="text-xs text-green-600">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center mb-4">
                <svg
                  className="w-12 h-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                ZIPファイルをドラッグ&ドロップまたは
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                ファイルを選択
              </button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".zip"
            className="hidden"
          />
        </div>

        {selectedFile && !isImporting && (
          <button
            onClick={handleReset}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            ファイル選択をリセット
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <pre className="text-sm text-green-700 whitespace-pre-line">
                {result}
              </pre>
            </div>
          </div>
        </div>
      )}

      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!selectedFile || isImporting}
        className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        {isImporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            インポート中...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            プロジェクトをインポート
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-gray-500">
        ※ ファイルサイズ制限: 100MB まで
      </p>
    </div>
  );
};

export default ImportSection;