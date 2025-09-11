/**
 * 大量データセット生成器
 * 性能テスト用の1000+ Issues、Dependencies、Commentsを生成
 */

import { PrismaService } from '../../src/database/prisma.service';

export interface LargeDatasetConfig {
  totalIssues: number;
  maxDepth: number;
  maxChildrenPerLevel: number;
  dependencyCount: number;
  commentCount: number;
  imageCount: number;
}

export interface LargeDatasetStats {
  issuesCreated: number;
  dependenciesCreated: number;
  commentsCreated: number;
  imagesCreated: number;
  totalExecutionTime: number;
  memoryUsagePeak: number;
}

export interface HierarchyLevel {
  level: number;
  count: number;
  parentIds?: string[];
}

/**
 * 大量データセット生成器クラス
 */
export class LargeDatasetGenerator {
  private prisma: PrismaService;
  private projectId: string;
  private config: LargeDatasetConfig;
  private createdIssueIds: string[] = [];
  private hierarchyMap: Map<number, string[]> = new Map();

  constructor(prisma: PrismaService, projectId: string, config: LargeDatasetConfig) {
    this.prisma = prisma;
    this.projectId = projectId;
    this.config = config;
  }

  /**
   * 大量データセット生成のメインメソッド
   */
  async generateLargeDataset(): Promise<LargeDatasetStats> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;
    
    console.log(`🚀 大量データセット生成開始 (${this.config.totalIssues} Issues)`);

