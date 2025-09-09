'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UniqueIdentifier } from '@dnd-kit/core';

/**
 * ドラッグ可能ラッパーコンポーネントのProps
 */
interface DraggableWrapperProps {
  id: UniqueIdentifier;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  dragHandle?: boolean;
}

/**
 * ドラッグ可能なラッパーコンポーネント
 * @dnd-kit/sortableを使用してアイテムをドラッグ可能にする
 */
export function DraggableWrapper({
  id,
  children,
  className = '',
  disabled = false,
  dragHandle = false,
}: DraggableWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // ドラッグハンドル使用時は、listenersを手動で適用
  const dragProps = dragHandle ? {} : { ...listeners, ...attributes };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${className}
        ${isDragging ? 'opacity-50 z-10' : ''}
        ${disabled ? 'cursor-default' : dragHandle ? '' : 'cursor-grab'}
        ${isDragging && !disabled ? 'cursor-grabbing' : ''}
      `.trim()}
      {...dragProps}
    >
      {dragHandle ? (
        <div className="flex items-start gap-2">
          <div
            className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 transition-colors"
            {...listeners}
            {...attributes}
          >
            <DragHandleIcon />
          </div>
          <div className="flex-1">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * ドラッグハンドルアイコン
 */
function DragHandleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

/**
 * ドラッグプレビューコンポーネント
 * DragOverlay内で使用
 */
interface DragPreviewProps {
  children: React.ReactNode;
  className?: string;
}

export function DragPreview({ children, className = '' }: DragPreviewProps) {
  return (
    <div
      className={`
        ${className}
        bg-white border border-gray-200 shadow-lg rounded-md
        transform rotate-3 opacity-90
      `.trim()}
    >
      {children}
    </div>
  );
}

/**
 * ドロップゾーンコンポーネント
 */
interface DropZoneProps {
  children: React.ReactNode;
  className?: string;
  isOver?: boolean;
}

export function DropZone({
  children,
  className = '',
  isOver = false,
}: DropZoneProps) {
  return (
    <div
      className={`
        ${className}
        ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}
        border-2 border-dashed rounded-md p-4 transition-colors
      `.trim()}
    >
      {children}
    </div>
  );
}

/**
 * 基本的なドラッグ&ドロップリストコンポーネント
 * テスト・サンプル用途
 */
interface BasicDragDropListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (items: T[]) => void;
  getItemId: (item: T) => UniqueIdentifier;
  className?: string;
  itemClassName?: string;
  dragHandle?: boolean;
}

export function BasicDragDropList<T>({
  items,
  renderItem,
  onReorder,
  getItemId,
  className = '',
  itemClassName = '',
  dragHandle = false,
}: BasicDragDropListProps<T>) {
  // useDragDropフックの利用例は、実際のコンポーネントで使用時に追加
  // この基本コンポーネントは型定義とレイアウトの提供に留める
  
  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item, index) => (
        <DraggableWrapper
          key={getItemId(item)}
          id={getItemId(item)}
          className={itemClassName}
          dragHandle={dragHandle}
        >
          {renderItem(item, index)}
        </DraggableWrapper>
      ))}
    </div>
  );
}