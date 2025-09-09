import { 
  generateWBSNumbers, 
  calculateSingleWBSNumber, 
  isValidWBSNumber, 
  getWBSLevel,
  WBSIssueData 
} from './wbs-number.util';

/**
 * WBS番号生成ユーティリティのテスト
 * 
 * テスト対象:
 * - generateWBSNumbers() - 全Issue WBS番号生成
 * - calculateSingleWBSNumber() - 単一Issue WBS番号計算
 * - isValidWBSNumber() - WBS番号妥当性チェック
 * - getWBSLevel() - 階層レベル取得
 * 
 * テストケース:
 * - 正常系: 階層構造・sort_order通りのWBS番号生成
 * - 境界値: 空配列、単一Issue、深い階層、大量データ
 * - 異常系: 不正データ、循環参照データ、極端な値
 * - パフォーマンス: 大量データ処理の性能チェック
 */
describe('WBSNumberUtil', () => {
  
  describe('generateWBSNumbers()', () => {
    it('should generate correct WBS numbers for flat structure', () => {
      const issues: WBSIssueData[] = [
        { id: 'issue-1', parent_id: null, sort_order: 10 },
        { id: 'issue-2', parent_id: null, sort_order: 20 },
        { id: 'issue-3', parent_id: null, sort_order: 30 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(3);
      expect(results.find(r => r.id === 'issue-1')).toEqual({ id: 'issue-1', wbs_number: '1', level: 1 });
      expect(results.find(r => r.id === 'issue-2')).toEqual({ id: 'issue-2', wbs_number: '2', level: 1 });
      expect(results.find(r => r.id === 'issue-3')).toEqual({ id: 'issue-3', wbs_number: '3', level: 1 });
    });

    it('should generate correct WBS numbers for hierarchical structure', () => {
      const issues: WBSIssueData[] = [
        { id: 'root-1', parent_id: null, sort_order: 10 },
        { id: 'root-2', parent_id: null, sort_order: 20 },
        { id: 'child-1-1', parent_id: 'root-1', sort_order: 10 },
        { id: 'child-1-2', parent_id: 'root-1', sort_order: 20 },
        { id: 'child-2-1', parent_id: 'root-2', sort_order: 10 },
        { id: 'grandchild-1-1-1', parent_id: 'child-1-1', sort_order: 10 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(6);
      expect(results.find(r => r.id === 'root-1')).toEqual({ id: 'root-1', wbs_number: '1', level: 1 });
      expect(results.find(r => r.id === 'root-2')).toEqual({ id: 'root-2', wbs_number: '2', level: 1 });
      expect(results.find(r => r.id === 'child-1-1')).toEqual({ id: 'child-1-1', wbs_number: '1.1', level: 2 });
      expect(results.find(r => r.id === 'child-1-2')).toEqual({ id: 'child-1-2', wbs_number: '1.2', level: 2 });
      expect(results.find(r => r.id === 'child-2-1')).toEqual({ id: 'child-2-1', wbs_number: '2.1', level: 2 });
      expect(results.find(r => r.id === 'grandchild-1-1-1')).toEqual({ id: 'grandchild-1-1-1', wbs_number: '1.1.1', level: 3 });
    });

    it('should handle issues with unordered sort_order correctly', () => {
      const issues: WBSIssueData[] = [
        { id: 'issue-1', parent_id: null, sort_order: 50 }, // 後からソート
        { id: 'issue-2', parent_id: null, sort_order: 10 }, // 最初にソート
        { id: 'issue-3', parent_id: null, sort_order: 30 }, // 真ん中にソート
      ];

      const results = generateWBSNumbers(issues);

      // sort_order順にWBS番号が割り当てられているかチェック
      expect(results.find(r => r.id === 'issue-2')).toEqual({ id: 'issue-2', wbs_number: '1', level: 1 }); // sort_order: 10 → WBS: 1
      expect(results.find(r => r.id === 'issue-3')).toEqual({ id: 'issue-3', wbs_number: '2', level: 1 }); // sort_order: 30 → WBS: 2
      expect(results.find(r => r.id === 'issue-1')).toEqual({ id: 'issue-1', wbs_number: '3', level: 1 }); // sort_order: 50 → WBS: 3
    });

    it('should handle empty array', () => {
      const results = generateWBSNumbers([]);
      expect(results).toEqual([]);
    });

    it('should handle single issue', () => {
      const issues: WBSIssueData[] = [
        { id: 'only-one', parent_id: null, sort_order: 10 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ id: 'only-one', wbs_number: '1', level: 1 });
    });

    it('should handle deep hierarchy (5 levels)', () => {
      const issues: WBSIssueData[] = [
        { id: 'level-1', parent_id: null, sort_order: 10 },
        { id: 'level-2', parent_id: 'level-1', sort_order: 10 },
        { id: 'level-3', parent_id: 'level-2', sort_order: 10 },
        { id: 'level-4', parent_id: 'level-3', sort_order: 10 },
        { id: 'level-5', parent_id: 'level-4', sort_order: 10 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(5);
      expect(results.find(r => r.id === 'level-1')).toEqual({ id: 'level-1', wbs_number: '1', level: 1 });
      expect(results.find(r => r.id === 'level-2')).toEqual({ id: 'level-2', wbs_number: '1.1', level: 2 });
      expect(results.find(r => r.id === 'level-3')).toEqual({ id: 'level-3', wbs_number: '1.1.1', level: 3 });
      expect(results.find(r => r.id === 'level-4')).toEqual({ id: 'level-4', wbs_number: '1.1.1.1', level: 4 });
      expect(results.find(r => r.id === 'level-5')).toEqual({ id: 'level-5', wbs_number: '1.1.1.1.1', level: 5 });
    });

    it('should handle extreme hierarchy depth (10 levels)', () => {
      const issues: WBSIssueData[] = [];
      let parentId = null;
      
      for (let level = 1; level <= 10; level++) {
        const issueId = `level-${level}`;
        issues.push({ id: issueId, parent_id: parentId, sort_order: 10 });
        parentId = issueId;
      }

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(10);
      expect(results.find(r => r.id === 'level-1')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'level-5')?.wbs_number).toBe('1.1.1.1.1');
      expect(results.find(r => r.id === 'level-10')?.wbs_number).toBe('1.1.1.1.1.1.1.1.1.1');
      expect(results.find(r => r.id === 'level-10')?.level).toBe(10);
    });

    it('should handle large number of siblings', () => {
      const issues: WBSIssueData[] = [];
      
      // 100個の兄弟Issueを作成
      for (let i = 1; i <= 100; i++) {
        issues.push({ 
          id: `sibling-${i}`, 
          parent_id: null, 
          sort_order: i * 10 
        });
      }

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(100);
      expect(results.find(r => r.id === 'sibling-1')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'sibling-50')?.wbs_number).toBe('50');
      expect(results.find(r => r.id === 'sibling-100')?.wbs_number).toBe('100');
      
      // 全てレベル1であることを確認
      results.forEach(result => {
        expect(result.level).toBe(1);
      });
    });

    it('should handle negative sort_order values', () => {
      const issues: WBSIssueData[] = [
        { id: 'negative', parent_id: null, sort_order: -10 },
        { id: 'zero', parent_id: null, sort_order: 0 },
        { id: 'positive', parent_id: null, sort_order: 10 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results.find(r => r.id === 'negative')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'zero')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'positive')?.wbs_number).toBe('3');
    });

    it('should handle identical sort_order values (stable sort)', () => {
      const issues: WBSIssueData[] = [
        { id: 'first', parent_id: null, sort_order: 10 },
        { id: 'second', parent_id: null, sort_order: 10 },
        { id: 'third', parent_id: null, sort_order: 10 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(3);
      // IDによる安定ソートで順序が決まるはず
      const sortedByWbs = results.sort((a, b) => parseInt(a.wbs_number) - parseInt(b.wbs_number));
      expect(sortedByWbs[0].level).toBe(1);
      expect(sortedByWbs[1].level).toBe(1);
      expect(sortedByWbs[2].level).toBe(1);
    });

    it('should handle orphaned children (parent not found)', () => {
      const issues: WBSIssueData[] = [
        { id: 'root', parent_id: null, sort_order: 10 },
        { id: 'orphan', parent_id: 'non-existent-parent', sort_order: 20 },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(2);
      expect(results.find(r => r.id === 'root')?.wbs_number).toBe('1');
      // 孤立した子は、ルートレベルとして扱われる
      expect(results.find(r => r.id === 'orphan')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'orphan')?.level).toBe(1);
    });

    it('should handle malformed data gracefully', () => {
      const issues: WBSIssueData[] = [
        // 正常なデータ
        { id: 'normal', parent_id: null, sort_order: 10 },
        // 異常なデータ（ただし型定義に従っている）
        { id: '', parent_id: null, sort_order: 20 }, // 空ID
        { id: 'large-sort', parent_id: null, sort_order: Number.MAX_SAFE_INTEGER },
      ];

      const results = generateWBSNumbers(issues);

      expect(results).toHaveLength(3);
      expect(results.find(r => r.id === 'normal')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === '')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'large-sort')?.wbs_number).toBe('3');
    });
  });

  describe('calculateSingleWBSNumber()', () => {
    const issues: WBSIssueData[] = [
      { id: 'root-1', parent_id: null, sort_order: 10 },
      { id: 'root-2', parent_id: null, sort_order: 20 },
      { id: 'child-1-1', parent_id: 'root-1', sort_order: 10 },
      { id: 'child-1-2', parent_id: 'root-1', sort_order: 20 },
      { id: 'grandchild-1-1-1', parent_id: 'child-1-1', sort_order: 10 },
    ];

    it('should calculate correct WBS number for root issue', () => {
      const wbsNumber = calculateSingleWBSNumber('root-1', issues);
      expect(wbsNumber).toBe('1');
    });

    it('should calculate correct WBS number for child issue', () => {
      const wbsNumber = calculateSingleWBSNumber('child-1-2', issues);
      expect(wbsNumber).toBe('1.2');
    });

    it('should calculate correct WBS number for grandchild issue', () => {
      const wbsNumber = calculateSingleWBSNumber('grandchild-1-1-1', issues);
      expect(wbsNumber).toBe('1.1.1');
    });

    it('should return null for non-existent issue', () => {
      const wbsNumber = calculateSingleWBSNumber('non-existent', issues);
      expect(wbsNumber).toBeNull();
    });

    it('should handle empty issues array', () => {
      const wbsNumber = calculateSingleWBSNumber('any-id', []);
      expect(wbsNumber).toBeNull();
    });

    it('should handle single issue array', () => {
      const singleIssue = [{ id: 'only-one', parent_id: null, sort_order: 10 }];
      const wbsNumber = calculateSingleWBSNumber('only-one', singleIssue);
      expect(wbsNumber).toBe('1');
    });

    it('should handle complex hierarchy with multiple calculations', () => {
      const complexIssues: WBSIssueData[] = [
        { id: 'A', parent_id: null, sort_order: 100 },
        { id: 'B', parent_id: null, sort_order: 200 },
        { id: 'C', parent_id: null, sort_order: 300 },
        { id: 'A1', parent_id: 'A', sort_order: 110 },
        { id: 'A2', parent_id: 'A', sort_order: 120 },
        { id: 'B1', parent_id: 'B', sort_order: 210 },
        { id: 'A1a', parent_id: 'A1', sort_order: 111 },
        { id: 'A1b', parent_id: 'A1', sort_order: 112 },
      ];

      expect(calculateSingleWBSNumber('A', complexIssues)).toBe('1');
      expect(calculateSingleWBSNumber('B', complexIssues)).toBe('2');
      expect(calculateSingleWBSNumber('C', complexIssues)).toBe('3');
      expect(calculateSingleWBSNumber('A1', complexIssues)).toBe('1.1');
      expect(calculateSingleWBSNumber('A2', complexIssues)).toBe('1.2');
      expect(calculateSingleWBSNumber('B1', complexIssues)).toBe('2.1');
      expect(calculateSingleWBSNumber('A1a', complexIssues)).toBe('1.1.1');
      expect(calculateSingleWBSNumber('A1b', complexIssues)).toBe('1.1.2');
    });
  });

  describe('isValidWBSNumber()', () => {
    it('should return true for valid WBS numbers', () => {
      expect(isValidWBSNumber('1')).toBe(true);
      expect(isValidWBSNumber('1.1')).toBe(true);
      expect(isValidWBSNumber('1.1.1')).toBe(true);
      expect(isValidWBSNumber('10.20.30')).toBe(true);
      expect(isValidWBSNumber('1.1.1.1.1')).toBe(true); // 深い階層
      expect(isValidWBSNumber('999.888.777')).toBe(true); // 大きい数値
      expect(isValidWBSNumber('1.2.3.4.5.6.7.8.9.10')).toBe(true); // 非常に深い階層
    });

    it('should return false for invalid WBS numbers', () => {
      expect(isValidWBSNumber('')).toBe(false);
      expect(isValidWBSNumber('0')).toBe(false); // 0から始まる
      expect(isValidWBSNumber('1.0')).toBe(false); // 0を含む
      expect(isValidWBSNumber('1.')).toBe(false); // 末尾にドット
      expect(isValidWBSNumber('.1')).toBe(false); // 先頭にドット
      expect(isValidWBSNumber('1..1')).toBe(false); // 連続ドット
      expect(isValidWBSNumber('a.1')).toBe(false); // 数字以外
      expect(isValidWBSNumber('1.b')).toBe(false); // 数字以外
      expect(isValidWBSNumber('1-1')).toBe(false); // ハイフン区切り
      expect(isValidWBSNumber(null as any)).toBe(false); // null
      expect(isValidWBSNumber(undefined as any)).toBe(false); // undefined
      expect(isValidWBSNumber(123 as any)).toBe(false); // 数値型
      expect(isValidWBSNumber(' 1.1 ')).toBe(false); // 前後に空白
      expect(isValidWBSNumber('1. 1')).toBe(false); // 中間に空白
      expect(isValidWBSNumber('01.1')).toBe(false); // ゼロ埋め
      expect(isValidWBSNumber('1.01')).toBe(false); // ゼロ埋め
    });

    it('should handle edge cases and malformed input', () => {
      expect(isValidWBSNumber('1.2.3.')).toBe(false); // 末尾ドット
      expect(isValidWBSNumber('.1.2.3')).toBe(false); // 先頭ドット
      expect(isValidWBSNumber('1...2')).toBe(false); // 複数ドット
      expect(isValidWBSNumber('1.2.3.4.5.6.7.8.9.10.11.12')).toBe(true); // 極端に深い階層（有効）
      expect(isValidWBSNumber('-1')).toBe(false); // 負の数
      expect(isValidWBSNumber('1.-2')).toBe(false); // 負の数を含む
      expect(isValidWBSNumber('1.2.3e10')).toBe(false); // 科学記法
      expect(isValidWBSNumber('1.2.Infinity')).toBe(false); // 無限大
    });
  });

  describe('getWBSLevel()', () => {
    it('should return correct level for valid WBS numbers', () => {
      expect(getWBSLevel('1')).toBe(1);
      expect(getWBSLevel('1.1')).toBe(2);
      expect(getWBSLevel('1.1.1')).toBe(3);
      expect(getWBSLevel('10.20.30.40')).toBe(4);
      expect(getWBSLevel('1.1.1.1.1.1')).toBe(6); // 深い階層
      expect(getWBSLevel('999.888.777.666.555.444.333.222.111')).toBe(9); // 非常に深い階層
    });

    it('should return 0 for invalid WBS numbers', () => {
      expect(getWBSLevel('')).toBe(0);
      expect(getWBSLevel('0')).toBe(0);
      expect(getWBSLevel('1.0')).toBe(0);
      expect(getWBSLevel('invalid')).toBe(0);
      expect(getWBSLevel(null as any)).toBe(0);
      expect(getWBSLevel(undefined as any)).toBe(0);
      expect(getWBSLevel('1.')).toBe(0);
      expect(getWBSLevel('.1')).toBe(0);
      expect(getWBSLevel('1..1')).toBe(0);
    });

    it('should handle edge cases for level calculation', () => {
      expect(getWBSLevel('1.2.3.4.5.6.7.8.9.10.11.12.13.14.15')).toBe(15);
      expect(getWBSLevel('999')).toBe(1);
      expect(getWBSLevel('1.999')).toBe(2);
      expect(getWBSLevel(' 1.1 ')).toBe(0); // 空白は無効
    });
  });

  describe('Complex scenarios', () => {
    it('should handle mixed hierarchy with multiple siblings correctly', () => {
      const issues: WBSIssueData[] = [
        // ルートレベル 3つ
        { id: 'project-a', parent_id: null, sort_order: 100 },
        { id: 'project-b', parent_id: null, sort_order: 200 },
        { id: 'project-c', parent_id: null, sort_order: 300 },
        
        // project-a の子（2つ）
        { id: 'task-a1', parent_id: 'project-a', sort_order: 110 },
        { id: 'task-a2', parent_id: 'project-a', sort_order: 120 },
        
        // project-b の子（3つ）
        { id: 'task-b1', parent_id: 'project-b', sort_order: 210 },
        { id: 'task-b2', parent_id: 'project-b', sort_order: 220 },
        { id: 'task-b3', parent_id: 'project-b', sort_order: 230 },
        
        // task-a1 の子（1つ）
        { id: 'subtask-a1-1', parent_id: 'task-a1', sort_order: 111 },
        
        // task-b2 の子（2つ）
        { id: 'subtask-b2-1', parent_id: 'task-b2', sort_order: 221 },
        { id: 'subtask-b2-2', parent_id: 'task-b2', sort_order: 222 },
      ];

      const results = generateWBSNumbers(issues);

      // 検証：ルートレベル
      expect(results.find(r => r.id === 'project-a')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'project-b')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'project-c')?.wbs_number).toBe('3');

      // 検証：レベル2
      expect(results.find(r => r.id === 'task-a1')?.wbs_number).toBe('1.1');
      expect(results.find(r => r.id === 'task-a2')?.wbs_number).toBe('1.2');
      expect(results.find(r => r.id === 'task-b1')?.wbs_number).toBe('2.1');
      expect(results.find(r => r.id === 'task-b2')?.wbs_number).toBe('2.2');
      expect(results.find(r => r.id === 'task-b3')?.wbs_number).toBe('2.3');

      // 検証：レベル3
      expect(results.find(r => r.id === 'subtask-a1-1')?.wbs_number).toBe('1.1.1');
      expect(results.find(r => r.id === 'subtask-b2-1')?.wbs_number).toBe('2.2.1');
      expect(results.find(r => r.id === 'subtask-b2-2')?.wbs_number).toBe('2.2.2');
    });

    it('should handle real-world project structure', () => {
      const issues: WBSIssueData[] = [
        // プロジェクトフェーズ
        { id: 'phase-1', parent_id: null, sort_order: 1000 },
        { id: 'phase-2', parent_id: null, sort_order: 2000 },
        { id: 'phase-3', parent_id: null, sort_order: 3000 },
        
        // Phase 1 のタスク
        { id: 'requirements', parent_id: 'phase-1', sort_order: 1100 },
        { id: 'design', parent_id: 'phase-1', sort_order: 1200 },
        
        // Requirements のサブタスク
        { id: 'req-gathering', parent_id: 'requirements', sort_order: 1110 },
        { id: 'req-analysis', parent_id: 'requirements', sort_order: 1120 },
        { id: 'req-approval', parent_id: 'requirements', sort_order: 1130 },
        
        // Design のサブタスク
        { id: 'ui-design', parent_id: 'design', sort_order: 1210 },
        { id: 'api-design', parent_id: 'design', sort_order: 1220 },
        
        // Phase 2 のタスク
        { id: 'development', parent_id: 'phase-2', sort_order: 2100 },
        { id: 'testing', parent_id: 'phase-2', sort_order: 2200 },
        
        // Development のサブタスク
        { id: 'backend-dev', parent_id: 'development', sort_order: 2110 },
        { id: 'frontend-dev', parent_id: 'development', sort_order: 2120 },
        
        // Phase 3 のタスク
        { id: 'deployment', parent_id: 'phase-3', sort_order: 3100 },
      ];

      const results = generateWBSNumbers(issues);

      // フェーズレベル
      expect(results.find(r => r.id === 'phase-1')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'phase-2')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'phase-3')?.wbs_number).toBe('3');

      // Phase 1 タスク
      expect(results.find(r => r.id === 'requirements')?.wbs_number).toBe('1.1');
      expect(results.find(r => r.id === 'design')?.wbs_number).toBe('1.2');

      // Requirements サブタスク
      expect(results.find(r => r.id === 'req-gathering')?.wbs_number).toBe('1.1.1');
      expect(results.find(r => r.id === 'req-analysis')?.wbs_number).toBe('1.1.2');
      expect(results.find(r => r.id === 'req-approval')?.wbs_number).toBe('1.1.3');

      // Design サブタスク
      expect(results.find(r => r.id === 'ui-design')?.wbs_number).toBe('1.2.1');
      expect(results.find(r => r.id === 'api-design')?.wbs_number).toBe('1.2.2');

      // Phase 2 タスク
      expect(results.find(r => r.id === 'development')?.wbs_number).toBe('2.1');
      expect(results.find(r => r.id === 'testing')?.wbs_number).toBe('2.2');

      // Development サブタスク
      expect(results.find(r => r.id === 'backend-dev')?.wbs_number).toBe('2.1.1');
      expect(results.find(r => r.id === 'frontend-dev')?.wbs_number).toBe('2.1.2');

      // Phase 3 タスク
      expect(results.find(r => r.id === 'deployment')?.wbs_number).toBe('3.1');
    });
  });

  describe('Performance and scalability tests', () => {
    it('should handle large datasets efficiently', () => {
      const largeIssueSet: WBSIssueData[] = [];
      
      // 1000個のルートレベルIssueを作成
      for (let i = 1; i <= 1000; i++) {
        largeIssueSet.push({
          id: `root-${i}`,
          parent_id: null,
          sort_order: i * 10,
        });
      }

      const startTime = performance.now();
      const results = generateWBSNumbers(largeIssueSet);
      const endTime = performance.now();

      expect(results).toHaveLength(1000);
      expect(results[0].wbs_number).toBe('1');
      expect(results[999].wbs_number).toBe('1000');
      
      // パフォーマンステスト（1秒以内に完了すべき）
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle deeply nested hierarchy efficiently', () => {
      const deepIssues: WBSIssueData[] = [];
      let parentId = null;
      
      // 50レベルの深い階層を作成
      for (let level = 1; level <= 50; level++) {
        const issueId = `deep-${level}`;
        deepIssues.push({ id: issueId, parent_id: parentId, sort_order: 10 });
        parentId = issueId;
      }

      const startTime = performance.now();
      const results = generateWBSNumbers(deepIssues);
      const endTime = performance.now();

      expect(results).toHaveLength(50);
      expect(results.find(r => r.id === 'deep-1')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'deep-1')?.level).toBe(1);
      expect(results.find(r => r.id === 'deep-50')?.level).toBe(50);
      
      // 深い階層でもパフォーマンスが劣化しないことを確認
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle mixed large and deep structure', () => {
      const mixedIssues: WBSIssueData[] = [];
      
      // 100個のルートIssue
      for (let i = 1; i <= 100; i++) {
        mixedIssues.push({
          id: `root-${i}`,
          parent_id: null,
          sort_order: i * 100,
        });
        
        // 各ルートIssueに10個の子Issue
        for (let j = 1; j <= 10; j++) {
          mixedIssues.push({
            id: `child-${i}-${j}`,
            parent_id: `root-${i}`,
            sort_order: i * 100 + j,
          });
        }
      }

      const startTime = performance.now();
      const results = generateWBSNumbers(mixedIssues);
      const endTime = performance.now();

      expect(results).toHaveLength(1100); // 100 roots + 1000 children
      expect(results.find(r => r.id === 'root-1')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'child-1-1')?.wbs_number).toBe('1.1');
      expect(results.find(r => r.id === 'child-1-10')?.wbs_number).toBe('1.10');
      expect(results.find(r => r.id === 'root-100')?.wbs_number).toBe('100');
      
      // 混合構造でもパフォーマンスが劣化しないことを確認
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('Data integrity tests', () => {
    it('should maintain consistency across multiple operations', () => {
      let issues: WBSIssueData[] = [
        { id: 'A', parent_id: null, sort_order: 10 },
        { id: 'B', parent_id: null, sort_order: 20 },
        { id: 'A1', parent_id: 'A', sort_order: 11 },
      ];

      // 初期WBS番号
      let results = generateWBSNumbers(issues);
      expect(results.find(r => r.id === 'A')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'B')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'A1')?.wbs_number).toBe('1.1');

      // Issue追加
      issues.push({ id: 'A2', parent_id: 'A', sort_order: 12 });
      results = generateWBSNumbers(issues);
      expect(results.find(r => r.id === 'A2')?.wbs_number).toBe('1.2');

      // 順序変更
      issues.find(i => i.id === 'B').sort_order = 5; // Bを最初に移動
      results = generateWBSNumbers(issues);
      expect(results.find(r => r.id === 'B')?.wbs_number).toBe('1');
      expect(results.find(r => r.id === 'A')?.wbs_number).toBe('2');
      expect(results.find(r => r.id === 'A1')?.wbs_number).toBe('2.1');
      expect(results.find(r => r.id === 'A2')?.wbs_number).toBe('2.2');
    });

    it('should handle circular reference detection gracefully', () => {
      // 循環参照のあるデータ（実際のシステムでは検出されるべきだが、ユーティリティとしては処理する）
      const circularIssues: WBSIssueData[] = [
        { id: 'A', parent_id: 'B', sort_order: 10 }, // A -> B
        { id: 'B', parent_id: 'A', sort_order: 20 }, // B -> A (循環)
        { id: 'C', parent_id: null, sort_order: 30 },
      ];

      const results = generateWBSNumbers(circularIssues);
      
      // 循環参照があっても処理が完了することを確認
      expect(results).toHaveLength(3);
      // 循環参照のあるIssueはルートレベルとして扱われる可能性がある
      expect(results.find(r => r.id === 'C')?.wbs_number).toBe('1');
    });
  });
});