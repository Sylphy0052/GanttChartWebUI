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
 * - 境界値: 空配列、単一Issue、深い階層
 * - 異常系: 不正データ、循環参照データ
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
  });

  describe('isValidWBSNumber()', () => {
    it('should return true for valid WBS numbers', () => {
      expect(isValidWBSNumber('1')).toBe(true);
      expect(isValidWBSNumber('1.1')).toBe(true);
      expect(isValidWBSNumber('1.1.1')).toBe(true);
      expect(isValidWBSNumber('10.20.30')).toBe(true);
      expect(isValidWBSNumber('1.1.1.1.1')).toBe(true); // 深い階層
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
    });
  });

  describe('getWBSLevel()', () => {
    it('should return correct level for valid WBS numbers', () => {
      expect(getWBSLevel('1')).toBe(1);
      expect(getWBSLevel('1.1')).toBe(2);
      expect(getWBSLevel('1.1.1')).toBe(3);
      expect(getWBSLevel('10.20.30.40')).toBe(4);
      expect(getWBSLevel('1.1.1.1.1.1')).toBe(6); // 深い階層
    });

    it('should return 0 for invalid WBS numbers', () => {
      expect(getWBSLevel('')).toBe(0);
      expect(getWBSLevel('0')).toBe(0);
      expect(getWBSLevel('1.0')).toBe(0);
      expect(getWBSLevel('invalid')).toBe(0);
      expect(getWBSLevel(null as any)).toBe(0);
      expect(getWBSLevel(undefined as any)).toBe(0);
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
  });
});