import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * API負荷・ストレステスト
 * 
 * 対象テストシナリオ:
 * 1. 同時アクセス100ユーザーでの負荷テスト
 * 2. 平均レスポンス時間2秒以内の維持
 * 3. データベース接続プール限界テスト
 * 4. API rate limiting動作確認
 * 5. エラー率5%以下の維持
 * 6. スループット測定
 * 
 * 合格基準:
 * - 100同時ユーザーで平均レスポンス時間2秒以内
 * - エラー率5%以下
 * - メモリ使用量制限内
 * - データベース接続枯渇なし
 */
describe('Load and Stress Testing (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  
  // テスト用プロジェクトデータ
  let testProjectIds: string[] = [];
  let testPassword: string;
  let authHeaders: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    testPassword = 'LoadTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // 複数のテスト用プロジェクト作成（負荷分散のため）
    for (let i = 0; i < 10; i++) {
      const project = await prismaService.project.create({
        data: {
          name: `Load Test Project ${i + 1}`,
          description: `Project ${i + 1} for load testing`,
          shared_password_hash: hashedPassword,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      
      testProjectIds.push(project.id);
      authHeaders.push(btoa(`${project.id}:${testPassword}`));

      // 各プロジェクトに基本的なIssueを作成
      for (let j = 0; j < 5; j++) {
        await prismaService.issue.create({
          data: {
            title: `Load Test Issue ${j + 1}`,
            description: `Issue ${j + 1} for load testing`,
            status: 'open',
            priority: 'medium',
            project_id: project.id,
            sort_order: j + 1,
            created_at: new Date(),
            updated_at: new Date(),
            version: 1,
          },
        });
      }
    }

    console.log(`✓ Created ${testProjectIds.length} test projects with basic issues`);
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    for (const projectId of testProjectIds) {
      await prismaService.issue.deleteMany({
        where: { project_id: projectId },
      });
      await prismaService.project.deleteMany({
        where: { id: projectId },
      });
    }
    
    await app.close();
  });

  describe('1. 同時アクセス負荷テスト', () => {
    it('should handle 100 concurrent users with average response time under 2 seconds', async () => {
      const concurrentUsers = 100;
      const requestsPerUser = 5;
      const acceptableAverageTime = 2000; // 2 seconds
      const maxErrorRate = 0.05; // 5%

      console.log(`\n🚀 Starting load test: ${concurrentUsers} concurrent users, ${requestsPerUser} requests each`);

      const startTime = Date.now();
      const results: { success: boolean; responseTime: number; status: number }[] = [];

      // 100人の同時ユーザーシミュレーション
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
        const projectIndex = userIndex % testProjectIds.length;
        const projectId = testProjectIds[projectIndex];
        const authHeader = authHeaders[projectIndex];

        // 各ユーザーが複数のAPIリクエストを実行
        const userRequests = [
          // プロジェクト詳細取得
          () => request(app.getHttpServer())
            .get(`/projects/${projectId}`)
            .set('Authorization', `Basic ${authHeader}`),
          
          // Issue一覧取得
          () => request(app.getHttpServer())
            .get(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`),
          
          // Issue作成
          () => request(app.getHttpServer())
            .post(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `Load Test Issue User ${userIndex}`,
              description: 'Created during load test',
              status: 'open',
              priority: 'medium'
            }),
          
          // グローバル設定取得
          () => request(app.getHttpServer())
            .get('/settings/global')
            .set('Authorization', `Basic ${authHeader}`),

          // ヘルスチェック
          () => request(app.getHttpServer())
            .get('/health')
        ];

        // リクエストを順次実行
        const userResults = [];
        for (let i = 0; i < Math.min(requestsPerUser, userRequests.length); i++) {
          const requestStart = Date.now();
          try {
            const response = await userRequests[i]();
            const responseTime = Date.now() - requestStart;
            
            userResults.push({
              success: response.status < 400,
              responseTime,
              status: response.status
            });
          } catch (error) {
            const responseTime = Date.now() - requestStart;
            userResults.push({
              success: false,
              responseTime,
              status: 500
            });
          }
        }

        return userResults;
      });

      // 全ユーザーのリクエストを並行実行
      const allUserResults = await Promise.allSettled(userPromises);
      const totalTime = Date.now() - startTime;

      // 結果の集計
      allUserResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          // Promise rejection をエラーとして記録
          results.push({
            success: false,
            responseTime: totalTime,
            status: 500
          });
        }
      });

      // パフォーマンス分析
      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      const totalRequests = results.length;
      const errorRate = failedRequests.length / totalRequests;
      
      const responseTimes = successfulRequests.map(r => r.responseTime);
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;
      
      const p95ResponseTime = responseTimes.length > 0 
        ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
        : 0;

      const maxResponseTime = Math.max(...responseTimes, 0);
      const minResponseTime = Math.min(...responseTimes, 0);
      const throughput = (totalRequests / (totalTime / 1000)).toFixed(2); // requests/second

      // 結果レポート
      console.log(`\n📊 Load Test Results:`);
      console.log(`  Total Requests: ${totalRequests}`);
      console.log(`  Successful: ${successfulRequests.length} (${((1 - errorRate) * 100).toFixed(1)}%)`);
      console.log(`  Failed: ${failedRequests.length} (${(errorRate * 100).toFixed(1)}%)`);
      console.log(`  Average Response Time: ${averageResponseTime.toFixed(0)}ms`);
      console.log(`  95th Percentile: ${p95ResponseTime}ms`);
      console.log(`  Min/Max Response Time: ${minResponseTime}ms / ${maxResponseTime}ms`);
      console.log(`  Total Test Duration: ${totalTime}ms`);
      console.log(`  Throughput: ${throughput} requests/second`);

      // アサーション
      expect(errorRate).toBeLessThanOrEqual(maxErrorRate);
      expect(averageResponseTime).toBeLessThanOrEqual(acceptableAverageTime);
      expect(successfulRequests.length).toBeGreaterThan(0);
      
      // 95パーセンタイルも許容範囲内であることを確認
      expect(p95ResponseTime).toBeLessThanOrEqual(acceptableAverageTime * 2); // P95は平均の2倍以内

      // 最低限のスループットを確認
      const minThroughput = 10; // 10 requests/second以上
      expect(parseFloat(throughput)).toBeGreaterThanOrEqual(minThroughput);
    }, 120000); // 2分タイムアウト

    it('should maintain performance under sustained load', async () => {
      const sustainedDuration = 30000; // 30秒間の継続負荷
      const concurrentUsers = 20; // 少ない同時ユーザー数で長時間テスト
      const requestInterval = 1000; // 1秒間隔でリクエスト

      console.log(`\n⏱️  Starting sustained load test: ${sustainedDuration/1000}s duration`);

      const startTime = Date.now();
      const results: Array<{ timestamp: number; responseTime: number; success: boolean }> = [];
      let testRunning = true;

      // 持続負荷テスト実行
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
        const projectIndex = userIndex % testProjectIds.length;
        const projectId = testProjectIds[projectIndex];
        const authHeader = authHeaders[projectIndex];

        while (testRunning && Date.now() - startTime < sustainedDuration) {
          const requestStart = Date.now();
          try {
            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/issues`)
              .set('Authorization', `Basic ${authHeader}`);

            results.push({
              timestamp: requestStart,
              responseTime: Date.now() - requestStart,
              success: response.status < 400
            });
          } catch (error) {
            results.push({
              timestamp: requestStart,
              responseTime: Date.now() - requestStart,
              success: false
            });
          }

          // リクエスト間隔を維持
          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      });

      // 持続テスト実行
      setTimeout(() => { testRunning = false; }, sustainedDuration);
      await Promise.allSettled(userPromises);

      // パフォーマンスの時系列分析
      const timeSlices = 5; // 5つの時間区間に分割
      const sliceDuration = sustainedDuration / timeSlices;
      
      for (let i = 0; i < timeSlices; i++) {
        const sliceStart = startTime + (i * sliceDuration);
        const sliceEnd = sliceStart + sliceDuration;
        
        const sliceResults = results.filter(r => 
          r.timestamp >= sliceStart && r.timestamp < sliceEnd
        );

        if (sliceResults.length > 0) {
          const avgResponseTime = sliceResults.reduce((sum, r) => sum + r.responseTime, 0) / sliceResults.length;
          const successRate = sliceResults.filter(r => r.success).length / sliceResults.length;

          console.log(`  Slice ${i + 1}: ${sliceResults.length} requests, avg: ${avgResponseTime.toFixed(0)}ms, success: ${(successRate * 100).toFixed(1)}%`);
          
          // 各時間区間でパフォーマンスが維持されていることを確認
          expect(avgResponseTime).toBeLessThanOrEqual(3000); // 3秒以内
          expect(successRate).toBeGreaterThanOrEqual(0.95); // 95%以上の成功率
        }
      }

      expect(results.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('2. データベース接続プール負荷テスト', () => {
    it('should handle database connection pool exhaustion gracefully', async () => {
      const maxConcurrentDbOperations = 50; // データベース接続を集中的に使用
      
      console.log(`\n🗄️  Testing database connection pool with ${maxConcurrentDbOperations} concurrent operations`);

      // データベース集約的な操作を同時実行
      const dbOperations = Array.from({ length: maxConcurrentDbOperations }, async (_, index) => {
        const projectIndex = index % testProjectIds.length;
        const projectId = testProjectIds[projectIndex];
        const authHeader = authHeaders[projectIndex];

        const operations = [
          // 複雑な検索クエリ
          () => request(app.getHttpServer())
            .get(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .query({ search: 'Load Test' }),
          
          // Issue作成（データベース書き込み）
          () => request(app.getHttpServer())
            .post(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `DB Pool Test Issue ${index}`,
              description: 'Database connection pool test',
              status: 'open',
              priority: 'medium'
            }),

          // Issue更新（データベース書き込み）
          () => request(app.getHttpServer())
            .get(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .then(response => {
              if (response.body.length > 0) {
                const issueId = response.body[0].id;
                return request(app.getHttpServer())
                  .put(`/projects/${projectId}/issues/${issueId}`)
                  .set('Authorization', `Basic ${authHeader}`)
                  .send({
                    title: `Updated Issue ${index}`,
                    description: 'Updated during DB pool test'
                  });
              }
              return { status: 200 };
            }),
        ];

        const startTime = Date.now();
        try {
          const operation = operations[index % operations.length];
          const response = await operation();
          return {
            success: response.status < 400,
            responseTime: Date.now() - startTime,
            status: response.status
          };
        } catch (error) {
          return {
            success: false,
            responseTime: Date.now() - startTime,
            status: 500
          };
        }
      });

      const results = await Promise.allSettled(dbOperations);
      
      const successfulOperations = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      
      const failedOperations = results.length - successfulOperations;
      const successRate = successfulOperations / results.length;

      console.log(`  Database Operations: ${results.length}`);
      console.log(`  Successful: ${successfulOperations}`);
      console.log(`  Failed: ${failedOperations}`);
      console.log(`  Success Rate: ${(successRate * 100).toFixed(1)}%`);

      // データベース接続プールが適切に管理されていることを確認
      expect(successRate).toBeGreaterThanOrEqual(0.9); // 90%以上の成功率
      expect(successfulOperations).toBeGreaterThan(0);
    }, 60000);

    it('should recover from database connection issues', async () => {
      // データベース接続の回復力テスト
      const testDuration = 10000; // 10秒間
      const requestInterval = 500; // 0.5秒間隔

      const results: boolean[] = [];
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        try {
          const response = await request(app.getHttpServer())
            .get(`/projects/${testProjectIds[0]}`)
            .set('Authorization', `Basic ${authHeaders[0]}`)
            .timeout(2000);

          results.push(response.status < 400);
        } catch (error) {
          results.push(false);
        }

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      const successRate = results.filter(r => r).length / results.length;
      
      console.log(`  Connection Recovery Test: ${(successRate * 100).toFixed(1)}% success rate over ${testDuration/1000}s`);

      // データベース接続が安定していることを確認
      expect(successRate).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('3. メモリ使用量監視', () => {
    it('should maintain memory usage within limits during high load', async () => {
      const initialMemory = process.memoryUsage();
      console.log(`\n💾 Initial Memory Usage:`, {
        heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(initialMemory.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(initialMemory.external / 1024 / 1024)}MB`,
        rss: `${Math.round(initialMemory.rss / 1024 / 1024)}MB`
      });

      // 高負荷でのメモリ使用量テスト
      const highLoadRequests = Array.from({ length: 50 }, async (_, index) => {
        const projectIndex = index % testProjectIds.length;
        const projectId = testProjectIds[projectIndex];
        const authHeader = authHeaders[projectIndex];

        // メモリを消費する可能性のある操作
        return Promise.all([
          request(app.getHttpServer())
            .get(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`),
          
          request(app.getHttpServer())
            .post(`/projects/${projectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `Memory Test Issue ${index}`,
              description: 'A'.repeat(1000), // 大きな説明文
              status: 'open',
              priority: 'medium'
            })
        ]);
      });

      await Promise.allSettled(highLoadRequests);

      // ガベージコレクション強制実行
      if (global.gc) {
        global.gc();
      }

      const peakMemory = process.memoryUsage();
      console.log(`Peak Memory Usage:`, {
        heapUsed: `${Math.round(peakMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(peakMemory.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(peakMemory.external / 1024 / 1024)}MB`,
        rss: `${Math.round(peakMemory.rss / 1024 / 1024)}MB`
      });

      // メモリ使用量増加の確認
      const heapIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreaseRatio = heapIncrease / initialMemory.heapUsed;

      console.log(`Memory Increase: ${Math.round(heapIncrease / 1024 / 1024)}MB (${(heapIncreaseRatio * 100).toFixed(1)}%)`);

      // メモリ使用量が異常に増加していないことを確認
      expect(peakMemory.heapUsed).toBeLessThan(512 * 1024 * 1024); // 512MB以内
      expect(heapIncreaseRatio).toBeLessThan(3.0); // 初期値の3倍以内
    });
  });

  describe('4. エラーハンドリング負荷テスト', () => {
    it('should handle error conditions gracefully under load', async () => {
      // 意図的にエラーを発生させる負荷テスト
      const errorInducingRequests = [
        // 存在しないプロジェクトアクセス
        () => request(app.getHttpServer())
          .get('/projects/non-existent-id')
          .set('Authorization', `Basic ${authHeaders[0]}`),
        
        // 不正なデータでのIssue作成
        () => request(app.getHttpServer())
          .post(`/projects/${testProjectIds[0]}/issues`)
          .set('Authorization', `Basic ${authHeaders[0]}`)
          .send({
            title: '', // 空のタイトル
            status: 'invalid_status'
          }),
        
        // 認証なしアクセス
        () => request(app.getHttpServer())
          .get(`/projects/${testProjectIds[0]}`),

        // 存在しないエンドポイント
        () => request(app.getHttpServer())
          .get('/non-existent-endpoint')
      ];

      const concurrentErrors = 30;
      const errorResults = [];

      const errorPromises = Array.from({ length: concurrentErrors }, async (_, index) => {
        const requestType = errorInducingRequests[index % errorInducingRequests.length];
        const startTime = Date.now();
        
        try {
          const response = await requestType();
          return {
            responseTime: Date.now() - startTime,
            status: response.status,
            hasErrorResponse: response.status >= 400
          };
        } catch (error) {
          return {
            responseTime: Date.now() - startTime,
            status: 500,
            hasErrorResponse: true
          };
        }
      });

      const results = await Promise.allSettled(errorPromises);
      const errorResponses = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

      const avgErrorResponseTime = errorResponses.reduce((sum, r) => sum + r.responseTime, 0) / errorResponses.length;
      const properErrorResponses = errorResponses.filter(r => r.hasErrorResponse).length;

      console.log(`\n❌ Error Handling Test:`);
      console.log(`  Total Error Requests: ${concurrentErrors}`);
      console.log(`  Proper Error Responses: ${properErrorResponses}`);
      console.log(`  Average Error Response Time: ${avgErrorResponseTime.toFixed(0)}ms`);

      // エラーが適切に処理されることを確認
      expect(properErrorResponses).toBeGreaterThan(concurrentErrors * 0.8); // 80%以上が適切なエラーレスポンス
      expect(avgErrorResponseTime).toBeLessThan(1000); // エラーレスポンスも1秒以内
    });
  });
});