'use client';

import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Issue } from '@/types/issue';

interface HierarchyChangeDragZoneProps {
  targetParentId: string | null; // nullはルートレベルを意味する
  targetParent?: Issue | null;
  currentDraggedIssue?: Issue;
  allIssues: Issue[];
  isValidDrop?: boolean;
  children: React.ReactNode;
  onHierarchyDrop?: (draggedIssueId: string, newParentId: string | null) => void;
}

/**
 * 階層変更ドラッグ&ドロップ受付ゾーンコンポーネント
 * Issue間でのドラッグ&ドロップによる階層変更を処理
 */
const HierarchyChangeDragZone: React.FC<HierarchyChangeDragZoneProps> = ({
  targetParentId,
  targetParent,
  currentDraggedIssue,
  allIssues,
  isValidDrop = true,
  children,
  onHierarchyDrop,
}) => {
  // ドロップ可能エリアのID
  const droppableId = `hierarchy-${targetParentId || 'root'}`;
  
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: {
      type: 'hierarchy-change',
      targetParentId,
      targetParent,
    },
  });

  // 循環参照チェック
  const wouldCreateCircularReference = useMemo(() => {
    if (!currentDraggedIssue || !targetParentId) return false;
    
    // ドラッグ中のIssueの子孫を取得
    const getDescendants = (issueId: string): Set<string> => {
      const descendants = new Set<string>([issueId]);
      const children = allIssues.filter(issue => issue.parent_id === issueId);
      
      children.forEach(child => {
        const childDescendants = getDescendants(child.id);
        childDescendants.forEach(desc => descendants.add(desc));
      });
      
      return descendants;
    };

    const descendants = getDescendants(currentDraggedIssue.id);
    return descendants.has(targetParentId);
  }, [currentDraggedIssue, targetParentId, allIssues]);

  // ドロップ状態の判定
  const dropState = useMemo(() => {
    if (!currentDraggedIssue) {
      return { isValid: true, reason: '' };
    }

    // 自分自身にドロップしようとした場合
    if (currentDraggedIssue.id === targetParentId) {
      return { isValid: false, reason: '自分自身を親にすることはできません' };
    }

    // 既に同じ親の場合
    if (currentDraggedIssue.parent_id === targetParentId) {
      return { isValid: false, reason: '既に同じ親Issue下にあります' };
    }

    // 循環参照をチェック
    if (wouldCreateCircularReference) {
      return { isValid: false, reason: '循環参照が発生します' };
    }

    return { isValid: isValidDrop, reason: '' };
  }, [currentDraggedIssue, targetParentId, wouldCreateCircularReference, isValidDrop]);

  // ドロップ時の視覚的フィードバック
  const getDropZoneStyle = () => {
    if (!isOver || !currentDraggedIssue) return {};

    if (dropState.isValid) {
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.1)', // green-500 with opacity
        borderColor: 'rgb(34, 197, 94)', // green-500
        borderWidth: '2px',
        borderStyle: 'dashed',
      };
    } else {
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.1)', // red-500 with opacity
        borderColor: 'rgb(239, 68, 68)', // red-500
        borderWidth: '2px',
        borderStyle: 'dashed',
      };
    }
  };

  // ドラッグ情報の表示名
  const getTargetDisplayName = () => {
    if (targetParent) {
      const wbsPrefix = targetParent.wbs_number ? `${targetParent.wbs_number} ` : '';
      return `${wbsPrefix}${targetParent.title}`;
    }
    return 'ルートレベル';
  };

  return (
    <div
      ref={setNodeRef}
      style={getDropZoneStyle()}
      className={`
        relative transition-all duration-200
        ${isOver && currentDraggedIssue ? 'rounded-md' : ''}
      `}
    >
      {children}
      
      {/* ドロップ中のオーバーレイ表示 */}
      {isOver && currentDraggedIssue && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-5 rounded-md z-10">
          <div className={`
            px-3 py-2 rounded-md text-sm font-medium shadow-lg
            ${dropState.isValid 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
            }
          `}>
            {dropState.isValid ? (
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {getTargetDisplayName()}に移動
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {dropState.reason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HierarchyChangeDragZone;