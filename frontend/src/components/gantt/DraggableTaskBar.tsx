'use client';

import React, { useState, useCallback } from 'react';
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
  onDateChange?: (issueId: string, newStartDate: Date, newEndDate: Date) => Promise<void>;
  onTaskSelect?: (issue: Issue) => void;
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

  // タスク選択ハンドラー
  const handleTaskClick = useCallback(() => {
    if (!readOnly && onTaskSelect) {
      onTaskSelect(issue);
    }
  }, [readOnly, onTaskSelect, issue]);

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
      className={`draggable-task-bar-container ${dndIsDragging ? 'dragging' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...attributes}
      {...listeners}
    >
      {/* 基本TaskBarコンポーネント */}
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

      {/* ドラッグ中のゴーストバー */}
      {dndIsDragging && (
        <div
          className={`absolute top-0 left-0 bg-blue-400 bg-opacity-60 border-2 border-blue-500 rounded-md ${
            isConstraintViolated ? 'bg-red-400 border-red-500' : ''
          }`}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
            移動中...
          </div>
        </div>
      )}

      {/* 制約違反時の警告表示 */}
      {isConstraintViolated && errorMessage && (
        <div className="absolute -top-8 left-0 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* ホバー時のドラッグヒント */}
      {isHovered && !readOnly && !disabled && !dndIsDragging && (
        <div className="absolute -top-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-30 pointer-events-none">
          ドラッグで日程変更
        </div>
      )}
    </div>
  );
};

export default DraggableTaskBar;