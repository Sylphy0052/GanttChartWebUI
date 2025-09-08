import { Issue } from '@prisma/client';

/**
 * WBS（Work Breakdown Structure）番号生成ユーティリティ
 * 
 * 機能:
 * - 階層構造とsort_orderに基づくWBS番号生成（1.1.1形式）
 * - 親子関係の階層レベル計算
 * - sort_order順序での連番割り当て
 * 
 * 仕様:
 * - ルートレベル（parent_id = null）: 1, 2, 3, ...
 * - レベル2（親がルートの子）: 1.1, 1.2, 2.1, 2.2, ...
 * - レベル3（親がレベル2の子）: 1.1.1, 1.1.2, 1.2.1, ...
 * - sort_orderの昇順でWBS番号を割り当て
 */

export interface WBSIssueData {
  id: string;
  parent_id: string | null;
  sort_order: number;
}

export interface WBSNumberResult {
  id: string;
  wbs_number: string;
  level: number;
}

/**
 * プロジェクト内の全IssueにWBS番号を生成する
 * @param issues プロジェクト内のIssue一覧（sort_order昇順ソート済み想定）
 * @returns WBS番号付きIssue結果一覧
 */
export function generateWBSNumbers(issues: WBSIssueData[]): WBSNumberResult[] {
  const results: WBSNumberResult[] = [];
  const hierarchyMap = new Map<string, WBSIssueData>();
  const parentChildrenMap = new Map<string | null, WBSIssueData[]>();
  
  // Issue階層マップの構築
  for (const issue of issues) {
    hierarchyMap.set(issue.id, issue);
    
    const parentId = issue.parent_id;
    if (!parentChildrenMap.has(parentId)) {
      parentChildrenMap.set(parentId, []);
    }
    parentChildrenMap.get(parentId)!.push(issue);
  }
  
  // 各階層でsort_order順にソート
  for (const [parentId, children] of parentChildrenMap) {
    children.sort((a, b) => a.sort_order - b.sort_order);
  }
  
  // ルートレベルから再帰的にWBS番号を生成
  const rootIssues = parentChildrenMap.get(null) || [];
  
  for (let i = 0; i < rootIssues.length; i++) {
    const rootIssue = rootIssues[i];
    const rootNumber = (i + 1).toString();
    
    generateWBSNumbersRecursive(
      rootIssue,
      rootNumber,
      1,
      parentChildrenMap,
      results
    );
  }
  
  return results;
}

/**
 * 再帰的WBS番号生成（内部関数）
 * @param currentIssue 現在のIssue
 * @param currentWBS 現在のWBS番号
 * @param currentLevel 現在の階層レベル（1から開始）
 * @param parentChildrenMap 親子関係マップ
 * @param results 結果格納配列
 */
function generateWBSNumbersRecursive(
  currentIssue: WBSIssueData,
  currentWBS: string,
  currentLevel: number,
  parentChildrenMap: Map<string | null, WBSIssueData[]>,
  results: WBSNumberResult[]
): void {
  // 現在のIssueにWBS番号を割り当て
  results.push({
    id: currentIssue.id,
    wbs_number: currentWBS,
    level: currentLevel,
  });
  
  // 子Issueが存在する場合、再帰的に処理
  const childIssues = parentChildrenMap.get(currentIssue.id) || [];
  
  for (let i = 0; i < childIssues.length; i++) {
    const childIssue = childIssues[i];
    const childWBS = `${currentWBS}.${i + 1}`;
    
    generateWBSNumbersRecursive(
      childIssue,
      childWBS,
      currentLevel + 1,
      parentChildrenMap,
      results
    );
  }
}

/**
 * 特定のIssue一つのWBS番号を計算する（高速版）
 * 
 * 全体を再計算せずに、対象Issueの位置のみを計算
 * 注意: sort_orderが変更された場合は全体再計算が必要
 * 
 * @param targetIssueId 対象IssueID
 * @param issues プロジェクト内のIssue一覧
 * @returns WBS番号、見つからない場合はnull
 */
export function calculateSingleWBSNumber(
  targetIssueId: string,
  issues: WBSIssueData[]
): string | null {
  const hierarchyMap = new Map<string, WBSIssueData>();
  const parentChildrenMap = new Map<string | null, WBSIssueData[]>();
  
  // 階層マップ構築
  for (const issue of issues) {
    hierarchyMap.set(issue.id, issue);
    
    const parentId = issue.parent_id;
    if (!parentChildrenMap.has(parentId)) {
      parentChildrenMap.set(parentId, []);
    }
    parentChildrenMap.get(parentId)!.push(issue);
  }
  
  // 各階層をsort_order順にソート
  for (const [parentId, children] of parentChildrenMap) {
    children.sort((a, b) => a.sort_order - b.sort_order);
  }
  
  const targetIssue = hierarchyMap.get(targetIssueId);
  if (!targetIssue) {
    return null;
  }
  
  // ルートまでの階層パスを逆算
  const hierarchyPath: number[] = [];
  let currentIssue = targetIssue;
  
  while (currentIssue) {
    const siblings = parentChildrenMap.get(currentIssue.parent_id) || [];
    const siblingIndex = siblings.findIndex(sibling => sibling.id === currentIssue.id);
    
    if (siblingIndex === -1) {
      return null; // データ不整合
    }
    
    hierarchyPath.unshift(siblingIndex + 1); // 1ベースで番号付け
    
    // 親Issueを取得
    if (currentIssue.parent_id) {
      currentIssue = hierarchyMap.get(currentIssue.parent_id) || null;
    } else {
      break; // ルートに到達
    }
  }
  
  return hierarchyPath.join('.');
}

/**
 * WBS番号の妥当性をチェック
 * @param wbsNumber チェック対象のWBS番号
 * @returns 妥当な場合はtrue
 */
export function isValidWBSNumber(wbsNumber: string): boolean {
  if (!wbsNumber || typeof wbsNumber !== 'string') {
    return false;
  }
  
  // 正規表現パターン: 1つ以上の数字をドットで繋いだ形式
  const wbsPattern = /^[1-9]\d*(\.[1-9]\d*)*$/;
  return wbsPattern.test(wbsNumber);
}

/**
 * WBS番号から階層レベルを取得
 * @param wbsNumber WBS番号（例: "1.2.3"）
 * @returns 階層レベル（例: 3）、不正な場合は0
 */
export function getWBSLevel(wbsNumber: string): number {
  if (!isValidWBSNumber(wbsNumber)) {
    return 0;
  }
  
  return wbsNumber.split('.').length;
}