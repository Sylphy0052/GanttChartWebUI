'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Issue } from '@/types/issue';
import { ProjectRole } from '@/types/project';
import DraggableWBSTree from '@/components/issues/DraggableWBSTree';
import GanttChart, { ExtendedGanttChartProps } from './GanttChart';
import DependencyEditor from './DependencyEditor';
import GanttNotificationHandler from './GanttNotificationHandler';
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
 * WBS-ガント統合レイアウトコンポーネント（WebSocket通知対応）
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

  // 依存関係作成成功時のハンドラー（ローカル＋WebSocket）
  const handleDependencyCreated = useCallback((newDependency: Dependency) => {
    setDependencies(prev => [...prev, newDependency]);
    console.log('依存関係が作成されました:', newDependency);
  }, []);

  // 依存関係削除成功時のハンドラー（ローカル＋WebSocket）
  const handleDependencyDeleted = useCallback((deletedDependencyId: string) => {
    setDependencies(prev => prev.filter(dep => dep.id !== deletedDependencyId));
    setSelectedDependency(null);
    console.log('依存関係が削除されました:', deletedDependencyId);
  }, []);

  // 日程調整の処理（WebSocket通知から）
  const handleScheduleAdjusted = useCallback((adjustedIssues: any[]) => {
    console.log('スケジュール調整が完了しました:', adjustedIssues);
    // Issues再取得をトリガー
    if (onIssuesUpdate) {
      console.log('Issues更新をトリガーします...');
    }
  }, [onIssuesUpdate]);

  // ガントチャート更新ハンドラー（WebSocket通知から）
  const handleGanttUpdate = useCallback(() => {
    console.log('ガントチャートの更新が必要です');
    // 依存関係を再取得
    fetchDependencies();
  }, [fetchDependencies]);

  // 依存関係操作エラーハンドラー
  const handleDependencyError = useCallback((error: string) => {
    console.error('依存関係操作エラー:', error);
    setDependenciesError(error);
    
    // 5秒後にエラーをクリア
    setTimeout(() => {
      setDependenciesError(null);
    }, 5000);
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

  // 依存関係タイプの短縮形変換
  const getDependencyTypeShort = (dependency: Dependency): string => {
    if (dependency.type) return dependency.type;
    
    switch (dependency.dependency_type) {
      case 'finish_to_start': return 'FS';
      case 'start_to_start': return 'SS';
      case 'finish_to_finish': return 'FF';
      case 'start_to_finish': return 'SF';
      default: return 'FS';
    }
  };

  // ExtendedGanttChartPropsに適合するprops
  const ganttChartProps: ExtendedGanttChartProps = {
    issues,
    dependencies,
    selectedIssue,
    selectedDependency,
    onTaskSelect: handleGanttTaskSelect,
    onDependencySelect: handleDependencySelect,
    onDependencyHover: handleDependencyHover,
    width: 800,
    height: 400,
    readOnly: userRole !== 'editor',
    loading: isLoading || dependenciesLoading,
    editorRole: userRole === 'editor', // Editor権限チェック
    enableDragDrop: userRole === 'editor', // ドラッグ&ドロップ有効化
    options: {
      viewMode: 'Week',
      locale: 'ja-JP',
      showWeekends: true,
      showHolidays: true,
    },
  };

  return (
    <div 
      ref={containerRef}
      className="h-full flex bg-white overflow-hidden"
    >
      {/* WebSocket通知ハンドラー（ガント機能専用） */}
      <GanttNotificationHandler
        projectId={projectId}
        onIssuesUpdate={onIssuesUpdate}
        onGanttUpdate={handleGanttUpdate}
        onError={handleDependencyError}
        showToast={true}
      />

      {/* 左パネル: WBSツリー */}
      <div 
        className="border-r border-gray-200 bg-gray-50 overflow-hidden flex flex-col"
        style={{ width: `${currentSplitSize}%` }}
      >
        <div className="p-3 bg-white border-b border-gray-200 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-900">WBS構造</h3>
          <p className="text-xs text-gray-500 mt-1">
            課題の階層構造を管理できます
          </p>
        </div>
        
        <div className="flex-1 overflow-auto p-2">
          <DraggableWBSTree
            issues={issues}
            selectedIssue={selectedIssue}
            onIssueClick={(issue) => {
              setSelectedIssue(issue);
              onIssueClick?.(issue);
            }}
            onIssuesReorder={onIssuesUpdate}
            projectId={projectId}
            editable={userRole === 'editor'}
            showProgress={true}
            showDates={true}
          />
        </div>
      </div>

      {/* 分割バー */}
      <div
        className="w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize flex-shrink-0 relative group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        {isDragging && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded pointer-events-none">
            {Math.round(currentSplitSize)}%
          </div>
        )}
      </div>

      {/* 右パネル: ガントチャート（WebSocket通知対応） */}
      <div 
        className="overflow-hidden"
        style={{ width: `${100 - currentSplitSize}%` }}
      >
        <div className="h-full flex flex-col">
          <div className="p-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">ガントチャート</h3>
                <p className="text-xs text-gray-500 mt-1">
                  タスクの時系列進捗と依存関係を表示
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                {selectedDependency && (
                  <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    依存関係選択中
                  </div>
                )}
                {userRole === 'editor' && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    右クリックで依存関係編集
                  </div>
                )}
              </div>
            </div>

            {/* 依存関係エラー表示 */}
            {dependenciesError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex">
                  <div className="text-red-400 mr-2">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-red-800">依存関係操作エラー</p>
                    <p className="text-xs text-red-700 mt-1">{dependenciesError}</p>
                    <button
                      onClick={fetchDependencies}
                      className="mt-2 text-xs text-red-800 underline hover:text-red-900"
                    >
                      再読み込み
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 依存関係編集機能付きガントチャート */}
            <DependencyEditor
              projectId={projectId}
              issues={issues}
              dependencies={dependencies}
              onDependencyCreated={handleDependencyCreated}
              onDependencyDeleted={handleDependencyDeleted}
              onError={handleDependencyError}
              editorRole={userRole === 'editor'}
            >
              <GanttChart {...ganttChartProps} />
            </DependencyEditor>

            {/* 依存関係統計情報 */}
            {dependencies.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    依存関係: {dependencies.length}件
                    {dependencies.filter(dep => getDependencyTypeShort(dep) === 'FS').length > 0 && (
                      <span className="ml-2">（FS: {dependencies.filter(dep => getDependencyTypeShort(dep) === 'FS').length}件）</span>
                    )}
                  </span>
                  {userRole === 'editor' && (
                    <div className="text-xs text-gray-500">
                      ドラッグ&ドロップで依存関係作成
                    </div>
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