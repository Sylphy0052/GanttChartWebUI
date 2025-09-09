import { useState, useCallback, useMemo } from 'react';
import { Issue, WBSTreeNode, WBSTreeState } from '@/types/issue';

/**
 * フラットなIssue配列を階層構造に変換する
 * @param issues フラットなIssue配列
 * @returns 階層構造化されたIssue配列
 */
const buildHierarchy = (issues: Issue[]): Issue[] => {
  // IDでのマップを作成
  const issueMap = new Map<string, Issue>();
  const rootIssues: Issue[] = [];
  
  // 全てのissueをマップに追加し、childrenを初期化
  issues.forEach(issue => {
    issueMap.set(issue.id, {
      ...issue,
      children: []
    });
  });
  
  // 親子関係を構築
  issues.forEach(issue => {
    const currentIssue = issueMap.get(issue.id)!;
    
    if (issue.parent_id) {
      const parent = issueMap.get(issue.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(currentIssue);
        // 子要素をsort_orderでソート
        parent.children.sort((a, b) => a.sort_order - b.sort_order);
      } else {
        // 親が見つからない場合はルートとして扱う
        rootIssues.push(currentIssue);
      }
    } else {
      // 親がいない場合はルート要素
      rootIssues.push(currentIssue);
    }
  });
  
  // ルート要素をsort_orderでソート
  return rootIssues.sort((a, b) => a.sort_order - b.sort_order);
};

/**
 * WBS番号を生成する関数
 * @param issue Issue情報
 * @param issues 全Issue配列
 * @returns WBS番号（1.1.1形式）
 */
const generateWBSNumber = (issue: Issue, issues: Issue[]): string => {
  if (issue.wbs_number) {
    return issue.wbs_number; // バックエンドから提供される場合はそれを使用
  }

  const buildPath = (currentIssue: Issue, allIssues: Issue[]): number[] => {
    const path: number[] = [];
    
    const findSiblingIndex = (issue: Issue): number => {
      const siblings = allIssues.filter(i => i.parent_id === issue.parent_id);
      const sortedSiblings = siblings.sort((a, b) => a.sort_order - b.sort_order);
      return sortedSiblings.findIndex(s => s.id === issue.id) + 1;
    };
    
    const traverse = (issue: Issue): void => {
      const index = findSiblingIndex(issue);
      path.unshift(index);
      
      if (issue.parent_id) {
        const parent = allIssues.find(i => i.id === issue.parent_id);
        if (parent) {
          traverse(parent);
        }
      }
    };
    
    traverse(currentIssue);
    return path;
  };

  const path = buildPath(issue, issues);
  return path.join('.');
};

/**
 * 階層構造をフラット化してWBSTreeNodeに変換
 */
const flattenWithLevels = (
  issues: Issue[],
  allIssues: Issue[],
  level: number = 0,
  expandedNodes: Set<string> = new Set(),
  parentIsVisible: boolean = true
): WBSTreeNode[] => {
  const result: WBSTreeNode[] = [];
  
  issues.forEach((issue) => {
    const hasChildren = issue.children && issue.children.length > 0;
    const isExpanded = expandedNodes.has(issue.id);
    const isVisible = parentIsVisible;
    
    const node: WBSTreeNode = {
      ...issue,
      level,
      isExpanded,
      hasChildren: Boolean(hasChildren),
      isVisible,
      wbs_number: generateWBSNumber(issue, allIssues),
    };
    
    result.push(node);
    
    // 子要素を再帰処理（展開されている場合のみ）
    if (hasChildren && isExpanded && isVisible) {
      const childNodes = flattenWithLevels(
        issue.children!,
        allIssues,
        level + 1,
        expandedNodes,
        true
      );
      result.push(...childNodes);
    }
  });
  
  return result;
};

/**
 * WBSツリー状態管理のカスタムフック
 */
export function useWBSTree(issues: Issue[]) {
  const [treeState, setTreeState] = useState<WBSTreeState>({
    expandedNodes: new Set<string>(),
    visibleNodes: new Set<string>(),
  });

  // フラット配列から階層構造を構築
  const hierarchicalIssues = useMemo(() => {
    return buildHierarchy(issues);
  }, [issues]);

  // 全Issue一覧（親子関係を含む）
  const allIssues = useMemo(() => {
    const flattenAll = (issues: Issue[]): Issue[] => {
      const result: Issue[] = [];
      issues.forEach(issue => {
        result.push(issue);
        if (issue.children && issue.children.length > 0) {
          result.push(...flattenAll(issue.children));
        }
      });
      return result;
    };
    return flattenAll(hierarchicalIssues);
  }, [hierarchicalIssues]);

  // ルートIssue（親のないIssue）のみを取得
  const rootIssues = useMemo(() => {
    return hierarchicalIssues;
  }, [hierarchicalIssues]);

  // フラット化されたWBSツリーノード
  const flattenedNodes = useMemo(() => {
    return flattenWithLevels(rootIssues, allIssues, 0, treeState.expandedNodes);
  }, [rootIssues, allIssues, treeState.expandedNodes]);

  // 表示可能なノードのみをフィルター
  const visibleNodes = useMemo(() => {
    return flattenedNodes.filter(node => node.isVisible);
  }, [flattenedNodes]);

  // ノードの展開/折りたたみ切り替え
  const toggleExpand = useCallback((nodeId: string) => {
    setTreeState(prev => {
      const newExpandedNodes = new Set(prev.expandedNodes);
      if (newExpandedNodes.has(nodeId)) {
        newExpandedNodes.delete(nodeId);
      } else {
        newExpandedNodes.add(nodeId);
      }
      return {
        ...prev,
        expandedNodes: newExpandedNodes,
      };
    });
  }, []);

  // すべて展開
  const expandAll = useCallback(() => {
    const allNodeIds = allIssues
      .filter(issue => issue.children && issue.children.length > 0)
      .map(issue => issue.id);
    
    setTreeState(prev => ({
      ...prev,
      expandedNodes: new Set(allNodeIds),
    }));
  }, [allIssues]);

  // すべて折りたたみ
  const collapseAll = useCallback(() => {
    setTreeState(prev => ({
      ...prev,
      expandedNodes: new Set<string>(),
    }));
  }, []);

  // 特定ノードまでのパスを展開
  const expandToNode = useCallback((nodeId: string) => {
    const node = allIssues.find(issue => issue.id === nodeId);
    if (!node) return;

    const pathIds: string[] = [];
    let current = node;
    
    // 親をたどってパスを構築
    while (current.parent_id) {
      const parent = allIssues.find(issue => issue.id === current.parent_id);
      if (parent) {
        pathIds.push(parent.id);
        current = parent;
      } else {
        break;
      }
    }

    setTreeState(prev => ({
      ...prev,
      expandedNodes: new Set([...prev.expandedNodes, ...pathIds]),
    }));
  }, [allIssues]);

  return {
    // 状態
    treeState,
    allIssues,
    rootIssues,
    flattenedNodes,
    visibleNodes,
    
    // アクション
    toggleExpand,
    expandAll,
    collapseAll,
    expandToNode,
    
    // ユーティリティ
    isExpanded: (nodeId: string) => treeState.expandedNodes.has(nodeId),
    hasExpandableNodes: allIssues.some(issue => issue.children && issue.children.length > 0),
  };
}