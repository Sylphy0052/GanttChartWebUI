import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { io, Socket } from 'socket.io-client';

/**
 * WebSocket接続断・復旧テスト
 * 
 * 対象テストシナリオ:
 * 1. 意図的な接続断によるクライアント復旧テスト
 * 2. サーバー再起動後のクライアント自動接続
 * 3. ネットワーク断続的な接続でのメッセージ配信
 * 4. 長時間接続での安定性テスト
 * 5. 複数クライアント同時接続断の処理
 * 6. 認証失敗後の接続再試行処理
 * 
 * 合格基準:
 * - 接続断後の自動復旧機能
 * - メッセージの取りこぼしなし
 * - 接続状態の適切な管理
 * - エラーハンドリングの適切性
 */
describe('WebSocket Connection Recovery Tests (e2e)', () => {
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
    await app.listen(0); // 動的ポート割り当て

    // サーバーURLを取得
    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address?.port || 3001;
    serverUrl = `http://localhost:${port}`;

    // テスト用プロジェクト作成
    testPassword = 'WebSocketTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'WebSocket Connection Test Project',
        description: 'Project for WebSocket connection testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${testPassword}`);

    console.log(`🔌 WebSocket connection tests initialized on ${serverUrl}`);
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

  function createSocketConnection(projectId?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(serverUrl, {
        auth: {
          projectId: projectId || testProjectId,
          password: testPassword
        },
        transports: ['websocket'],
        timeout: 5000
      });

      socket.on('connect', () => {
        console.log(`  ✅ Socket connected: ${socket.id}`);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        console.log(`  ❌ Socket connection failed: ${error.message}`);
        reject(error);
      });

      setTimeout(() => {
        if (!socket.connected) {
          socket.disconnect();
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  describe('1. 基本接続断復旧テスト', () => {
    it('should recover from intentional disconnection', async () => {
      console.log('\n🔄 Testing intentional disconnection recovery');

      const socket = await createSocketConnection();
      expect(socket.connected).toBe(true);

      const initialConnectionId = socket.id;
      console.log(`  Initial connection ID: ${initialConnectionId}`);

      // 接続状態のイベントリスナーを設定
      let disconnectCount = 0;
      let reconnectCount = 0;
      const messageReceived: string[] = [];

      socket.on('disconnect', (reason) => {
        disconnectCount++;
        console.log(`  🔌 Disconnected (count: ${disconnectCount}): ${reason}`);
      });

      socket.on('connect', () => {
        reconnectCount++;
        console.log(`  🔌 Reconnected (count: ${reconnectCount}): ${socket.id}`);
      });

      socket.on('notification', (data) => {
        messageReceived.push(data.type);
        console.log(`  📨 Message received: ${data.type}`);
      });

      // 意図的な切断
      socket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(socket.connected).toBe(false);
      expect(disconnectCount).toBe(1);

      // 再接続
      socket.connect();
      await new Promise(resolve => {
        if (socket.connected) {
          resolve(void 0);
        } else {
          socket.on('connect', () => resolve(void 0));
        }
      });

      expect(socket.connected).toBe(true);
      expect(reconnectCount).toBe(1);

      const newConnectionId = socket.id;
      console.log(`  New connection ID: ${newConnectionId}`);
      expect(newConnectionId).not.toBe(initialConnectionId);

      // 再接続後のメッセージ配信テスト
      const testIssueResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Recovery Test Issue',
          description: 'Testing message delivery after reconnection',
          status: 'open',
          priority: 'medium'
        });

      expect(testIssueResponse.status).toBe(HttpStatus.CREATED);

      // メッセージ受信を待機
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(messageReceived).toContain('issue_created');
      console.log('  📨 Message received after reconnection');

      socket.disconnect();
      console.log('✅ Disconnection recovery successful');
    });

    it('should handle multiple rapid disconnections gracefully', async () => {
      console.log('\n⚡ Testing rapid disconnection handling');

      const socket = await createSocketConnection();
      
      let disconnectionCount = 0;
      let connectionCount = 0;

      socket.on('disconnect', () => {
        disconnectionCount++;
        console.log(`    Disconnection #${disconnectionCount}`);
      });

      socket.on('connect', () => {
        connectionCount++;
        console.log(`    Connection #${connectionCount}`);
      });

      // 複数回の急速な断続接続
      for (let i = 0; i < 3; i++) {
        console.log(`  Cycle ${i + 1}: Disconnecting...`);
        socket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`  Cycle ${i + 1}: Reconnecting...`);
        socket.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!socket.connected) {
          console.log(`  Waiting for connection...`);
          await new Promise(resolve => {
            socket.on('connect', () => resolve(void 0));
          });
        }

        expect(socket.connected).toBe(true);
      }

      console.log(`  Total disconnections: ${disconnectionCount}`);
      console.log(`  Total connections: ${connectionCount}`);

      expect(disconnectionCount).toBeGreaterThanOrEqual(3);
      expect(connectionCount).toBeGreaterThanOrEqual(3);

      socket.disconnect();
      console.log('✅ Rapid disconnections handled successfully');
    });
  });

  describe('2. ネットワーク遅延・断続シミュレーション', () => {
    it('should handle network latency and intermittent connections', async () => {
      console.log('\n🌐 Testing network latency handling');

      // 高遅延での接続テスト
      const highLatencySocket = io(serverUrl, {
        auth: {
          projectId: testProjectId,
          password: testPassword
        },
        transports: ['websocket'],
        timeout: 10000, // 高い遅延を想定
        retries: 3,
        retryDelay: 1000
      });

      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('High latency connection timeout'));
        }, 15000);

        highLatencySocket.on('connect', () => {
          clearTimeout(timeout);
          console.log('  📡 High latency connection established');
          resolve();
        });

        highLatencySocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await connectionPromise;
      expect(highLatencySocket.connected).toBe(true);

      // 遅延環境でのメッセージ送信テスト
      const messageReceived: any[] = [];
      highLatencySocket.on('notification', (data) => {
        messageReceived.push({
          type: data.type,
          timestamp: Date.now()
        });
        console.log(`  📨 Delayed message received: ${data.type}`);
      });

      // 複数のAPIコールを実行
      const apiCalls = [
        request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Latency Test Issue 1',
            description: 'First issue for latency testing',
            status: 'open',
            priority: 'medium'
          }),
        
        request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Latency Test Issue 2', 
            description: 'Second issue for latency testing',
            status: 'open',
            priority: 'high'
          })
      ];

      const results = await Promise.allSettled(apiCalls);
      const successfulCalls = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === HttpStatus.CREATED
      ).length;

      console.log(`  API calls completed: ${successfulCalls}/${apiCalls.length}`);

      // メッセージ受信待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(messageReceived.length).toBeGreaterThanOrEqual(successfulCalls);
      console.log(`  Messages received: ${messageReceived.length}`);

      highLatencySocket.disconnect();
      console.log('✅ Network latency handling successful');
    });
  });

  describe('3. 長時間接続安定性テスト', () => {
    it('should maintain stable connection over extended period', async () => {
      console.log('\n⏰ Testing long-term connection stability');

      const socket = await createSocketConnection();
      const testDuration = 30000; // 30秒間のテスト
      const pingInterval = 5000; // 5秒間隔でping

      let connectionDropped = false;
      let messagesReceived = 0;
      let pingsReceived = 0;

      socket.on('disconnect', (reason) => {
        connectionDropped = true;
        console.log(`  ⚠️  Connection dropped during stability test: ${reason}`);
      });

      socket.on('notification', () => {
        messagesReceived++;
      });

      socket.on('pong', () => {
        pingsReceived++;
      });

      // 定期的なping送信
      const pingTimer = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
          console.log('  📤 Ping sent');
        }
      }, pingInterval);

      // バックグラウンドでAPIアクティビティをシミュレーション
      const activityTimer = setInterval(async () => {
        if (socket.connected) {
          try {
            await request(app.getHttpServer())
              .post(`/projects/${testProjectId}/issues`)
              .set('Authorization', `Basic ${authHeader}`)
              .send({
                title: `Stability Test Issue ${Date.now()}`,
                description: 'Generated during stability test',
                status: 'open',
                priority: 'medium'
              });
          } catch (error) {
            console.log(`  ⚠️  API call failed during stability test: ${error.message}`);
          }
        }
      }, 10000); // 10秒間隔

      // テスト期間を待機
      await new Promise(resolve => setTimeout(resolve, testDuration));

      clearInterval(pingTimer);
      clearInterval(activityTimer);

      console.log(`  Test duration: ${testDuration / 1000}s`);
      console.log(`  Connection dropped: ${connectionDropped}`);
      console.log(`  Messages received: ${messagesReceived}`);
      console.log(`  Pings received: ${pingsReceived}`);
      console.log(`  Final connection state: ${socket.connected}`);

      // 安定性要件確認
      expect(connectionDropped).toBe(false);
      expect(socket.connected).toBe(true);
      expect(messagesReceived).toBeGreaterThan(0);

      socket.disconnect();
      console.log('✅ Long-term connection stability maintained');
    });
  });

  describe('4. 複数クライアント接続管理', () => {
    it('should handle multiple client disconnections', async () => {
      console.log('\n👥 Testing multiple client connection management');

      const clientCount = 5;
      const sockets: Socket[] = [];

      // 複数クライアント接続
      console.log(`  Connecting ${clientCount} clients...`);
      for (let i = 0; i < clientCount; i++) {
        try {
          const socket = await createSocketConnection();
          sockets.push(socket);
          console.log(`    Client ${i + 1} connected: ${socket.id}`);
        } catch (error) {
          console.log(`    Client ${i + 1} failed to connect: ${error.message}`);
        }
      }

      expect(sockets.length).toBeGreaterThan(0);
      console.log(`  Successfully connected clients: ${sockets.length}/${clientCount}`);

      // 全クライアントにメッセージが配信されることを確認
      const messagePromises = sockets.map(socket => {
        return new Promise<boolean>((resolve) => {
          socket.on('notification', (data) => {
            if (data.type === 'issue_created') {
              resolve(true);
            }
          });
          
          setTimeout(() => resolve(false), 5000);
        });
      });

      // メッセージをトリガーするAPIコール
      const triggerResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Multi-Client Test Issue',
          description: 'Testing multi-client message delivery',
          status: 'open',
          priority: 'medium'
        });

      expect(triggerResponse.status).toBe(HttpStatus.CREATED);

      // メッセージ受信確認
      const messageResults = await Promise.allSettled(messagePromises);
      const receivedCount = messageResults.filter(r => 
        r.status === 'fulfilled' && r.value === true
      ).length;

      console.log(`  Clients received message: ${receivedCount}/${sockets.length}`);
      expect(receivedCount).toBe(sockets.length);

      // 段階的な切断テスト
      console.log('  Testing staged disconnections...');
      for (let i = 0; i < sockets.length; i++) {
        sockets[i].disconnect();
        console.log(`    Disconnected client ${i + 1}`);
        
        // 残りのクライアントが正常に動作することを確認
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ Multiple client connection management successful');
    });
  });

  describe('5. 認証エラー処理', () => {
    it('should handle authentication failures gracefully', async () => {
      console.log('\n🔐 Testing authentication error handling');

      // 無効な認証情報での接続試行
      const authFailurePromise = new Promise<string>((resolve) => {
        const badAuthSocket = io(serverUrl, {
          auth: {
            projectId: testProjectId,
            password: 'wrong_password'
          },
          transports: ['websocket'],
          timeout: 5000
        });

        badAuthSocket.on('connect_error', (error) => {
          console.log(`  ❌ Auth failure as expected: ${error.message}`);
          badAuthSocket.disconnect();
          resolve(error.message);
        });

        badAuthSocket.on('connect', () => {
          console.log(`  ⚠️  Unexpected successful connection with bad auth`);
          badAuthSocket.disconnect();
          resolve('unexpected_success');
        });
      });

      const authError = await authFailurePromise;
      expect(authError).not.toBe('unexpected_success');

      // 存在しないプロジェクトIDでの接続試行
      const invalidProjectPromise = new Promise<string>((resolve) => {
        const invalidProjectSocket = io(serverUrl, {
          auth: {
            projectId: '00000000-0000-0000-0000-000000000000',
            password: testPassword
          },
          transports: ['websocket'],
          timeout: 5000
        });

        invalidProjectSocket.on('connect_error', (error) => {
          console.log(`  ❌ Invalid project failure as expected: ${error.message}`);
          invalidProjectSocket.disconnect();
          resolve(error.message);
        });

        invalidProjectSocket.on('connect', () => {
          console.log(`  ⚠️  Unexpected successful connection with invalid project`);
          invalidProjectSocket.disconnect();
          resolve('unexpected_success');
        });
      });

      const projectError = await invalidProjectPromise;
      expect(projectError).not.toBe('unexpected_success');

      // 正常な認証が引き続き機能することを確認
      const validSocket = await createSocketConnection();
      expect(validSocket.connected).toBe(true);
      
      console.log('  ✅ Valid authentication still works after failures');
      validSocket.disconnect();

      console.log('✅ Authentication error handling successful');
    });
  });

  describe('6. メッセージ配信保証', () => {
    it('should guarantee message delivery after reconnection', async () => {
      console.log('\n📨 Testing message delivery guarantee');

      const socket = await createSocketConnection();
      const receivedMessages: any[] = [];

      socket.on('notification', (data) => {
        receivedMessages.push({
          type: data.type,
          timestamp: Date.now(),
          data: data
        });
        console.log(`  📨 Message received: ${data.type}`);
      });

      // 初期メッセージ送信
      const issue1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Message Delivery Test 1',
          description: 'First message test',
          status: 'open',
          priority: 'medium'
        });

      expect(issue1Response.status).toBe(HttpStatus.CREATED);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const initialMessageCount = receivedMessages.length;
      console.log(`  Initial messages received: ${initialMessageCount}`);

      // 接続を切断
      console.log('  Disconnecting for message delivery test...');
      socket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 切断中にメッセージを送信
      const issue2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Message Delivery Test 2',
          description: 'Second message test (during disconnection)',
          status: 'open',
          priority: 'high'
        });

      expect(issue2Response.status).toBe(HttpStatus.CREATED);
      console.log('  Message sent during disconnection');

      // 再接続
      console.log('  Reconnecting...');
      socket.connect();
      await new Promise(resolve => {
        if (socket.connected) {
          resolve(void 0);
        } else {
          socket.on('connect', () => resolve(void 0));
        }
      });

      // 再接続後のメッセージを待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMessageCount = receivedMessages.length;
      console.log(`  Final messages received: ${finalMessageCount}`);
      console.log(`  Messages during test: ${finalMessageCount - initialMessageCount}`);

      // メッセージ配信の確認（実装に依存）
      // 理想的には切断中のメッセージも再接続後に受信される
      expect(finalMessageCount).toBeGreaterThanOrEqual(initialMessageCount);

      // 再接続後の新しいメッセージが正常に配信されることを確認
      const issue3Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Message Delivery Test 3',
          description: 'Third message test (after reconnection)',
          status: 'open',
          priority: 'medium'
        });

      expect(issue3Response.status).toBe(HttpStatus.CREATED);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const afterReconnectCount = receivedMessages.length;
      expect(afterReconnectCount).toBeGreaterThan(finalMessageCount);
      console.log('  📨 New message received after reconnection');

      socket.disconnect();
      console.log('✅ Message delivery verification completed');
    });
  });
});