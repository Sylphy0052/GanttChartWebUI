'use client';

import { useState, useCallback } from 'react';
import { Issue } from '@/types/issue';
import { issuesApi, IssueHierarchyChangeDto, ApiError } from '@/api/issues';

export interface HierarchyChangeState {
  isLoading: boolean;
  error: string | null;
}

export interface UseHierarchyChangeReturn {
  state: HierarchyChangeState;
  changeHierarchy: (
    issueId: string,
    newParentId: string | null,
    version: number,
    onSuccess?: (updatedIssue: Issue, affectedIssues: Issue[]) => void
  ) => Promise<void>;
  validateHierarchyChange: (
    sourceIssue: Issue,
    targetParentId: string | null,
    allIssues: Issue[]
  ) => { isValid: boolean; error?: string };
  clearError: () => void;
}

/**
 * Issue階層変更管理フック
 * 循環参照防止、WBS番号更新、エラーハンドリングを含む
 */
export const useHierarchyChange = (): UseHierarchyChangeReturn => {
  const [state, setState] = useState<HierarchyChangeState>({
    isLoading: false,
    error: null,
  });

  /**
   * 循環参照を検出する再帰関数
   */
  const hasCircularReference = useCallback(
    (sourceId: string, targetParentId: string | null, allIssues: Issue[]): boolean => {
      if (!targetParentId || sourceId === targetParentId) {
        return sourceId === targetParentId; // 自分自身を親にする場合は循環参照
      }

      // targetParentIdからルートまでの親チェーンを辿る
      let currentId: string | undefined = targetParentId;
      const visited = new Set<string>();

      while (currentId) {
        // 既に訪問済みの場合は循環参照
        if (visited.has(currentId)) {
          return true;
        }
        
        // sourceIdが親チェーンに含まれる場合は循環参照
        if (currentId === sourceId) {
          return true;
        }

        visited.add(currentId);
        
        // 次の親を探す
        const parent = allIssues.find(issue => issue.id === currentId)?.parent_id;
        currentId = parent || undefined;
      }

      return false;
    },
    []
  );

  /**
   * 階層変更のバリデーション
   */
  const validateHierarchyChange = useCallback(
    (sourceIssue: Issue, targetParentId: string | null, allIssues: Issue[]): { isValid: boolean; error?: string } => {
      // 現在の親と同じ場合は変更不要
      if (sourceIssue.parent_id === targetParentId) {
        return { isValid: false, error: '現在の親と同じです' };
      }

      // 自分自身を親にする場合
      if (sourceIssue.id === targetParentId) {
        return { isValid: false, error: '自分自身を親にすることはできません' };
      }

      // 循環参照チェック
      if (hasCircularReference(sourceIssue.id, targetParentId, allIssues)) {
        return { isValid: false, error: '循環参照が発生するため、この階層変更はできません' };
      }

      // 子Issue（子孫含む）を親にする場合のチェック
      const isDescendant = (issueId: string, ancestorId: string): boolean => {
        const issue = allIssues.find(i => i.id === issueId);
        if (!issue || !issue.parent_id) return false;
        
        if (issue.parent_id === ancestorId) return true;
        return isDescendant(issue.parent_id, ancestorId);
      };

      if (targetParentId && isDescendant(targetParentId, sourceIssue.id)) {
        return { isValid: false, error: '子Issueを親にすることはできません' };
      }

      return { isValid: true };
    },
    [hasCircularReference]
  );

  /**
   * 階層変更を実行
   */
  const changeHierarchy = useCallback(
    async (
      issueId: string,
      newParentId: string | null,
      version: number,
      onSuccess?: (updatedIssue: Issue, affectedIssues: Issue[]) => void
    ): Promise<void> => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const changeDto: IssueHierarchyChangeDto = {
          parent_id: newParentId,
          version,
        };

        const response = await issuesApi.changeHierarchy(issueId, changeDto);
        
        setState(prev => ({ ...prev, isLoading: false }));
        
        // 成功時のコールバック実行
        if (onSuccess) {
          onSuccess(response.updatedIssue, response.affectedIssues);
        }
      } catch (error) {
        const errorMessage = error instanceof ApiError 
          ? error.message
          : error instanceof Error 
          ? error.message 
          : '階層変更に失敗しました';

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        
        throw error;
      }
    },
    []
  );

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    changeHierarchy,
    validateHierarchyChange,
    clearError,
  };
};