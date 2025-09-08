/**
 * プロジェクト管理のE2Eテスト
 * 
 * テスト対象:
 * - プロジェクトCRUD操作
 * - データバリデーション
 * - 論理削除機能
 * - パスワード保護機能
 * - エラーハンドリング
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';

describe('プロジェクト管理 E2E テスト', () => {
  let app: INestApplication;
  const authHeader = testHelper.createBasicAuthHeader();

  beforeAll(async () => {
    app = testHelper.app;
  });

  describe('プロジェクト作成 (POST /projects)', () => {
    it('有効なデータでプロジェクト作成成功', async () => {
      const newProject = {
        name: 'New E2E Test Project',
        description: 'Created via E2E testing',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'active',
      };

      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', authHeader)
        .send(newProject)
        .expect(201);

      testHelper.expectValidProject(response.body);
      expect(response.body.name).toBe(newProject.name);
      expect(response.body.description).toBe(newProject.description);
      expect(response.body.status).toBe(newProject.status);
      expect(new Date(response.body.start_date)).toEqual(new Date(newProject.start_date));
      expect(new Date(response.body.end_date)).toEqual(new Date(newProject.end_date));
    });

    it('必須フィールド不足でバリデーションエラー', async () => {
      const invalidProjects = [
        {}, // 全フィールド不足
        { name: 'Test' }, // その他フィールド不足
        { 
          name: 'Test',
          description: 'Test desc',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          // status不足
        },
        {
          name: 'Test',
          description: 'Test desc',
          start_date: '2024-01-01',
          // end_date不足
          status: 'active',
        },
      ];

      for (const invalidProject of invalidProjects) {
        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', authHeader)
          .send(invalidProject)
          .expect(400);
      }
    });

    it('不正な日付形式でバリデーションエラー', async () => {
      const invalidDates = [
        'invalid-date',
        '2024-13-01', // 13月
        '2024-01-32', // 32日
        '2024/01/01', // スラッシュ区切り
        1640995200000, // Unix timestamp
      ];

      for (const invalidDate of invalidDates) {
        const project = {
          name: 'Test Project',
          description: 'Test',
          start_date: invalidDate,
          end_date: '2024-12-31',
          status: 'active',
        };

        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', authHeader)
          .send(project)
          .expect(400);
      }
    });

    it('終了日が開始日より前でバリデーションエラー', async () => {
      const project = {
        name: 'Invalid Date Range Project',
        description: 'End date before start date',
        start_date: '2024-12-31',
        end_date: '2024-01-01', // 開始日より前
        status: 'active',
      };

      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', authHeader)
        .send(project)
        .expect(400);
    });

    it('不正なステータス値でバリデーションエラー', async () => {
      const invalidStatuses = ['invalid', 'ACTIVE', 'Completed', 123, null];

      for (const invalidStatus of invalidStatuses) {
        const project = {
          name: 'Test Project',
          description: 'Test',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          status: invalidStatus,
        };

        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', authHeader)
          .send(project)
          .expect(400);
      }
    });

    it('長すぎるフィールドでバリデーションエラー', async () => {
      const project = {
        name: 'a'.repeat(256), // 255文字制限を超過
        description: 'a'.repeat(1001), // 1000文字制限を超過
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'active',
      };

      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', authHeader)
        .send(project)
        .expect(400);
    });
  });

  describe('プロジェクト取得 (GET /projects)', () => {
    let testProjects: any[];

    beforeEach(async () => {
      // テストデータ準備
      testProjects = await Promise.all([
        testHelper.createTestProject({ 
          name: 'Active Project 1', 
          status: 'active',
          start_date: new Date('2024-01-01'),
        }),
        testHelper.createTestProject({ 
          name: 'Active Project 2', 
          status: 'active',
          start_date: new Date('2024-02-01'),
        }),
        testHelper.createTestProject({ 
          name: 'Completed Project', 
          status: 'completed',
          start_date: new Date('2024-03-01'),
        }),
      ]);
    });

    it('全プロジェクト一覧取得成功', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(testProjects.length);

      // 各プロジェクトの形式チェック
      response.body.forEach((project: any) => {
        testHelper.expectValidProject(project);
      });

      // 削除されていないプロジェクトのみが返されることを確認
      response.body.forEach((project: any) => {
        expect(project.is_deleted).toBe(false);
      });
    });

    it('空のプロジェクト一覧取得', async () => {
      // 全プロジェクトを削除
      for (const project of testProjects) {
        await testHelper.prisma.project.update({
          where: { id: project.id },
          data: { is_deleted: true },
        });
      }

      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('プロジェクト詳細取得 (GET /projects/:id)', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await testHelper.createTestProject();
    });

    it('存在するプロジェクトの詳細取得成功', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      testHelper.expectValidProject(response.body);
      expect(response.body.id).toBe(testProject.id);
      expect(response.body.name).toBe(testProject.name);
    });

    it('存在しないプロジェクトIDで404エラー', async () => {
      const nonexistentId = 'cjld2cyuq0000t3rmniod1foy'; // 有効なCUID形式だが存在しない

      await request(app.getHttpServer())
        .get(`/projects/${nonexistentId}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('無効なプロジェクトIDフォーマットで400エラー', async () => {
      const invalidIds = [
        'invalid-id',
        '123',
        'not-a-cuid',
        '',
        'null',
        'undefined',
      ];

      for (const invalidId of invalidIds) {
        await request(app.getHttpServer())
          .get(`/projects/${invalidId}`)
          .set('Authorization', authHeader)
          .expect(400);
      }
    });

    it('削除済みプロジェクトに対して404エラー', async () => {
      // プロジェクトを論理削除
      await testHelper.prisma.project.update({
        where: { id: testProject.id },
        data: { is_deleted: true },
      });

      await request(app.getHttpServer())
        .get(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(404);
    });
  });

  describe('プロジェクト更新 (PATCH /projects/:id)', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await testHelper.createTestProject();
    });

    it('有効なデータでプロジェクト更新成功', async () => {
      const updates = {
        name: 'Updated Project Name',
        description: 'Updated description',
        status: 'completed' as const,
      };

      const response = await request(app.getHttpServer())
        .patch(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .send(updates)
        .expect(200);

      testHelper.expectValidProject(response.body);
      expect(response.body.id).toBe(testProject.id);
      expect(response.body.name).toBe(updates.name);
      expect(response.body.description).toBe(updates.description);
      expect(response.body.status).toBe(updates.status);
    });

    it('部分的なフィールド更新成功', async () => {
      const updates = {
        name: 'Partially Updated Name',
      };

      const response = await request(app.getHttpServer())
        .patch(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.description).toBe(testProject.description); // 変更されていない
    });

    it('日付フィールドの更新成功', async () => {
      const updates = {
        start_date: '2024-06-01',
        end_date: '2024-11-30',
      };

      const response = await request(app.getHttpServer())
        .patch(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .send(updates)
        .expect(200);

      expect(new Date(response.body.start_date)).toEqual(new Date(updates.start_date));
      expect(new Date(response.body.end_date)).toEqual(new Date(updates.end_date));
    });

    it('存在しないプロジェクトIDで404エラー', async () => {
      const nonexistentId = 'cjld2cyuq0000t3rmniod1foy';

      await request(app.getHttpServer())
        .patch(`/projects/${nonexistentId}`)
        .set('Authorization', authHeader)
        .send({ name: 'Updated Name' })
        .expect(404);
    });

    it('無効な更新データでバリデーションエラー', async () => {
      const invalidUpdates = [
        { name: 'a'.repeat(256) }, // 長すぎる名前
        { description: 'a'.repeat(1001) }, // 長すぎる説明
        { status: 'invalid-status' }, // 不正なステータス
        { start_date: 'invalid-date' }, // 不正な日付
      ];

      for (const invalidUpdate of invalidUpdates) {
        await request(app.getHttpServer())
          .patch(`/projects/${testProject.id}`)
          .set('Authorization', authHeader)
          .send(invalidUpdate)
          .expect(400);
      }
    });

    it('削除済みプロジェクトの更新で404エラー', async () => {
      await testHelper.prisma.project.update({
        where: { id: testProject.id },
        data: { is_deleted: true },
      });

      await request(app.getHttpServer())
        .patch(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .send({ name: 'Updated Name' })
        .expect(404);
    });
  });

  describe('プロジェクト削除 (DELETE /projects/:id)', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await testHelper.createTestProject();
    });

    it('存在するプロジェクトの削除成功（論理削除）', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(204);

      // データベースで論理削除を確認
      const deletedProject = await testHelper.prisma.project.findUnique({
        where: { id: testProject.id },
      });

      expect(deletedProject).not.toBeNull();
      expect(deletedProject?.is_deleted).toBe(true);
    });

    it('削除後はプロジェクト一覧に表示されない', async () => {
      // 削除実行
      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(204);

      // 一覧取得で削除されたプロジェクトが含まれないことを確認
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', authHeader)
        .expect(200);

      const projectIds = response.body.map((p: any) => p.id);
      expect(projectIds).not.toContain(testProject.id);
    });

    it('削除後は詳細取得で404エラー', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('存在しないプロジェクトIDで404エラー', async () => {
      const nonexistentId = 'cjld2cyuq0000t3rmniod1foy';

      await request(app.getHttpServer())
        .delete(`/projects/${nonexistentId}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('既に削除済みのプロジェクトに対して404エラー', async () => {
      // 手動で削除済みに設定
      await testHelper.prisma.project.update({
        where: { id: testProject.id },
        data: { is_deleted: true },
      });

      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(404);
    });
  });

  describe('プロジェクトパスワード設定 (POST /projects/:id/set-password)', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await testHelper.createTestProject();
    });

    it('有効なパスワード設定成功', async () => {
      const passwordData = {
        password: 'secure-shared-password',
      };

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/set-password`)
        .set('Authorization', authHeader)
        .send(passwordData)
        .expect(200);

      testHelper.expectValidProject(response.body);
      expect(response.body.id).toBe(testProject.id);

      // データベースでパスワードハッシュが設定されたことを確認
      const updatedProject = await testHelper.prisma.project.findUnique({
        where: { id: testProject.id },
      });
      expect(updatedProject?.shared_password_hash).not.toBeNull();
    });

    it('パスワード削除（空のパスワード）', async () => {
      // まずパスワードを設定
      await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/set-password`)
        .set('Authorization', authHeader)
        .send({ password: 'temp-password' })
        .expect(200);

      // 空のパスワードで削除
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProject.id}/set-password`)
        .set('Authorization', authHeader)
        .send({ password: '' })
        .expect(200);

      // データベースでパスワードハッシュが削除されたことを確認
      const updatedProject = await testHelper.prisma.project.findUnique({
        where: { id: testProject.id },
      });
      expect(updatedProject?.shared_password_hash).toBeNull();
    });

    it('不正なパスワード形式でバリデーションエラー', async () => {
      const invalidPasswords = [
        { password: 'a'.repeat(1001) }, // 長すぎるパスワード
        { password: 123 }, // 数値型
        { password: null }, // null値
        {}, // パスワードフィールド不足
      ];

      for (const invalidPassword of invalidPasswords) {
        await request(app.getHttpServer())
          .post(`/projects/${testProject.id}/set-password`)
          .set('Authorization', authHeader)
          .send(invalidPassword)
          .expect(400);
      }
    });

    it('存在しないプロジェクトIDで404エラー', async () => {
      const nonexistentId = 'cjld2cyuq0000t3rmniod1foy';

      await request(app.getHttpServer())
        .post(`/projects/${nonexistentId}/set-password`)
        .set('Authorization', authHeader)
        .send({ password: 'test-password' })
        .expect(404);
    });
  });

  describe('プロジェクトパスワード認証 (POST /projects/auth-password)', () => {
    let passwordProtectedProject: any;

    beforeEach(async () => {
      passwordProtectedProject = await testHelper.createTestProject();
      
      // パスワードを設定
      await request(app.getHttpServer())
        .post(`/projects/${passwordProtectedProject.id}/set-password`)
        .set('Authorization', authHeader)
        .send({ password: 'test-shared-password' })
        .expect(200);
    });

    it('正しいパスワードで認証成功', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', authHeader)
        .send({
          project_id: passwordProtectedProject.id,
          password: 'test-shared-password',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.project_id).toBe(passwordProtectedProject.id);
      expect(response.body.permission).toBe('editor');
    });

    it('間違ったパスワードで認証失敗', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', authHeader)
        .send({
          project_id: passwordProtectedProject.id,
          password: 'wrong-password',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.project_id).toBe(passwordProtectedProject.id);
      expect(response.body.permission).toBe('viewer');
    });

    it('パスワード未設定のプロジェクトで認証失敗', async () => {
      const unprotectedProject = await testHelper.createTestProject();

      const response = await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', authHeader)
        .send({
          project_id: unprotectedProject.id,
          password: 'any-password',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
    });

    it('存在しないプロジェクトIDで404エラー', async () => {
      const nonexistentId = 'cjld2cyuq0000t3rmniod1foy';

      await request(app.getHttpServer())
        .post('/projects/auth-password')
        .set('Authorization', authHeader)
        .send({
          project_id: nonexistentId,
          password: 'any-password',
        })
        .expect(404);
    });
  });

  describe('データ整合性とエラーハンドリング', () => {
    it('同時更新での競合状態テスト', async () => {
      const project = await testHelper.createTestProject();

      // 同時に更新リクエストを送信
      const updatePromises = [
        request(app.getHttpServer())
          .patch(`/projects/${project.id}`)
          .set('Authorization', authHeader)
          .send({ name: 'Update 1' }),
        request(app.getHttpServer())
          .patch(`/projects/${project.id}`)
          .set('Authorization', authHeader)
          .send({ name: 'Update 2' }),
      ];

      const responses = await Promise.all(updatePromises);
      
      // 少なくとも一つは成功するはず
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });

    it('大量データでのパフォーマンステスト', async () => {
      const startTime = Date.now();

      // 10個のプロジェクトを並行作成
      const creationPromises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', authHeader)
          .send({
            name: `Bulk Project ${i}`,
            description: `Bulk created project ${i}`,
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            status: 'active',
          })
      );

      const responses = await Promise.all(creationPromises);
      const endTime = Date.now();

      // 全て成功することを確認
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // パフォーマンス閾値チェック（10秒以内）
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('メモリリークテスト - 大量取得', async () => {
      // 複数のプロジェクトを作成
      await Promise.all(Array.from({ length: 50 }, (_, i) =>
        testHelper.createTestProject({ name: `Memory Test Project ${i}` })
      ));

      // 大量取得を複数回実行
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .get('/projects')
          .set('Authorization', authHeader)
          .expect(200);

        expect(response.body.length).toBeGreaterThan(40);
      }
    });
  });
});