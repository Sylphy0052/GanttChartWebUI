'use client';

import React, { useState, useEffect } from 'react';
import { ChangeLogEntry } from '@/types/issue';
import { changeLogApi, ApiError } from '@/lib/api';

interface ChangeLogSectionProps {
  projectId: string;
  issueId: string;
  changeLog: ChangeLogEntry[];
}

const ChangeLogSection: React.FC<ChangeLogSectionProps> = ({
  projectId,
  issueId,
  changeLog: initialChangeLog,
}) => {
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(initialChangeLog);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChangeLog(initialChangeLog);
  }, [initialChangeLog]);

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFieldDisplayName = (fieldName: string): string => {
    const fieldNames: Record<string, string> = {
      title: 'タイトル',
      description_md: '説明',
      status: 'ステータス',
      assignee: '担当者',
      start_date: '開始日',
      end_date: '終了日',
      progress_pct: '進捗率',
      effort_hours: '見積時間',
      is_blocked: 'ブロック状態',
      labels: 'ラベル',
      parent_id: '親Issue',
    };
    return fieldNames[fieldName] || fieldName;
  };

  const getStatusDisplayName = (status: string): string => {
    const statusNames: Record<string, string> = {
      open: 'オープン',
      in_progress: '進行中',
      done: '完了',
      blocked: 'ブロック',
    };
    return statusNames[status] || status;
  };

  const formatValue = (fieldName: string, value: string | null | undefined): string => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    switch (fieldName) {
      case 'status':
        return getStatusDisplayName(value);
      case 'is_blocked':
        return value === 'true' ? 'ブロック中' : '通常';
      case 'progress_pct':
        return `${value}%`;
      case 'effort_hours':
        return `${value}時間`;
      case 'start_date':
      case 'end_date':
        try {
          const date = new Date(value);
          return date.toLocaleDateString('ja-JP');
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  const getChangeIcon = (fieldName: string) => {
    switch (fieldName) {
      case 'status':
        return (
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'assignee':
        return (
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'progress_pct':
        return (
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  // 日付でグループ化
  const groupedChangeLog = changeLog.reduce((groups: Record<string, ChangeLogEntry[]>, entry) => {
    const date = new Date(entry.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
    return groups;
  }, {});

  const loadChangeLog = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await changeLogApi.getAll(projectId, issueId);
      setChangeLog(data);
    } catch (error) {
      console.error('Failed to load change log:', error);
      if (error instanceof ApiError) {
        setError(`変更履歴の読み込みに失敗しました: ${error.message}`);
      } else {
        setError('ネットワークエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">変更履歴</h2>
        <button
          onClick={loadChangeLog}
          disabled={isLoading}
          className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center space-x-1">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>読み込み中</span>
            </div>
          ) : (
            '最新に更新'
          )}
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 変更履歴タイムライン */}
      <div className="space-y-6">
        {Object.keys(groupedChangeLog).length === 0 ? (
          <div className="text-center py-8">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 text-gray-500">変更履歴がありません</p>
          </div>
        ) : (
          Object.entries(groupedChangeLog)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([dateString, entries]) => (
              <div key={dateString}>
                <h3 className="text-sm font-medium text-gray-500 mb-4">
                  {new Date(dateString).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                
                <div className="relative">
                  {/* タイムライン縦線 */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  
                  <div className="space-y-4">
                    {entries
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((entry, index) => (
                        <div key={entry.id} className="relative flex items-start space-x-3">
                          {/* アイコン */}
                          <div className="relative z-10">
                            {getChangeIcon(entry.field_name)}
                          </div>

                          {/* 変更内容 */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">
                                {getFieldDisplayName(entry.field_name)}
                              </span>
                              <span className="text-gray-500"> が変更されました</span>
                            </div>
                            
                            <div className="mt-1 text-sm text-gray-600">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-xs text-gray-400">変更前:</span>
                                  <div className="font-mono bg-red-50 px-2 py-1 rounded text-red-700">
                                    {formatValue(entry.field_name, entry.old_value)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-400">変更後:</span>
                                  <div className="font-mono bg-green-50 px-2 py-1 rounded text-green-700">
                                    {formatValue(entry.field_name, entry.new_value)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {entry.user_hint && (
                              <div className="mt-2 text-xs text-gray-500 italic">
                                メモ: {entry.user_hint}
                              </div>
                            )}

                            <div className="mt-2 text-xs text-gray-400">
                              {formatDate(entry.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ChangeLogSection;