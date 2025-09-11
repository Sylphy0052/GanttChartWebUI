/**
 * Comments機能統合テスト
 * コメントCRUD操作とWebSocket通知のE2Eテスト
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { NotificationGateway } from '../src/websocket/websocket.gateway';
import * as request from 'supertest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { io, Socket } from 'socket.io-client';

describe('Comments E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationGateway: NotificationGateway;
  let testProject: any;
  let testIssue: any;
  let testComment: any;
  let clientSocket: Socket;

  // Basic認証ヘッダー生成
  const createBasicAuthHeader = (username = 'testuser', password = 'testpass') => {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  };

  // プロジェクト認証ヘッダー生成
  const createProjectAuthHeaders = (projectId: string) => ({
    'x-project-id': projectId,
    'x-project-password-auth': 'true',
  });

  beforeAll(async () => {
    // テスト環境設定
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.AUTH_TYPE = 'basic';
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    notificationGateway = app.get<NotificationGateway>(NotificationGateway);

    // テストデータベースのクリーンアップ
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }

    await app.init();
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

    // テストデータ作成
    testProject = await prisma.project.create({
      data: {
        name: 'Comments Test Project',
        description_md: 'A test project for comments E2E testing',
        shared_password_hash: null,
      },
    });

    testIssue = await prisma.issue.create({
      data: {
        project_id: testProject.id,
        title: 'Comments Test Issue',
        description_md: 'A test issue for comments testing',
        status: 'open',
        progress_pct: 0,
        start_date: new Date('2024-06-01'),
        end_date: new Date('2024-06-15'),
        is_blocked: false,
        sort_order: 0,
        labels: [],
      },
    });

    testComment = await prisma.comment.create({
      data: {
        issue_id: testIssue.id,
        body_md: 'This is a test comment for E2E testing',
        created_by: 'testuser',
      },
    });
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('コメント一覧取得 (GET /projects/:projectId/issues/:issueId/comments)', () => {
    it('Issue別コメント一覧が正常に取得できる', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: testComment.id,
        body_md: testComment.body_md,
        created_by: testComment.created_by,
        issue_id: testIssue.id,
      });
      expect(response.body[0]).toHaveProperty('created_at');
      expect(response.body[0]).toHaveProperty('updated_at');
    });

    it('複数コメントが作成日時順で取得される', async () => {
      // 追加のコメントを作成
      const comment2 = await prisma.comment.create({
        data: {
          issue_id: testIssue.id,
          body_md: 'Second test comment',
          created_by: 'testuser2',
        },
      });

      const comment3 = await prisma.comment.create({
        data: {
          issue_id: testIssue.id,
          body_md: 'Third test comment',
          created_by: 'testuser3',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(200);

      expect(response.body).toHaveLength(3);

      // 作成日時順（昇順）で並んでいることを確認
      const createdDates = response.body.map((comment: any) => new Date(comment.created_at));
      for (let i = 1; i < createdDates.length; i++) {
        expect(createdDates[i].getTime()).toBeGreaterThanOrEqual(createdDates[i - 1].getTime());
      }
    });

    it('存在しないIssueのコメント取得で404エラー', async () => {
      const nonExistentIssueId = 'non-existent-issue-id';

      await request(app.getHttpServer())
        .get(`/projects/${testProject.id}/issues/${nonExistentIssueId}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(404);
    });

    it('存在しないプロジェクトのコメント取得で404エラー', async () => {
      const nonExistentProjectId = 'non-existent-project-id';

      await request(app.getHttpServer())
        .get(`/projects/${nonExistentProjectId}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(nonExistentProjectId))
        .expect(404);
    });

    it('認証なしでコメント取得が拒否される', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .expect(401);
    });

    it('Viewer権限でコメント取得が成功する', async () => {
      // Viewer権限のプロジェクトを作成
      const viewerProject = await prisma.project.create({
        data: {
          name: 'Viewer Test Project',
          description_md: 'Test project for viewer permissions',
          shared_password_hash: '$2b$10$test.viewer.hash',
        },
      });

      const viewerIssue = await prisma.issue.create({
        data: {
          project_id: viewerProject.id,
          title: 'Viewer Test Issue',
          description_md: 'Test issue for viewer',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      await prisma.comment.create({
        data: {
          issue_id: viewerIssue.id,
          body_md: 'Viewer test comment',
          created_by: 'viewer_user',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/projects/${viewerProject.id}/issues/${viewerIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(viewerProject.id))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].body_md).toBe('Viewer test comment');
    });
  });

  describe('コメント作成 (POST /projects/:projectId/issues/:issueId/comments)', () => {
    it('有効なコメントが正常に作成される', async () => {
      const createCommentDto = {
        body_md: '新しいテストコメントです',
        created_by: 'test_creator',
      };

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(createCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        body_md: createCommentDto.body_md,
        created_by: createCommentDto.created_by,
        issue_id: testIssue.id,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');

      // データベースにも正しく保存されているか確認
      const savedComment = await prisma.comment.findUnique({
        where: { id: response.body.id },
      });
      expect(savedComment).toBeTruthy();
      expect(savedComment!.body_md).toBe(createCommentDto.body_md);
    });

    it('必須フィールド不足でバリデーションエラー', async () => {
      const invalidDto = {
        // body_md未指定
        created_by: 'test_creator',
      };

      await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(invalidDto)
        .expect(400);
    });

    it('空文字のbody_mdでバリデーションエラー', async () => {
      const invalidDto = {
        body_md: '',
        created_by: 'test_creator',
      };

      await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(invalidDto)
        .expect(400);
    });

    it('長すぎるbody_mdでバリデーションエラー', async () => {
      const invalidDto = {
        body_md: 'a'.repeat(10001), // 10,000文字制限を超過
        created_by: 'test_creator',
      };

      await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(invalidDto)
        .expect(400);
    });

    it('存在しないIssueにコメント作成で404エラー', async () => {
      const createCommentDto = {
        body_md: 'Test comment for non-existent issue',
        created_by: 'test_creator',
      };

      await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/non-existent-issue/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(createCommentDto)
        .expect(404);
    });

    it('Editor権限なしでコメント作成が拒否される', async () => {
      // Viewer権限のプロジェクトでコメント作成を試行
      const viewerProject = await prisma.project.create({
        data: {
          name: 'Viewer Only Project',
          description_md: 'Project with viewer permissions only',
          shared_password_hash: '$2b$10$test.viewer.hash',
        },
      });

      const viewerIssue = await prisma.issue.create({
        data: {
          project_id: viewerProject.id,
          title: 'Viewer Issue',
          description_md: 'Issue for viewer test',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      const createCommentDto = {
        body_md: 'Viewer should not be able to create this',
        created_by: 'viewer_user',
      };

      await request(app.getHttpServer())
        .post(`/projects/${viewerProject.id}/issues/${viewerIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(viewerProject.id))
        .send(createCommentDto)
        .expect(403);
    });

    it('マークダウン形式のコメントが正常に処理される', async () => {
      const markdownComment = {
        body_md: `# コメントタイトル

これは**太字**で、*斜体*のテキストです。

- リスト項目1
- リスト項目2

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

[リンクテキスト](https://example.com)`,
        created_by: 'markdown_user',
      };

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(markdownComment)
        .expect(201);

      expect(response.body.body_md).toBe(markdownComment.body_md);
    });
  });

  describe('コメント編集 (PUT /projects/:projectId/comments/:id)', () => {
    it('有効なコメント更新が正常に処理される', async () => {
      const updateCommentDto = {
        body_md: '更新されたコメント内容です',
        created_by: 'updated_user',
      };

      const response = await request(app.getHttpServer())
        .put(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(updateCommentDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testComment.id,
        body_md: updateCommentDto.body_md,
        created_by: updateCommentDto.created_by,
        issue_id: testIssue.id,
      });
      expect(response.body.updated_at).not.toBe(response.body.created_at);

      // データベースでも更新されているか確認
      const updatedComment = await prisma.comment.findUnique({
        where: { id: testComment.id },
      });
      expect(updatedComment!.body_md).toBe(updateCommentDto.body_md);
    });

    it('部分更新（body_mdのみ）が正常に処理される', async () => {
      const partialUpdateDto = {
        body_md: '部分更新されたコメント',
      };

      const response = await request(app.getHttpServer())
        .put(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(partialUpdateDto)
        .expect(200);

      expect(response.body.body_md).toBe(partialUpdateDto.body_md);
      expect(response.body.created_by).toBe(testComment.created_by); // 元の値が保持される
    });

    it('存在しないコメント更新で404エラー', async () => {
      const updateCommentDto = {
        body_md: 'Non-existent comment update',
      };

      await request(app.getHttpServer())
        .put(`/projects/${testProject.id}/comments/non-existent-comment-id`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(updateCommentDto)
        .expect(404);
    });

    it('空文字のbody_mdで更新時バリデーションエラー', async () => {
      const invalidUpdateDto = {
        body_md: '',
      };

      await request(app.getHttpServer())
        .put(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(invalidUpdateDto)
        .expect(400);
    });

    it('Editor権限なしでコメント更新が拒否される', async () => {
      // Viewer権限のプロジェクトを作成
      const viewerProject = await prisma.project.create({
        data: {
          name: 'Viewer Update Test Project',
          description_md: 'Project for testing viewer update restrictions',
          shared_password_hash: '$2b$10$test.viewer.hash',
        },
      });

      const viewerIssue = await prisma.issue.create({
        data: {
          project_id: viewerProject.id,
          title: 'Viewer Update Issue',
          description_md: 'Issue for viewer update test',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      const viewerComment = await prisma.comment.create({
        data: {
          issue_id: viewerIssue.id,
          body_md: 'Original viewer comment',
          created_by: 'viewer_user',
        },
      });

      const updateDto = {
        body_md: 'Viewer should not be able to update this',
      };

      await request(app.getHttpServer())
        .put(`/projects/${viewerProject.id}/comments/${viewerComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(viewerProject.id))
        .send(updateDto)
        .expect(403);
    });

    it('楽観ロック（バージョン制御）が正しく動作する', async () => {
      // 最初の更新
      const firstUpdate = {
        body_md: 'First update',
        version: testComment.version,
      };

      const firstResponse = await request(app.getHttpServer())
        .put(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(firstUpdate)
        .expect(200);

      // 古いバージョンでの更新を試行
      const secondUpdate = {
        body_md: 'Second update with old version',
        version: testComment.version, // 古いバージョン
      };

      await request(app.getHttpServer())
        .put(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(secondUpdate)
        .expect(409); // Conflict
    });
  });

  describe('コメント削除 (DELETE /projects/:projectId/comments/:id)', () => {
    it('有効なコメントが正常に削除される', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(204);

      // データベースから削除されているか確認（論理削除）
      const deletedComment = await prisma.comment.findUnique({
        where: { id: testComment.id },
        include: { issue: true },
      });

      expect(deletedComment).toBeTruthy();
      expect(deletedComment!.is_deleted).toBe(true);
      expect(deletedComment!.deleted_at).toBeTruthy();
    });

    it('存在しないコメント削除で404エラー', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}/comments/non-existent-comment-id`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(404);
    });

    it('既に削除されたコメントの削除で404エラー', async () => {
      // コメントを先に削除
      await prisma.comment.update({
        where: { id: testComment.id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}/comments/${testComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(404);
    });

    it('Editor権限なしでコメント削除が拒否される', async () => {
      // Viewer権限のプロジェクトを作成
      const viewerProject = await prisma.project.create({
        data: {
          name: 'Viewer Delete Test Project',
          description_md: 'Project for testing viewer delete restrictions',
          shared_password_hash: '$2b$10$test.viewer.hash',
        },
      });

      const viewerIssue = await prisma.issue.create({
        data: {
          project_id: viewerProject.id,
          title: 'Viewer Delete Issue',
          description_md: 'Issue for viewer delete test',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      const viewerComment = await prisma.comment.create({
        data: {
          issue_id: viewerIssue.id,
          body_md: 'Comment to be deleted by viewer',
          created_by: 'viewer_user',
        },
      });

      await request(app.getHttpServer())
        .delete(`/projects/${viewerProject.id}/comments/${viewerComment.id}`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(viewerProject.id))
        .expect(403);
    });
  });

  describe('WebSocket通知統合テスト', () => {
    beforeEach(async () => {
      // WebSocketクライアント接続
      const serverUrl = `http://localhost:${app.getHttpServer().address()?.port || 3001}`;
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        timeout: 5000,
      });

      return new Promise<void>((resolve) => {
        clientSocket.on('connect', () => {
          // プロジェクトルームに参加
          notificationGateway.joinProjectRoom(clientSocket, testProject.id).then(() => {
            resolve();
          });
        });
      });
    });

    it('コメント作成時にWebSocket通知が送信される', async () => {
      return new Promise<void>((resolve, reject) => {
        const createCommentDto = {
          body_md: 'WebSocket通知テストコメント',
          created_by: 'websocket_user',
        };

        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('comment_created');
            expect(notification.data.message).toContain('新しいコメントが投稿されました');
            expect(notification.data.message).toContain(testIssue.title);
            expect(notification.data.projectId).toBe(testProject.id);
            expect(notification.data.entityType).toBe('comment');
            expect(notification.data.entity.comment.body_md).toBe(createCommentDto.body_md);
            expect(notification.data.entity.issue.id).toBe(testIssue.id);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        // コメント作成API実行
        request(app.getHttpServer())
          .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
          .set('Authorization', createBasicAuthHeader())
          .set(createProjectAuthHeaders(testProject.id))
          .send(createCommentDto)
          .expect(201)
          .end((err) => {
            if (err) reject(err);
          });
      });
    });

    it('コメント更新時にWebSocket通知が送信される', async () => {
      return new Promise<void>((resolve, reject) => {
        const updateCommentDto = {
          body_md: 'WebSocket通知テスト更新コメント',
        };

        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('comment_updated');
            expect(notification.data.message).toContain('コメントが更新されました');
            expect(notification.data.message).toContain(testIssue.title);
            expect(notification.data.projectId).toBe(testProject.id);
            expect(notification.data.entityType).toBe('comment');
            expect(notification.data.entity.comment.id).toBe(testComment.id);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        // コメント更新API実行
        request(app.getHttpServer())
          .put(`/projects/${testProject.id}/comments/${testComment.id}`)
          .set('Authorization', createBasicAuthHeader())
          .set(createProjectAuthHeaders(testProject.id))
          .send(updateCommentDto)
          .expect(200)
          .end((err) => {
            if (err) reject(err);
          });
      });
    });

    it('コメント削除時にWebSocket通知が送信される', async () => {
      return new Promise<void>((resolve, reject) => {
        clientSocket.on('notification', (notification) => {
          try {
            expect(notification.event).toBe('comment_deleted');
            expect(notification.data.message).toContain('コメントが削除されました');
            expect(notification.data.message).toContain(testIssue.title);
            expect(notification.data.projectId).toBe(testProject.id);
            expect(notification.data.entityType).toBe('comment');
            expect(notification.data.entity.comment.id).toBe(testComment.id);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        // コメント削除API実行
        request(app.getHttpServer())
          .delete(`/projects/${testProject.id}/comments/${testComment.id}`)
          .set('Authorization', createBasicAuthHeader())
          .set(createProjectAuthHeaders(testProject.id))
          .expect(204)
          .end((err) => {
            if (err) reject(err);
          });
      });
    });

    it('異なるプロジェクトのコメント操作では通知が受信されない', async () => {
      // 異なるプロジェクトを作成
      const otherProject = await prisma.project.create({
        data: {
          name: 'Other Test Project',
          description_md: 'Another test project',
          shared_password_hash: null,
        },
      });

      const otherIssue = await prisma.issue.create({
        data: {
          project_id: otherProject.id,
          title: 'Other Test Issue',
          description_md: 'Issue in other project',
          status: 'open',
          progress_pct: 0,
          start_date: new Date('2024-06-01'),
          end_date: new Date('2024-06-15'),
          is_blocked: false,
          sort_order: 0,
          labels: [],
        },
      });

      let notificationReceived = false;

      clientSocket.on('notification', () => {
        notificationReceived = true;
      });

      // 異なるプロジェクトでコメント作成
      await request(app.getHttpServer())
        .post(`/projects/${otherProject.id}/issues/${otherIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(otherProject.id))
        .send({
          body_md: 'Comment in other project',
          created_by: 'other_user',
        })
        .expect(201);

      // 1秒待って通知が来ないことを確認
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(notificationReceived).toBe(false);
    });
  });

  describe('エラー処理とエッジケース', () => {
    it('データベース接続エラー時の適切なエラーレスポンス', async () => {
      // Prismaサービスをモック
      const originalFindMany = prisma.comment.findMany;
      prisma.comment.findMany = jest.fn().mockRejectedValue(new Error('Database connection error'));

      await request(app.getHttpServer())
        .get(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .expect(500);

      // 元のメソッドを復元
      prisma.comment.findMany = originalFindMany;
    });

    it('WebSocket通知エラーがAPI操作をブロックしない', async () => {
      // NotificationGatewayをモックしてエラーを発生させる
      const originalNotifyCommentChanged = notificationGateway.notifyCommentChanged;
      notificationGateway.notifyCommentChanged = jest.fn().mockRejectedValue(
        new Error('WebSocket notification error')
      );

      const createCommentDto = {
        body_md: 'WebSocket error test comment',
        created_by: 'error_test_user',
      };

      // WebSocket通知エラーがあってもAPI操作は成功する
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(createCommentDto)
        .expect(201);

      expect(response.body.body_md).toBe(createCommentDto.body_md);

      // 元のメソッドを復元
      notificationGateway.notifyCommentChanged = originalNotifyCommentChanged;
    });

    it('特殊文字を含むコメントが正常に処理される', async () => {
      const specialCharComment = {
        body_md: 'Special characters: 🚀 ñ ü ñ ∑ ≈ ≤ ≥ € $ ¥ £ & < > " \' \\ / @',
        created_by: 'special_char_user',
      };

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(specialCharComment)
        .expect(201);

      expect(response.body.body_md).toBe(specialCharComment.body_md);

      // データベースからも正しく取得できるか確認
      const saved = await prisma.comment.findUnique({
        where: { id: response.body.id },
      });
      expect(saved!.body_md).toBe(specialCharComment.body_md);
    });

    it('非常に長いコメント作成者名の処理', async () => {
      const longNameComment = {
        body_md: 'Comment with long creator name',
        created_by: 'a'.repeat(255), // 非常に長い名前
      };

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .set(createProjectAuthHeaders(testProject.id))
        .send(longNameComment)
        .expect(201);

      expect(response.body.created_by).toBe(longNameComment.created_by);
    });

    it('空のプロジェクトIDでエラーが発生する', async () => {
      await request(app.getHttpServer())
        .get(`/projects//issues/${testIssue.id}/comments`)
        .set('Authorization', createBasicAuthHeader())
        .expect(404); // ルートが見つからない
    });
  });
});