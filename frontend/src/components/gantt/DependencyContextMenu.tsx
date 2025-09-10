'use client';

import React from 'react';
import { Issue } from '../../types/issue';

export interface DependencyContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  targetIssue?: Issue;
  dependencyId?: string; // 既存依存関係の削除時
  onClose: () => void;
  onCreateDependency?: (targetIssueId: string) => void;
  onDeleteDependency?: (dependencyId: string) => void;
  onSelectPredecessor?: (issueId: string) => void;
  disabled?: boolean;
  mode?: 'create' | 'delete' | 'select-predecessor';
}

/**
 * 依存関係操作のコンテキストメニュー
 * - タスクバー右クリック→依存関係作成開始
 * - 依存関係線右クリック→削除オプション
 */
const DependencyContextMenu: React.FC<DependencyContextMenuProps> = ({
  isOpen,
  position,
  targetIssue,
  dependencyId,
  onClose,
  onCreateDependency,
  onDeleteDependency,
  onSelectPredecessor,
  disabled = false,
  mode = 'create',
}) => {
  if (!isOpen) return null;

  const handleCreateDependency = () => {
    if (targetIssue && onCreateDependency && !disabled) {
      onCreateDependency(targetIssue.id);
    }
    onClose();
  };

  const handleDeleteDependency = () => {
    if (dependencyId && onDeleteDependency && !disabled) {
      onDeleteDependency(dependencyId);
    }
    onClose();
  };

  const handleSelectPredecessor = () => {
    if (targetIssue && onSelectPredecessor && !disabled) {
      onSelectPredecessor(targetIssue.id);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderMenuItems = () => {
    if (disabled) {
      return (
        <div className="px-3 py-2 text-sm text-gray-400">
          編集権限がありません
        </div>
      );
    }

    switch (mode) {
      case 'create':
        return (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
              onClick={handleCreateDependency}
              disabled={!targetIssue}
            >
              <span className="mr-2">➡️</span>
              このタスクから依存関係を作成
            </button>
            <div className="border-t border-gray-200"></div>
            <div className="px-3 py-2 text-xs text-gray-500">
              {targetIssue ? `${targetIssue.title} → 後続タスク選択` : ''}
            </div>
          </>
        );

      case 'delete':
        return (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center"
            onClick={handleDeleteDependency}
            disabled={!dependencyId}
          >
            <span className="mr-2">🗑️</span>
            この依存関係を削除
          </button>
        );

      case 'select-predecessor':
        return (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center"
              onClick={handleSelectPredecessor}
              disabled={!targetIssue}
            >
              <span className="mr-2">✓</span>
              先行タスクとして選択
            </button>
            <div className="border-t border-gray-200"></div>
            <div className="px-3 py-2 text-xs text-gray-500">
              {targetIssue ? `${targetIssue.title} を先行タスクに設定` : ''}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* バックドロップ */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleBackdropClick}
        role="button"
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      
      {/* メニュー */}
      <div
        className="fixed z-50 min-w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {renderMenuItems()}
      </div>
    </>
  );
};

export default DependencyContextMenu;