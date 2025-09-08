/**
 * バックアップ機能のE2Eテスト
 * 
 * テスト対象:
 * - プロジェクトエクスポート機能
 * - プロジェクトインポート機能
 * - ファイルアップロード処理
 * - バリデーションとエラーハンドリング
 * - セキュリティ制御
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as archiver from 'archiver';

describe('バックアップ機能 E2E テスト', () => {
  let app: INestApplication;
  const authHeader = testHelper.createBasicAuthHeader();

  beforeAll(async () => {
    app = testHelper.app;
  });

  describe('プロジェクトエクスポート (POST /api/backup/export/:projectId)', () => {
    let testProject: any;
    let testTasks: any[];

    beforeEach(async () => {
      // テストプロジェクトとタスクを作成
      testProject = await testHelper.createTestProject({
        name: 'Export Test Project',
        description: 'Project for export testing',
      });

      testTasks = await Promise.all([
        testHelper.createTestTask(testProject.id, {
          name: 'Export Task 1',
          description: 'First task for export',
          status: 'completed',
          progress: 100,
        }),
        testHelper.createTestTask(testProject.id, {
          name: 'Export Task 2',
          description: 'Second task for export',
          status: 'in_progress',
          progress: 50,
        }),
      ]);
    });

    it('プロジェクトエクスポート成功', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      // ZIPファイルのレスポンスヘッダー確認
      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.zip');

      // レスポンスボディがバイナリデータであることを確認
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // ZIPファイルの妥当性を簡単にチェック
      const zipSignature = response.body.slice(0, 4);
      expect(zipSignature.toString('hex')).toBe('504b0304'); // ZIP file signature
    });

    it('存在しないプロジェクトIDでエクスポート失敗', async () => {
      const nonexistentId = 'cjld2cyuq0000t3rmniod1foy';

      await request(app.getHttpServer())
        .post(`/api/backup/export/${nonexistentId}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('無効なプロジェクトIDフォーマットでバリデーションエラー', async () => {
      const invalidIds = [
        'invalid-id',
        '123',
        'not-a-cuid',
        '',
      ];

      for (const invalidId of invalidIds) {
        await request(app.getHttpServer())
          .post(`/api/backup/export/${invalidId}`)
          .set('Authorization', authHeader)
          .expect(400);
      }
    });

    it('削除済みプロジェクトのエクスポートで404エラー', async () => {
      // プロジェクトを論理削除
      await testHelper.prisma.project.update({
        where: { id: testProject.id },
        data: { deleted_at: new Date() },
      });

      await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('Editor権限必須でViewer権限では403エラー', async () => {
      // 一時的にViewer権限に変更
      process.env.AUTH_TYPE = 'none';

      await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .expect(403);

      // 設定を元に戻す
      process.env.AUTH_TYPE = 'basic';
    });

    it('大量データのエクスポートパフォーマンステスト', async () => {
      // 大量のタスクを作成
      const bulkTasks = Array.from({ length: 100 }, (_, i) => ({
        project_id: testProject.id,
        name: `Bulk Task ${i}`,
        description: `Bulk task ${i} for performance testing`,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-15'),
        status: 'pending',
        progress: 0,
      }));

      for (const taskData of bulkTasks) {
        await testHelper.prisma.task.create({ data: taskData });
      }

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      const endTime = Date.now();

      // パフォーマンス要件: 30秒以内
      expect(endTime - startTime).toBeLessThan(30000);

      // レスポンスサイズが妥当であることを確認
      expect(response.body.length).toBeGreaterThan(1000);
    });
  });

  describe('プロジェクトインポート (POST /api/backup/import)', () => {
    let testZipBuffer: Buffer;

    beforeEach(async () => {
      testZipBuffer = await createTestZipFile();
    });

    it('有効なZIPファイルでインポート成功', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', testZipBuffer, 'test-project.zip')
        .field('projectName', 'Imported Test Project')
        .expect(200);

      expect(response.body).toHaveProperty('projectId');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('tasksImported');
      expect(response.body.projectId).toMatch(/^c[a-z0-9]{24}$/); // CUID format

      // インポートされたプロジェクトが存在することを確認
      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: response.body.projectId },
        include: { tasks: true },
      });

      expect(importedProject).not.toBeNull();
      expect(importedProject?.name).toBe('Imported Test Project');
      expect(importedProject?.tasks.length).toBeGreaterThan(0);
    });

    it('プロジェクト名未指定でも自動命名でインポート成功', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', testZipBuffer, 'test-project.zip')
        .expect(200);

      expect(response.body.projectId).toBeDefined();

      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: response.body.projectId },
      });

      expect(importedProject?.name).toBeDefined();
      expect(importedProject?.name).not.toBe('');
    });

    it('ファイル未指定でバリデーションエラー', async () => {
      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .field('projectName', 'Test Project')
        .expect(400);
    });

    it('非ZIPファイルでバリデーションエラー', async () => {
      const textBuffer = Buffer.from('This is not a zip file');

      const invalidFiles = [
        { buffer: textBuffer, filename: 'test.txt', mimetype: 'text/plain' },
        { buffer: textBuffer, filename: 'test.json', mimetype: 'application/json' },
        { buffer: textBuffer, filename: 'test.exe', mimetype: 'application/octet-stream' },
      ];

      for (const file of invalidFiles) {
        await request(app.getHttpServer())
          .post('/api/backup/import')
          .set('Authorization', authHeader)
          .attach('file', file.buffer, file.filename)
          .expect(400);
      }
    });

    it('ファイルサイズ制限超過でエラー', async () => {
      // 100MB超のダミーファイル作成
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024, 'a'); // 101MB

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', largeBuffer, 'large-file.zip')
        .expect(400);
    });

    it('破損したZIPファイルでエラー', async () => {
      const corruptedZip = Buffer.from('PK\x03\x04corrupted data');

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', corruptedZip, 'corrupted.zip')
        .expect(500);
    });

    it('無効なJSON構造でエラー', async () => {
      const invalidJsonZip = await createInvalidZipFile();

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', invalidJsonZip, 'invalid.zip')
        .expect(500);
    });

    it('Editor権限必須でViewer権限では403エラー', async () => {
      process.env.AUTH_TYPE = 'none';

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .attach('file', testZipBuffer, 'test-project.zip')
        .expect(403);

      process.env.AUTH_TYPE = 'basic';
    });

    it('同時インポートでのデータ競合テスト', async () => {
      const importPromises = Array.from({ length: 3 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/backup/import')
          .set('Authorization', authHeader)
          .attach('file', testZipBuffer, `test-project-${i}.zip`)
          .field('projectName', `Concurrent Import ${i}`)
      );

      const responses = await Promise.all(importPromises);

      // 全て成功するはず
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.projectId).toBeDefined();
      });

      // 異なるプロジェクトIDが生成されることを確認
      const projectIds = responses.map(r => r.body.projectId);
      const uniqueIds = [...new Set(projectIds)];
      expect(uniqueIds.length).toBe(projectIds.length);
    });
  });

  describe('エラーハンドリングとセキュリティ', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await testHelper.createTestProject();
    });

    it('認証なしでアクセス拒否', async () => {
      await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .expect(401);
    });

    it('無効な認証情報でアクセス拒否', async () => {
      const invalidAuth = testHelper.createBasicAuthHeader('wrong', 'credentials');

      await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', invalidAuth)
        .expect(401);
    });

    it('SQLインジェクション攻撃の防御', async () => {
      const maliciousIds = [
        "'; DROP TABLE projects; --",
        'c123456789012345678901234\' OR 1=1 --',
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
      ];

      for (const maliciousId of maliciousIds) {
        await request(app.getHttpServer())
          .post(`/api/backup/export/${encodeURIComponent(maliciousId)}`)
          .set('Authorization', authHeader)
          .expect(400);
      }
    });

    it('悪意のあるファイル名でのパストラバーサル防御', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd.zip',
        '..\\..\\windows\\system32\\config\\sam.zip',
        '/etc/shadow.zip',
        'null.zip\x00.exe',
      ];

      for (const filename of maliciousFilenames) {
        await request(app.getHttpServer())
          .post('/api/backup/import')
          .set('Authorization', authHeader)
          .attach('file', testZipBuffer, filename)
          .expect(400);
      }
    });

    it('レート制限テスト（連続アクセス）', async () => {
      const rapidRequests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/api/backup/export/${testProject.id}`)
          .set('Authorization', authHeader)
      );

      const responses = await Promise.all(rapidRequests);

      // 少なくとも一部は成功するはず（完全な制限がかかっていない場合）
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  describe('データ整合性とフォーマット', () => {
    let complexProject: any;

    beforeEach(async () => {
      // 複雑なデータ構造のプロジェクトを作成
      complexProject = await testHelper.createTestProject({
        name: 'Complex Export Project',
        description: 'Project with special characters: àáäâ 中文 🚀',
        start_date: new Date('2024-01-01T00:00:00.000Z'),
        end_date: new Date('2024-12-31T23:59:59.999Z'),
      });

      // 依存関係のあるタスクを作成
      const parentTask = await testHelper.createTestTask(complexProject.id, {
        name: 'Parent Task',
        dependencies: [],
      });

      await testHelper.createTestTask(complexProject.id, {
        name: 'Dependent Task',
        dependencies: [parentTask.id],
      });
    });

    it('特殊文字を含むデータの正しいエクスポート/インポート', async () => {
      // エクスポート
      const exportResponse = await request(app.getHttpServer())
        .post(`/api/backup/export/${complexProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      // インポート
      const importResponse = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', exportResponse.body, 'complex-project.zip')
        .expect(200);

      // インポートされたデータの確認
      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: importResponse.body.projectId },
        include: { tasks: true },
      });

      expect(importedProject?.name).toContain('Complex Export Project');
      expect(importedProject?.description).toContain('àáäâ');
      expect(importedProject?.description).toContain('中文');
      expect(importedProject?.description).toContain('🚀');
    });

    it('日付時刻の正確な保持', async () => {
      const exportResponse = await request(app.getHttpServer())
        .post(`/api/backup/export/${complexProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      const importResponse = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', exportResponse.body, 'datetime-test.zip')
        .expect(200);

      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: importResponse.body.projectId },
      });

      // 日付が正確に保持されていることを確認（1分程度の誤差は許容）
      const originalStart = new Date(complexProject.start_date);
      const importedStart = new Date(importedProject!.start_date);
      const timeDiff = Math.abs(originalStart.getTime() - importedStart.getTime());
      
      expect(timeDiff).toBeLessThan(60000); // 1分以内
    });

    it('タスク依存関係の正確な復元', async () => {
      const exportResponse = await request(app.getHttpServer())
        .post(`/api/backup/export/${complexProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      const importResponse = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', exportResponse.body, 'dependencies-test.zip')
        .expect(200);

      const importedTasks = await testHelper.prisma.task.findMany({
        where: { project_id: importResponse.body.projectId },
      });

      expect(importedTasks.length).toBe(2);
      
      const parentTask = importedTasks.find(t => t.name === 'Parent Task');
      const dependentTask = importedTasks.find(t => t.name === 'Dependent Task');
      
      expect(parentTask).toBeDefined();
      expect(dependentTask).toBeDefined();
      expect(dependentTask?.dependencies).toContain(parentTask?.id);
    });
  });
});

/**
 * テスト用のZIPファイルを作成
 */
async function createTestZipFile(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    const projectData = {
      name: 'Test Import Project',
      description: 'Project created for import testing',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T23:59:59.999Z',
      status: 'active',
    };

    const tasksData = [
      {
        name: 'Import Task 1',
        description: 'First task from import',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-15T23:59:59.999Z',
        status: 'completed',
        progress: 100,
        dependencies: [],
      },
      {
        name: 'Import Task 2',
        description: 'Second task from import',
        start_date: '2024-01-16T00:00:00.000Z',
        end_date: '2024-01-31T23:59:59.999Z',
        status: 'in_progress',
        progress: 50,
        dependencies: [],
      },
    ];

    archive.append(JSON.stringify(projectData, null, 2), { name: 'project.json' });
    archive.append(JSON.stringify(tasksData, null, 2), { name: 'tasks.json' });
    archive.finalize();
  });
}

/**
 * 無効なZIPファイルを作成（テスト用）
 */
async function createInvalidZipFile(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // 無効なJSON構造
    const invalidData = '{ "name": "Invalid", "incomplete": true';
    
    archive.append(invalidData, { name: 'project.json' });
    archive.finalize();
  });
}