'use client';

import { useState, useCallback } from 'react';
import { Issue } from '../types/issue';
import { Dependency } from '../components/gantt/DependencyLines';

export interface DependencyManagementState {
  isCreating: boolean;
  selectedPredecessor: Issue | null;
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
    targetIssue?: Issue;
    dependencyId?: string;
    mode: 'create' | 'delete' | 'select-predecessor';
  };
}

export interface DependencyManagementActions {
  // 依存関係作成フロー
  startCreation: (predecessorIssue: Issue, event: React.MouseEvent) => void;
  selectSuccessor: (successorIssue: Issue) => void;
  cancelCreation: () => void;

  // コンテキストメニュー
  openTaskContextMenu: (issue: Issue, event: React.MouseEvent) => void;
  openDependencyContextMenu: (dependencyId: string, event: React.MouseEvent) => void;
  closeContextMenu: () => void;

  // 依存関係操作
  createDependency: (predecessorId: string, successorId: string) => Promise<void>;
  deleteDependency: (dependencyId: string) => Promise<void>;
}

export interface DependencyApiProps {
  projectId: string;
  onDependencyCreated?: (dependency: Dependency) => void;
  onDependencyDeleted?: (dependencyId: string) => void;
  onError?: (error: string) => void;
  editorRole?: boolean;
}

/**
 * 依存関係管理フック
 * UI操作（コンテキストメニュー、作成フロー）とAPI連携を管理
 */
export const useDependencyManagement = (props: DependencyApiProps) => {
  const { projectId, onDependencyCreated, onDependencyDeleted, onError, editorRole = false } = props;

  const [state, setState] = useState<DependencyManagementState>({
    isCreating: false,
    selectedPredecessor: null,
    contextMenu: {
      isOpen: false,
      position: { x: 0, y: 0 },
      mode: 'create',
    },
  });

  // コンテキストメニュー操作
  const openTaskContextMenu = useCallback((issue: Issue, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setState(prev => ({
      ...prev,
      contextMenu: {
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        targetIssue: issue,
        mode: state.isCreating ? 'select-predecessor' : 'create',
      },
    }));
  }, [state.isCreating]);

  const openDependencyContextMenu = useCallback((dependencyId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setState(prev => ({
      ...prev,
      contextMenu: {
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        dependencyId,
        mode: 'delete',
      },
    }));
  }, []);

  const closeContextMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      contextMenu: {
        ...prev.contextMenu,
        isOpen: false,
      },
    }));
  }, []);

  // 依存関係作成フロー
  const startCreation = useCallback((predecessorIssue: Issue, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!editorRole) {
      onError?.('依存関係の作成にはEditor権限が必要です');
      return;
    }

    setState(prev => ({
      ...prev,
      isCreating: true,
      selectedPredecessor: predecessorIssue,
    }));
    
    closeContextMenu();
  }, [editorRole, onError, closeContextMenu]);

  const selectSuccessor = useCallback((successorIssue: Issue) => {
    if (!state.selectedPredecessor) return;
    
    // 自分自身を後続タスクに選択した場合
    if (state.selectedPredecessor.id === successorIssue.id) {
      onError?.('タスク自身を依存関係の対象に設定することはできません');
      return;
    }
    
    createDependency(state.selectedPredecessor.id, successorIssue.id);
  }, [state.selectedPredecessor, onError]);

  const cancelCreation = useCallback(() => {
    setState(prev => ({
      ...prev,
      isCreating: false,
      selectedPredecessor: null,
    }));
  }, []);

  // API連携
  const createDependency = useCallback(async (predecessorId: string, successorId: string) => {
    if (!editorRole) {
      onError?.('依存関係の作成にはEditor権限が必要です');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          predecessor_issue_id: predecessorId,
          successor_issue_id: successorId,
          dependency_type: 'finish_to_start',
          lag_days: 0,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        
        // 循環依存エラーの特別処理
        if (response.status === 400 && errorData.message?.includes('circular dependency')) {
          throw new Error('循環依存が発生するため、この依存関係は作成できません');
        }
        
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const dependency: Dependency = await response.json();
      onDependencyCreated?.(dependency);
      
      // 作成完了後、状態をリセット
      setState(prev => ({
        ...prev,
        isCreating: false,
        selectedPredecessor: null,
      }));
      
    } catch (error) {
      console.error('Failed to create dependency:', error);
      onError?.(error instanceof Error ? error.message : '依存関係の作成に失敗しました');
    }
  }, [projectId, editorRole, onDependencyCreated, onError]);

  const deleteDependency = useCallback(async (dependencyId: string) => {
    if (!editorRole) {
      onError?.('依存関係の削除にはEditor権限が必要です');
      return;
    }

    try {
      const response = await fetch(`/api/dependencies/${dependencyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      onDependencyDeleted?.(dependencyId);
      closeContextMenu();
      
    } catch (error) {
      console.error('Failed to delete dependency:', error);
      onError?.(error instanceof Error ? error.message : '依存関係の削除に失敗しました');
    }
  }, [editorRole, onDependencyDeleted, onError, closeContextMenu]);

  // アクション群
  const actions: DependencyManagementActions = {
    startCreation,
    selectSuccessor,
    cancelCreation,
    openTaskContextMenu,
    openDependencyContextMenu,
    closeContextMenu,
    createDependency,
    deleteDependency,
  };

  return {
    state,
    actions,
    isDisabled: !editorRole,
  };
};