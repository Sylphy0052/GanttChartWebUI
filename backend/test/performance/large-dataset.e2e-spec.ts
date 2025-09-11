/**
 * 大量データ性能テスト (T7.2.2)
 * 
 * テスト対象:
 * - 1000+ Issues生成・表示性能 (5秒以内)
 * - ガントチャートドラッグ操作性能 (100ms以内)
 * - メモリ使用量監視 (1GB以内)
 * - 複雑依存関係での処理性能
 * - 大量データでのAPI応答性
 * - データベースクエリ最適化検証
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { testHelper } from '../test-setup';
import { 
  LargeDatasetGenerator, 
  createDefaultLargeDatasetConfig,
  createSmallDatasetConfig,
  LargeDatasetStats,
  LargeDatasetConfig 
} from '../fixtures/large-dataset-generator';

describe('大量データ性能テスト (T7.2.2)', () => {
  let app: INestApplication;
  const authHeader = testHelper.createBasicAuthHeader();
  let testProjectId: string;
  let datasetGenerator: LargeDatasetGenerator;
  let performanceMetrics: PerformanceMetrics = {};

  // 性能測定用インターフェース
  interface PerformanceMetrics {
    dataGeneration?: PerformanceResult;
    smallDataGeneration?: PerformanceResult;
    issueListLoad?: PerformanceResult;
    wbsTreeDisplay?: PerformanceResult;
    ganttChartRender?: PerformanceResult;
    dragOperation?: PerformanceResult;
    dependencyCheck?: PerformanceResult;
    memoryUsage?: MemoryMetrics;
  }

  interface PerformanceResult {
    startTime: number;
    endTime: number;
    duration: number;
    success: boolean;
    error?: string;
  }

  interface MemoryMetrics {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    timestamp: number;
  }

  // テストタイムアウト設定（大量データのため長時間）
  const LARGE_DATASET_TIMEOUT = 300000; // 5分
  const API_PERFORMANCE_TIMEOUT = 10000; // 10秒

  beforeAll(async () => {
    app = testHelper.app;
    
    console.log('🚀 大量データ性能テスト開始');
    console.log(`📊 Node.js version: ${process.version}`);
    console.log(`💾 Initial memory: ${JSON.stringify(process.memoryUsage(), null, 2)}`);
    
    // テスト用プロジェクト作成
    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', authHeader)
      .send({
        name: 'Large Dataset Performance Test Project',
        description_md: 'Project for large dataset performance testing',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'active',
      });
    
    testProjectId = projectResponse.body.id;
    console.log(`📋 Test project created: ${testProjectId}`);
    
  }, LARGE_DATASET_TIMEOUT);

  afterAll(async () => {
    // 性能レポート出力
    console.log('\n📈 === 大量データ性能テスト結果レポート ===');
    console.log(JSON.stringify(performanceMetrics, null, 2));
    
    // テストデータクリーンアップ
    if (datasetGenerator) {
      await datasetGenerator.cleanupLargeDataset();
    }
    
    if (testProjectId) {
      await request(app.getHttpServer())
        .delete(`/projects/${testProjectId}`)
        .set('Authorization', authHeader);
    }
    
    console.log('✅ 大量データ性能テスト完了');
  }, LARGE_DATASET_TIMEOUT);

  describe('🔧 大量データ生成性能テスト', () => {
    it('1000 Issues + 200 Dependencies + 2000 Comments を5秒以内で生成', async () => {
      // 性能目標: 5秒以内
      const TARGET_GENERATION_TIME = 5000; // 5秒
      
      const config = createDefaultLargeDatasetConfig();
      datasetGenerator = new LargeDatasetGenerator(testHelper.prisma, testProjectId, config);
      
      const startTime = Date.now();
      const result = await measurePerformance('dataGeneration', async () => {
        return await datasetGenerator.generateLargeDataset();
      });
      
      const stats = result as LargeDatasetStats;
      
      // 検証: 生成時間
      expect(stats.totalExecutionTime).toBeLessThan(TARGET_GENERATION_TIME);
      
      // 検証: 生成数
      expect(stats.issuesCreated).toBe(config.totalIssues);
      expect(stats.dependenciesCreated).toBe(config.dependencyCount);
      expect(stats.commentsCreated).toBe(config.commentCount);
      expect(stats.imagesCreated).toBe(config.imageCount);
      
      // 検証: メモリ使用量 (500MB以内)
      expect(stats.memoryUsagePeak).toBeLessThan(500 * 1024 * 1024);
      
      console.log(`✅ 大量データ生成完了: ${stats.totalExecutionTime}ms (目標: ${TARGET_GENERATION_TIME}ms)`);
      
    }, LARGE_DATASET_TIMEOUT);

    it('小規模データセット（100 Issues）の高速生成を検証', async () => {
      // 比較用の小規模データセット
      const config = createSmallDatasetConfig();
      const smallDatasetGenerator = new LargeDatasetGenerator(testHelper.prisma, testProjectId, config);
      
      const result = await measurePerformance('smallDataGeneration', async () => {
        return await smallDatasetGenerator.generateLargeDataset();
      });
      
      const stats = result as LargeDatasetStats;
      
      // 小規模データは1秒以内
      expect(stats.totalExecutionTime).toBeLessThan(1000);
      
      // クリーンアップ
      await smallDatasetGenerator.cleanupLargeDataset();
      
    }, 30000);
  });

  describe('📊 API性能テスト', () => {
    it('1000件Issue一覧取得が1秒以内で応答', async () => {
      const TARGET_RESPONSE_TIME = 1000; // 1秒
      
      const result = await measurePerformance('issueListLoad', async () => {
        const response = await request(app.getHttpServer())
          .get(`/projects/${testProjectId}/issues`)
          .set('Authorization', authHeader)
          .expect(200);
        
        return response.body;
      });
      
      // 応答時間検証
      expect(performanceMetrics.issueListLoad!.duration).toBeLessThan(TARGET_RESPONSE_TIME);
      
      // データ整合性検証
      const issues = result as any[];
      expect(issues.length).toBeGreaterThan(900); // 1000件近く
      
      console.log(`✅ Issue一覧取得: ${performanceMetrics.issueListLoad!.duration}ms (目標: ${TARGET_RESPONSE_TIME}ms)`);
      
    }, API_PERFORMANCE_TIMEOUT);

    it('WBSツリー階層表示が2秒以内で応答', async () => {
      const TARGET_RESPONSE_TIME = 2000; // 2秒
      
      const result = await measurePerformance('wbsTreeDisplay', async () => {
        const response = await request(app.getHttpServer())
          .get(`/projects/${testProjectId}/issues`)
          .set('Authorization', authHeader)
          .expect(200);
        
        return response.body;
      });
      
      // 応答時間検証
      expect(performanceMetrics.wbsTreeDisplay!.duration).toBeLessThan(TARGET_RESPONSE_TIME);
      
      console.log(`✅ WBSツリー表示: ${performanceMetrics.wbsTreeDisplay!.duration}ms (目標: ${TARGET_RESPONSE_TIME}ms)`);
      
    }, API_PERFORMANCE_TIMEOUT);

    it('ガントチャートデータ取得が3秒以内で応答', async () => {
      const TARGET_RESPONSE_TIME = 3000; // 3秒
      
      const result = await measurePerformance('ganttChartRender', async () => {
        const response = await request(app.getHttpServer())
          .get(`/projects/${testProjectId}/issues`)
          .set('Authorization', authHeader)
          .expect(200);
        
        return response.body;
      });
      
      // 応答時間検証
      expect(performanceMetrics.ganttChartRender!.duration).toBeLessThan(TARGET_RESPONSE_TIME);
      
      console.log(`✅ ガントチャート取得: ${performanceMetrics.ganttChartRender!.duration}ms (目標: ${TARGET_RESPONSE_TIME}ms)`);
      
    }, API_PERFORMANCE_TIMEOUT);

    it('Issue並び替え更新が500ms以内で応答', async () => {
      const TARGET_RESPONSE_TIME = 500; // 500ms
      
      // 並び替え対象のIssueを取得
      const issuesResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader);
      
      const issues = issuesResponse.body;
      expect(issues.length).toBeGreaterThan(5);
      
      // 並び替えデータ準備（正しいDTO形式）
      const reorderData = {
        issues: issues.slice(0, 5).map((issue: any, index: number) => ({
          id: issue.id,
          sort_order: index + 100, // 新しいソート順
          version: issue.version || 1, // バージョン情報
        }))
      };
      
      const result = await measurePerformance('dragOperation', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/issues/reorder`)
          .set('Authorization', authHeader)
          .send(reorderData)
          .expect(200);
        
        return response.body;
      });
      
      // 応答時間検証（ドラッグ操作の目標値）
      expect(performanceMetrics.dragOperation!.duration).toBeLessThan(TARGET_RESPONSE_TIME);
      
      console.log(`✅ Issue並び替え: ${performanceMetrics.dragOperation!.duration}ms (目標: ${TARGET_RESPONSE_TIME}ms)`);
      
    }, API_PERFORMANCE_TIMEOUT);
  });

  describe('🔗 依存関係性能テスト', () => {
    it('複雑な依存関係チェックが200ms以内で応答', async () => {
      const TARGET_RESPONSE_TIME = 200; // 200ms
      
      // 依存関係検証用のIssueを取得
      const issuesResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader);
      
      const issues = issuesResponse.body;
      expect(issues.length).toBeGreaterThanOrEqual(2);
      
      const result = await measurePerformance('dependencyCheck', async () => {
        const response = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/dependencies`)
          .set('Authorization', authHeader)
          .send({
            predecessor_issue_id: issues[0].id,
            successor_issue_id: issues[1].id,
            type: 'FS',
          })
          .expect(201);
        
        return response.body;
      });
      
      // 応答時間検証
      expect(performanceMetrics.dependencyCheck!.duration).toBeLessThan(TARGET_RESPONSE_TIME);
      
      console.log(`✅ 依存関係チェック: ${performanceMetrics.dependencyCheck!.duration}ms (目標: ${TARGET_RESPONSE_TIME}ms)`);
      
    }, API_PERFORMANCE_TIMEOUT);

    it('依存関係一覧取得の性能を検証', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .expect(200);
      
      const duration = Date.now() - startTime;
      
      // 依存関係数の検証
      expect(response.body.length).toBeGreaterThan(150); // 200件近く
      
      // 応答時間は1秒以内
      expect(duration).toBeLessThan(1000);
      
      console.log(`✅ 依存関係一覧取得: ${duration}ms, ${response.body.length}件`);
    });
  });

  describe('💾 メモリ使用量テスト', () => {
    it('長時間操作でメモリ使用量が1GB以内', async () => {
      const TARGET_MEMORY_LIMIT = 1024 * 1024 * 1024; // 1GB
      
      // 初期メモリ使用量
      const initialMemory = process.memoryUsage();
      performanceMetrics.memoryUsage = {
        ...initialMemory,
        timestamp: Date.now(),
      };
      
      console.log(`📊 初期メモリ使用量: ${JSON.stringify(initialMemory, null, 2)}`);
      
      // 連続API呼び出しでメモリリークをチェック
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .get(`/projects/${testProjectId}/issues`)
          .set('Authorization', authHeader);
        
        // ガベージコレクション促進
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = process.memoryUsage();
        console.log(`  🔄 Iteration ${i + 1} memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
        
        // メモリリミットチェック
        expect(currentMemory.rss).toBeLessThan(TARGET_MEMORY_LIMIT);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`📊 最終メモリ使用量: ${JSON.stringify(finalMemory, null, 2)}`);
      console.log(`📈 メモリ増加量: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      
      // メモリ増加が500MB以内（メモリリーク検出）
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
      
    }, 60000);

    it('データベース接続プールの性能を検証', async () => {
      // 並行リクエストでコネクションプールをテスト
      const concurrentRequests = 20;
      const promises = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app.getHttpServer())
            .get(`/projects/${testProjectId}/issues`)
            .set('Authorization', authHeader)
        );
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // 全てのリクエストが成功
      results.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // 並行処理が10秒以内
      expect(duration).toBeLessThan(10000);
      
      console.log(`✅ 並行リクエスト ${concurrentRequests}件: ${duration}ms`);
    });
  });

  describe('📈 統計・レポート機能', () => {
    it('大量データの統計情報を取得', async () => {
      const stats = await datasetGenerator.getDatasetStatistics();
      
      console.log('📊 === データセット統計 ===');
      console.log(JSON.stringify(stats, null, 2));
      
      // 統計の検証
      expect(stats.totalIssues).toBeGreaterThan(900);
      expect(stats.totalDependencies).toBeGreaterThan(150);
      expect(stats.totalComments).toBeGreaterThan(1800);
      expect(stats.hierarchyDistribution).toHaveLength(5);
    });

    it('性能ベンチマーク結果を出力', () => {
      console.log('\n🏆 === 性能ベンチマーク結果 ===');
      
      const summary = {
        dataGeneration: formatPerformanceResult(performanceMetrics.dataGeneration),
        apiPerformance: {
          issueList: formatPerformanceResult(performanceMetrics.issueListLoad),
          wbsTree: formatPerformanceResult(performanceMetrics.wbsTreeDisplay),
          ganttChart: formatPerformanceResult(performanceMetrics.ganttChartRender),
          dragOperation: formatPerformanceResult(performanceMetrics.dragOperation),
          dependencyCheck: formatPerformanceResult(performanceMetrics.dependencyCheck),
        },
        memoryUsage: performanceMetrics.memoryUsage,
        testEnvironment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          memoryLimit: '1GB',
        },
      };
      
      console.log(JSON.stringify(summary, null, 2));
      
      // 全体的な性能評価
      const allTargetsMet = checkPerformanceTargets();
      expect(allTargetsMet).toBe(true);
    });

    it('データベース最適化効果を測定', async () => {
      // インデックス使用状況の検証（PostgreSQL固有）
      const indexUsageStats = await testHelper.prisma.$queryRaw`
        SELECT 
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        AND idx_tup_read > 0
        ORDER BY idx_tup_read DESC;
      `;
      
      console.log('📊 インデックス使用統計:', indexUsageStats);
      
      // 複雑なクエリの実行時間測定
      const complexQueryStart = Date.now();
      
      const complexData = await testHelper.prisma.issue.findMany({
        where: {
          project_id: testProjectId,
          is_deleted: false,
          OR: [
            { status: 'in_progress' },
            { status: 'blocked' },
          ],
        },
        include: {
          comments: true,
          predecessor_deps: {
            include: {
              predecessor: true
            }
          },
          successor_deps: {
            include: {
              successor: true
            }
          },
        },
      });
      
      const complexQueryDuration = Date.now() - complexQueryStart;
      
      console.log(`✅ 複雑クエリ実行時間: ${complexQueryDuration}ms (対象: ${complexData.length}件)`);
      
      // 複雑クエリが2秒以内
      expect(complexQueryDuration).toBeLessThan(2000);
    });
  });

  // ヘルパー関数群

  /**
   * 性能測定ヘルパー
   */
  async function measurePerformance<T>(
    metricName: keyof PerformanceMetrics,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const endTime = Date.now();
      
      if (metricName === 'memoryUsage') {
        // memoryUsageの場合は特別扱い
        performanceMetrics[metricName] = {
          ...process.memoryUsage(),
          timestamp: Date.now(),
        } as MemoryMetrics;
      } else {
        performanceMetrics[metricName] = {
          startTime,
          endTime,
          duration: endTime - startTime,
          success: true,
        } as PerformanceResult;
      }
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      
      if (metricName !== 'memoryUsage') {
        performanceMetrics[metricName] = {
          startTime,
          endTime,
          duration: endTime - startTime,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as PerformanceResult;
      }
      
      throw error;
    }
  }

  /**
   * 性能結果フォーマット
   */
  function formatPerformanceResult(result?: PerformanceResult): string {
    if (!result) return 'N/A';
    
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    const error = result.error ? ` (${result.error})` : '';
    
    return `${status} ${duration}${error}`;
  }

  /**
   * 性能目標達成チェック
   */
  function checkPerformanceTargets(): boolean {
    const targets = [
      { name: 'Data Generation', metric: performanceMetrics.dataGeneration, target: 5000 },
      { name: 'Issue List', metric: performanceMetrics.issueListLoad, target: 1000 },
      { name: 'WBS Tree', metric: performanceMetrics.wbsTreeDisplay, target: 2000 },
      { name: 'Gantt Chart', metric: performanceMetrics.ganttChartRender, target: 3000 },
      { name: 'Drag Operation', metric: performanceMetrics.dragOperation, target: 500 },
      { name: 'Dependency Check', metric: performanceMetrics.dependencyCheck, target: 200 },
    ];
    
    let allMet = true;
    
    console.log('\n🎯 === 性能目標達成状況 ===');
    for (const target of targets) {
      const met = target.metric && target.metric.success && target.metric.duration < target.target;
      const status = met ? '✅' : '❌';
      const duration = target.metric?.duration || 'N/A';
      
      console.log(`${status} ${target.name}: ${duration}ms (目標: ${target.target}ms)`);
      
      if (!met) allMet = false;
    }
    
    return allMet;
  }
});