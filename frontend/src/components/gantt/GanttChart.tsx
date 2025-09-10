'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Issue } from '../../types/issue';
import {
  GanttChartProps,
  GanttTask,
  GanttOptions,
  GanttDisplaySettings,
} from '../../types/gantt';
import {
  convertIssuesToGanttTasks,
  mergeGanttOptions,
  mergeDisplaySettings,
  calculateDateRange,
  sortIssuesForGantt,
  generateGanttCSSVariables,
} from '../../lib/gantt-config';
import TaskBar from './TaskBar';
import DraggableTaskBar from './DraggableTaskBar';
import MilestoneMarker from './MilestoneMarker';
import DependencyLines, { Dependency } from './DependencyLines';
import { useGanttDragDrop } from '../../hooks/useGanttDragDrop';

/**
 * 拡張ガントチャートProps（依存関係編集対応）
 */
export interface ExtendedGanttChartProps extends GanttChartProps {
  dependencies?: Dependency[];
  onDependencySelect?: (dependency: Dependency | null) => void;
  onDependencyHover?: (dependency: Dependency | null) => void;
  selectedDependency?: string | null;
  projectId?: string;
  enableDragDrop?: boolean; // ドラッグ&ドロップ機能の有効化
  editorRole?: boolean; // Editor権限チェック
  
  // 依存関係編集用イベントハンドラー
  onTaskBarRightClick?: (issue: Issue, event: React.MouseEvent) => void;
  onDependencyLineRightClick?: (dependencyId: string, event: React.MouseEvent) => void;
  onTaskBarClick?: (issue: Issue) => void;
  dependencyCreationMode?: boolean;
  selectedPredecessor?: Issue | null;
}

/**
 * 基本ガントチャートコンポーネント（依存関係線表示対応 + ドラッグ&ドロップ対応 + 依存関係編集対応）
 * Issue期間バー表示・基本描画・FS依存関係矢印線表示・ドラッグ&ドロップ日程調整・依存関係編集機能を提供
 */
