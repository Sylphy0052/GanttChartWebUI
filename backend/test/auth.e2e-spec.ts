/**
 * 認証・権限管理のE2Eテスト
 * 
 * テスト対象:
 * - Basic認証機能
 * - 権限管理（viewer/editor）
 * - プロジェクトパスワード認証
 * - 認証ミドルウェアの動作
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';

describe('認証・権限管理 E2E テスト', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = testHelper.app;
  });

  describe('Basic認証テスト', () => {
    it('正しい認証情報でアクセス成功', async () => {
      const authHeader = testHelper.createBasicAuthHeader('testuser', 'testpass');

      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('間違った認証情報でアクセス拒否', async () => {
      const authHeader = testHelper.createBasicAuthHeader('wronguser', 'wrongpass');

      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', authHeader)
        .expect(401);
    });

    it('認証ヘッダーなしでアクセス拒否', async () => {
      await request(app.getHttpServer())
        .get('/projects')
        .expect(401);
    });

    it('不正な形式のBasic認証ヘッダーでアクセス拒否', async () => {
      const invalidHeaders = [
        'Basic invalidbase64',
        'Basic ' + Buffer.from('onlyusername').toString('base64'),
        'Bearer token123', // JWT形式
        'Basic', // 空の認証情報
      ];

      for (const header of invalidHeaders) {
        await request(app.getHttpServer())
          .get('/projects')
          .set('Authorization', header)
          .expect(401);
      }
    });
  });

  describe('権限管理テスト', () => {
    const validAuthHeader = testHelper.createBasicAuthHeader();

    describe('Viewerアクセス制御', () => {
      it('GET /projects - viewer権限でアクセス可能', async () => {
        await request(app.getHttpServer())
          .get('/projects')
          .set('Authorization', validAuthHeader)
          .expect(200);
      });

      it('GET /projects/:id - viewer権限でアクセス可能', async () => {
        // テストプロジェクト作成
        const project = await testHelper.createTestProject();

        await request(app.getHttpServer())
          .get(`/projects/${project.id}`)
          .set('Authorization', validAuthHeader)
          .expect(200);
      });

      it('GET /api/settings/holidays - viewer権限でアクセス可能', async () => {
        await request(app.getHttpServer())
          .get('/api/settings/holidays')
          .set('Authorization', validAuthHeader)
          .expect(200);
      });

      it('POST /projects/auth-password - viewer権限でアクセス可能', async () => {
        // パスワード保護プロジェクト作成
        const project = await testHelper.createTestProject({
          shared_password_hash: '$2b$10$example.hash',
        });

        await request(app.getHttpServer())
          .post('/projects/auth-password')
          .set('Authorization', validAuthHeader)
          .send({
            project_id: project.id,
            password: 'testpassword',
          })
          .expect(200);
      });
    });

    describe('Editorアクセス制御', () => {
      it('POST /projects - editor権限でアクセス可能', async () => {
        const newProject = {
          name: 'New Test Project',
          description: 'Created via E2E test',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          status: 'active',
        };

        const response = await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', validAuthHeader)
          .send(newProject)
          .expect(201);

        testHelper.expectValidProject(response.body);
        expect(response.body.name).toBe(newProject.name);
      });

      it('PATCH /projects/:id - editor権限でアクセス可能', async () => {
        const project = await testHelper.createTestProject();

        const updates = {
          name: 'Updated Project Name',
          description: 'Updated via E2E test',
        };

        const response = await request(app.getHttpServer())
          .patch(`/projects/${project.id}`)
          .set('Authorization', validAuthHeader)
          .send(updates)
          .expect(200);

        expect(response.body.name).toBe(updates.name);
        expect(response.body.description).toBe(updates.description);
      });

      it('DELETE /projects/:id - editor権限でアクセス可能', async () => {
        const project = await testHelper.createTestProject();

        await request(app.getHttpServer())
          .delete(`/projects/${project.id}`)
          .set('Authorization', validAuthHeader)
          .expect(204);

        // 論理削除の確認
        const deletedProject = await testHelper.prisma.project.findUnique({
          where: { id: project.id },
        });
        expect(deletedProject?.is_deleted).toBe(true);
      });

      it('POST /projects/:id/set-password - editor権限でアクセス可能', async () => {
        const project = await testHelper.createTestProject();

        const passwordData = {
          password: 'newsharedpassword',
        };

        const response = await request(app.getHttpServer())
          .post(`/projects/${project.id}/set-password`)
          .set('Authorization', validAuthHeader)
          .send(passwordData)
          .expect(200);

        testHelper.expectValidProject(response.body);
        expect(response.body.id).toBe(project.id);
      });

      it('PUT /api/settings/holidays - editor権限でアクセス可能', async () => {
        const holidaySettings = {
          weekend_off: true,
          holiday_dates: ['2024-01-01', '2024-12-25'],
        };

        const response = await request(app.getHttpServer())
          .put('/api/settings/holidays')
          .set('Authorization', validAuthHeader)
          .send(holidaySettings)
          .expect(200);

        expect(response.body.weekend_off).toBe(true);
        expect(response.body.holiday_dates).toEqual(holidaySettings.holiday_dates);
      });

      it('POST /api/backup/export/:projectId - editor権限でアクセス可能', async () => {
        const project = await testHelper.createTestProject();

        const response = await request(app.getHttpServer())
          .post(`/api/backup/export/${project.id}`)
          .set('Authorization', validAuthHeader)
          .expect(200);

        // ZIPファイルのダウンロードレスポンスを期待
        expect(response.headers['content-type']).toContain('application/zip');
      });

      it('POST /api/backup/import - editor権限でアクセス可能', async () => {
        const testZipBuffer = await testHelper.createTestZipFile();

        const response = await request(app.getHttpServer())
          .post('/api/backup/import')
          .set('Authorization', validAuthHeader)
          .attach('file', testZipBuffer, 'test-project.zip')
          .field('projectName', 'Imported Test Project')
          .expect(200);

        expect(response.body).toHaveProperty('projectId');
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('プロジェクトパスワード認証テスト', () => {
    let passwordProtectedProject: any;

    beforeEach(async () => {
      passwordProtectedProject = await testHelper.createTestProject({
        name: 'Password Protected Project',
        shared_password_hash: '$2b$10$K8H2VnQgE3hM9h9BHJ8X5.example.hash',
      });
    });

    it('正しいプロジェクトパスワードで認証成功', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', testHelper.createBasicAuthHeader())
        .send({
          project_id: passwordProtectedProject.id,
          password: 'correct-password',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.project_id).toBe(passwordProtectedProject.id);
      expect(response.body.permission).toBe('editor');
    });

    it('間違ったプロジェクトパスワードで認証失敗', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', testHelper.createBasicAuthHeader())
        .send({
          project_id: passwordProtectedProject.id,
          password: 'wrong-password',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.permission).toBe('viewer');
    });

    it('存在しないプロジェクトIDで認証エラー', async () => {
      await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', testHelper.createBasicAuthHeader())
        .send({
          project_id: 'nonexistent-project-id',
          password: 'any-password',
        })
        .expect(404);
    });

    it('プロジェクトパスワード認証ヘッダーを使用したアクセス', async () => {
      const projectHeaders = testHelper.createProjectPasswordHeaders(passwordProtectedProject.id);

      const response = await request(app.getHttpServer())
        .get(`/projects/${passwordProtectedProject.id}`)
        .set(projectHeaders)
        .expect(200);

      testHelper.expectValidProject(response.body);
      expect(response.body.id).toBe(passwordProtectedProject.id);
    });

    it('無効なプロジェクトIDヘッダーでアクセス拒否', async () => {
      const invalidHeaders = testHelper.createProjectPasswordHeaders('invalid-project-id');

      await request(app.getHttpServer())
        .get('/projects/invalid-project-id')
        .set(invalidHeaders)
        .expect(401);
    });
  });

  describe('認証バリデーション', () => {
    it('不正なJSONでリクエスト拒否', async () => {
      await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', testHelper.createBasicAuthHeader())
        .set('Content-Type', 'application/json')
        .send('invalid-json-string')
        .expect(400);
    });

    it('必須フィールド不足でバリデーションエラー', async () => {
      const invalidRequests = [
        { project_id: '', password: 'test' }, // 空のプロジェクトID
        { project_id: 'valid-id', password: '' }, // 空のパスワード
        { project_id: 'valid-id' }, // パスワード不足
        { password: 'test' }, // プロジェクトID不足
        {}, // 両方不足
      ];

      for (const invalidRequest of invalidRequests) {
        await request(app.getHttpServer())
          .post('/projects/auth-password')
          .set('Authorization', testHelper.createBasicAuthHeader())
          .send(invalidRequest)
          .expect(400);
      }
    });

    it('長すぎるパスワードでバリデーションエラー', async () => {
      const tooLongPassword = 'a'.repeat(1001); // 1000文字を超える

      await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', testHelper.createBasicAuthHeader())
        .send({
          project_id: 'test-project-id',
          password: tooLongPassword,
        })
        .expect(400);
    });
  });

  describe('ヘルスチェック（認証不要）', () => {
    it('ヘルスチェックは認証不要でアクセス可能', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toMatch(/ok|error/);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('認証ヘッダーがあってもヘルスチェック実行可能', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', testHelper.createBasicAuthHeader())
        .expect(200);

      expect(response.body.status).toMatch(/ok|error/);
    });
  });

  describe('認証レスポンス形式', () => {
    it('401エラーレスポンス形式が正しい', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('403エラーレスポンス形式が正しい', async () => {
      // viewer権限でeditor専用エンドポイントにアクセス
      process.env.AUTH_TYPE = 'none'; // 一時的にviewer権限に設定

      const response = await request(app.getHttpServer())
        .post('/projects')
        .send({
          name: 'Test Project',
          description: 'Test',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          status: 'active',
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 403);

      // 設定を元に戻す
      process.env.AUTH_TYPE = 'basic';
    });
  });
});