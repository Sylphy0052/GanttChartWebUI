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
  predecessor_issue_id: string;
  successor_issue_id: string;
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  type?: 'FS' | 'SS' | 'FF' | 'SF'; // UI用の短縮形（互換性のため）
  lag_days?: number; // 遅延日数（負の値も可能）
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // UI状態（オプション）
  isSelected?: boolean;
  isHovered?: boolean;
  validationError?: string;
}

export interface DependencyLinesProps {
  issues: Issue[];
  dependencies: Dependency[];
  containerRef: React.RefObject<HTMLElement>;
  rowHeight: number;
  selectedDependency?: string | null;
  onDependencySelect?: (dependency: Dependency | null, event?: React.MouseEvent) => void;
  onDependencyHover?: (dependency: Dependency | null) => void;
  onDependencyRightClick?: (dependencyId: string, event: React.MouseEvent) => void;
  options?: Partial<DependencyLineOptions>;
  disabled?: boolean;
  className?: string;
}

/**
 * 依存関係線表示コンポーネント
 * FS (Finish-to-Start) 依存関係を矢印線で視覚化
 */
const DependencyLinesComponent: React.FC<DependencyLinesProps> = ({
  issues,
  dependencies,
  containerRef,
  rowHeight,
  selectedDependency,
  onDependencySelect,
  onDependencyHover,
  onDependencyRightClick,
  options = {},
  disabled = false,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [taskPositions, setTaskPositions] = useState<Record<string, TaskPosition>>({});
  const [hoveredDependency, setHoveredDependency] = useState<string | null>(null);

  // オプションのマージ
  const lineOptions = useMemo(() => ({
    ...DEFAULT_DEPENDENCY_LINE_OPTIONS,
    ...options,
  }), [options]);

  // タスク位置の更新（issuesまたはrowHeightが変更されたとき）
  useEffect(() => {
    if (!containerRef.current) return;

    const positions = updateTaskPositions(issues, containerRef.current, rowHeight);
    setTaskPositions(positions);
  }, [issues, rowHeight]);

  // 依存関係線をuseMemoで安全に計算
  const calculatedLines = useMemo(() => {
    if (!Object.keys(taskPositions).length || !dependencies.length) return [];

    const lines = dependencies.map(dependency => {
      const predecessorPos = taskPositions[dependency.predecessor_issue_id];
      const successorPos = taskPositions[dependency.successor_issue_id];

      if (!predecessorPos || !successorPos) return null;

      const path = calculateFSArrowPath(
        predecessorPos,
        successorPos,
        lineOptions
      );

      return {
        dependency,
        path,
        isSelected: selectedDependency === dependency.id,
        isHovered: hoveredDependency === dependency.id,
        isValid: true,
        predecessorPos,
        successorPos,
      } as DependencyLine;
    }).filter(Boolean) as DependencyLine[];

    return filterVisibleDependencies(lines, containerRef.current);
  }, [
    // 安全な依存関係のみ - プリミティブ値を使用
    Object.keys(taskPositions).length,
    dependencies.length,
    dependencies.map(d => d.id).sort().join('|'), // 依存関係IDの変更を検出
    selectedDependency,
    hoveredDependency,
    lineOptions.strokeWidth, // 描画オプションの変更
    lineOptions.color
  ]);

  // スクロール・リサイズイベントリスナー
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const positions = updateTaskPositions(issues, containerRef.current, rowHeight);
      setTaskPositions(positions);
    };

    const handleResize = () => {
      if (!containerRef.current) return;
      const positions = updateTaskPositions(issues, containerRef.current, rowHeight);
      setTaskPositions(positions);
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [issues, rowHeight]);

  // 依存関係線クリックハンドラー
  const handleDependencyClick = useCallback((line: DependencyLine, event: React.MouseEvent) => {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.button === 2) {
      // 右クリック
      onDependencyRightClick?.(line.dependency.id, event);
    } else {
      // 左クリック
      onDependencySelect?.(line.dependency, event);
    }
  }, [disabled, onDependencyRightClick, onDependencySelect]);

  // 依存関係線ホバーハンドラー
  const handleDependencyHover = useCallback((line: DependencyLine | null) => {
    if (disabled) return;

    const dependencyId = line?.dependency.id || null;
    setHoveredDependency(dependencyId);
    onDependencyHover?.(line?.dependency || null);
  }, [disabled, onDependencyHover]);

  // SVGサイズの計算
  const containerRect = containerRef.current?.getBoundingClientRect();
  const svgWidth = containerRect?.width || 0;
  const svgHeight = containerRect?.height || 0;

  if (!containerRef.current || calculatedLines.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      width={svgWidth}
      height={svgHeight}
      style={{ zIndex: 10 }}
    >
      <defs>
        {/* 矢印マーカー定義 */}
        <marker
          id="dependency-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,0 0,6 9,3"
            fill={lineOptions.arrowColor}
            stroke={lineOptions.arrowColor}
            strokeWidth="1"
          />
        </marker>
        <marker
          id="dependency-arrow-selected"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,0 0,8 10,4"
            fill={lineOptions.selectedColor}
            stroke={lineOptions.selectedColor}
            strokeWidth="2"
          />
        </marker>
      </defs>

      {/* 依存関係線の描画 */}
      {calculatedLines.map((line) => (
        <g key={line.dependency.id}>
          {/* 依存関係矢印線 */}
          <DependencyArrow
            line={line}
            options={lineOptions}
            onClick={(event) => handleDependencyClick(line, event)}
            onMouseEnter={() => handleDependencyHover(line)}
            onMouseLeave={() => handleDependencyHover(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              onDependencyRightClick?.(line.dependency.id, event);
            }}
            disabled={disabled}
          />

          {/* 依存関係ラベル（選択時のみ） */}
          {line.isSelected && lineOptions.showLabels && (
            <text
              x={(line.predecessorPos.right + line.successorPos.left) / 2}
              y={line.predecessorPos.centerY - 10}
              className="text-xs fill-current text-gray-600"
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {line.dependency.dependency_type === 'finish_to_start' ? 'FS' :
               line.dependency.dependency_type === 'start_to_start' ? 'SS' :
               line.dependency.dependency_type === 'finish_to_finish' ? 'FF' : 'SF'}
              {line.dependency.lag_days ? ` (${line.dependency.lag_days}d)` : ''}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

// React.memoでコンポーネントをメモ化
const DependencyLines = React.memo(DependencyLinesComponent, (prevProps, nextProps) => {
  // カスタム比較関数で無駄な再レンダリングを防ぐ
  if (
    prevProps.issues.length !== nextProps.issues.length ||
    prevProps.dependencies.length !== nextProps.dependencies.length ||
    prevProps.selectedDependency !== nextProps.selectedDependency ||
    prevProps.rowHeight !== nextProps.rowHeight ||
    prevProps.disabled !== nextProps.disabled
  ) {
    return false;
  }

  // 依存関係の詳細比較（IDのみ）
  if (prevProps.dependencies.length > 0) {
    const prevDepIds = prevProps.dependencies.map(d => d.id).sort();
    const nextDepIds = nextProps.dependencies.map(d => d.id).sort();
    if (prevDepIds.join(',') !== nextDepIds.join(',')) {
      return false;
    }
  }

  // Issuesの詳細比較（IDのみ）
  if (prevProps.issues.length > 0) {
    const prevIssueIds = prevProps.issues.map(i => i.id).sort();
    const nextIssueIds = nextProps.issues.map(i => i.id).sort();
    if (prevIssueIds.join(',') !== nextIssueIds.join(',')) {
      return false;
    }
  }

  return true;
});

DependencyLines.displayName = 'DependencyLines';

export default DependencyLines;