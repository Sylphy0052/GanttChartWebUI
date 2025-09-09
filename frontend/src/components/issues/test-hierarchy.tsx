'use client';

// 階層変更機能テスト用コンポーネント
import React from 'react';
import { Issue } from '@/types/issue';
import ParentIssueSelector from './ParentIssueSelector';
import { useHierarchyChange } from '@/hooks/useHierarchyChange';

// テスト用のサンプルデータ
const mockIssues: Issue[] = [
  {
    id: '1',
    project_id: 'project-1',
    title: '親Issue 1',
    description_md: 'ルートレベルのIssue',
    assignee: '田中',
    status: 'in_progress',
    progress_pct: 50,
    is_blocked: false,
    sort_order: 1000,
    labels: ['重要'],
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    wbs_number: '1',
  },
  {
    id: '2',
    project_id: 'project-1',
    parent_id: '1',
    title: '子Issue 1-1',
    description_md: 'Issue 1の子',
    assignee: '佐藤',
    status: 'open',
    progress_pct: 0,
    is_blocked: false,
    sort_order: 1000,
    labels: [],
    version: 1,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    wbs_number: '1.1',
  },
  {
    id: '3',
    project_id: 'project-1',
    title: '親Issue 2',
    description_md: 'もう一つのルートレベルIssue',
    assignee: '鈴木',
    status: 'done',
    progress_pct: 100,
    is_blocked: false,
    sort_order: 2000,
    labels: [],
    version: 1,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    wbs_number: '2',
  },
  {
    id: '4',
    project_id: 'project-1',
    parent_id: '2',
    title: '孫Issue 1-1-1',
    description_md: 'Issue 2の孫',
    assignee: '高橋',
    status: 'blocked',
    progress_pct: 25,
    is_blocked: true,
    sort_order: 1000,
    labels: ['緊急'],
    version: 1,
    created_at: '2024-01-04T00:00:00Z',
    updated_at: '2024-01-04T00:00:00Z',
    wbs_number: '1.1.1',
  }
];

const HierarchyChangeTestComponent: React.FC = () => {
  const [currentIssue, setCurrentIssue] = React.useState(mockIssues[3]); // 孫Issue
  const { state, validateHierarchyChange } = useHierarchyChange();
  
  const handleParentChange = (parentId: string | null) => {
    console.log('階層変更:', { from: currentIssue.parent_id, to: parentId });
    
    // バリデーションテスト
    const validation = validateHierarchyChange(currentIssue, parentId, mockIssues);
    console.log('バリデーション結果:', validation);
    
    if (validation.isValid) {
      // 実際のAPI呼び出しではなく、ローカル状態を更新
      setCurrentIssue(prev => ({ ...prev, parent_id: parentId }));
      alert(`階層変更成功: ${parentId ? `親ID ${parentId}` : 'ルートレベル'}`);
    } else {
      alert(`階層変更失敗: ${validation.error}`);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">階層変更機能テスト</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">現在のIssue</h2>
        <div className="bg-gray-50 p-4 rounded">
          <p><strong>ID:</strong> {currentIssue.id}</p>
          <p><strong>タイトル:</strong> {currentIssue.title}</p>
          <p><strong>WBS番号:</strong> {currentIssue.wbs_number}</p>
          <p><strong>現在の親ID:</strong> {currentIssue.parent_id || 'なし（ルートレベル）'}</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">親Issue変更</h2>
        <ParentIssueSelector
          currentIssue={currentIssue}
          allIssues={mockIssues}
          onParentChange={handleParentChange}
          isLoading={state.isLoading}
        />
        
        {state.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700">エラー: {state.error}</p>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">テストケース</h2>
        <div className="space-y-2 text-sm">
          <p><strong>正常ケース:</strong></p>
          <ul className="list-disc ml-6 space-y-1">
            <li>孫Issue(1.1.1) → 親Issue 2(ID:3) への移動</li>
            <li>孫Issue(1.1.1) → ルートレベルへの移動</li>
          </ul>
          
          <p className="mt-4"><strong>エラーケース:</strong></p>
          <ul className="list-disc ml-6 space-y-1">
            <li>孫Issue(1.1.1) → 子Issue 1-1(ID:2) への移動（循環参照）</li>
            <li>孫Issue(1.1.1) → 自分自身(ID:4) への移動</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Mock Issues構造</h2>
        <div className="text-sm font-mono">
          <div>1. 親Issue 1 (WBS: 1)</div>
          <div className="ml-4">└ 2. 子Issue 1-1 (WBS: 1.1)</div>
          <div className="ml-8">└ 4. 孫Issue 1-1-1 (WBS: 1.1.1) ← 現在選択中</div>
          <div>3. 親Issue 2 (WBS: 2)</div>
        </div>
      </div>
    </div>
  );
};

export default HierarchyChangeTestComponent;