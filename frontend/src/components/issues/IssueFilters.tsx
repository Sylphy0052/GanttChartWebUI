'use client';

import React, { useState, useEffect } from 'react';
import { IssueStatus, IssueFilters as IssueFiltersType } from '@/types/issue';
import { issuesApi } from '@/lib/api';

interface IssueFiltersProps {
  filters: IssueFiltersType;
  onFiltersChange: (filters: IssueFiltersType) => void;
  projectId: string;
}

const statusOptions: Array<{ value: IssueStatus; label: string; color: string }> = [
  { value: 'open', label: 'オープン', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: '進行中', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'done', label: '完了', color: 'bg-green-100 text-green-800' },
  { value: 'blocked', label: 'ブロック', color: 'bg-red-100 text-red-800' },
];

const sortOptions = [
  { value: 'created_at', label: '作成日' },
  { value: 'updated_at', label: '更新日' },
  { value: 'title', label: 'タイトル' },
  { value: 'start_date', label: '開始日' },
  { value: 'end_date', label: '終了日' },
] as const;

const IssueFilters: React.FC<IssueFiltersProps> = ({ filters, onFiltersChange, projectId }) => {
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<string[]>([]);

  // 担当者一覧を取得
  useEffect(() => {
    const loadAssignees = async () => {
      try {
        const assignees = await issuesApi.getAssignees(projectId);
        setAssigneeSuggestions(assignees);
      } catch (error) {
        console.error('Failed to load assignees:', error);
        setAssigneeSuggestions([]);
      }
    };

    if (projectId) {
      loadAssignees();
    }
  }, [projectId]);

  const handleStatusToggle = (status: IssueStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    onFiltersChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  const handleAssigneeChange = (assignee: string) => {
    onFiltersChange({
      ...filters,
      assignee: assignee.trim() || undefined,
    });
  };

  const handleSearchTermChange = (searchTerm: string) => {
    onFiltersChange({
      ...filters,
      searchTerm,
    });
  };


  const handleSortChange = (sortBy: typeof sortOptions[number]['value']) => {
    onFiltersChange({
      ...filters,
      sortBy,
    });
  };

  const handleSortOrderChange = (sortOrder: 'asc' | 'desc') => {
    onFiltersChange({
      ...filters,
      sortOrder,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      sortBy: 'created_at',
      sortOrder: 'desc',
      searchTerm: '',
    });
  };

  const hasActiveFilters = Boolean(
    filters.status?.length || 
    filters.assignee || 
    filters.searchTerm?.trim() ||
    filters.sortBy !== 'created_at' || 
    filters.sortOrder !== 'desc'
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-6 py-4">
        <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-6">
          {/* ステータス フィルター */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ステータス
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(({ value, label, color }) => {
                const isSelected = filters.status?.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => handleStatusToggle(value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? color
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 担当者 フィルター */}
          <div className="flex-1">
            <label htmlFor="assignee-filter" className="block text-sm font-medium text-gray-700 mb-2">
              担当者
            </label>
            <select
              id="assignee-filter"
              value={filters.assignee || ''}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">すべての担当者</option>
              {assigneeSuggestions.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
          </div>

          {/* 検索 */}
          <div className="flex-1">
            <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-2">
              検索
            </label>
            <input
              id="search-filter"
              type="text"
              placeholder="タイトル、説明、担当者、WBS番号で検索"
              value={filters.searchTerm || ''}
              onChange={(e) => handleSearchTermChange(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* ソート */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              並び順
            </label>
            <div className="flex space-x-2">
              <select
                value={filters.sortBy || 'created_at'}
                onChange={(e) => handleSortChange(e.target.value as typeof sortOptions[number]['value'])}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {sortOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={filters.sortOrder || 'desc'}
                onChange={(e) => handleSortOrderChange(e.target.value as 'asc' | 'desc')}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="desc">降順</option>
                <option value="asc">昇順</option>
              </select>
            </div>
          </div>

          {/* クリア ボタン */}
          <div className="flex items-end">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueFilters;