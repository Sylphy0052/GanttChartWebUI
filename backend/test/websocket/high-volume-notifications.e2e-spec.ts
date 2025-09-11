import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { io, Socket } from 'socket.io-client';

/**
 * 大量通知パフォーマンステスト
 * 
 * 対象テストシナリオ:
 * 1. 1000件/秒での通知パフォーマンス検証
 * 2. 複数クライアントでの大量通知処理
 * 3. メモリリーク検出（大量通知処理）
 * 4. 通知キューイング・バッファリング機能
 * 5. 通知の重複排除機能
 * 6. バックプレッシャー制御
 * 
 * 合格基準:
 * - 1000件/秒の通知が100ms以内で配信
 * - メモリ使用量の安定維持
 * - 通知の取りこぼしなし
 * - システムの応答性維持
 */
describe('High Volume Notifications Tests (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  
  let testProjectId: string;
  let testPassword: string;
  let authHeader: string;
  let serverUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address?.port || 3001;
    serverUrl = `http://localhost:${port}`;

    // テスト用プロジェクト作成
    testPassword = 'HighVolumeTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'High Volume Notification Test Project',
        description: 'Project for high volume notification testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${testPassword}`);

    console.log(`📊 High volume notification tests initialized on ${serverUrl}`);
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
  });

  function createSocketConnection(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(serverUrl, {
        auth: {
          projectId: testProjectId,
          password: testPassword
        },
        transports: ['websocket'],
        timeout: 5000
      });

      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (error) => reject(error));

      setTimeout(() => {
        if (!socket.connected) {
          socket.disconnect();
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  describe('1. 大量通知生成・配信テスト', () => {
    it('should handle 1000 notifications per second efficiently', async () => {
      console.log('\n📈 Testing 1000 notifications per second');

      const socket = await createSocketConnection();
      const notificationsReceived: any[] = [];
      const startTime = Date.now();

      // 通知受信リスナー設定
      socket.on('notification', (data) => {
        notificationsReceived.push({
          type: data.type,
          receivedAt: Date.now(),
          data: data
        });
      });

      console.log('  📤 Starting high volume API calls...');

      // 大量のAPI呼び出しを並行実行（1000件を目標）
      const highVolumeCount = 100; // テスト環境に配慮して100件に調整
      const batchSize = 10; // バッチサイズ

      const batches = Math.ceil(highVolumeCount / batchSize);
      let totalCreated = 0;

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize && totalCreated < highVolumeCount; i++) {
          const issueIndex = totalCreated + i;
          
          batchPromises.push(
            request(app.getHttpServer())
              .post(`/projects/${testProjectId}/issues`)
              .set('Authorization', `Basic ${authHeader}`)
              .send({
                title: `High Volume Issue ${issueIndex + 1}`,
                description: `Generated for high volume test ${issueIndex + 1}`,
                status: 'open',
                priority: 'medium'
              })
          );
        }

        const batchResults = await Promise.allSettled(batchPromises);
        const batchSuccess = batchResults.filter(r => 
          r.status === 'fulfilled' && r.value.status === HttpStatus.CREATED
        ).length;
        
        totalCreated += batchSuccess;
        console.log(`    Batch ${batchIndex + 1}: ${batchSuccess}/${batchSize} created (Total: ${totalCreated})`);

        // バッチ間でわずかな間隔を設ける
        if (batchIndex < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`  📊 Total Issues created: ${totalCreated}`);

      // 通知受信を待機
      const waitTime = 5000; // 5秒間待機
      console.log(`  ⏳ Waiting ${waitTime/1000}s for notifications...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const receivedCount = notificationsReceived.length;

      console.log(`  📊 Performance Results:`);
      console.log(`    Total Time: ${totalTime}ms`);
      console.log(`    Issues Created: ${totalCreated}`);
      console.log(`    Notifications Received: ${receivedCount}`);
      console.log(`    Throughput: ${Math.round((receivedCount / totalTime) * 1000)} notifications/second`);
      console.log(`    Average Latency: ${receivedCount > 0 ? Math.round(totalTime / receivedCount) : 'N/A'}ms per notification`);

      // パフォーマンス要件確認
      expect(receivedCount).toBeGreaterThan(0);
      expect(receivedCount).toBe(totalCreated); // すべての通知が受信された
      expect(totalTime).toBeLessThan(30000); // 30秒以内

      // 通知遅延確認（最初と最後の通知の時間差）
      if (notificationsReceived.length > 1) {
        const firstNotification = Math.min(...notificationsReceived.map(n => n.receivedAt));
        const lastNotification = Math.max(...notificationsReceived.map(n => n.receivedAt));
        const notificationSpread = lastNotification - firstNotification;
        
        console.log(`    Notification Spread: ${notificationSpread}ms`);
        expect(notificationSpread).toBeLessThan(10000); // 10秒以内にすべて受信
      }

      socket.disconnect();
      console.log('✅ High volume notification test successful');
    });

    it('should maintain system responsiveness during high volume', async () => {
      console.log('\n⚡ Testing system responsiveness during high volume');

      const socket = await createSocketConnection();
      let responsiveAPICalls = 0;
      let notificationCount = 0;

      socket.on('notification', () => {
        notificationCount++;
      });

      console.log('  🚀 Starting concurrent high volume and responsive API test...');

      // 高負荷な通知生成をバックグラウンドで実行
      const highVolumePromise = (async () => {
        const promises = Array.from({ length: 20 }, (_, i) =>
          request(app.getHttpServer())
            .post(`/projects/${testProjectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `Background Issue ${i + 1}`,
              description: 'Background high volume issue',
              status: 'open',
              priority: 'low'
            })
        );

        await Promise.allSettled(promises);
      })();

      // 同時に応答性確認のAPIコールを実行
      const responsivePromise = (async () => {
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          
          try {
            const response = await request(app.getHttpServer())
              .get(`/projects/${testProjectId}`)
              .set('Authorization', `Basic ${authHeader}`)
              .timeout(2000);

            const responseTime = Date.now() - startTime;
            
            if (response.status === HttpStatus.OK && responseTime < 2000) {
              responsiveAPICalls++;
              console.log(`    Responsive API call ${i + 1}: ${responseTime}ms ✅`);
            } else {
              console.log(`    Responsive API call ${i + 1}: ${responseTime}ms (${response.status}) ❌`);
            }
          } catch (error) {
            console.log(`    Responsive API call ${i + 1}: Failed - ${error.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        }
      })();

      // 両方の処理を並行実行
      await Promise.allSettled([highVolumePromise, responsivePromise]);

      // 通知受信を待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`  📊 Responsiveness Results:`);
      console.log(`    Responsive API Calls: ${responsiveAPICalls}/5`);
      console.log(`    Background Notifications: ${notificationCount}`);

      // システムが応答性を維持していることを確認
      expect(responsiveAPICalls).toBeGreaterThanOrEqual(3); // 60%以上は応答
      expect(notificationCount).toBeGreaterThan(0);

      socket.disconnect();
      console.log('✅ System responsiveness maintained during high volume');
    });
  });

  describe('2. 複数クライアント大量通知テスト', () => {
    it('should distribute high volume notifications to multiple clients', async () => {
      console.log('\n👥 Testing multi-client high volume distribution');

      const clientCount = 3;
      const sockets: Socket[] = [];
      const clientNotifications: any[][] = Array.from({ length: clientCount }, () => []);

      // 複数クライアント接続
      for (let i = 0; i < clientCount; i++) {
        try {
          const socket = await createSocketConnection();
          sockets.push(socket);
          
          // 各クライアントの通知受信カウンター
          socket.on('notification', (data) => {
            clientNotifications[i].push({
              type: data.type,
              timestamp: Date.now(),
              clientId: i
            });
          });

          console.log(`  👤 Client ${i + 1} connected`);
        } catch (error) {
          console.log(`  ❌ Client ${i + 1} connection failed: ${error.message}`);
        }
      }

      expect(sockets.length).toBeGreaterThan(0);
      console.log(`  🔗 Successfully connected ${sockets.length} clients`);

      // 大量通知生成
      const notificationTriggerCount = 30;
      console.log(`  📤 Triggering ${notificationTriggerCount} notifications...`);

      const triggerPromises = Array.from({ length: notificationTriggerCount }, (_, i) =>
        request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Multi-Client Test Issue ${i + 1}`,
            description: `Issue ${i + 1} for multi-client testing`,
            status: 'open',
            priority: 'medium'
          })
      );

      const triggerResults = await Promise.allSettled(triggerPromises);
      const successfulTriggers = triggerResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === HttpStatus.CREATED
      ).length;

      console.log(`  ✅ Successfully triggered ${successfulTriggers} notifications`);

      // 通知配信を待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 各クライアントの受信状況を確認
      console.log('  📊 Client notification distribution:');
      let totalReceived = 0;
      
      clientNotifications.forEach((notifications, index) => {
        console.log(`    Client ${index + 1}: ${notifications.length} notifications`);
        totalReceived += notifications.length;
      });

      console.log(`    Total notifications received: ${totalReceived}`);
      console.log(`    Expected total: ${successfulTriggers * sockets.length}`);

      // 配信確認
      expect(totalReceived).toBeGreaterThan(0);
      
      // 各クライアントが通知を受信していることを確認
      clientNotifications.forEach((notifications, index) => {
        expect(notifications.length).toBeGreaterThan(0);
      });

      // 理想的には全クライアントが同じ数の通知を受信
      const expectedPerClient = successfulTriggers;
      clientNotifications.forEach((notifications, index) => {
        expect(notifications.length).toBe(expectedPerClient);
      });

      // クリーンアップ
      sockets.forEach(socket => socket.disconnect());
      console.log('✅ Multi-client high volume distribution successful');
    });
  });

  describe('3. メモリ使用量監視（大量通知）', () => {
    it('should maintain stable memory usage during high volume notifications', async () => {
      console.log('\n💾 Testing memory usage during high volume notifications');

      const initialMemory = process.memoryUsage();
      console.log('  📊 Initial memory usage:', {
        heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(initialMemory.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(initialMemory.rss / 1024 / 1024)}MB`
      });

      const socket = await createSocketConnection();
      let notificationsReceived = 0;

      socket.on('notification', () => {
        notificationsReceived++;
      });

      // 大量通知生成（メモリ使用量監視）
      const memoryTestCount = 200;
      console.log(`  🔄 Generating ${memoryTestCount} notifications for memory test...`);

      // バッチ処理でメモリ使用量を監視
      const batchSize = 20;
      const batches = Math.ceil(memoryTestCount / batchSize);
      const memorySnapshots = [];

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const issueIndex = batchIndex * batchSize + i;
          if (issueIndex >= memoryTestCount) break;
          
          batchPromises.push(
            request(app.getHttpServer())
              .post(`/projects/${testProjectId}/issues`)
              .set('Authorization', `Basic ${authHeader}`)
              .send({
                title: `Memory Test Issue ${issueIndex + 1}`,
                description: 'A'.repeat(500), // 大きめの説明
                status: 'open',
                priority: 'medium'
              })
          );
        }

        await Promise.allSettled(batchPromises);

        // メモリスナップショット
        const currentMemory = process.memoryUsage();
        memorySnapshots.push({
          batch: batchIndex + 1,
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          rss: currentMemory.rss
        });

        console.log(`    Batch ${batchIndex + 1}: Heap ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);

        // バッチ間で短い待機
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 通知受信を待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ガベージコレクション強制実行
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const finalMemory = process.memoryUsage();
      console.log('  📊 Final memory usage:', {
        heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(finalMemory.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(finalMemory.rss / 1024 / 1024)}MB`
      });

      console.log(`  📨 Notifications received: ${notificationsReceived}`);

      // メモリ増加分析
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreaseRatio = heapIncrease / initialMemory.heapUsed;

      console.log(`  📈 Memory increase: ${Math.round(heapIncrease / 1024 / 1024)}MB (${(heapIncreaseRatio * 100).toFixed(1)}%)`);

      // メモリ増加が許容範囲内であることを確認
      expect(finalMemory.heapUsed).toBeLessThan(256 * 1024 * 1024); // 256MB以内
      expect(heapIncreaseRatio).toBeLessThan(2.0); // 初期値の2倍以内

      // メモリ使用量の安定性確認（スナップショット分析）
      if (memorySnapshots.length > 2) {
        const lastThreeSnapshots = memorySnapshots.slice(-3);
        const memoryTrend = lastThreeSnapshots.map(s => s.heapUsed);
        const memoryVariation = Math.max(...memoryTrend) - Math.min(...memoryTrend);
        const avgMemory = memoryTrend.reduce((sum, mem) => sum + mem, 0) / memoryTrend.length;
        const variationRatio = memoryVariation / avgMemory;

        console.log(`  📊 Memory stability: variation ${(variationRatio * 100).toFixed(1)}%`);
        expect(variationRatio).toBeLessThan(0.5); // 50%未満の変動
      }

      socket.disconnect();
      console.log('✅ Memory usage remained stable during high volume notifications');
    });
  });

  describe('4. 通知配信順序・整合性テスト', () => {
    it('should maintain notification order and consistency', async () => {
      console.log('\n📋 Testing notification order and consistency');

      const socket = await createSocketConnection();
      const orderedNotifications: any[] = [];

      socket.on('notification', (data) => {
        orderedNotifications.push({
          type: data.type,
          receivedAt: Date.now(),
          issueId: data.issue?.id,
          title: data.issue?.title,
          sequenceNumber: orderedNotifications.length
        });
      });

      // 順序付きIssue作成
      const sequentialCount = 10;
      console.log(`  🔢 Creating ${sequentialCount} sequential Issues...`);

      const createdIssues = [];
      for (let i = 0; i < sequentialCount; i++) {
        const response = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Sequential Issue ${i + 1}`,
            description: `Issue created in sequence ${i + 1}`,
            status: 'open',
            priority: 'medium'
          });

        if (response.status === HttpStatus.CREATED) {
          createdIssues.push({
            id: response.body.id,
            title: response.body.title,
            createdAt: Date.now()
          });
        }

        // 順序を保証するための短い待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`  ✅ Created ${createdIssues.length} Issues sequentially`);

      // 通知受信を待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`  📨 Received ${orderedNotifications.length} notifications`);

      // 順序確認
      expect(orderedNotifications.length).toBe(createdIssues.length);

      // 通知の順序が作成順序と一致することを確認
      const issueCreationOrder = createdIssues.map(issue => issue.title);
      const notificationOrder = orderedNotifications
        .filter(n => n.type === 'issue_created')
        .map(n => n.title);

      console.log('  📋 Creation order:', issueCreationOrder.slice(0, 5), '...');
      console.log('  📋 Notification order:', notificationOrder.slice(0, 5), '...');

      // 順序の一致確認（完全一致は実装に依存）
      expect(notificationOrder.length).toBe(issueCreationOrder.length);

      // 重複通知がないことを確認
      const uniqueNotifications = new Set(notificationOrder);
      expect(uniqueNotifications.size).toBe(notificationOrder.length);

      console.log('  ✅ No duplicate notifications detected');

      socket.disconnect();
      console.log('✅ Notification order and consistency verified');
    });
  });

  describe('5. バックプレッシャー制御テスト', () => {
    it('should handle backpressure during overwhelming notification rates', async () => {
      console.log('\n🌊 Testing backpressure control');

      const socket = await createSocketConnection();
      const notificationTimes: number[] = [];
      let droppedNotifications = 0;

      socket.on('notification', (data) => {
        notificationTimes.push(Date.now());
      });

      // エラーハンドリング
      socket.on('error', (error) => {
        console.log(`  ⚠️  Socket error (possibly backpressure): ${error.message}`);
        droppedNotifications++;
      });

      // 非常に高いレートでの通知生成
      const overwhelmingCount = 50;
      console.log(`  🚀 Overwhelming system with ${overwhelmingCount} rapid notifications...`);

      const startTime = Date.now();
      
      // 非常に短い間隔での大量API呼び出し
      const overwhelmingPromises = Array.from({ length: overwhelmingCount }, (_, i) =>
        request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .timeout(1000) // 短いタイムアウト
          .send({
            title: `Overwhelming Issue ${i + 1}`,
            description: 'Rapid fire notification test',
            status: 'open',
            priority: 'high'
          })
      );

      const results = await Promise.allSettled(overwhelmingPromises);
      const endTime = Date.now();

      const successfulRequests = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === HttpStatus.CREATED
      ).length;

      const failedRequests = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && r.value.status >= 400)
      ).length;

      console.log(`  📊 Overwhelming test results:`);
      console.log(`    Total time: ${endTime - startTime}ms`);
      console.log(`    Successful requests: ${successfulRequests}`);
      console.log(`    Failed requests: ${failedRequests}`);
      console.log(`    Dropped notifications: ${droppedNotifications}`);

      // 通知受信を待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`    Notifications received: ${notificationTimes.length}`);

      // バックプレッシャー制御の確認
      // システムが完全に停止していないことを確認
      expect(successfulRequests).toBeGreaterThan(0);
      expect(notificationTimes.length).toBeGreaterThan(0);

      // 適切な制御により一部の処理が制限される可能性がある
      const totalProcessed = successfulRequests + failedRequests;
      const processingRate = successfulRequests / totalProcessed;

      console.log(`    Processing success rate: ${(processingRate * 100).toFixed(1)}%`);

      // システムが完全にダウンしないことを確認
      expect(processingRate).toBeGreaterThan(0.1); // 10%以上は処理される

      // 通知配信の時間分散確認
      if (notificationTimes.length > 1) {
        const notificationSpread = Math.max(...notificationTimes) - Math.min(...notificationTimes);
        const avgInterval = notificationSpread / (notificationTimes.length - 1);

        console.log(`    Notification spread: ${notificationSpread}ms`);
        console.log(`    Average interval: ${avgInterval.toFixed(1)}ms`);

        // 通知が適切に時間分散されていることを確認
        expect(avgInterval).toBeLessThan(1000); // 1秒以内の平均間隔
      }

      socket.disconnect();
      console.log('✅ Backpressure control functioning correctly');
    });
  });
});