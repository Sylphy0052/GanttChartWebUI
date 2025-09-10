'use client';

import React from 'react';
import { Issue } from '../../types/issue';
import { Dependency } from './DependencyLines';
import DependencyContextMenu from './DependencyContextMenu';
import { useDependencyManagement } from '../../hooks/useDependencyManagement';

export interface DependencyEditorProps {
  projectId: string;
  issues: Issue[];
  dependencies: Dependency[];
  onDependencyCreated?: (dependency: Dependency) => void;
  onDependencyDeleted?: (dependencyId: string) => void;
  onError?: (error: string) => void;
  editorRole?: boolean;
  children?: React.ReactNode;
}

/**
 * 依存関係編集UI統合コンポーネント
 * - コンテキストメニュー表示
 * - 依存関係作成・削除フロー管理
 * - 子コンポーネント（ガントチャート）との連携
 */
const DependencyEditor: React.FC<DependencyEditorProps> = ({
  projectId,
  issues,
  dependencies,
  onDependencyCreated,
  onDependencyDeleted,
  onError,
  editorRole = false,
  children,
}) => {
  const { state, actions, isDisabled } = useDependencyManagement({
    projectId,
    onDependencyCreated,
    onDependencyDeleted,
    onError,
    editorRole,
  });

  // 子コンポーネントに渡すハンドラー
  const handleTaskBarRightClick = (issue: Issue, event: React.MouseEvent) => {
    if (isDisabled) return;
    actions.openTaskContextMenu(issue, event);
  };

  const handleDependencyLineRightClick = (dependencyId: string, event: React.MouseEvent) => {
    if (isDisabled) return;
    actions.openDependencyContextMenu(dependencyId, event);
  };

  const handleTaskBarClick = (issue: Issue) => {
    if (state.isCreating && state.selectedPredecessor) {
      actions.selectSuccessor(issue);
    }
  };

  // 依存関係情報の取得
  const getDependencyInfo = (dependencyId: string) => {
    const dependency = dependencies.find(d => d.id === dependencyId);
    if (!dependency) return null;

    const predecessor = issues.find(i => i.id === dependency.predecessor_issue_id);
    const successor = issues.find(i => i.id === dependency.successor_issue_id);

    return {
      dependency,
      predecessor,
      successor,
    };
  };

  return (
    <div className="dependency-editor-container">
      {/* 作成中の状態表示 */}
      {state.isCreating && state.selectedPredecessor && (
        <div className="fixed top-4 right-4 z-40 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-blue-600 mr-2">➡️</span>
              <div>
                <p className="text-sm font-medium text-blue-900">依存関係作成中</p>
                <p className="text-xs text-blue-700">
                  先行: {state.selectedPredecessor.title}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  後続タスクをクリックしてください
                </p>
              </div>
            </div>
            <button
              onClick={actions.cancelCreation}
              className="ml-3 text-blue-400 hover:text-blue-600"
              title="キャンセル"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 子コンポーネント（ガントチャート）にイベントハンドラーを注入 */}
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            onTaskBarRightClick: handleTaskBarRightClick,
            onDependencyLineRightClick: handleDependencyLineRightClick,
            onTaskBarClick: handleTaskBarClick,
            dependencyCreationMode: state.isCreating,
            selectedPredecessor: state.selectedPredecessor,
          });
        }
        return child;
      })}

      {/* コンテキストメニュー */}
      <DependencyContextMenu
        isOpen={state.contextMenu.isOpen}
        position={state.contextMenu.position}
        targetIssue={state.contextMenu.targetIssue}
        dependencyId={state.contextMenu.dependencyId}
        mode={state.contextMenu.mode}
        disabled={isDisabled}
        onClose={actions.closeContextMenu}
        onCreateDependency={(targetIssueId) => {
          if (state.contextMenu.targetIssue) {
            actions.startCreation(state.contextMenu.targetIssue, {} as React.MouseEvent);
          }
        }}
        onDeleteDependency={actions.deleteDependency}
        onSelectPredecessor={(issueId) => {
          const issue = issues.find(i => i.id === issueId);
          if (issue) {
            actions.startCreation(issue, {} as React.MouseEvent);
          }
        }}
      />

      {/* キーボードショートカットのヘルプ */}
      {state.isCreating && (
        <div className="fixed bottom-4 left-4 z-40 bg-gray-800 text-white rounded-lg p-2 text-xs">
          <div>ESC: キャンセル</div>
          <div>クリック: 後続タスク選択</div>
        </div>
      )}
    </div>
  );
};

export default DependencyEditor;