    try {
      // 1. 階層構造でIssueを生成
      await this.generateHierarchicalIssues();
      
      // 2. 依存関係を生成
      await this.generateDependencies();
      
      // 3. コメントを生成
      await this.generateComments();
      
      // 4. 画像パスを生成
      await this.generateImagePaths();
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      
      const stats: LargeDatasetStats = {
        issuesCreated: this.createdIssueIds.length,
        dependenciesCreated: this.config.dependencyCount,
        commentsCreated: this.config.commentCount,
        imagesCreated: this.config.imageCount,
        totalExecutionTime: endTime - startTime,
        memoryUsagePeak: Math.max(finalMemory - initialMemory, 0),
      };

      console.log(`✅ 大量データセット生成完了: ${JSON.stringify(stats, null, 2)}`);
      return stats;

    } catch (error) {
      console.error('❌ 大量データセット生成に失敗:', error);
      throw error;
    }
  }

  /**
   * 階層構造でIssueを生成
   */
  private async generateHierarchicalIssues(): Promise<void> {
    console.log('📊 階層構造Issues生成開始...');
    
    const hierarchyPlan = this.calculateHierarchyDistribution();
    
    for (const level of hierarchyPlan) {
      await this.generateIssuesForLevel(level);
      
      // メモリ使用量チェック
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 800 * 1024 * 1024) { // 800MB
        console.warn('⚠️ メモリ使用量が800MBを超過しました');
        // ガベージコレクション強制実行
        if (global.gc) {
          global.gc();
        }
      }
    }
  }

  /**
   * 階層分散計算
   */
  private calculateHierarchyDistribution(): HierarchyLevel[] {
    const levels: HierarchyLevel[] = [];
    const { totalIssues, maxDepth } = this.config;
    
    // 階層別分散（上位レベルほど少なく、下位レベルほど多く）
    const distribution = [
      { level: 1, ratio: 0.01 },  // 1% (10件)
      { level: 2, ratio: 0.05 },  // 5% (50件)
      { level: 3, ratio: 0.20 },  // 20% (200件)
      { level: 4, ratio: 0.50 },  // 50% (500件)
      { level: 5, ratio: 0.24 },  // 24% (240件)
    ];

    for (const dist of distribution.slice(0, maxDepth)) {
      levels.push({
        level: dist.level,
        count: Math.floor(totalIssues * dist.ratio),
      });
    }

    return levels;
  }

  /**
   * レベル別Issue生成
   */
  private async generateIssuesForLevel(levelConfig: HierarchyLevel): Promise<void> {
    const { level, count } = levelConfig;
    const parentIds = level === 1 ? [] : this.hierarchyMap.get(level - 1) || [];
    
    console.log(`  📝 レベル${level}: ${count}件のIssues生成中...`);
    
    const batchSize = 100;
    const levelIssueIds: string[] = [];
    
    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const batch = await this.createIssueBatch(level, batchCount, parentIds);
      
      levelIssueIds.push(...batch.map(issue => issue.id));
      this.createdIssueIds.push(...batch.map(issue => issue.id));
    }
    
    this.hierarchyMap.set(level, levelIssueIds);
    console.log(`    ✅ レベル${level}完了: ${levelIssueIds.length}件`);
  }

  /**
   * Issueバッチ作成
   */
  private async createIssueBatch(level: number, count: number, parentIds: string[]): Promise<any[]> {
    const issues = [];
    
    for (let i = 0; i < count; i++) {
      const parentId = parentIds.length > 0 ? 
        parentIds[Math.floor(Math.random() * parentIds.length)] : null;
      
      const issue = {
        project: { connect: { id: this.projectId } },
        title: `Level${level}-Issue-${i + 1}`,
        description_md: this.generateIssueDescription(level, i),
        status: this.randomStatus(),
        type: this.randomType(),
        progress_pct: Math.floor(Math.random() * 101),
        start_date: this.generateRandomDate(),
        end_date: this.generateRandomEndDate(),
        assignee: this.randomAssignee(),
        effort_hours: Math.floor(Math.random() * 40) + 1,
        labels: this.randomLabels(),
        sort_order: i,
        ...(parentId && { parent: { connect: { id: parentId } } }),
      };
      
      issues.push(issue);
    }
    
    // バッチでDB挿入（トランザクション使用）
    return await this.prisma.$transaction(
      issues.map(issueData => this.prisma.issue.create({ data: issueData }))
    );
  }

  /**
   * 依存関係生成
   */
  private async generateDependencies(): Promise<void> {
    console.log(`🔗 依存関係生成開始: ${this.config.dependencyCount}件`);
    
    const dependencies = [];
    const usedPairs = new Set<string>();
    
    for (let i = 0; i < this.config.dependencyCount; i++) {
      let predecessorId: string;
      let successorId: string;
      let pairKey: string;
      
      // 重複しない依存関係ペアを生成
      do {
        predecessorId = this.createdIssueIds[Math.floor(Math.random() * this.createdIssueIds.length)];
        successorId = this.createdIssueIds[Math.floor(Math.random() * this.createdIssueIds.length)];
        pairKey = `${predecessorId}-${successorId}`;
      } while (predecessorId === successorId || usedPairs.has(pairKey));
      
      usedPairs.add(pairKey);
      
      dependencies.push({
        project_id: this.projectId,
        predecessor_issue_id: predecessorId,
        successor_issue_id: successorId,
        type: 'FS' as const,
      });
    }
    
    // バッチで依存関係を作成
    const batchSize = 50;
    for (let i = 0; i < dependencies.length; i += batchSize) {
      const batch = dependencies.slice(i, i + batchSize);
      await this.prisma.$transaction(
        batch.map(depData => this.prisma.dependency.create({ data: depData }))
      );
    }
    
    console.log(`  ✅ 依存関係生成完了: ${dependencies.length}件`);
  }

  /**
   * コメント生成
   */
  private async generateComments(): Promise<void> {
    console.log(`💬 コメント生成開始: ${this.config.commentCount}件`);
    
    const comments = [];
    const commentsPerIssue = Math.ceil(this.config.commentCount / this.createdIssueIds.length);
    
    for (const issueId of this.createdIssueIds) {
      const commentCount = Math.min(commentsPerIssue, 
        Math.floor(Math.random() * 5) + 1); // 1-5件のコメント
      
      for (let i = 0; i < commentCount && comments.length < this.config.commentCount; i++) {
        comments.push({
          issue: { connect: { id: issueId } },
          author: `user${Math.floor(Math.random() * 10) + 1}`,
          body_md: this.generateCommentText(i),
        });
      }
    }
    
    // バッチでコメントを作成
    const batchSize = 100;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      await this.prisma.$transaction(
        batch.map(commentData => this.prisma.comment.create({ data: commentData }))
      );
    }
    
    console.log(`  ✅ コメント生成完了: ${comments.length}件`);
  }

  /**
   * 画像パス生成
   */
  private async generateImagePaths(): Promise<void> {
    console.log(`🖼️ 画像パス生成開始: ${this.config.imageCount}件`);
    
    const imagePaths = [];
    
    for (let i = 0; i < this.config.imageCount; i++) {
      const issueId = this.createdIssueIds[Math.floor(Math.random() * this.createdIssueIds.length)];
      
      imagePaths.push({
        issue: { connect: { id: issueId } },
        path: `test-image-${i + 1}.png`,
      });
    }
    
    // バッチで画像パスを作成
    const batchSize = 100;
    for (let i = 0; i < imagePaths.length; i += batchSize) {
      const batch = imagePaths.slice(i, i + batchSize);
      await this.prisma.$transaction(
        batch.map(imageData => this.prisma.imagePath.create({ data: imageData }))
      );
    }
    
    console.log(`  ✅ 画像パス生成完了: ${imagePaths.length}件`);
  }

  // ヘルパーメソッド群

  private generateIssueDescription(level: number, index: number): string {
    const descriptions = [
      `レベル${level}の Issue ${index + 1} です。この Issue は性能テスト用に生成されたものです。`,
      `階層構造テスト用の Issue です。レベル: ${level}、インデックス: ${index + 1}`,
      `大量データセットの一部として生成された Issue です。詳細なタスク内容が記載されます。`,
      `プロジェクト管理システムの性能検証用 Issue。複数の子タスクを持つ可能性があります。`,
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private randomStatus(): 'open' | 'in_progress' | 'done' | 'blocked' {
    const statuses = ['open', 'in_progress', 'done', 'blocked'] as const;
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private randomType(): 'Task' | 'Milestone' {
    const types = ['Task', 'Milestone'] as const;
    // 90% Task, 10% Milestone
    return Math.random() < 0.9 ? 'Task' : 'Milestone';
  }

  private generateRandomDate(): Date {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  private generateRandomEndDate(): Date {
    const start = new Date('2024-06-01');
    const end = new Date('2025-06-30');
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  private randomAssignee(): string | null {
    const assignees = [null, 'user1', 'user2', 'user3', 'user4', 'user5'];
    return assignees[Math.floor(Math.random() * assignees.length)];
  }

  private randomLabels(): string[] {
    const allLabels = ['frontend', 'backend', 'database', 'api', 'ui', 'test', 'bug', 'feature'];
    const labelCount = Math.floor(Math.random() * 3);
    const selectedLabels: string[] = [];
    
    for (let i = 0; i < labelCount; i++) {
      const label = allLabels[Math.floor(Math.random() * allLabels.length)];
      if (!selectedLabels.includes(label)) {
        selectedLabels.push(label);
      }
    }
    
    return selectedLabels;
  }

  private generateCommentText(index: number): string {
    const comments = [
      `コメント ${index + 1}: この Issue の進捗について報告します。`,
      `レビュー結果: 実装内容を確認しました。問題ありません。`,
      `質問: この Issue の依存関係について教えてください。`,
      `更新: 作業内容を更新しました。次のステップに進みます。`,
      `確認: テスト結果は良好です。リリース準備を開始します。`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }

  /**
   * 生成されたデータの統計を取得
   */
  async getDatasetStatistics(): Promise<any> {
    const issueCount = await this.prisma.issue.count({
      where: { project_id: this.projectId, is_deleted: false }
    });
    
    const dependencyCount = await this.prisma.dependency.count({
      where: { project_id: this.projectId }
    });
    
    const commentCount = await this.prisma.comment.count({
      where: {
        issue: {
          project_id: this.projectId
        }
      }
    });
    
    const imageCount = await this.prisma.imagePath.count({
      where: {
        issue: {
          project_id: this.projectId
        }
      }
    });
    
    // 階層別統計
    const hierarchyStats = [];
    for (let level = 1; level <= this.config.maxDepth; level++) {
      const levelCount = await this.prisma.issue.count({
        where: {
          project_id: this.projectId,
          is_deleted: false,
          // 階層レベルの判定（簡易版）
          ...(level === 1 && { parent_id: null }),
          ...(level > 1 && { parent_id: { not: null } }),
        }
      });
      
      hierarchyStats.push({ level, count: levelCount });
    }
    
    return {
      totalIssues: issueCount,
      totalDependencies: dependencyCount,
      totalComments: commentCount,
      totalImages: imageCount,
      hierarchyDistribution: hierarchyStats,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * 大量データの削除（クリーンアップ）
   */
  async cleanupLargeDataset(): Promise<void> {
    console.log('🧹 大量データセットクリーンアップ開始...');
    
    try {
      // トランザクションで一括削除（削除順序を考慮）
      await this.prisma.$transaction([
        // 1. 画像パスを削除
        this.prisma.imagePath.deleteMany({
          where: {
            issue: {
              project_id: this.projectId
            }
          }
        }),
        // 2. コメントを削除
        this.prisma.comment.deleteMany({
          where: {
            issue: {
              project_id: this.projectId
            }
          }
        }),
        // 3. 依存関係を削除
        this.prisma.dependency.deleteMany({
          where: {
            project_id: this.projectId
          }
        }),
        // 4. Issueを削除（カスケード削除ではなく明示的削除）
        this.prisma.issue.deleteMany({
          where: { project_id: this.projectId }
        }),
      ]);
      
      console.log('✅ 大量データセットクリーンアップ完了');
    } catch (error) {
      console.error('❌ クリーンアップに失敗:', error);
      throw error;
    }
  }
}

/**
 * デフォルト設定で大量データセットを生成
 */
export function createDefaultLargeDatasetConfig(): LargeDatasetConfig {
  return {
    totalIssues: 1000,
    maxDepth: 5,
    maxChildrenPerLevel: 50,
    dependencyCount: 200,
    commentCount: 2000,
    imageCount: 500,
  };
}

/**
 * 性能テスト用の小規模データセット設定
 */
export function createSmallDatasetConfig(): LargeDatasetConfig {
  return {
    totalIssues: 100,
    maxDepth: 3,
    maxChildrenPerLevel: 10,
    dependencyCount: 20,
    commentCount: 200,
    imageCount: 50,
  };
}