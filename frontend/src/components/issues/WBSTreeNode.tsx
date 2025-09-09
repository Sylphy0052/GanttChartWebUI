'use client';

import React from 'react';
import { WBSTreeNodeType } from '@/hooks/useWBSTree';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WBSTreeNodeProps {
  node: WBSTreeNodeType;
  onToggleExpand?: (nodeId: string) => void;
  onNodeClick?: (node: WBSTreeNodeType) => void;
  isSelected?: boolean;
  enableDragHandle?: boolean;
  isDraggedOver?: boolean;
}

const WBSTreeNode: React.FC<WBSTreeNodeProps> = ({
  node,
  onToggleExpand,
  onNodeClick,
  isSelected = false,
  enableDragHandle = false,
  isDraggedOver = false,
}) => {
  // ドラッグ機能の設定（enableDragHandleがtrueの場合のみ有効）
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled: !enableDragHandle,
  });

  const style = enableDragHandle ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : {};

  // インデントスタイル
  const getIndentStyle = () => ({
    paddingLeft: `${node.level * 24 + 16}px`,
  });

  // 階層構造を視覚化する縦線・水平線の描画
  const renderTreeLines = () => {
    if (node.level === 0) return null;
    
    return (
      <>
        {/* 縦線 */}
        {Array.from({ length: node.level }, (_, i) => (
          <div
            key={`vline-${i}`}
            className="absolute h-full w-px bg-gray-200"
            style={{ left: `${i * 24 + 24}px`, top: 0 }}
          />
        ))}
        {/* 水平線 */}
        <div
          className="absolute w-4 h-px bg-gray-200"
          style={{ left: `${(node.level - 1) * 24 + 24}px`, top: '50%' }}
        />
      </>
    );
  };

  // 展開/折りたたみボタン
  const renderExpandButton = () => {
    if (!node.hasChildren) {
      return <div className="w-5 h-5" />;
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.(node.id);
        }}
        className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
      >
        {node.isExpanded ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
    );
  };

  // WBS番号表示
  const renderWBSNumber = () => {
    if (!node.wbsNumber) return null;
    
    return (
      <span className="text-xs font-mono text-gray-500 min-w-[60px]">
        {node.wbsNumber}
      </span>
    );
  };

  // ドラッグハンドル
  const renderDragHandle = () => {
    if (!enableDragHandle) return null;

    return (
      <td className="w-8 px-2">
        <div
          className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 transition-colors"
          {...listeners}
          {...attributes}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      </td>
    );
  };

  // クリックハンドラ
  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick?.(node);
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={handleNodeClick}
      className={`
        transition-colors relative cursor-pointer
        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
        ${isDraggedOver ? 'bg-blue-50 border-blue-200' : ''}
        ${isDragging ? 'opacity-50 z-10' : ''}
        ${node.level > 0 ? 'border-l border-gray-100' : ''}
      `}
    >
      {renderDragHandle()}
      
      {/* タイトル列 */}
      <td className="py-4 pr-4 relative" style={getIndentStyle()}>
        {renderTreeLines()}
        <div className="flex items-center space-x-2">
          {renderExpandButton()}
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {renderWBSNumber()}
            <span className={`font-medium truncate ${node.hasChildren ? 'text-gray-900' : 'text-gray-700'}`}>
              {node.title}
            </span>
          </div>
        </div>
      </td>

      {/* ステータス列 */}
      <td className="px-3 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
          ${node.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
          ${node.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : ''}
          ${node.status === 'not_started' ? 'bg-gray-100 text-gray-800' : ''}
          ${node.status === 'blocked' ? 'bg-red-100 text-red-800' : ''}
        `}>
          {node.status === 'completed' && '完了'}
          {node.status === 'in_progress' && '進行中'}
          {node.status === 'not_started' && '未着手'}
          {node.status === 'blocked' && 'ブロック'}
        </span>
      </td>

      {/* 担当者列 */}
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {node.assignee || '-'}
      </td>

      {/* 開始日列 */}
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {node.start_date ? new Date(node.start_date).toLocaleDateString('ja-JP') : '-'}
      </td>

      {/* 終了日列 */}
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {node.end_date ? new Date(node.end_date).toLocaleDateString('ja-JP') : '-'}
      </td>

      {/* 進捗率列 */}
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-1 mr-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${node.progress_pct || 0}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-gray-900">
            {node.progress_pct || 0}%
          </span>
        </div>
      </td>
    </tr>
  );
};

export default WBSTreeNode;