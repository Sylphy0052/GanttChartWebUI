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
  onDependencySelect?: (dependency: Dependency | null) => void;
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
const DependencyLines: React.FC<DependencyLinesProps> = ({
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
  const [taskPositions, setTaskPositions] = useState<TaskPosition[]>([]);
  const [dependencyLines, setDependencyLines] = useState<DependencyLine[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // 依存関係線のオプション設定
  const lineOptions = useMemo(() => ({
    ...DEFAULT_DEPENDENCY_LINE_OPTIONS,
    ...options,
  }), [options]);

  // タスクの位置情報を更新
  useEffect(() => {
    if (!containerRef.current) return;

    const positions = updateTaskPositions(issues, containerRef.current, rowHeight);
    setTaskPositions(positions);
  }, [issues, containerRef, rowHeight]);

  // 依存関係線の計算と描画
  useEffect(() => {
    if (!taskPositions.length || !dependencies.length) {
      setDependencyLines([]);
      setWarnings([]);
      return;
    }

    try {
      // 表示可能な依存関係のフィルタリング
      const visibleDeps = filterVisibleDependencies(
        dependencies,
        issues,
        taskPositions
      );

      // 依存関係線の計算
      const lines: DependencyLine[] = [];
      const newWarnings: string[] = [];

      for (const dep of visibleDeps) {
        const predecessorPos = taskPositions.find(p => p.issueId === dep.predecessor_issue_id);
        const successorPos = taskPositions.find(p => p.issueId === dep.successor_issue_id);

        if (!predecessorPos || !successorPos) {
          newWarnings.push(`依存関係 ${dep.id} のタスク位置を特定できませんでした`);
          continue;
        }

        // FS (Finish-to-Start) パスの計算
        const path = calculateFSArrowPath(
          predecessorPos,
          successorPos,
          lineOptions
        );

        if (path) {
          lines.push({
            id: dep.id,
            dependency: dep,
            path,
            isSelected: selectedDependency === dep.id,
            style: {
              stroke: dep.isSelected ? lineOptions.selectedColor : lineOptions.defaultColor,
              strokeWidth: dep.isSelected ? lineOptions.selectedWidth : lineOptions.defaultWidth,
              strokeDasharray: dep.is_active ? 'none' : '5,5',
            },
          });
        } else {
          newWarnings.push(`依存関係 ${dep.id} の線描画に失敗しました`);
        }
      }

      setDependencyLines(lines);
      setWarnings(newWarnings);
    } catch (error) {
      console.error('Failed to calculate dependency lines:', error);
      setWarnings([`依存関係線の計算中にエラーが発生しました: ${error}`]);
    }
  }, [taskPositions, dependencies, selectedDependency, lineOptions, issues]);

  // 依存関係線のクリックハンドラー
  const handleDependencyClick = useCallback((dependency: Dependency, event?: React.MouseEvent) => {
    if (disabled) return;
    
    if (event?.button === 2) {
      // 右クリック
      event.preventDefault();
      onDependencyRightClick?.(dependency.id, event);
    } else {
      // 左クリック（選択）
      onDependencySelect?.(dependency);
    }
  }, [disabled, onDependencySelect, onDependencyRightClick]);

  // 依存関係線のホバーハンドラー
  const handleDependencyHover = useCallback((dependency: Dependency | null) => {
    if (disabled || !onDependencyHover) return;
    
    onDependencyHover(dependency);
  }, [disabled, onDependencyHover]);

  // SVGのサイズ計算
  const svgDimensions = useMemo(() => {
    if (!containerRef.current) return { width: 0, height: 0 };
    
    const container = containerRef.current;
    return {
      width: container.scrollWidth,
      height: container.scrollHeight,
    };
  }, [containerRef, taskPositions]);

  // 表示する依存関係がない場合
  if (dependencyLines.length === 0) {
    return null;
  }

  return (
    <div className={`dependency-lines-container ${className}`}>
      {/* 警告メッセージ */}
      {warnings.length > 0 && (
        <div className="dependency-warnings mb-2">
          {warnings.map((warning, index) => (
            <div key={index} className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* SVG依存関係線 */}
      <svg
        ref={svgRef}
        className="dependency-lines-svg absolute top-0 left-0 pointer-events-none"
        style={{
          width: svgDimensions.width,
          height: svgDimensions.height,
          zIndex: 10,
        }}
      >
        {/* 依存関係線の描画 */}
        {dependencyLines.map((line) => (
          <DependencyArrow
            key={line.id}
            dependency={line.dependency}
            path={line.path}
            isSelected={line.isSelected}
            onClick={(event) => handleDependencyClick(line.dependency, event)}
            onHover={(isHovered) => 
              handleDependencyHover(isHovered ? line.dependency : null)
            }
            disabled={disabled}
            style={line.style}
            onContextMenu={(event) => handleDependencyClick(line.dependency, event)}
          />
        ))}

        {/* 選択された依存関係のハイライト */}
        {selectedDependency && (
          <defs>
            <filter id="selected-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        )}
      </svg>

      {/* デバッグ情報 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dependency-debug-info absolute bottom-0 right-0 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>依存関係: {dependencyLines.length}</div>
          <div>タスク位置: {taskPositions.length}</div>
          <div>SVG: {svgDimensions.width}×{svgDimensions.height}</div>
          {selectedDependency && <div>選択中: {selectedDependency}</div>}
        </div>
      )}
    </div>
  );
};

export default DependencyLines;