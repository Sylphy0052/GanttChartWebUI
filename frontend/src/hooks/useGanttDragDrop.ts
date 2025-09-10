'use client';

import { useState, useCallback, useMemo } from 'react';
import { DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/core';
import { Issue } from '../types/issue';
import { Dependency } from '../components/gantt/DependencyLines';
import { issuesApi } from '../api/issues';

export interface DragDropState {
  isDragging: boolean;
  draggedTask: Issue | null;
  dragOffset: { x: number; y: number } | null;
  constraintViolations: Map<string, string>;
  originalPosition: { startDate: Date; endDate: Date } | null;
}

export interface UseGanttDragDropProps {
  issues: Issue[];
  dependencies: Dependency[];
  projectId: string;
  onIssueUpdate?: (issueId: string, updatedIssue: Issue) => void;
  onError?: (error: Error) => void;
  readOnly?: boolean;
  pixelsPerDay?: number; // ドラッグ距離から日数計算用
}

export interface UseGanttDragDropReturn {
  dragState: DragDropState;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  calculateNewDates: (issue: Issue, deltaX: number) => { startDate: Date; endDate: Date };
  validateConstraints: (issue: Issue, newStartDate: Date, newEndDate: Date) => string | null;
  resetDragState: () => void;
}

/**
 * ガントチャートドラッグ&ドロップ機能のカスタムフック
 * タスクバーの移動、制約チェック、Backend API連携を管理
 */
export function useGanttDragDrop({
  issues,
  dependencies,
  projectId,
  onIssueUpdate,
  onError,
  readOnly = false,
  pixelsPerDay = 14, // デフォルト: 1日 = 14px
}: UseGanttDragDropProps): UseGanttDragDropReturn {
  const [dragState, setDragState] = useState<DragDropState>({
    isDragging: false,
    draggedTask: null,
    dragOffset: null,
    constraintViolations: new Map(),
    originalPosition: null,
  });

  // 依存関係マップの生成（パフォーマンス最適化）
  const dependencyMap = useMemo(() => {
    const predecessorsMap = new Map<string, string[]>();
    const successorsMap = new Map<string, string[]>();
    
    dependencies.forEach(dep => {
      // Predecessor -> Successors
      if (!successorsMap.has(dep.predecessor_issue_id)) {
        successorsMap.set(dep.predecessor_issue_id, []);
      }
      successorsMap.get(dep.predecessor_issue_id)!.push(dep.successor_issue_id);
      
      // Successor -> Predecessors
      if (!predecessorsMap.has(dep.successor_issue_id)) {
        predecessorsMap.set(dep.successor_issue_id, []);
      }
      predecessorsMap.get(dep.successor_issue_id)!.push(dep.predecessor_issue_id);
    });
    
    return { predecessorsMap, successorsMap };
  }, [dependencies]);

  // ドラッグ距離から新しい日付を計算
  const calculateNewDates = useCallback((issue: Issue, deltaX: number): { startDate: Date; endDate: Date } => {
    if (!issue.start_date || !issue.end_date) {
      return { startDate: new Date(), endDate: new Date() };
    }

    const originalStart = new Date(issue.start_date);
    const originalEnd = new Date(issue.end_date);
    const duration = originalEnd.getTime() - originalStart.getTime();
    
    // ピクセル移動を日数に変換
    const daysDelta = Math.round(deltaX / pixelsPerDay);
    
    const newStartDate = new Date(originalStart);
    newStartDate.setDate(newStartDate.getDate() + daysDelta);
    
    const newEndDate = new Date(newStartDate.getTime() + duration);
    
    return { startDate: newStartDate, endDate: newEndDate };
  }, [pixelsPerDay]);

  // 依存関係制約の検証
  const validateConstraints = useCallback((
    issue: Issue, 
    newStartDate: Date, 
    newEndDate: Date
  ): string | null => {
    const { predecessorsMap, successorsMap } = dependencyMap;
    
    // Predecessor制約チェック (Finish-to-Start)
    const predecessorIds = predecessorsMap.get(issue.id) || [];
    for (const predecessorId of predecessorIds) {
      const predecessor = issues.find(i => i.id === predecessorId);
      if (predecessor && predecessor.end_date) {
        const predecessorEnd = new Date(predecessor.end_date);
        if (newStartDate < predecessorEnd) {
          return `前のタスク "${predecessor.title}" が完了してから開始してください`;
        }
      }
    }
    
    // Successor制約チェック (Finish-to-Start)
    const successorIds = successorsMap.get(issue.id) || [];
    for (const successorId of successorIds) {
      const successor = issues.find(i => i.id === successorId);
      if (successor && successor.start_date) {
        const successorStart = new Date(successor.start_date);
        if (newEndDate > successorStart) {
          return `次のタスク "${successor.title}" の開始前に完了してください`;
        }
      }
    }

    return null; // 制約違反なし
  }, [issues, dependencyMap]);

  // ドラッグ開始ハンドラー
  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (readOnly) return;

    const { active } = event;
    const taskData = active.data.current;
    
    if (taskData?.type === 'task-bar' && taskData.issue) {
      const issue = taskData.issue as Issue;
      
      setDragState(prev => ({
        ...prev,
        isDragging: true,
        draggedTask: issue,
        originalPosition: {
          startDate: new Date(issue.start_date || new Date()),
          endDate: new Date(issue.end_date || new Date()),
        },
        constraintViolations: new Map(),
      }));
    }
  }, [readOnly]);

  // ドラッグ移動ハンドラー
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (readOnly || !dragState.isDragging || !dragState.draggedTask) return;

    const { delta } = event;
    const deltaX = delta.x;
    
    // 新しい日付を計算
    const { startDate: newStartDate, endDate: newEndDate } = calculateNewDates(
      dragState.draggedTask, 
      deltaX
    );
    
    // 制約違反チェック
    const violation = validateConstraints(dragState.draggedTask, newStartDate, newEndDate);
    
    setDragState(prev => {
      const newViolations = new Map(prev.constraintViolations);
      if (violation) {
        newViolations.set(dragState.draggedTask!.id, violation);
      } else {
        newViolations.delete(dragState.draggedTask!.id);
      }
      
      return {
        ...prev,
        dragOffset: { x: deltaX, y: delta.y },
        constraintViolations: newViolations,
      };
    });
  }, [readOnly, dragState, calculateNewDates, validateConstraints]);

  // ドラッグ終了ハンドラー
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (readOnly || !dragState.isDragging || !dragState.draggedTask || !dragState.dragOffset) {
      resetDragState();
      return;
    }

    const { draggedTask, dragOffset, constraintViolations } = dragState;
    
    try {
      // 制約違反がある場合は更新をキャンセル
      if (constraintViolations.has(draggedTask.id)) {
        console.warn('Constraint violation detected, canceling drag operation');
        resetDragState();
        return;
      }

      // 新しい日付を計算
      const { startDate: newStartDate, endDate: newEndDate } = calculateNewDates(
        draggedTask, 
        dragOffset.x
      );

      // 最終制約チェック
      const finalViolation = validateConstraints(draggedTask, newStartDate, newEndDate);
      if (finalViolation) {
        console.warn('Final constraint violation detected:', finalViolation);
        resetDragState();
        return;
      }

      // Backend API呼び出し
      const updatedIssue = await issuesApi.update(projectId, draggedTask.id, {
        start_date: newStartDate.toISOString(),
        end_date: newEndDate.toISOString(),
      });

      // 成功時のコールバック
      if (onIssueUpdate) {
        onIssueUpdate(draggedTask.id, updatedIssue);
      }

      console.log(`Issue ${draggedTask.title} successfully moved to ${newStartDate.toLocaleDateString()} - ${newEndDate.toLocaleDateString()}`);

    } catch (error) {
      console.error('Failed to update issue dates:', error);
      
      // エラーハンドリング
      if (onError) {
        onError(error instanceof Error ? error : new Error('Failed to update task dates'));
      }
    } finally {
      resetDragState();
    }
  }, [
    readOnly, 
    dragState, 
    projectId, 
    calculateNewDates, 
    validateConstraints, 
    onIssueUpdate, 
    onError
  ]);

  // ドラッグ状態のリセット
  const resetDragState = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedTask: null,
      dragOffset: null,
      constraintViolations: new Map(),
      originalPosition: null,
    });
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    calculateNewDates,
    validateConstraints,
    resetDragState,
  };
}