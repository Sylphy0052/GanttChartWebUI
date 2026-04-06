'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Issue } from '../../types/issue';
import TaskBar, { TaskBarProps } from './TaskBar';

export interface DraggableTaskBarProps extends Omit<TaskBarProps, 'onClick'> {
  issue: Issue;
  startDate: Date;
  endDate: Date;
  width: number;
  height?: number;
  onDateChange?: (issue: Issue, newStartDate: Date, newEndDate: Date) => Promise<void>;
  onTaskSelect?: (issue: Issue, event: React.MouseEvent) => void;
  className?: string;
  showLabel?: boolean;
  showProgress?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  isDragging?: boolean;
  isConstraintViolated?: boolean;
  errorMessage?: string;
}

/**
 * ドラッグ可能なタスクバーコンポーネント
 * @dnd-kitを使用してタスクの日程をドラッグ&ドロップで変更
 */
const DraggableTaskBar: React.FC<DraggableTaskBarProps> = ({
  issue,
  startDate,
  endDate,
  width,
  height = 24,
  onDateChange,
  onTaskSelect,
  className = '',
  showLabel = true,
  showProgress = true,
  readOnly = false,
  disabled = false,
  isDragging = false,
  isConstraintViolated = false,
  errorMessage,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [resizeMode, setResizeMode] = useState<'start' | 'end' | null>(null);
  const [isDraggingResize, setIsDraggingResize] = useState(false);

  // @dnd-kit ドラッグ設定
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: dndIsDragging,
  } = useDraggable({
    id: `task-bar-${issue.id}`,
    disabled: readOnly || disabled,
    data: {
      type: 'task-bar',
      issue,
      startDate,
      endDate,
      width,
    },
  });

  // ドラッグ変換スタイル
  const dragStyle = {
    transform: CSS.Translate.toString(transform),
  };

  // リサイズハンドラー
  const handleResizeStart = useCallback((event: React.MouseEvent, mode: 'start' | 'end') => {
    if (readOnly || disabled) return;

    event.preventDefault();
    event.stopPropagation();

    setResizeMode(mode);
    setIsDraggingResize(true);
    setDragStartPosition({ x: event.clientX, y: event.clientY });
  }, [readOnly, disabled]);

  const handleResizeMove = useCallback((event: MouseEvent) => {
    if (!isDraggingResize || !dragStartPosition || !resizeMode || !onDateChange) return;

    const deltaX = event.clientX - dragStartPosition.x;
    const dayWidth = 40; // 1日あたりのピクセル数（設定に応じて調整）
    const daysDelta = Math.round(deltaX / dayWidth);

    if (daysDelta === 0) return;

    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);

    if (resizeMode === 'start') {
      newStartDate.setDate(newStartDate.getDate() + daysDelta);
      // 開始日が終了日を超えないように制限
      if (newStartDate >= newEndDate) return;
    } else {
      newEndDate.setDate(newEndDate.getDate() + daysDelta);
      // 終了日が開始日を下回らないように制限
      if (newEndDate <= newStartDate) return;
    }

    onDateChange(issue, newStartDate, newEndDate);
    setDragStartPosition({ x: event.clientX, y: event.clientY });
  }, [isDraggingResize, dragStartPosition, resizeMode, onDateChange, issue, startDate, endDate]);

  const handleResizeEnd = useCallback(() => {
    setIsDraggingResize(false);
    setResizeMode(null);
    setDragStartPosition(null);
  }, []);

  // リサイズイベントリスナー
  useEffect(() => {
    if (isDraggingResize) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isDraggingResize, handleResizeMove, handleResizeEnd]);

  // タスク選択ハンドラー
  const handleTaskClick = useCallback((event: React.MouseEvent) => {
    if (!readOnly && onTaskSelect && !isDraggingResize) {
      onTaskSelect(issue, event);
    }
  }, [readOnly, onTaskSelect, issue, isDraggingResize]);

  // タスクバー用の拡張スタイル
  const enhancedClassName = [
    className,
    dndIsDragging ? 'cursor-grabbing opacity-75 z-50' : '',
    !readOnly && !disabled ? 'cursor-grab hover:shadow-lg' : '',
    isConstraintViolated ? 'border-2 border-red-500 shadow-red-200' : '',
    'transition-all duration-200 ease-in-out',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`draggable-task-bar-container relative ${dndIsDragging ? 'dragging' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...attributes}
      {...(readOnly || disabled ? {} : listeners)}
    >
      <TaskBar
        issue={issue}
        startDate={startDate}
        endDate={endDate}
        width={width}
        height={height}
        onClick={handleTaskClick}
        className={enhancedClassName}
        showLabel={showLabel}
        showProgress={showProgress}
        readOnly={readOnly}
        {...props}
      />

      {/* 左端のリサイズハンドル */}
      {!readOnly && !disabled && isHovered && (
        <div
          className="absolute left-0 top-0 w-2 h-full bg-blue-500 opacity-0 hover:opacity-100 cursor-col-resize z-10 transition-opacity duration-200"
          style={{ left: '-1px' }}
          onMouseDown={(e) => handleResizeStart(e, 'start')}
          title="開始日を変更"
        />
      )}

      {/* 右端のリサイズハンドル */}
      {!readOnly && !disabled && isHovered && (
        <div
          className="absolute right-0 top-0 w-2 h-full bg-blue-500 opacity-0 hover:opacity-100 cursor-col-resize z-10 transition-opacity duration-200"
          style={{ right: '-1px' }}
          onMouseDown={(e) => handleResizeStart(e, 'end')}
          title="終了日を変更"
        />
      )}

      {/* エラーメッセージ表示 */}
      {isConstraintViolated && errorMessage && (
        <div className="absolute top-full left-0 mt-1 bg-red-100 border border-red-300 text-red-700 text-xs px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default DraggableTaskBar;