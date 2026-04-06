'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  generateDateColumns,
  DateColumn,
} from '../../lib/gantt-config';
import TaskBar from './TaskBar';
import DraggableTaskBar from './DraggableTaskBar';
import MilestoneMarker from './MilestoneMarker';
import DependencyLines, { Dependency } from './DependencyLines';
import { useGanttDragDrop } from '../../hooks/useGanttDragDrop';

/**
 * 日本の祖日判定関数（簡易版）
 */
function isJapaneseHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0ベースから1ベースに変換
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0:日曜日, 1:月曜日, ..., 6:土曜日
  
  // 固定祖日
  const fixedHolidays = [
    { month: 1, day: 1 },   // 元日
    { month: 2, day: 11 },  // 建国記念の日
    { month: 2, day: 23 },  // 天皇誕生日
    { month: 4, day: 29 },  // 昭和の日
    { month: 5, day: 3 },   // 憲法記念日
    { month: 5, day: 4 },   // みどりの日
    { month: 5, day: 5 },   // こどもの日
    { month: 8, day: 11 },  // 山の日
    { month: 11, day: 3 },  // 文化の日
    { month: 11, day: 23 }, // 勤労感謝の日
  ];
  
  // 固定祖日のチェック
  if (fixedHolidays.some(holiday => holiday.month === month && holiday.day === day)) {
    return true;
  }
  
  // ハッピーマンデー（月曜日の祖日）
  if (month === 1 && dayOfWeek === 1) {
    // 成人の日（1月第2月曜日）
    const weekOfMonth = Math.floor((day - 1) / 7) + 1;
    if (weekOfMonth === 2) return true;
  }
  
  if (month === 7 && dayOfWeek === 1) {
    // 海の日（7月第3月曜日）
    const weekOfMonth = Math.floor((day - 1) / 7) + 1;
    if (weekOfMonth === 3) return true;
  }
  
  if (month === 9 && dayOfWeek === 1) {
    // 敬老の日（9月第3月曜日）
    const weekOfMonth = Math.floor((day - 1) / 7) + 1;
    if (weekOfMonth === 3) return true;
  }
  
  if (month === 10 && dayOfWeek === 1) {
    // スポーツの日（10月第2月曜日）
    const weekOfMonth = Math.floor((day - 1) / 7) + 1;
    if (weekOfMonth === 2) return true;
  }
  
  return false;
}

/**
 * 日付の種類を判定する関数
 */
function getDateType(date: Date): 'weekday' | 'weekend' | 'holiday' {
  const dayOfWeek = date.getDay();
  
  // 祖日判定
  if (isJapaneseHoliday(date)) {
    return 'holiday';
  }
  
  // 土日・日曜日判定
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'weekend';
  }
  
  return 'weekday';
}

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
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'Day' | 'Week'>('Day');
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const dateHeaderRef = useRef<HTMLDivElement>(null);
  const taskNamesRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<{ horizontal: boolean; vertical: boolean }>({ horizontal: false, vertical: false });

  // @dnd-kit sensors設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動してからドラッグ開始
      },
    })
  );

  // 設定のマージ（viewModeを上書き）
  const ganttOptions = useMemo(() => {
    const merged = mergeGanttOptions(options);
    return { ...merged, viewMode };
  }, [options, viewMode]);
  const ganttDisplaySettings = useMemo(() => mergeDisplaySettings(displaySettings), [displaySettings]);

  // ドラッグ&ドロップ機能（Editor権限且つ有効化時のみ）
  const isDragDropEnabled = enableDragDrop && editorRole && !readOnly && projectId;
  
  console.log('Drag & Drop Status:');
  console.log('  enableDragDrop:', enableDragDrop);
  console.log('  editorRole:', editorRole);
  console.log('  readOnly:', readOnly);
  console.log('  projectId:', projectId);
  console.log('  isDragDropEnabled:', isDragDropEnabled);
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

  // 日付範囲の計算（登録されたタスクの日付に基づく）
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (filteredIssues.length === 0) {
      // タスクがない場合は今日を中心とした範囲
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 3);
      return { start: startDate, end: endDate };
    }
    
    // タスクの実際の日付範囲を取得
    const issueRange = calculateDateRange(filteredIssues);
    
    // タスクの開始日から少し余裕を持たせた範囲
    const startDate = new Date(issueRange.start);
    startDate.setDate(startDate.getDate() - 7); // 1週間前から
    
    const endDate = new Date(issueRange.end);
    endDate.setDate(endDate.getDate() + 7); // 1週間後まで
    
    // 今日が範囲外の場合は範囲を拡張
    if (today < startDate) {
      startDate.setTime(today.getTime());
      startDate.setDate(startDate.getDate() - 7);
    }
    if (today > endDate) {
      endDate.setTime(today.getTime());
      endDate.setDate(endDate.getDate() + 7);
    }
    
    console.log('Date range calculation (based on tasks):');
    console.log('  Task start date:', issueRange.start.toISOString().split('T')[0]);
    console.log('  Task end date:', issueRange.end.toISOString().split('T')[0]);
    console.log('  Display start date:', startDate.toISOString().split('T')[0]);
    console.log('  Display end date:', endDate.toISOString().split('T')[0]);
    console.log('  Today:', today.toISOString().split('T')[0]);
    console.log('  Total tasks:', filteredIssues.length);
    
    return { start: startDate, end: endDate };
  }, [filteredIssues]);

  // 日付列の生成
  const dateColumns = useMemo(() => {
    const columns = generateDateColumns(
      dateRange.start,
      dateRange.end,
      ganttOptions.viewMode,
      ganttOptions.columnWidth
    );
    
    console.log('Date columns generated:');
    console.log('  Columns count:', columns.length);
    console.log('  Total width:', columns.length * ganttOptions.columnWidth, 'px');
    console.log('  Column width:', ganttOptions.columnWidth, 'px');
    console.log('  View mode:', ganttOptions.viewMode);
    
    // 祖日・土日の数をカウント
    let weekendCount = 0;
    let holidayCount = 0;
    columns.forEach(column => {
      const dateType = getDateType(column.date);
      if (dateType === 'holiday') holidayCount++;
      else if (dateType === 'weekend') weekendCount++;
    });
    console.log('  Weekends:', weekendCount, 'Holidays:', holidayCount);
    
    return columns;
  }, [dateRange, ganttOptions.viewMode, ganttOptions.columnWidth]);

  // CSS変数の生成
  const cssVariables = useMemo(() => {
    return generateGanttCSSVariables(ganttOptions);
  }, [ganttOptions]);

  // 今日の日付位置計算
  const todayPosition = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStartTime = dateRange.start.getTime();
    const todayTime = today.getTime();
    
    if (viewMode === 'Day') {
      const daysDiff = Math.floor((todayTime - rangeStartTime) / (1000 * 60 * 60 * 24));
      const position = daysDiff * ganttOptions.columnWidth;
      console.log('Today position calculation (Day mode):');
      console.log('  Days from start:', daysDiff, 'Position:', position, 'px');
      return position;
    } else if (viewMode === 'Week') {
      const rangeStart = new Date(dateRange.start);
      const rangeDayOfWeek = rangeStart.getDay();
      const rangeMondayOffset = rangeDayOfWeek === 0 ? -6 : 1 - rangeDayOfWeek;
      rangeStart.setDate(rangeStart.getDate() + rangeMondayOffset);
      rangeStart.setHours(0, 0, 0, 0);
      
      const weeksDiff = Math.floor((todayTime - rangeStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
      const position = weeksDiff * ganttOptions.columnWidth;
      console.log('Today position calculation (Week mode):');
      console.log('  Weeks from start:', weeksDiff, 'Position:', position, 'px');
      return position;
    }
    return 0;
  }, [dateRange, viewMode, ganttOptions.columnWidth]);

  // 初期スクロール位置を今日に設定
  useEffect(() => {
    const timer = setTimeout(() => {
      if (timelineRef.current && todayPosition >= 0) {
        // 初期スクロール位置を決定（今日が表示範囲内にある場合は今日、ない場合は先頭タスク）
        let scrollPosition = 0;
        
        if (filteredIssues.length > 0) {
          // 最初のタスクの開始日位置を計算
          const firstTask = [...filteredIssues].sort((a, b) => {
            const aStart = a.start_date ? new Date(a.start_date) : new Date();
            const bStart = b.start_date ? new Date(b.start_date) : new Date();
            return aStart.getTime() - bStart.getTime();
          })[0];
          
          if (firstTask?.start_date) {
            const firstTaskStart = new Date(firstTask.start_date);
            firstTaskStart.setHours(0, 0, 0, 0);
            const rangeStartTime = dateRange.start.getTime();
            const firstTaskTime = firstTaskStart.getTime();
            
            const daysDiff = Math.floor((firstTaskTime - rangeStartTime) / (1000 * 60 * 60 * 24));
            const firstTaskPosition = daysDiff * ganttOptions.columnWidth;
            
            // 今日が表示範囲内にあるかチェック
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isTodayInRange = today >= dateRange.start && today <= dateRange.end;
            
            if (isTodayInRange && todayPosition >= 0) {
              // 今日が範囲内にある場合は今日にスクロール
              scrollPosition = Math.max(0, todayPosition - 100);
              console.log('Scrolling to today position:', scrollPosition, 'px');
            } else {
              // 今日が範囲外の場合は最初のタスクにスクロール
              scrollPosition = Math.max(0, firstTaskPosition - 100);
              console.log('Scrolling to first task position:', scrollPosition, 'px');
            }
          } else {
            scrollPosition = Math.max(0, todayPosition - 100);
            console.log('No task dates found, scrolling to today:', scrollPosition, 'px');
          }
        } else {
          scrollPosition = Math.max(0, todayPosition - 100);
          console.log('No tasks, scrolling to today:', scrollPosition, 'px');
        }
        
        timelineRef.current.scrollLeft = scrollPosition;
        
        // デバッグ情報
        console.log('Scroll containers debug:');
        console.log('  Timeline clientWidth:', timelineRef.current.clientWidth);
        console.log('  Timeline scrollWidth:', timelineRef.current.scrollWidth);
        console.log('  Today position:', todayPosition);
        console.log('  Initial scroll position:', scrollPosition);
        console.log('  Tasks count:', filteredIssues.length);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [todayPosition, dateColumns.length]);

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

  // スクロール同期処理
  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    
    // 横スクロール同期
    if (dateHeaderRef.current && Math.abs(dateHeaderRef.current.scrollLeft - target.scrollLeft) > 1) {
      dateHeaderRef.current.scrollLeft = target.scrollLeft;
    }
    
    // 縦スクロール同期
    if (taskNamesRef.current && Math.abs(taskNamesRef.current.scrollTop - target.scrollTop) > 1) {
      taskNamesRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const handleDateHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    
    // タイムライン本体と横スクロールを同期
    if (timelineRef.current && Math.abs(timelineRef.current.scrollLeft - target.scrollLeft) > 1) {
      timelineRef.current.scrollLeft = target.scrollLeft;
    }
  }, []);

  const handleTaskNamesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    
    // タイムライン本体と縦スクロールを同期
    if (timelineRef.current && Math.abs(timelineRef.current.scrollTop - target.scrollTop) > 1) {
      timelineRef.current.scrollTop = target.scrollTop;
    }
  }, []);

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
    <>
      <style jsx global>{`
        /* スクロールバーのスタイル */
        .gantt-chart-container ::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .gantt-chart-container ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 6px;
        }
        .gantt-chart-container ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 6px;
        }
        .gantt-chart-container ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .gantt-chart-container {
          scrollbar-width: thin;
        }
      `}</style>
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
                  ドラッグ&ドロップ有効 ✅
                </span>
              )}
              {!isDragDropEnabled && (
                <span className="text-red-600 ml-2">
                  ドラッグ&ドロップ無効 ❌
                </span>
              )}
              {dependencyCreationMode && (
                <span className="text-orange-600 ml-2">
                  依存関係作成モード
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-4">
              {/* 表示モード切り替え */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">表示モード:</span>
                <div className="flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode('Day')}
                    className={`px-3 py-1 text-xs font-medium rounded-l-md border ${
                      viewMode === 'Day'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    日
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('Week')}
                    className={`px-3 py-1 text-xs font-medium rounded-r-md border-t border-b border-r ${
                      viewMode === 'Week'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    週
                  </button>
                </div>
              </div>
              
              {/* 期間情報 */}
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>表示期間: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}</span>
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
          </div>

          {/* ガントチャート本体（2列レイアウト） */}
          <div className="flex" style={{ width: '100%', minHeight: 0 }}>
            {/* 左側：タスク名列 */}
            <div className="bg-gray-50 border-r" style={{ minWidth: '250px' }}>
              {/* タスク名ヘッダー */}
              <div className="px-4 py-2 border-b bg-gray-100 text-sm font-medium text-gray-900">
                タスク名
              </div>
              
              {/* タスク名一覧 */}
              <div 
                ref={taskNamesRef}
                style={{ height: `${height - 160}px`, overflowY: 'auto', overflowX: 'hidden' }}
                onScroll={handleTaskNamesScroll}
              >
                {filteredIssues.map((issue, index) => (
                  <div
                    key={`task-name-${issue.id}`}
                    className="px-4 py-2 border-b border-gray-200 text-sm text-gray-900 hover:bg-gray-100 cursor-pointer"
                    style={{ height: `${ganttOptions.rowHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => {
                      // プロジェクトIDが存在する場合は詳細画面に遷移
                      if (projectId) {
                        router.push(`/projects/${projectId}/issues/${issue.id}`);
                      } else {
                        handleTaskSelect(issue.id);
                      }
                    }}
                  >
                    <div className="truncate flex-1" title={issue.title}>
                      {issue.wbs_number && (
                        <span className="text-xs text-gray-500 mr-2">{issue.wbs_number}</span>
                      )}
                      <span className="text-gray-900 hover:text-blue-600">{issue.title}</span>
                    </div>
                    <div className="ml-2 flex-shrink-0 text-xs text-gray-500">
                      {issue.start_date && issue.end_date && (
                        <>
                          {new Date(issue.start_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          -
                          {new Date(issue.end_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          <span className="ml-1">
                            ({Math.ceil((new Date(issue.end_date).getTime() - new Date(issue.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}日)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右側：タイムライン */}
            <div className="flex-1 relative" style={{ minWidth: 0 }}>
              {/* 日付ヘッダー */}
              <div 
                ref={dateHeaderRef}
                className="bg-gray-100 border-b"
                onScroll={handleDateHeaderScroll}
                style={{ 
                  height: 'auto',
                  overflowX: 'hidden', // 上のスクロールバーを非表示
                  overflowY: 'hidden',
                  width: '100%'
                }}
              >
                <div 
                  className="flex"
                  style={{ 
                    width: `${dateColumns.length * ganttOptions.columnWidth}px`,
                    minWidth: `${dateColumns.length * ganttOptions.columnWidth}px`
                  }}
                >
                  {dateColumns.map((column, index) => (
                    <div
                      key={`date-${column.date.getTime()}`}
                      className={`border-r border-gray-300 px-1 py-2 text-xs text-center`}
                      style={{
                        backgroundColor: (() => {
                          const dateType = getDateType(column.date);
                          if (dateType === 'holiday') return '#fef2f2'; // 祖日: 涼しい赤
                          if (dateType === 'weekend') return '#f0f9ff'; // 土日: 涼しい青
                          return 'white'; // 平日: 白
                        })(),
                        color: '#000000', // 日付カラムの文字色を黒に統一
                        width: `${column.width}px`,
                        minWidth: `${column.width}px`
                      }}
                    >
                      {column.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* タイムライン本体 */}
              <div 
                ref={timelineRef}
                className="relative border"
                style={{ 
                  height: `${height - 160}px`,
                  width: '100%',
                  backgroundColor: '#fafafa',
                  overflowX: 'auto',
                  overflowY: 'auto'
                }}
                onScroll={handleTimelineScroll}
              >
                {/* スクロール可能なコンテンツコンテナ */}
                <div 
                  className="relative bg-white"
                  style={{ 
                    width: `${dateColumns.length * ganttOptions.columnWidth}px`,
                    minWidth: `${dateColumns.length * ganttOptions.columnWidth}px`,
                    height: `${Math.max(filteredIssues.length * ganttOptions.rowHeight, 400)}px`
                  }}
                >
                  {/* 縦グリッドライン */}
                  <div className="absolute inset-0 pointer-events-none">
                    {dateColumns.map((column, index) => (
                      <div
                        key={`grid-line-${index}`}
                        className="absolute top-0 bottom-0"
                        style={{
                          backgroundColor: (() => {
                            const dateType = getDateType(column.date);
                            if (dateType === 'holiday') return '#fef2f2'; // 祖日: 涼しい赤
                            if (dateType === 'weekend') return '#f0f9ff'; // 土日: 涼しい青
                            return '#f9fafb'; // 平日: 涼しいグレー
                          })()
                        }}
                        style={{
                          left: `${column.position}px`,
                          width: `${column.width}px`,
                          borderRight: '1px solid #e5e5e5',
                          opacity: 0.7 // 背景の透明度を下げてタスクバーを見やすくする
                        }}
                      />
                    ))}
                  </div>

                  {/* タスクバー */}
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
                  
                  // タスクバーの位置計算（より正確な計算）
                  let leftPosition = 0;
                  let taskWidth = ganttOptions.columnWidth;
                  
                  if (viewMode === 'Day') {
                    // 日表示モード：日数ベースで計算
                    const startTime = startDate.setHours(0, 0, 0, 0);
                    const endTime = endDate.setHours(23, 59, 59, 999);
                    const rangeStartTime = dateRange.start.setHours(0, 0, 0, 0);
                    
                    const startDays = Math.floor((startTime - rangeStartTime) / (1000 * 60 * 60 * 24));
                    const endDays = Math.floor((endTime - rangeStartTime) / (1000 * 60 * 60 * 24)) + 1;
                    
                    leftPosition = startDays * ganttOptions.columnWidth;
                    taskWidth = Math.max((endDays - startDays) * ganttOptions.columnWidth, ganttOptions.columnWidth);
                  } else if (viewMode === 'Week') {
                    // 週表示モード：月曜日基準で週数を計算
                    const rangeStart = new Date(dateRange.start);
                    const rangeDayOfWeek = rangeStart.getDay();
                    const rangeMondayOffset = rangeDayOfWeek === 0 ? -6 : 1 - rangeDayOfWeek;
                    rangeStart.setDate(rangeStart.getDate() + rangeMondayOffset);
                    rangeStart.setHours(0, 0, 0, 0);
                    
                    const taskStart = new Date(startDate);
                    taskStart.setHours(0, 0, 0, 0);
                    const taskEnd = new Date(endDate);
                    taskEnd.setHours(23, 59, 59, 999);
                    
                    const startWeeks = Math.floor((taskStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
                    const endWeeks = Math.floor((taskEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
                    
                    leftPosition = Math.max(0, startWeeks * ganttOptions.columnWidth);
                    taskWidth = Math.max((endWeeks - startWeeks) * ganttOptions.columnWidth, ganttOptions.columnWidth);
                  }

                  return (
                    <div
                      key={issue.id}
                      data-issue-id={issue.id}
                      className="relative border-b border-gray-200"
                      style={{ height: `${ganttOptions.rowHeight}px` }}
                    >
                      {/* ドラッグ可能タスクバー */}
                      {isDragDropEnabled ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${leftPosition}px`,
                            top: '2px',
                            width: `${taskWidth}px`,
                            height: `${ganttOptions.rowHeight - 8}px`,
                          }}
                        >
                          <DraggableTaskBar
                            key={`draggable-task-${issue.id}`}
                            issue={issue}
                            startDate={startDate}
                            endDate={endDate}
                            width={taskWidth}
                            height={ganttOptions.rowHeight - 8}
                            onDateChange={async (issueId, newStartDate, newEndDate) => {
                              if (onTaskChange) {
                                onTaskChange(issueId, {
                                  start_date: newStartDate,
                                  end_date: newEndDate,
                                });
                              }
                            }}
                            onTaskSelect={(issue, event) => handleTaskBarClickInternal(issue, event)}
                            readOnly={readOnly}
                            disabled={false}
                            isDragging={isBeingDragged}
                            isConstraintViolated={!!constraintViolation}
                            errorMessage={constraintViolation}
                            className={`${
                              isSelected ? 'border-2 border-blue-500' : 'border border-gray-300'
                            } ${
                              isPredecessor ? 'ring-2 ring-orange-300' : ''
                            } ${
                              isValidSuccessor ? 'ring-2 ring-green-300' : ''
                            }`}
                            showLabel={true}
                            showProgress={true}
                          />
                        </div>
                      ) : (
                        // 通常のタスクバー（ドラッグ無効）
                        <div
                          className={`absolute top-1 rounded cursor-pointer transition-all duration-200 ${
                            isSelected ? 'border-2 border-blue-500' : 'border border-gray-300'
                          } ${isBeingDragged ? 'opacity-50' : ''} ${
                            isPredecessor ? 'ring-2 ring-orange-300' : ''
                          } ${isValidSuccessor ? 'ring-2 ring-green-300' : ''}`}
                          style={{
                            left: `${leftPosition}px`,
                            width: `${taskWidth}px`,
                            height: `${ganttOptions.rowHeight - 8}px`,
                            backgroundColor: isTaskMilestone ? '#ef4444' : '#3b82f6',
                          }}
                          onClick={(e) => handleTaskBarClickInternal(issue, e)}
                          onContextMenu={(e) => handleTaskBarClickInternal(issue, e)}
                          title={`${issue.title}\n${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n進捗: ${issue.progress_pct}%`}
                        >
                          {/* 進捗バー */}
                          {issue.progress_pct > 0 && (
                            <div
                              className="h-full bg-green-400 rounded-l"
                              style={{ width: `${issue.progress_pct}%` }}
                            />
                          )}
                          
                          {/* タスクラベル */}
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className="text-white text-xs font-medium truncate">
                              {issue.title}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                  })}

                  {/* 依存関係線表示 */}
                  {ganttDisplaySettings.showDependencies && (
                    <DependencyLines
                      issues={filteredIssues}
                      dependencies={filteredDependencies}
                      containerRef={timelineRef as React.RefObject<HTMLElement>}
                      rowHeight={ganttOptions.rowHeight}
                      selectedDependency={selectedDependency}
                      onDependencySelect={handleDependencyClick}
                      onDependencyHover={onDependencyHover}
                      disabled={readOnly}
                      onDependencyRightClick={onDependencyLineRightClick}
                    />
                  )}
                </div>
              </div>
            </div>
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
    </>
  );
};

export default GanttChart;