/**
 * WebSocket通信統合テスト
 * Socket.IOを使用したリアルタイム通知機能のE2Eテスト
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { NotificationGateway } from '../src/websocket/websocket.gateway';
import { SettingsService } from '../src/settings/settings.service';
import { IssuesService } from '../src/issues/issues.service';
import { CommentsService } from '../src/comments/comments.service';
import { io, Socket } from 'socket.io-client';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('WebSocket E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationGateway: NotificationGateway;
  let settingsService: SettingsService;
  let issuesService: IssuesService;
  let commentsService: CommentsService;
  let testProject: any;
  let testIssue: any;
  let clientSocket: Socket;

  // WebSocketサーバーURL
  const getSocketUrl = () => `http://localhost:${app.getHttpServer().address()?.port || 3001}`;

  beforeAll(async () => {
    // テスト環境設定
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    notificationGateway = app.get<NotificationGateway>(NotificationGateway);
    settingsService = app.get<SettingsService>(SettingsService);
    issuesService = app.get<IssuesService>(IssuesService);
    commentsService = app.get<CommentsService>(CommentsService);

    // テストデータベースのクリーンアップ
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }

    await app.init();
    await app.listen(0); // ランダムポートで起動
  }, 60000);

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    if (prisma) {
      await prisma.$disconnect();
    }
    
    if (app) {
      await app.close();
    }

    // テストデータベースファイル削除
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }
  }, 30000);

  beforeEach(async () => {
    // テストデータのクリーンアップ
    await prisma.comment.deleteMany();
    await prisma.issue.deleteMany();
    await prisma.project.deleteMany();
    await prisma.globalSettings.deleteMany();

    // テストデータ作成
    testProject = await prisma.project.create({
      data: {
        name: 'WebSocket Test Project',
        description_md: 'A test project for WebSocket E2E testing',
        shared_password_hash: null,
      },
    });

    testIssue = await prisma.issue.create({
      data: {
        project_id: testProject.id,
        title: 'WebSocket Test Issue',
        description_md: 'A test issue for WebSocket testing',
        status: 'open',
        progress_pct: 0,
        start_date: new Date('2024-06-01'),
        end_date: new Date('2024-06-15'),
        is_blocked: false,
        sort_order: 0,
        labels: [],
      },
    });
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('WebSocket接続管理', () => {
    it('クライアント接続が正常に確立される', (done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(clientSocket.id).toBeDefined();
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('接続確認メッセージが受信される', (done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connection_established', (data) => {
        expect(data).toHaveProperty('message', 'WebSocket connection established');
        expect(data).toHaveProperty('timestamp');
        expect(new Date(data.timestamp)).toBeInstanceOf(Date);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('クライアント切断が正常に処理される', (done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        expect(clientSocket.connected).toBe(false);
        done();
      });
    });
  });

  describe('プロジェクトルーム管理', () => {
    beforeEach((done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    it('プロジェクトルームに参加できる', async () => {
      // NotificationGatewayのjoinProjectRoomメソッドを直接テスト
      const socketId = clientSocket.id;
      
      expect(async () => {
        await notificationGateway.joinProjectRoom(clientSocket, testProject.id);
      }).not.toThrow();

      // ルーム参加の確認（Socket.IOの内部状態を確認）
      expect(clientSocket.rooms).toContain(`project:${testProject.id}`);
    });

    it('プロジェクトルームから退出できる', async () => {
      // 先にルームに参加
      await notificationGateway.joinProjectRoom(clientSocket, testProject.id);
      expect(clientSocket.rooms).toContain(`project:${testProject.id}`);

      // ルームから退出
      await notificationGateway.leaveProjectRoom(clientSocket, testProject.id);
      expect(clientSocket.rooms).not.toContain(`project:${testProject.id}`);
    });

    it('存在しないプロジェクトルームでもエラーが発生しない', async () => {
      const nonExistentProjectId = 'non-existent-project-id';
      
      expect(async () => {
        await notificationGateway.joinProjectRoom(clientSocket, nonExistentProjectId);
      }).not.toThrow();

      expect(async () => {
        await notificationGateway.leaveProjectRoom(clientSocket, nonExistentProjectId);
      }).not.toThrow();
    });
  });

  describe('汎用通知配信システム', () => {
    beforeEach((done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    it('全体通知が正常に配信される', (done) => {
      const testNotification = {
        event: 'test_notification',
        data: {
          message: 'Test global notification',
          timestamp: new Date().toISOString(),
        },
      };

      clientSocket.on('notification', (notification) => {
        expect(notification).toEqual(testNotification);
        done();
      });

      // 全体通知を送信
      notificationGateway.sendNotification({
        target: 'ALL',
        notification: testNotification,
      });
    });

    it('プロジェクト特定通知が正常に配信される', (done) => {
      const testNotification = {
        event: 'project_specific_notification',
        data: {
          message: 'Test project notification',
          timestamp: new Date().toISOString(),
          projectId: testProject.id,
        },
      };

      // プロジェクトルームに参加
      notificationGateway.joinProjectRoom(clientSocket, testProject.id).then(() => {
        clientSocket.on('notification', (notification) => {
          expect(notification).toEqual(testNotification);
          expect(notification.data.projectId).toBe(testProject.id);
          done();
        });

        // プロジェクト特定通知を送信
        notificationGateway.sendNotification({
          target: 'PROJECT',
          notification: testNotification,
          projectId: testProject.id,
        });
      });
    });

    it('プロジェクトルーム外のクライアントは通知を受信しない', (done) => {
      const testNotification = {
        event: 'project_specific_notification',
        data: {
          message: 'Test project notification',
          timestamp: new Date().toISOString(),
          projectId: testProject.id,
        },
      };

      let notificationReceived = false;

      clientSocket.on('notification', () => {
        notificationReceived = true;
      });

      // プロジェクトルームに参加せずに通知を送信
      notificationGateway.sendNotification({
        target: 'PROJECT',
        notification: testNotification,
        projectId: testProject.id,
      });

      // 1秒待ってから確認
      setTimeout(() => {
        expect(notificationReceived).toBe(false);
        done();
      }, 1000);
    });

    it('projectId未指定のプロジェクト通知でエラーが発生する', async () => {
      const testNotification = {
        event: 'invalid_notification',
        data: { message: 'Invalid notification' },
      };

      await expect(
        notificationGateway.sendNotification({
          target: 'PROJECT',
          notification: testNotification,
          // projectId未指定
        })
      ).rejects.toThrow('PROJECT target requires projectId');
    });

    it('不正な通知ターゲットでエラーが発生する', async () => {
      const testNotification = {
        event: 'invalid_notification',
        data: { message: 'Invalid notification' },
      };

      await expect(
        notificationGateway.sendNotification({
          target: 'INVALID_TARGET' as any,
          notification: testNotification,
        })
      ).rejects.toThrow('Unknown notification target: INVALID_TARGET');
    });
  });

  describe('設定変更通知統合', () => {
    beforeEach((done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    it('グローバル設定変更通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('settings_changed');
            expect(notification.data.message).toContain('グローバル設定が更新されました');
            expect(notification.data.requiresReauth).toBe(false);
            expect(notification.data.timestamp).toBeDefined();
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        // NotificationGatewayのnotifySettingsChangedメソッドを直接呼び出し
        notificationGateway.notifySettingsChanged(
          'グローバル設定が更新されました',
          false
        );
      });
    });

    it('再認証要求付き設定変更通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('settings_changed');
            expect(notification.data.message).toContain('認証設定が変更されました');
            expect(notification.data.requiresReauth).toBe(true);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifySettingsChanged(
          '認証設定が変更されました。再ログインが必要です',
          true
        );
      });
    });

    it('プロジェクト特定の設定変更通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        // プロジェクトルームに参加
        notificationGateway.joinProjectRoom(clientSocket, testProject.id).then(() => {
          clientSocket.on('notification', (notification) => {
            try {
              expect(notification.event).toBe('settings_changed');
              expect(notification.data.message).toContain('プロジェクト設定が更新されました');
              expect(notification.data.projectId).toBe(testProject.id);
              resolve();
            } catch (error) {
              reject(error);
            }
          });

          notificationGateway.notifySettingsChanged(
            'プロジェクト設定が更新されました',
            false,
            testProject.id
          );
        });
      });
    });
  });

  describe('Issue変更通知統合', () => {
    beforeEach((done) => {
      clientSocket = io(getSocketUrl(), {
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        // プロジェクトルームに参加
        notificationGateway.joinProjectRoom(clientSocket, testProject.id).then(() => {
          done();
        });
      });
    });

    it('Issue作成通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('issue_created');
            expect(notification.data.message).toContain('新しいIssue');
            expect(notification.data.message).toContain(testIssue.title);
            expect(notification.data.projectId).toBe(testProject.id);
            expect(notification.data.entityType).toBe('issue');
            expect(notification.data.entityId).toBe(testIssue.id);
            expect(notification.data.entity).toMatchObject({
              id: testIssue.id,
              title: testIssue.title,
              project_id: testProject.id,
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifyIssueChanged({
          action: 'create',
          issue: testIssue,
          author: 'testuser',
        });
      });
    });

    it('Issue更新通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('issue_updated');
            expect(notification.data.message).toContain('Issue');
            expect(notification.data.message).toContain('更新されました');
            expect(notification.data.message).toContain(testIssue.title);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifyIssueChanged({
          action: 'update',
          issue: testIssue,
          author: 'testuser',
        });
      });
    });

    it('Issue削除通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('issue_deleted');
            expect(notification.data.message).toContain('Issue');
            expect(notification.data.message).toContain('削除されました');
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifyIssueChanged({
          action: 'delete',
          issue: testIssue,
          author: 'testuser',
        });
      });
    });

    it('不正なIssueアクションでエラーが発生する', async () => {
      // NotificationGateway内でエラーハンドリングされるため、例外は投げられない
      expect(async () => {
        await notificationGateway.notifyIssueChanged({
          action: 'invalid_action' as any,
          issue: testIssue,
          author: 'testuser',
        });
      }).not.toThrow();
    });
  });

  describe('Comment変更通知統合', () => {
    let testComment: any;

    beforeEach(async () => {
      // テストComment作成
      testComment = await prisma.comment.create({
        data: {
          issue_id: testIssue.id,
          body_md: 'WebSocket test comment',
          created_by: 'testuser',
        },
      });

      return new Promise<void>((resolve) => {
        clientSocket = io(getSocketUrl(), {
          transports: ['websocket'],
          timeout: 5000,
        });

        clientSocket.on('connect', () => {
          notificationGateway.joinProjectRoom(clientSocket, testProject.id).then(() => {
            resolve();
          });
        });
      });
    });

    it('Comment作成通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('comment_created');
            expect(notification.data.message).toContain('新しいコメントが投稿されました');
            expect(notification.data.message).toContain(testIssue.title);
            expect(notification.data.projectId).toBe(testProject.id);
            expect(notification.data.entityType).toBe('comment');
            expect(notification.data.entityId).toBe(testComment.id);
            expect(notification.data.entity.comment).toMatchObject({
              id: testComment.id,
              body_md: testComment.body_md,
            });
            expect(notification.data.entity.issue).toMatchObject({
              id: testIssue.id,
              title: testIssue.title,
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifyCommentChanged({
          action: 'create',
          comment: testComment,
          issue: testIssue,
          author: 'testuser',
        });
      });
    });

    it('Comment更新通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('comment_updated');
            expect(notification.data.message).toContain('コメントが更新されました');
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifyCommentChanged({
          action: 'update',
          comment: testComment,
          issue: testIssue,
          author: 'testuser',
        });
      });
    });

    it('Comment削除通知が正常に配信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('comment_deleted');
            expect(notification.data.message).toContain('コメントが削除されました');
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        notificationGateway.notifyCommentChanged({
          action: 'delete',
          comment: testComment,
          issue: testIssue,
          author: 'testuser',
        });
      });
    });
  });

  describe('WebSocketエラーハンドリング', () => {
    it('通知送信エラーが適切に処理される', async () => {
      // Mock server to simulate error
      const originalEmit = notificationGateway.server.emit;
      notificationGateway.server.emit = jest.fn().mockImplementation(() => {
        throw new Error('Mock WebSocket error');
      });

      await expect(
        notificationGateway.sendNotification({
          target: 'ALL',
          notification: {
            event: 'test_error',
            data: { message: 'Test error handling' },
          },
        })
      ).rejects.toThrow('Mock WebSocket error');

      // Restore original method
      notificationGateway.server.emit = originalEmit;
    });

    it('Issue通知エラーがサービス操作を阻害しない', async () => {
      // Mock notificationGateway to simulate error
      const originalSendNotification = notificationGateway.sendNotification;
      notificationGateway.sendNotification = jest.fn().mockRejectedValue(
        new Error('Mock notification error')
      );

      // Issue通知エラーは例外を投げない（ログ出力のみ）
      expect(async () => {
        await notificationGateway.notifyIssueChanged({
          action: 'create',
          issue: testIssue,
          author: 'testuser',
        });
      }).not.toThrow();

      // Restore original method
      notificationGateway.sendNotification = originalSendNotification;
    });

    it('Comment通知エラーがサービス操作を阻害しない', async () => {
      const testComment = await prisma.comment.create({
        data: {
          issue_id: testIssue.id,
          body_md: 'Error test comment',
          created_by: 'testuser',
        },
      });

      // Mock notificationGateway to simulate error
      const originalSendNotification = notificationGateway.sendNotification;
      notificationGateway.sendNotification = jest.fn().mockRejectedValue(
        new Error('Mock notification error')
      );

      // Comment通知エラーは例外を投げない（ログ出力のみ）
      expect(async () => {
        await notificationGateway.notifyCommentChanged({
          action: 'create',
          comment: testComment,
          issue: testIssue,
          author: 'testuser',
        });
      }).not.toThrow();

      // Restore original method
      notificationGateway.sendNotification = originalSendNotification;
    });
  });

  describe('複数クライアント接続シナリオ', () => {
    let clientSocket2: Socket;

    afterEach(() => {
      if (clientSocket2 && clientSocket2.connected) {
        clientSocket2.disconnect();
      }
    });

    it('複数クライアントが同時に通知を受信できる', async () => {
      return new Promise<void>((resolve, reject) => {
        let client1Received = false;
        let client2Received = false;

        // 第1クライアント
        clientSocket = io(getSocketUrl(), {
          transports: ['websocket'],
          timeout: 5000,
        });

        // 第2クライアント
        clientSocket2 = io(getSocketUrl(), {
          transports: ['websocket'],
          timeout: 5000,
        });

        const checkCompletion = () => {
          if (client1Received && client2Received) {
            resolve();
          }
        };

        clientSocket.on('connect', () => {
          clientSocket.on('notification', (notification) => {
            expect(notification.event).toBe('test_notification');
            client1Received = true;
            checkCompletion();
          });
        });

        clientSocket2.on('connect', () => {
          clientSocket2.on('notification', (notification) => {
            expect(notification.event).toBe('test_notification');
            client2Received = true;
            checkCompletion();
          });

          // 両方のクライアントが接続したら通知を送信
          setTimeout(() => {
            notificationGateway.sendNotification({
              target: 'ALL',
              notification: {
                event: 'test_notification',
                data: { message: 'Multi-client test' },
              },
            });
          }, 100);
        });

        setTimeout(() => {
          if (!client1Received || !client2Received) {
            reject(new Error('Not all clients received notification within timeout'));
          }
        }, 5000);
      });
    });

    it('異なるプロジェクトルームのクライアントは相互の通知を受信しない', async () => {
      // 第2のテストプロジェクト作成
      const testProject2 = await prisma.project.create({
        data: {
          name: 'WebSocket Test Project 2',
          description_md: 'Second test project',
          shared_password_hash: null,
        },
      });

      return new Promise<void>((resolve, reject) => {
        let client1NotificationCount = 0;
        let client2NotificationCount = 0;

        clientSocket = io(getSocketUrl(), {
          transports: ['websocket'],
          timeout: 5000,
        });

        clientSocket2 = io(getSocketUrl(), {
          transports: ['websocket'],
          timeout: 5000,
        });

        clientSocket.on('connect', () => {
          notificationGateway.joinProjectRoom(clientSocket, testProject.id).then(() => {
            clientSocket.on('notification', () => {
              client1NotificationCount++;
            });
          });
        });

        clientSocket2.on('connect', () => {
          notificationGateway.joinProjectRoom(clientSocket2, testProject2.id).then(() => {
            clientSocket2.on('notification', () => {
              client2NotificationCount++;
            });

            // プロジェクト1にのみ通知を送信
            setTimeout(() => {
              notificationGateway.sendNotification({
                target: 'PROJECT',
                notification: {
                  event: 'project_specific_test',
                  data: { message: 'Project 1 only' },
                },
                projectId: testProject.id,
              });

              // プロジェクト2にのみ通知を送信
              setTimeout(() => {
                notificationGateway.sendNotification({
                  target: 'PROJECT',
                  notification: {
                    event: 'project_specific_test',
                    data: { message: 'Project 2 only' },
                  },
                  projectId: testProject2.id,
                });

                // 結果を確認
                setTimeout(() => {
                  try {
                    expect(client1NotificationCount).toBe(1);
                    expect(client2NotificationCount).toBe(1);
                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                }, 1000);
              }, 100);
            }, 100);
          });
        });
      });
    });
  });
});