const GanttChart: React.FC<ExtendedGanttChartProps> = ({
  issues,
  dependencies = [],
  options = {},
  displaySettings = {},
  filters,
  onTaskChange,
  onTaskSelect,
  onDependencySelect,
  onDependencyHover,
  selectedDependency,
  projectId,
  enableDragDrop = false,
  editorRole = false,
  onTaskBarRightClick,
  onDependencyLineRightClick,
  onTaskBarClick,
  dependencyCreationMode = false,
  selectedPredecessor,
  height = 400,
  className = '',
  loading = false,
  readOnly = false,
}) => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // @dnd-kit sensors設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動してからドラッグ開始
      },
    })
  );

  // 設定のマージ
  const ganttOptions = useMemo(() => mergeGanttOptions(options), [options]);
  const ganttDisplaySettings = useMemo(() => mergeDisplaySettings(displaySettings), [displaySettings]);

  // ドラッグ&ドロップ機能（Editor権限且つ有効化時のみ）
  const isDragDropEnabled = enableDragDrop && editorRole && !readOnly && projectId;
  const {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    validateConstraints,
  } = useGanttDragDrop({
    issues,
    dependencies,
    projectId: projectId || '',
    onIssueUpdate: (issueId, updatedIssue) => {
      if (onTaskChange) {
        onTaskChange(issueId, updatedIssue);
      }
    },
    onError: (error) => {
      console.error('Drag & Drop Error:', error);
      setWarnings(prev => [...prev, `ドラッグ&ドロップエラー: ${error.message}`]);
    },
    readOnly: !isDragDropEnabled,
    pixelsPerDay: 14, // 1日 = 14px
  });

  // Issueのソート
  const sortedIssues = useMemo(() => sortIssuesForGantt(issues), [issues]);

  // フィルタリング処理
  const filteredIssues = useMemo(() => {
    if (!filters) return sortedIssues;

    return sortedIssues.filter(issue => {
      // 日付範囲フィルター
      if (filters.dateRange) {
        const issueStart = issue.start_date ? new Date(issue.start_date) : null;
        const issueEnd = issue.end_date ? new Date(issue.end_date) : null;
        
        if (issueStart && issueStart < filters.dateRange.start) return false;
        if (issueEnd && issueEnd > filters.dateRange.end) return false;
      }

      // ステータスフィルター
      if (filters.statuses && !filters.statuses.includes(issue.status)) return false;

      // 担当者フィルター
      if (filters.assignees && issue.assignee && !filters.assignees.includes(issue.assignee)) return false;

      // 進捗フィルター
      if (filters.progressRange) {
        if (issue.progress_pct < filters.progressRange.min || issue.progress_pct > filters.progressRange.max) return false;
      }

      // 検索フィルター
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!issue.title.toLowerCase().includes(searchLower) &&
            !(issue.description_md?.toLowerCase().includes(searchLower)) &&
            !(issue.assignee?.toLowerCase().includes(searchLower))) return false;
      }

      return true;
    });
  }, [sortedIssues, filters]);

  // 表示中Issue IDに基づく依存関係のフィルタリング
  const filteredDependencies = useMemo(() => {
    if (!dependencies || dependencies.length === 0) return [];
    
    const visibleIssueIds = new Set(filteredIssues.map(issue => issue.id));
    
    return dependencies.filter(dep => 
      visibleIssueIds.has(dep.predecessor_issue_id) && 
      visibleIssueIds.has(dep.successor_issue_id)
    );
  }, [dependencies, filteredIssues]);

  // GanttTask変換
  const { tasks, dependencies: taskDependencies, warnings: conversionWarnings } = useMemo(() => {
    return convertIssuesToGanttTasks(filteredIssues, ganttOptions);
  }, [filteredIssues, ganttOptions]);

  // 警告の更新
  useEffect(() => {
    setWarnings(conversionWarnings);
  }, [conversionWarnings]);

  // 日付範囲の計算
  const dateRange = useMemo(() => {
    return calculateDateRange(filteredIssues);
  }, [filteredIssues]);

  // CSS変数の生成
  const cssVariables = useMemo(() => {
    return generateGanttCSSVariables(ganttOptions);
  }, [ganttOptions]);

  // タスク選択ハンドラー
  const handleTaskSelect = useCallback((taskId: string) => {
    setSelectedTask(taskId);
    const issue = filteredIssues.find(i => i.id === taskId);
    if (issue && onTaskSelect) {
      onTaskSelect(issue);
    }
  }, [filteredIssues, onTaskSelect]);

  // タスクバークリックハンドラー（依存関係作成モード対応）
  const handleTaskBarClickInternal = useCallback((issue: Issue, event: React.MouseEvent) => {
    // 右クリック処理
    if (event.button === 2) {
      event.preventDefault();
      onTaskBarRightClick?.(issue, event);
      return;
    }

    // 左クリック処理
    if (dependencyCreationMode) {
      // 依存関係作成モード中のクリック
      onTaskBarClick?.(issue);
    } else {
      // 通常のタスク選択
      handleTaskSelect(issue.id);
    }
  }, [dependencyCreationMode, onTaskBarRightClick, onTaskBarClick, handleTaskSelect]);

  // タスク変更ハンドラー（非ドラッグ操作用）
  const handleTaskChange = useCallback((task: GanttTask) => {
    if (readOnly || !onTaskChange) return;

    const changes: Partial<Issue> = {
      start_date: task.start,
      end_date: task.end,
      progress_pct: task.progress,
    };

    onTaskChange(task.id, changes);
  }, [readOnly, onTaskChange]);

  // タスクバー幅計算（日数に基づく）
  const calculateTaskWidth = useCallback((start: Date, end: Date): number => {
    const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const minWidth = 24; // 最小幅
    const pixelsPerDay = ganttOptions.columnWidth / 7; // 週表示を基準
    return Math.max(minWidth, durationDays * pixelsPerDay);
  }, [ganttOptions.columnWidth]);

  // Issue型の判定（Task/Milestone）
  const isMilestone = useCallback((issue: Issue): boolean => {
    if (!issue.start_date || !issue.end_date) return false;
    
    const start = new Date(issue.start_date);
    const end = new Date(issue.end_date);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    
    return diffDays <= 1; // 1日以下はマイルストーン扱い
  }, []);

  // 依存関係線の右クリックハンドラー
  const handleDependencyClick = useCallback((dependency: Dependency, event?: React.MouseEvent) => {
    if (event?.button === 2) {
      // 右クリック
      event.preventDefault();
      onDependencyLineRightClick?.(dependency.id, event);
    } else {
      // 左クリック（選択）
      onDependencySelect?.(dependency);
    }
  }, [onDependencyLineRightClick, onDependencySelect]);

  // ローディング表示
  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ height: `${height}px` }}
      >
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">ガントチャートを読み込み中...</span>
        </div>
      </div>
    );
  }

  // タスクが空の場合
  if (filteredIssues.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">📊</div>
          <p className="text-gray-600 text-sm">表示するタスクがありません</p>
          <p className="text-gray-500 text-xs mt-1">
            Issueに開始日・終了日を設定してください
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div 
        className={`gantt-chart-container relative ${className}`}
        style={{ 
          height: `${height}px`,
          ...cssVariables 
        }}
      >
        {/* 依存関係作成モード表示 */}
        {dependencyCreationMode && selectedPredecessor && (
          <div className="absolute top-2 left-2 z-30 bg-blue-100 border border-blue-300 rounded-md px-3 py-1 text-sm">
            <span className="text-blue-700">
              依存関係作成中: <strong>{selectedPredecessor.title}</strong> → 後続タスクを選択
            </span>
          </div>
        )}

        {/* 警告メッセージ */}
        {warnings.length > 0 && (
          <div className="mb-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
              <div className="flex">
                <div className="text-yellow-400 mr-2">⚠️</div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">ガントチャート変換の警告</p>
                  <ul className="mt-1 text-xs text-yellow-700">
                    {warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 期間バー表示ガントチャート */}
        <div className="gantt-timeline bg-white border rounded-lg overflow-hidden">
          {/* ヘッダー */}
          <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900">
              ガントチャート ({filteredIssues.length} タスク)
              {filteredDependencies.length > 0 && (
                <span className="text-blue-600 ml-2">
                  依存関係: {filteredDependencies.length}
                </span>
              )}
              {isDragDropEnabled && (
                <span className="text-green-600 ml-2">
                  ドラッグ&ドロップ有効
                </span>
              )}
              {dependencyCreationMode && (
                <span className="text-orange-600 ml-2">
                  依存関係作成モード
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>表示期間: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}</span>
              <span>|</span>
              <span>表示モード: {ganttOptions.viewMode}</span>
              <span>|</span>
              <span>行高: {ganttOptions.rowHeight}px</span>
              {ganttDisplaySettings.showDependencies && (
                <>
                  <span>|</span>
                  <span className="text-blue-600">依存関係表示中</span>
                </>
              )}
            </div>
          </div>

          {/* タスク一覧（期間バー表示） */}
          <div 
            ref={ganttContainerRef}
            className="gantt-tasks-container relative" 
            style={{ maxHeight: `${height - 120}px`, overflowY: 'auto', overflowX: 'auto' }}
          >
            {filteredIssues.map((issue, index) => {
              const isSelected = selectedTask === issue.id;
              const isTaskMilestone = isMilestone(issue);
              const isBeingDragged = dragState.draggedTask?.id === issue.id;
              const constraintViolation = dragState.constraintViolations.get(issue.id);
              const isPredecessor = selectedPredecessor?.id === issue.id;
              const isValidSuccessor = dependencyCreationMode && selectedPredecessor?.id !== issue.id;
              
              // 日付の準備
              const startDate = issue.start_date ? new Date(issue.start_date) : new Date();
              const endDate = issue.end_date ? new Date(issue.end_date) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
              
              // タスクバー幅の計算
              const taskWidth = calculateTaskWidth(startDate, endDate);

              return (
                <div
                  key={issue.id}
                  data-issue-id={issue.id}
                  className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  } ${isBeingDragged ? 'bg-blue-100' : ''} ${
                    isPredecessor ? 'bg-orange-50 border-l-4 border-orange-500' : ''
                  } ${isValidSuccessor ? 'bg-green-50 cursor-pointer' : ''}`}
                  style={{ height: `${ganttOptions.rowHeight}px` }}
                >
                  {/* 左側: タスク情報 */}
                  <div className="flex-shrink-0 w-80 px-4 border-r border-gray-200 flex items-center">
                    {/* 階層インデント */}
                    {ganttDisplaySettings.showHierarchy && issue.parent_id && (
                      <div style={{ width: `${ganttDisplaySettings.indentSize}px` }} className="flex-shrink-0" />
                    )}
                    
                    {/* タスクタイプアイコン */}
                    <div className="mr-2 flex-shrink-0">
                      {isTaskMilestone && <span className="text-red-500">◆</span>}
                      {issue.children && issue.children.length > 0 && <span className="text-green-500">📁</span>}
                      {!isTaskMilestone && (!issue.children || issue.children.length === 0) && <span className="text-blue-500">■</span>}
                      {isPredecessor && <span className="text-orange-500 ml-1">👈</span>}
                    </div>
                    
                    {/* タスク名 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={issue.title}>
                        {issue.wbs_number && `${issue.wbs_number} `}{issue.title}
                        {issue.is_blocked && <span className="text-red-500 ml-1">[BLOCKED]</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {issue.assignee && `担当: ${issue.assignee} | `}
                        {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* 右側: 期間バー表示領域 */}
                  <div className="flex-1 px-4 py-2 relative">
                    {isTaskMilestone ? (
                      /* マイルストーン菱形表示 */
                      <MilestoneMarker
                        issue={issue}
                        date={startDate}
                        size={Math.min(ganttOptions.barHeight, 20)}
                        onClick={(e) => handleTaskBarClickInternal(issue, e)}
                        showLabel={false} // 左側にラベル表示済み
                        readOnly={readOnly}
                        className="milestone-marker"
                        onContextMenu={(e) => handleTaskBarClickInternal(issue, e)}
                      />
                    ) : (
                      /* タスク期間バー表示 */
                      isDragDropEnabled ? (
                        <DraggableTaskBar
                          issue={issue}
                          startDate={startDate}
                          endDate={endDate}
                          width={taskWidth}
                          height={ganttOptions.barHeight}
                          onTaskSelect={(selectedIssue, e) => handleTaskBarClickInternal(selectedIssue, e)}
                          showLabel={taskWidth > 100} // 幅が十分な場合のみラベル表示
                          showProgress={ganttDisplaySettings.showProgress}
                          readOnly={readOnly}
                          disabled={issue.is_blocked}
                          isDragging={isBeingDragged}
                          isConstraintViolated={!!constraintViolation}
                          errorMessage={constraintViolation}
                          className="draggable-task-bar"
                          onContextMenu={(e) => handleTaskBarClickInternal(issue, e)}
                        />
                      ) : (
                        <TaskBar
                          issue={issue}
                          startDate={startDate}
                          endDate={endDate}
                          width={taskWidth}
                          height={ganttOptions.barHeight}
                          onClick={(e) => handleTaskBarClickInternal(issue, e)}
                          showLabel={taskWidth > 100} // 幅が十分な場合のみラベル表示
                          showProgress={ganttDisplaySettings.showProgress}
                          readOnly={readOnly}
                          className="task-bar"
                          onContextMenu={(e) => handleTaskBarClickInternal(issue, e)}
                        />
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {/* 依存関係線表示 */}
            {ganttDisplaySettings.showDependencies && (
              <DependencyLines
                issues={filteredIssues}
                dependencies={filteredDependencies}
                containerRef={ganttContainerRef as React.RefObject<HTMLElement>}
                rowHeight={ganttOptions.rowHeight}
                selectedDependency={selectedDependency}
                onDependencySelect={handleDependencyClick}
                onDependencyHover={onDependencyHover}
                disabled={readOnly}
                onDependencyRightClick={onDependencyLineRightClick}
              />
            )}
          </div>

          {/* フッター情報 */}
          <div className="bg-gray-50 px-3 py-2 border-t">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>
                完了: {filteredIssues.filter(i => i.status === 'done').length} / 
                進行中: {filteredIssues.filter(i => i.status === 'in_progress').length} / 
                未開始: {filteredIssues.filter(i => i.status === 'open').length} /
                ブロック: {filteredIssues.filter(i => i.is_blocked).length}
              </span>
              <span>
                マイルストーン: {filteredIssues.filter(i => isMilestone(i)).length}
              </span>
              <span>
                {filteredDependencies.length > 0 && (
                  <>依存関係: {filteredDependencies.length} | </>
                )}
                {readOnly ? '読み取り専用' : isDragDropEnabled ? 'ドラッグ&ドロップで編集可能' : 'クリックして選択・編集'}
                {dependencyCreationMode && ' | 依存関係作成モード'}
              </span>
            </div>
          </div>
        </div>

        {/* ドラッグオーバーレイ */}
        <DragOverlay>
          {dragState.draggedTask && (
            <div className="bg-blue-400 bg-opacity-80 border-2 border-blue-600 rounded-md p-2 text-white text-sm font-medium shadow-lg">
              {dragState.draggedTask.title} を移動中...
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default GanttChart;