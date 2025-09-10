'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Issue } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import DraggableWBSTree from '@/components/issues/DraggableWBSTree';
import GanttChart, { ExtendedGanttChartProps } from './GanttChart';
import { Dependency } from './DependencyLines';

interface GanttLayoutProps {
  projectId: string;
  issues: Issue[];
  userRole: ProjectRole;
  onIssueClick?: (issue: Issue) => void;
  onIssuesUpdate?: (issues: Issue[]) => void;
  onTaskChange?: (issueId: string, changes: Partial<Issue>) => void;
  isLoading?: boolean;
}

/**
 * WBS-ガント統合レイアウトコンポーネント（依存関係表示対応）
 * 左側WBSツリー・右側ガントチャート（依存関係矢印線付き）の水平分割表示を提供
 */
const GanttLayout: React.FC<GanttLayoutProps> = ({
  projectId,
  issues,
  userRole,
  onIssueClick,
  onIssuesUpdate,
  onTaskChange,
  isLoading = false,
}) => {
  // 分割サイズ（左パネルの幅パーセンテージ）
  const [splitSize, setSplitSize] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  
  // 依存関係データの状態管理
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [selectedDependency, setSelectedDependency] = useState<string | null>(null);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependenciesError, setDependenciesError] = useState<string | null>(null);
  
  // リサイズ中の一時的な位置を管理
  const [tempSplitSize, setTempSplitSize] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  // 依存関係データの取得
  const fetchDependencies = useCallback(async () => {
    if (!projectId) return;
    
    setDependenciesLoading(true);
    setDependenciesError(null);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // 依存関係が存在しない場合は空配列を設定
          setDependencies([]);
          return;
        }
        throw new Error(`依存関係の取得に失敗しました: ${response.status}`);
      }
      
      const dependenciesData: Dependency[] = await response.json();
      setDependencies(dependenciesData);
      
    } catch (error) {
      console.error('Failed to fetch dependencies:', error);
      setDependenciesError(error instanceof Error ? error.message : '依存関係の取得に失敗しました');
      setDependencies([]);
    } finally {
      setDependenciesLoading(false);
    }
  }, [projectId]);

  // 依存関係データの初期取得
  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  // Issue変更時に依存関係を再取得
  useEffect(() => {
    // Issuesの変更で依存関係への影響がある可能性があるため再取得
    if (!isLoading && issues.length > 0) {
      fetchDependencies();
    }
  }, [issues, isLoading, fetchDependencies]);

  // ガントチャートからのIssue選択
  const handleGanttTaskSelect = useCallback((issue: Issue | null) => {
    setSelectedIssue(issue);
  }, []);

  // 依存関係選択ハンドラー
  const handleDependencySelect = useCallback((dependency: Dependency | null) => {
    setSelectedDependency(dependency?.id || null);
  }, []);

  // 依存関係ホバーハンドラー
  const handleDependencyHover = useCallback((dependency: Dependency | null) => {
    // ホバー時の追加処理があれば実装
    // 現在は特に処理なし
  }, []);

  // ドラッグ開始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setTempSplitSize(splitSize);
  }, [splitSize]);

  // ドラッグ中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const newSplitSize = ((e.clientX - rect.left) / rect.width) * 100;
    
    // 分割サイズを20%-80%に制限
    const clampedSize = Math.max(20, Math.min(80, newSplitSize));
    setTempSplitSize(clampedSize);
  }, [isDragging]);

  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setSplitSize(tempSplitSize);
      setIsDragging(false);
    }
  }, [isDragging, tempSplitSize]);

  // グローバルイベントリスナー
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ローディング状態
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">ガントチャートを読み込み中...</span>
        </div>
      </div>
    );
  }

  const currentSplitSize = isDragging ? tempSplitSize : splitSize;

  // ExtendedGanttChartPropsに適合するprops
  const ganttChartProps: ExtendedGanttChartProps = {
    issues,
    dependencies,
    projectId,
    onTaskChange,
    onTaskSelect: handleGanttTaskSelect,
    onDependencySelect: handleDependencySelect,
    onDependencyHover: handleDependencyHover,
    selectedDependency,
    height: 400,
    readOnly: userRole !== 'editor',
    loading: isLoading || dependenciesLoading,
    options: {
      viewMode: 'Week',
      locale: 'ja-JP',
      allowDrag: userRole === 'editor',
      allowResize: userRole === 'editor',
      allowProgressChange: userRole === 'editor',
    },
    displaySettings: {
      showHierarchy: true,
      showProgress: true,
      showDependencies: true,
      timeScale: 'day',
    },
  };

  return (
    <div 
      ref={containerRef}
      className="h-full flex bg-white overflow-hidden"
    >
      {/* 左パネル: WBSツリー */}
      <div 
        className="border-r border-gray-200 overflow-hidden"
        style={{ width: `${currentSplitSize}%` }}
      >
        <div className="h-full overflow-auto">
          <DraggableWBSTree
            projectId={projectId}
            issues={issues}
            isLoading={isLoading}
            onIssueClick={onIssueClick}
            onIssuesUpdate={onIssuesUpdate}
            selectedIssueId={selectedIssue?.id}
            enableDragDrop={userRole === 'editor'}
            showControls={true}
          />
        </div>
      </div>

      {/* リサイズハンドル */}
      <div 
        className={`w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize transition-colors relative ${
          isDragging ? 'bg-blue-400' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* リサイズインジケーター */}
        <div className="absolute inset-y-0 left-0 w-full flex items-center justify-center">
          <div className="w-0.5 h-8 bg-gray-400 rounded-full opacity-60"></div>
        </div>
      </div>

      {/* 右パネル: ガントチャート */}
      <div 
        className="overflow-hidden"
        style={{ width: `${100 - currentSplitSize}%` }}
      >
        <div className="h-full overflow-auto">
          <div className="p-4">
            {/* ガントチャートヘッダー */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">ガントチャート</h2>
              <div className="flex items-center space-x-4">
                {selectedIssue && (
                  <div className="text-sm text-gray-600">
                    選択中: <span className="font-medium">{selectedIssue.title}</span>
                    {onIssueClick && (
                      <button
                        onClick={() => onIssueClick(selectedIssue)}
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        詳細を見る
                      </button>
                    )}
                  </div>
                )}
                {selectedDependency && (
                  <div className="text-sm text-green-600">
                    依存関係選択中
                  </div>
                )}
              </div>
            </div>

            {/* 依存関係エラー表示 */}
            {dependenciesError && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex">
                  <div className="text-yellow-400 mr-2">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">依存関係の読み込みエラー</p>
                    <p className="text-xs text-yellow-700 mt-1">{dependenciesError}</p>
                    <button
                      onClick={fetchDependencies}
                      className="mt-2 text-xs text-yellow-800 underline hover:text-yellow-900"
                    >
                      再読み込み
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* ガントチャート */}
            <GanttChart {...ganttChartProps} />

            {/* 依存関係統計情報 */}
            {dependencies.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    依存関係: {dependencies.length}件
                    {dependencies.filter(dep => dep.type === 'FS').length > 0 && (
                      <span className="ml-2">（FS: {dependencies.filter(dep => dep.type === 'FS').length}件）</span>
                    )}
                  </span>
                  {userRole === 'editor' && (
                    <button
                      onClick={fetchDependencies}
                      className="text-blue-600 hover:text-blue-800 underline"
                      disabled={dependenciesLoading}
                    >
                      {dependenciesLoading ? '更新中...' : '依存関係を更新'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttLayout;