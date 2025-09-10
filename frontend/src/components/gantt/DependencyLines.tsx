'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Issue } from '../../types/issue';
import DependencyArrow from './DependencyArrow';
import {
  DependencyLine,
  TaskPosition,
  DependencyLineOptions,
  DEFAULT_DEPENDENCY_LINE_OPTIONS,
  calculateFSArrowPath,
  updateTaskPositions,
  filterVisibleDependencies,
} from '../../utils/gantt-geometry';

export interface Dependency {
  id: string;
  project_id: string;
  predecessor_issue_id: string;
  successor_issue_id: string;
  type: 'FS';
  created_at: Date | string;
  predecessor?: {
    id: string;
    title: string;
  };
  successor?: {
    id: string;
    title: string;
  };
}

export interface DependencyLinesProps {
  issues: Issue[];
  dependencies: Dependency[];
  containerRef: React.RefObject<HTMLElement>;
  rowHeight?: number;
  options?: Partial<DependencyLineOptions>;
  selectedDependency?: string | null;
  onDependencySelect?: (dependency: Dependency | null) => void;
  onDependencyHover?: (dependency: Dependency | null) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * 依存関係線表示コンポーネント
 * 複数の依存関係矢印線を管理・表示し、パフォーマンス最適化を提供
 */
const DependencyLines: React.FC<DependencyLinesProps> = ({
  issues,
  dependencies,
  containerRef,
  rowHeight = 40,
  options = {},
  selectedDependency,
  onDependencySelect,
  onDependencyHover,
  className = '',
  disabled = false,
}) => {
  const [taskPositions, setTaskPositions] = useState<TaskPosition[]>([]);
  const [dependencyLines, setDependencyLines] = useState<DependencyLine[]>([]);
  const [visibleLines, setVisibleLines] = useState<DependencyLine[]>([]);
  const [hoveredLine, setHoveredLine] = useState<DependencyLine | null>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 描画オプションのマージ
  const lineOptions = useMemo(() => ({
    ...DEFAULT_DEPENDENCY_LINE_OPTIONS,
    ...options,
  }), [options]);

  // タスク位置の更新
  const updatePositions = useCallback(() => {
    if (!containerRef.current || issues.length === 0) return;

    const newPositions = updateTaskPositions(
      issues.map(issue => issue.id),
      containerRef.current,
      rowHeight
    );

    setTaskPositions(newPositions);

    // SVGサイズの更新
    const containerRect = containerRef.current.getBoundingClientRect();
    setSvgDimensions({
      width: containerRect.width,
      height: containerRect.height,
    });
  }, [issues, containerRef, rowHeight]);

  // 依存関係線の計算
  const calculateDependencyLines = useCallback(() => {
    if (taskPositions.length === 0 || dependencies.length === 0) {
      setDependencyLines([]);
      return;
    }

    const lines: DependencyLine[] = [];

    dependencies.forEach(dependency => {
      const predecessorPos = taskPositions.find(
        pos => pos.issueId === dependency.predecessor_issue_id
      );
      const successorPos = taskPositions.find(
        pos => pos.issueId === dependency.successor_issue_id
      );

      if (predecessorPos && successorPos) {
        const line = calculateFSArrowPath(predecessorPos, successorPos, lineOptions);
        lines.push(line);
      }
    });

    setDependencyLines(lines);
  }, [taskPositions, dependencies, lineOptions]);

  // 表示範囲内の線のフィルタリング
  const filterVisibleLines = useCallback(() => {
    if (!containerRef.current) {
      setVisibleLines(dependencyLines);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const viewportRect = {
      x: 0,
      y: 0,
      width: containerRect.width,
      height: containerRect.height,
    };

    const visible = filterVisibleDependencies(dependencyLines, viewportRect);
    setVisibleLines(visible);
  }, [dependencyLines, containerRef]);

  // 依存関係選択ハンドラー
  const handleDependencyClick = useCallback((line: DependencyLine) => {
    const dependency = dependencies.find(dep => 
      dep.predecessor_issue_id === line.predecessorIssueId &&
      dep.successor_issue_id === line.successorIssueId
    );
    
    if (dependency) {
      onDependencySelect?.(dependency);
    }
  }, [dependencies, onDependencySelect]);

  // 依存関係ホバーハンドラー
  const handleDependencyHover = useCallback((line: DependencyLine | null) => {
    setHoveredLine(line);
    
    if (line) {
      const dependency = dependencies.find(dep => 
        dep.predecessor_issue_id === line.predecessorIssueId &&
        dep.successor_issue_id === line.successorIssueId
      );
      onDependencyHover?.(dependency || null);
    } else {
      onDependencyHover?.(null);
    }
  }, [dependencies, onDependencyHover]);

  // 位置更新の初期化とリサイズ対応
  useEffect(() => {
    // 初回更新
    updatePositions();

    // ResizeObserverの設定
    if (containerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        // デバウンス処理
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
        }
        updateTimerRef.current = setTimeout(updatePositions, 100);
      });

      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [updatePositions, containerRef]);

  // スクロールイベントの処理
  useEffect(() => {
    if (!containerRef.current) return;

    const handleScroll = () => {
      // デバウンス処理
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        updatePositions();
        filterVisibleLines();
      }, 50);
    };

    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updatePositions, filterVisibleLines, containerRef]);

  // 依存関係線の再計算
  useEffect(() => {
    calculateDependencyLines();
  }, [calculateDependencyLines]);

  // 表示範囲のフィルタリング
  useEffect(() => {
    filterVisibleLines();
  }, [filterVisibleLines]);

  // 無効化時は表示しない
  if (disabled || dependencies.length === 0) {
    return null;
  }

  return (
    <div 
      className={`dependency-lines-container absolute inset-0 pointer-events-none z-10 ${className}`}
      style={{ overflow: 'hidden' }}
    >
      <svg
        width={svgDimensions.width}
        height={svgDimensions.height}
        className="dependency-lines-svg pointer-events-auto"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* デフス（矢印マーカー定義） */}
        <defs>
          <marker
            id="dependency-arrow-normal"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L9,3 z"
              fill={lineOptions.lineColor}
            />
          </marker>
          <marker
            id="dependency-arrow-hover"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L9,3 z"
              fill={lineOptions.hoverLineColor}
            />
          </marker>
          <marker
            id="dependency-arrow-selected"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L9,3 z"
              fill={lineOptions.selectedLineColor}
            />
          </marker>
        </defs>

        {/* 依存関係矢印線 */}
        {visibleLines.map(line => {
          const dependency = dependencies.find(dep => 
            dep.predecessor_issue_id === line.predecessorIssueId &&
            dep.successor_issue_id === line.successorIssueId
          );

          if (!dependency) return null;

          const isSelected = selectedDependency === dependency.id;
          const isHovered = hoveredLine?.id === line.id;

          return (
            <DependencyArrow
              key={line.id}
              dependency={line}
              options={lineOptions}
              isSelected={isSelected}
              isHovered={isHovered}
              onClick={handleDependencyClick}
              onHover={handleDependencyHover}
            />
          );
        })}

        {/* デバッグ情報（開発時のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <g className="debug-info">
            <text x="10" y="20" fontSize="10" fill="#666">
              依存関係: {dependencies.length} | 表示中: {visibleLines.length} | タスク位置: {taskPositions.length}
            </text>
          </g>
        )}
      </svg>

      {/* パフォーマンス統計（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs p-2 rounded">
          <div>Dependencies: {dependencies.length}</div>
          <div>Visible: {visibleLines.length}</div>
          <div>SVG: {svgDimensions.width}x{svgDimensions.height}</div>
        </div>
      )}
    </div>
  );
};

export default DependencyLines;
export type { Dependency };