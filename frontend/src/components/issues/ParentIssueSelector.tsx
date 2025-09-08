'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Issue } from '@/types/issue';
import { issuesApi, ApiError } from '@/lib/api';

interface ParentIssueSelectorProps {
  projectId: string;
  value?: string;
  onChange: (parentId: string | undefined) => void;
  excludeIssueId?: string; // 編集時に自分自身とその子Issuesを除外
  disabled?: boolean;
}

const ParentIssueSelector: React.FC<ParentIssueSelectorProps> = ({
  projectId,
  value,
  onChange,
  excludeIssueId,
  disabled = false,
}) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadIssues = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await issuesApi.getAll(projectId);
        
        // 階層構造を構築
        const issueMap = new Map<string, Issue>(data.map(issue => [issue.id, { ...issue, children: [] as Issue[] }]));
        const rootIssues: Issue[] = [];
        
        data.forEach(issue => {
          const issueWithChildren = issueMap.get(issue.id)!;
          
          if (issue.parent_id) {
            const parent = issueMap.get(issue.parent_id);
            if (parent) {
              if (!parent.children) {
                parent.children = [];
              }
              parent.children.push(issueWithChildren);
            } else {
              // 親が見つからない場合は、ルートレベルに追加
              rootIssues.push(issueWithChildren);
            }
          } else {
            rootIssues.push(issueWithChildren);
          }
        });
        
        setIssues(rootIssues);
      } catch (error) {
        if (error instanceof ApiError) {
          setError(`Issueの読み込みに失敗しました: ${error.message}`);
        } else {
          setError('ネットワークエラーが発生しました');
        }
        console.error('Failed to load issues:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      loadIssues();
    }
  }, [projectId]);

  // 除外すべきIssue IDのセットを作成（自分自身とその子Issues）
  const excludedIds = useMemo(() => {
    if (!excludeIssueId) return new Set();
    
    const excluded = new Set<string>([excludeIssueId]);
    
    const addChildrenToExcluded = (issues: Issue[]) => {
      issues.forEach(issue => {
        if (issue.parent_id === excludeIssueId || excluded.has(issue.parent_id || '')) {
          excluded.add(issue.id);
          if (issue.children) {
            addChildrenToExcluded(issue.children);
          }
        }
      });
    };
    
    // 全てのIssueをフラットにして子Issueを探す
    const flattenIssues = (issues: Issue[]): Issue[] => {
      return issues.reduce((acc, issue) => {
        acc.push(issue);
        if (issue.children) {
          acc.push(...flattenIssues(issue.children));
        }
        return acc;
      }, [] as Issue[]);
    };
    
    const allIssues = flattenIssues(issues);
    addChildrenToExcluded(allIssues);
    
    return excluded;
  }, [excludeIssueId, issues]);

  // フィルタリングされたIssueリストを作成
  const filteredIssues = useMemo(() => {
    const filterIssues = (issues: Issue[], depth = 0): Array<Issue & { depth: number }> => {
      const result: Array<Issue & { depth: number }> = [];
      
      issues.forEach(issue => {
        // 除外対象でない場合のみ追加
        if (!excludedIds.has(issue.id)) {
          // 検索クエリでフィルタリング
          const matchesSearch = !searchQuery || 
            issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            issue.assignee?.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (matchesSearch) {
            result.push({ ...issue, depth });
          }
          
          // 子Issuesも処理（親がフィルタされていても子は表示する可能性がある）
          if (issue.children) {
            result.push(...filterIssues(issue.children, depth + 1));
          }
        }
      });
      
      return result;
    };
    
    return filterIssues(issues);
  }, [issues, excludedIds, searchQuery]);

  const selectedIssue = useMemo(() => {
    const findIssue = (issues: Issue[]): Issue | null => {
      for (const issue of issues) {
        if (issue.id === value) return issue;
        if (issue.children) {
          const found = findIssue(issue.children);
          if (found) return found;
        }
      }
      return null;
    };
    return value ? findIssue(issues) : null;
  }, [value, issues]);

  const handleSelect = (issue: Issue | null) => {
    onChange(issue?.id);
    setIsOpen(false);
  };

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        親Issue
      </label>
      
      {/* セレクターボタン */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`relative w-full bg-white border rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
          disabled ? 'bg-gray-50 text-gray-500' : 'border-gray-300'
        }`}
      >
        <span className="block truncate">
          {isLoading ? (
            '読み込み中...'
          ) : selectedIssue ? (
            `${selectedIssue.title} (${selectedIssue.assignee || '未割り当て'})`
          ) : (
            '親Issueを選択'
          )}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {/* 検索フィールド */}
          <div className="sticky top-0 z-10 bg-white px-3 py-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Issueを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* なしオプション */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
              !value ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
            }`}
          >
            なし（親Issueなし）
          </button>

          {/* Issue一覧 */}
          {filteredIssues.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchQuery ? '検索結果がありません' : 'Issueがありません'}
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => handleSelect(issue)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                  value === issue.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                }`}
              >
                <div className="flex items-center">
                  {/* インデント表示 */}
                  <div style={{ paddingLeft: `${issue.depth * 16}px` }}>
                    {issue.depth > 0 && (
                      <span className="text-gray-400 mr-1">└</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">
                      {issue.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {issue.assignee || '未割り当て'} • {issue.status === 'open' ? 'オープン' : 
                       issue.status === 'in_progress' ? '進行中' :
                       issue.status === 'done' ? '完了' : 'ブロック'}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ParentIssueSelector;