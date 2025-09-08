'use client';

import React, { useState } from 'react';
import { backupApi, ApiError } from '@/lib/api';
import { Project } from '@/types/project';
import { ExportProgress } from '@/types/backup';

interface ExportSectionProps {
  project: Project;
}

const ExportSection: React.FC<ExportSectionProps> = ({ project }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      setProgress({
        phase: 'collecting',
        message: 'プロジェクトデータを収集中...',
        progress: 25,
      });

      // 実際のダウンロードを実行
      const blob = await backupApi.exportProject(project.id);

      setProgress({
        phase: 'creating-zip',
        message: 'ZIPファイルを作成中...',
        progress: 75,
      });

      // ダウンロード処理
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${project.name}-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress({
        phase: 'complete',
        message: 'エクスポート完了',
        progress: 100,
      });

      // 完了後にプログレスをクリア
      setTimeout(() => {
        setProgress(null);
      }, 2000);

    } catch (error) {
      if (error instanceof ApiError) {
        setError(`エクスポートに失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました');
      }
      console.error('Export failed:', error);
      setProgress(null);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        プロジェクトエクスポート
      </h3>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          現在のプロジェクト「{project.name}」をZIPファイルとしてダウンロードできます。
        </p>
        <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
          <li>すべてのIssueと関連データ</li>
          <li>コメントとファイル添付</li>
          <li>依存関係と変更履歴</li>
          <li>プロジェクト設定</li>
        </ul>
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
        onClick={handleExport}
        disabled={isExporting}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            エクスポート中...
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
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            ZIPファイルをダウンロード
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-gray-500">
        ※ ファイルサイズ制限: 100MB まで
      </p>
    </div>
  );
};

export default ExportSection;