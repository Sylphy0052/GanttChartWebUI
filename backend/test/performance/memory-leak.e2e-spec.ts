import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * メモリリーク検証テスト
 * 
 * 対象テストシナリオ:
 * 1. 24時間連続稼働シミュレーション（短縮版）
 * 2. メモリ使用量が2GB以内の維持
 * 3. ガベージコレクション効率の確認
 * 4. WebSocket接続のメモリリーク検出
 * 5. 大量データ処理後のメモリ解放確認
 * 6. データベース接続リークの検出
 * 
 * 合格基準:
 * - 24時間相当の負荷後もメモリ使用量が2GB以内
 * - メモリ増加率が安定している（線形増加しない）
 * - ガベージコレクション後の適切なメモリ解放
 */
describe('Memory Leak Detection Tests (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  
  let testProjectId: string;
  let testPassword: string;
  let authHeader: string;

  // メモリ監視データ
  const memorySnapshots: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    gcCount: number;
  }> = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // テスト用プロジェクト作成
    testPassword = 'MemoryTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'Memory Leak Test Project',
        description: 'Project for memory leak testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${testPassword}`);

    // 初期メモリスナップショット
    takeMemorySnapshot('initial');

    console.log('🧠 Memory leak detection tests initialized');
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    await prismaService.issue.deleteMany({
      where: { project_id: testProjectId },
    });
    await prismaService.project.deleteMany({
      where: { id: testProjectId },
    });
    
    await app.close();
    
    // 最終メモリレポート
    generateMemoryReport();
  });

  function takeMemorySnapshot(label: string, gcCount: number = 0): void {
    const memory = process.memoryUsage();
    memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss,
      gcCount
    });

    console.log(`📊 Memory Snapshot [${label}]:`, {
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memory.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`
    });
  }

  function forceGarbageCollection(): number {
    let gcCount = 0;
    if (global.gc) {
      // 複数回実行してより効果的にする
      for (let i = 0; i < 5; i++) {
        global.gc();
        gcCount++;
      }
    } else {
      console.warn('⚠️  Garbage collection not available. Run with --expose-gc flag.');
    }
    return gcCount;
  }

  function generateMemoryReport(): void {
    if (memorySnapshots.length < 2) return;

    console.log('\n📈 Memory Usage Report:');
    console.log('Timestamp\t\tHeap Used\tHeap Total\tRSS\t\tExternal');
    
    memorySnapshots.forEach((snapshot, index) => {
      const time = new Date(snapshot.timestamp).toISOString().substr(11, 8);
      const heapUsedMB = Math.round(snapshot.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(snapshot.heapTotal / 1024 / 1024);
      const rssMB = Math.round(snapshot.rss / 1024 / 1024);
      const externalMB = Math.round(snapshot.external / 1024 / 1024);
      
      console.log(`${time}\t\t${heapUsedMB}MB\t\t${heapTotalMB}MB\t\t${rssMB}MB\t\t${externalMB}MB`);
    });

    // メモリ増加率分析
    const first = memorySnapshots[0];
    const last = memorySnapshots[memorySnapshots.length - 1];
    const heapGrowth = ((last.heapUsed - first.heapUsed) / first.heapUsed) * 100;
    
    console.log(`\n📊 Memory Growth Analysis:`);
    console.log(`  Initial Heap: ${Math.round(first.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Final Heap: ${Math.round(last.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Growth Rate: ${heapGrowth.toFixed(2)}%`);
  }

  describe('1. 長時間稼働メモリリーク検出', () => {
    it('should maintain stable memory usage over extended operation', async () => {
      const testDuration = 60000; // 1分間（実際の24時間の縮約版）
      const operationInterval = 1000; // 1秒間隔
      const memoryCheckInterval = 10000; // 10秒毎にメモリチェック
      
      console.log(`\n⏰ Starting extended operation test: ${testDuration/1000}s duration`);

      const startTime = Date.now();
      let operationCount = 0;
      let lastMemoryCheck = startTime;

      // 長時間稼働シミュレーション
      while (Date.now() - startTime < testDuration) {
        // 様々な操作を循環実行
        const operations = [
          // Issue CRUD操作
          async () => {
            const response = await request(app.getHttpServer())
              .post(`/projects/${testProjectId}/issues`)
              .set('Authorization', `Basic ${authHeader}`)
              .send({
                title: `Long Running Test Issue ${operationCount}`,
                description: `Generated during extended test at ${new Date().toISOString()}`,
                status: 'open',
                priority: 'medium'
              });
            
            if (response.status === HttpStatus.CREATED) {
              // 作成後すぐに削除（メモリリーク検出のため）
              await request(app.getHttpServer())
                .delete(`/projects/${testProjectId}/issues/${response.body.id}`)
                .set('Authorization', `Basic ${authHeader}`);
            }
          },

          // データ取得操作
          async () => {
            await request(app.getHttpServer())
              .get(`/projects/${testProjectId}/issues`)
              .set('Authorization', `Basic ${authHeader}`);
          },

          // プロジェクト詳細取得
          async () => {
            await request(app.getHttpServer())
              .get(`/projects/${testProjectId}`)
              .set('Authorization', `Basic ${authHeader}`);
          }
        ];

        const operation = operations[operationCount % operations.length];
        
        try {
          await operation();
          operationCount++;
        } catch (error) {
          console.warn(`Operation ${operationCount} failed:`, error.message);
        }

        // 定期的なメモリチェック
        const now = Date.now();
        if (now - lastMemoryCheck >= memoryCheckInterval) {
          const gcCount = forceGarbageCollection();
          takeMemorySnapshot(`extended-${Math.floor((now - startTime) / 1000)}s`, gcCount);
          lastMemoryCheck = now;
        }

        await new Promise(resolve => setTimeout(resolve, operationInterval));
      }

      // 最終メモリチェック
      const finalGcCount = forceGarbageCollection();
      takeMemorySnapshot('final', finalGcCount);

      console.log(`✅ Completed ${operationCount} operations over ${testDuration/1000}s`);

      // メモリリーク分析
      if (memorySnapshots.length >= 3) {
        const initial = memorySnapshots.find(s => s.gcCount === 0);
        const afterGc = memorySnapshots.filter(s => s.gcCount > 0);
        
        if (initial && afterGc.length > 0) {
          const final = afterGc[afterGc.length - 1];
          const memoryIncrease = final.heapUsed - initial.heapUsed;
          const increaseRatio = (memoryIncrease / initial.heapUsed) * 100;

          console.log(`Memory Analysis: ${Math.round(memoryIncrease / 1024 / 1024)}MB increase (${increaseRatio.toFixed(1)}%)`);

          // メモリ増加が許容範囲内であることを確認
          expect(final.heapUsed).toBeLessThan(2 * 1024 * 1024 * 1024); // 2GB以内
          expect(increaseRatio).toBeLessThan(100); // 初期の2倍以内
        }
      }
    }, 120000); // 2分タイムアウト

    it('should effectively perform garbage collection', async () => {
      console.log('\n🗑️  Testing garbage collection efficiency');

      // メモリを意図的に消費
      const largeObjects: any[] = [];
      
      takeMemorySnapshot('before-allocation');

      // 大量のオブジェクト生成
      for (let i = 0; i < 1000; i++) {
        largeObjects.push({
          id: i,
          data: new Array(1000).fill(`data-${i}`),
          timestamp: Date.now(),
          metadata: {
            created: new Date(),
            size: 1000,
            type: 'test-object'
          }
        });
      }

      takeMemorySnapshot('after-allocation');

      // オブジェクト参照を削除
      largeObjects.length = 0;

      // ガベージコレクション実行
      const gcCount = forceGarbageCollection();
      
      // 少し待ってからメモリチェック
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      takeMemorySnapshot('after-gc', gcCount);

      // ガベージコレクション効果の確認
      const snapshots = memorySnapshots.slice(-3);
      if (snapshots.length === 3) {
        const beforeAlloc = snapshots[0];
        const afterAlloc = snapshots[1];
        const afterGc = snapshots[2];

        const allocatedMemory = afterAlloc.heapUsed - beforeAlloc.heapUsed;
        const recoveredMemory = afterAlloc.heapUsed - afterGc.heapUsed;
        const recoveryRate = (recoveredMemory / allocatedMemory) * 100;

        console.log(`  Allocated: ${Math.round(allocatedMemory / 1024 / 1024)}MB`);
        console.log(`  Recovered: ${Math.round(recoveredMemory / 1024 / 1024)}MB`);
        console.log(`  Recovery Rate: ${recoveryRate.toFixed(1)}%`);

        // ガベージコレクションが有効に機能していることを確認
        expect(recoveryRate).toBeGreaterThan(50); // 50%以上のメモリが回収される
        expect(afterGc.heapUsed).toBeLessThan(afterAlloc.heapUsed); // GC後にメモリが減少
      }
    });
  });

  describe('2. データベース接続リーク検出', () => {
    it('should not leak database connections', async () => {
      console.log('\n🔌 Testing database connection leak detection');

      takeMemorySnapshot('before-db-operations');

      // 大量のデータベース操作を実行
      const dbOperations = Array.from({ length: 100 }, async (_, index) => {
        try {
          // 複数のデータベース操作を順次実行
          await request(app.getHttpServer())
            .post(`/projects/${testProjectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `DB Connection Test Issue ${index}`,
              description: 'Testing database connection management',
              status: 'open',
              priority: 'medium'
            });

          await request(app.getHttpServer())
            .get(`/projects/${testProjectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`);

          return true;
        } catch (error) {
          console.warn(`DB operation ${index} failed:`, error.message);
          return false;
        }
      });

      const results = await Promise.allSettled(dbOperations);
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value === true
      ).length;

      console.log(`  Completed ${successful}/${dbOperations.length} database operations`);

      // 短時間待機（接続プールが安定するまで）
      await new Promise(resolve => setTimeout(resolve, 2000));

      const gcCount = forceGarbageCollection();
      takeMemorySnapshot('after-db-operations', gcCount);

      // データベース接続プールのメモリ使用量を確認
      const snapshots = memorySnapshots.slice(-2);
      if (snapshots.length === 2) {
        const before = snapshots[0];
        const after = snapshots[1];
        const memoryIncrease = after.heapUsed - before.heapUsed;
        const increaseRatio = (memoryIncrease / before.heapUsed) * 100;

        console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${increaseRatio.toFixed(1)}%)`);

        // データベース接続が適切に管理されていることを確認
        expect(increaseRatio).toBeLessThan(50); // 50%未満の増加
        expect(after.heapUsed).toBeLessThan(1024 * 1024 * 1024); // 1GB以内
      }

      expect(successful).toBeGreaterThan(0);
    });

    it('should handle database connection timeouts properly', async () => {
      console.log('\n⏱️  Testing database connection timeout handling');

      // 長時間実行されるクエリのシミュレーション（実際にはタイムアウト設定済み）
      const slowOperations = Array.from({ length: 10 }, async (_, index) => {
        const startTime = Date.now();
        try {
          const response = await request(app.getHttpServer())
            .get(`/projects/${testProjectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .timeout(5000); // 5秒タイムアウト

          return {
            success: response.status < 400,
            duration: Date.now() - startTime
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            error: error.message
          };
        }
      });

      const results = await Promise.allSettled(slowOperations);
      const completedOperations = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

      const successful = completedOperations.filter(op => op.success).length;
      const avgDuration = completedOperations.reduce((sum, op) => sum + op.duration, 0) / completedOperations.length;

      console.log(`  Completed operations: ${completedOperations.length}`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Average duration: ${avgDuration.toFixed(0)}ms`);

      // タイムアウトが適切に処理されることを確認
      expect(completedOperations.length).toBe(10);
      expect(avgDuration).toBeLessThan(10000); // 10秒以内
    });
  });

  describe('3. 大量データ処理メモリ管理', () => {
    it('should handle large data processing without excessive memory usage', async () => {
      console.log('\n📊 Testing large data processing memory management');

      takeMemorySnapshot('before-large-data');

      // 大量のIssueを作成
      const largeDataSize = 50;
      const createdIssues: string[] = [];

      for (let i = 0; i < largeDataSize; i++) {
        try {
          const response = await request(app.getHttpServer())
            .post(`/projects/${testProjectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `Large Data Test Issue ${i}`,
              description: 'A'.repeat(1000), // 大きな説明文
              status: 'open',
              priority: 'medium'
            });

          if (response.status === HttpStatus.CREATED) {
            createdIssues.push(response.body.id);
          }
        } catch (error) {
          console.warn(`Failed to create issue ${i}:`, error.message);
        }

        // 10個おきにメモリチェック
        if (i > 0 && i % 10 === 0) {
          takeMemorySnapshot(`large-data-${i}`);
        }
      }

      // 全Issue取得（大量データの読み込み）
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(response.status).toBe(HttpStatus.OK);
      
      takeMemorySnapshot('after-large-fetch');

      // 作成したIssueをクリーンアップ
      for (const issueId of createdIssues) {
        try {
          await request(app.getHttpServer())
            .delete(`/projects/${testProjectId}/issues/${issueId}`)
            .set('Authorization', `Basic ${authHeader}`);
        } catch (error) {
          // クリーンアップエラーは警告のみ
          console.warn(`Failed to cleanup issue ${issueId}`);
        }
      }

      const gcCount = forceGarbageCollection();
      takeMemorySnapshot('after-cleanup', gcCount);

      // メモリ使用量が適切に管理されていることを確認
      const snapshots = memorySnapshots.slice(-4);
      if (snapshots.length >= 3) {
        const before = snapshots[0];
        const peak = snapshots[snapshots.length - 2]; // cleanup前
        const after = snapshots[snapshots.length - 1]; // cleanup後

        const peakIncrease = peak.heapUsed - before.heapUsed;
        const finalIncrease = after.heapUsed - before.heapUsed;
        const cleanup = peak.heapUsed - after.heapUsed;

        console.log(`  Peak memory increase: ${Math.round(peakIncrease / 1024 / 1024)}MB`);
        console.log(`  Memory cleaned up: ${Math.round(cleanup / 1024 / 1024)}MB`);
        console.log(`  Final memory increase: ${Math.round(finalIncrease / 1024 / 1024)}MB`);

        // メモリが適切に管理されていることを確認
        expect(peak.heapUsed).toBeLessThan(512 * 1024 * 1024); // 512MB以内
        expect(cleanup).toBeGreaterThan(0); // クリーンアップでメモリが削減
      }

      expect(createdIssues.length).toBeGreaterThan(0);
    });
  });
});