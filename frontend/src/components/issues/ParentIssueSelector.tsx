'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Issue } from '@/types/issue';

interface ParentIssueSelectorProps {
  currentIssue?: Issue | null;
  allIssues: Issue[];
  selectedParentId?: string | null;
  onParentChange: (parentId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * 親Issue選択UIコンポーネント
 * ドロップダウンで親Issueを選択可能、循環参照防止機能付き
 */
const ParentIssueSelector: React.FC<ParentIssueSelectorProps> = React.memo(({
  currentIssue,
  allIssues,
  selectedParentId,
  onParentChange,
  isLoading = false,
  disabled = false,
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 現在の親Issue
  const currentParent = useMemo(() => {
    const parentId = selectedParentId !== undefined ? selectedParentId : currentIssue?.parent_id;
    return parentId ? allIssues.find(issue => issue.id === parentId) : null;
  }, [selectedParentId, currentIssue?.parent_id, allIssues]);

  // 選択可能な親Issue候補（循環参照を防ぐため子孫は除外）
  const availableParents = useMemo(() => {
    // 新規作成時（currentIssueがない場合）は全てのIssueが選択可能
    if (!currentIssue) {
      return allIssues;
    }

    // 子孫Issueを再帰的に取得
    const getDescendants = (issueId: string): Set<string> => {
      const descendants = new Set<string>([issueId]);
      
      const children = allIssues.filter(issue => issue.parent_id === issueId);
      children.forEach(child => {
        const childDescendants = getDescendants(child.id);
        childDescendants.forEach(desc => descendants.add(desc));
      });
      
      return descendants;
    };

    const descendants = getDescendants(currentIssue.id);
    
    return allIssues.filter(issue => 
      !descendants.has(issue.id) && // 自分と子孫は除外
      issue.id !== currentIssue.id // 自分自身も除外
    );
  }, [currentIssue?.id, allIssues]);

  // 検索フィルター
  const filteredParents = useMemo(() => {
    if (!availableParents) return [];
    if (!searchTerm) return availableParents;
    
    return availableParents.filter(issue =>
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (issue.wbs_number && issue.wbs_number.includes(searchTerm))
    );
  }, [availableParents, searchTerm]);

  // 外部クリック検知
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ドロップダウンを開く
  const handleOpen = () => {
    if (!disabled && !isLoading) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // 親Issueを選択
  const handleSelectParent = (parentId: string | null) => {
    onParentChange(parentId);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Issue表示名を生成
  const getIssueDisplayName = (issue: Issue) => {
    const wbsPrefix = issue.wbs_number ? `${issue.wbs_number} ` : '';
    return `${wbsPrefix}${issue.title}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        親Issue
      </label>
      
      {/* 選択ボックス */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || isLoading}
        className={`
          relative w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 text-left
          cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
          ${disabled || isLoading ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'}
        `}
      >
        <div className="flex items-center justify-between">
          <span className={currentParent ? 'text-gray-900' : 'text-gray-500'}>
            {currentParent ? getIssueDisplayName(currentParent) : '親Issueを選択'}
          </span>
          {isLoading ? (
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
          {/* 検索入力 */}
          <div className="px-3 py-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              placeholder="Issueを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 親なし選択 */}
          <button
            type="button"
            onClick={() => handleSelectParent(null)}
            className={`
              w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center
              ${!currentParent ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}
            `}
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            親Issueなし（ルートレベル）
          </button>

          {/* Issue候補リスト */}
          {filteredParents.length > 0 ? (
            filteredParents.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => handleSelectParent(issue.id)}
                className={`
                  w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center
                  ${currentParent?.id === issue.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}
                `}
              >
                {/* ステータスバッジ */}
                <span className={`
                  inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium mr-2
                  ${issue.status === 'open' ? 'bg-blue-100 text-blue-800' : ''}
                  ${issue.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${issue.status === 'done' ? 'bg-green-100 text-green-800' : ''}
                  ${issue.status === 'blocked' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {issue.status === 'open' && 'オープン'}
                  {issue.status === 'in_progress' && '進行中'}
                  {issue.status === 'done' && '完了'}
                  {issue.status === 'blocked' && 'ブロック'}
                </span>
                
                <span className="truncate">
                  {getIssueDisplayName(issue)}
                </span>
              </button>
            ))
          ) : searchTerm ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              検索結果がありません
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              選択可能な親Issueがありません
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ParentIssueSelector.displayName = 'ParentIssueSelector';

export default ParentIssueSelector;