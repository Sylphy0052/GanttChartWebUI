/**
 * バックアップ・エクスポート・インポート機能のE2Eテスト
 * 
 * テスト対象:
 * - プロジェクトエクスポート機能
 * - プロジェクトインポート機能
 * - ZIPファイルの生成と解析
 * - データ整合性の保証
 * - エラーハンドリング
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';

describe('バックアップ・エクスポート・インポート E2E テスト', () => {
  let app: INestApplication;
  let authHeader: string;

  beforeAll(async () => {
    app = testHelper.app;
    authHeader = testHelper.createBasicAuthHeader();
  });

  /**
   * テスト用ZIPファイル作成ヘルパー
   */
  async function createTestZipFile(): Promise<Buffer> {
    return await testHelper.createTestZipFile();
  }

  describe('プロジェクトエクスポート (POST /api/backup/export/:projectId)', () => {
    let testProject: any;
    let testIssue1: any;
    let testIssue2: any;

    beforeEach(async () => {
      // テストプロジェクト作成
      testProject = await testHelper.createTestProject({
        name: 'Export Test Project',
        description_md: 'This project will be exported for testing',
      });

      // テストIssue作成
      testIssue1 = await testHelper.createTestIssue(testProject.id, {
        title: 'Export Test Issue 1',
        description_md: 'First issue for export testing',
        status: 'open',
        progress_pct: 25,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-15'),
        labels: ['export', 'test'],
        effort_hours: 10,
      });

      testIssue2 = await testHelper.createTestIssue(testProject.id, {
        title: 'Export Test Issue 2',
        description_md: 'Second issue for export testing',
        status: 'in_progress',
        progress_pct: 75,
        start_date: new Date('2024-01-16'),
        end_date: new Date('2024-02-15'),
        parent_id: testIssue1.id,
        labels: ['export', 'development'],
        effort_hours: 20,
      });
    });

    it('有効なプロジェクトIDでエクスポート成功', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      // レスポンスヘッダーの検証
      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.zip');

      // ZIPファイルのサイズ検証（空でないこと）
      expect(response.body.length).toBeGreaterThan(100);
    });

    it('存在しないプロジェクトIDで404エラー', async () => {
      const nonExistentId = 'cjld2cyuq0000t3rmniod1foy';
      
      await request(app.getHttpServer())
        .post(`/api/backup/export/${nonExistentId}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('無効なプロジェクトID形式で400エラー', async () => {
      const invalidIds = [
        'invalid-id',
        '123',
        '',
        'too-short',
        'this-is-way-too-long-to-be-a-valid-cuid',
      ];

      for (const invalidId of invalidIds) {
        await request(app.getHttpServer())
          .post(`/api/backup/export/${invalidId}`)
          .set('Authorization', authHeader)
          .expect(400);
      }
    });

    it('論理削除されたプロジェクトのエクスポートで404エラー', async () => {
      // プロジェクト削除
      await request(app.getHttpServer())
        .delete(`/projects/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(204);

      // エクスポート試行
      await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it('大量のIssuesを含むプロジェクトのエクスポート', async () => {
      // 100個のIssue作成
      const issuePromises = Array.from({ length: 100 }, (_, index) =>
        testHelper.createTestIssue(testProject.id, {
          title: `Bulk Test Issue ${index + 1}`,
          description_md: `This is issue number ${index + 1} for bulk testing`,
          progress_pct: Math.floor(Math.random() * 101),
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-12-31'),
          labels: [`batch-${Math.floor(index / 10)}`],
        })
      );

      await Promise.all(issuePromises);

      const response = await request(app.getHttpServer())
        .post(`/api/backup/export/${testProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      // 大きなZIPファイルが生成されることを確認
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
      expect(response.body).toHaveProperty('importedCounts');
      expect(response.body.projectId).toMatch(/^c[a-z0-9]{24}$/); // CUID format

      // インポートされたプロジェクトが存在することを確認
      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: response.body.projectId },
        include: { issues: true },
      });

      expect(importedProject).toBeDefined();
      expect(importedProject?.name).toBe('Imported Test Project');
      expect(importedProject?.issues.length).toBe(2);
    });

    it('プロジェクト名指定なしでデフォルト名を使用', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', testZipBuffer, 'test-project.zip')
        .expect(200);

      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: response.body.projectId },
      });

      expect(importedProject?.name).toBe('Test Import Project'); // ZIPファイル内の名前
    });

    it('無効なファイル形式でエラー', async () => {
      const invalidFile = Buffer.from('This is not a ZIP file');

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', invalidFile, 'invalid.zip')
        .field('projectName', 'Should Fail')
        .expect(400);
    });

    it('空のファイルでエラー', async () => {
      const emptyFile = Buffer.alloc(0);

      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', emptyFile, 'empty.zip')
        .field('projectName', 'Should Fail')
        .expect(400);
    });

    it('ファイルなしでエラー', async () => {
      await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .field('projectName', 'Should Fail')
        .expect(400);
    });

    it('大量インポートの処理', async () => {
      // 大量データを含むZIPファイル作成
      const largeZip = await createTestZipFile();

      const promises = Array.from({ length: 5 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/backup/import')
          .set('Authorization', authHeader)
          .attach('file', largeZip, `large-project-${index}.zip`)
          .field('projectName', `Large Import Project ${index + 1}`)
          .expect(200)
      );

      const responses = await Promise.all(promises);

      // すべてのインポートが成功し、異なるプロジェクトIDが生成されることを確認
      responses.forEach((response, index) => {
        expect(response.body.projectId).toMatch(/^c[a-z0-9]{24}$/);
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
        const testZipBuffer = await createTestZipFile();
        
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
        description_md: '複雑なデータ構造を持つプロジェクト\n\n* 階層構造を持つIssue\n* 多様なステータス\n* 長いテキスト',
      });

      // 親Issue作成
      const parentIssue = await testHelper.createTestIssue(complexProject.id, {
        title: 'Parent Issue',
        description_md: '親Issueです',
        status: 'in_progress',
        progress_pct: 50,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-06-30'),
        labels: ['parent', 'milestone'],
        effort_hours: 100,
      });

      // 子Issues作成
      await Promise.all([
        testHelper.createTestIssue(complexProject.id, {
          title: 'Child Issue 1',
          description_md: '子Issue 1です',
          status: 'done',
          progress_pct: 100,
          parent_id: parentIssue.id,
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-02-15'),
          labels: ['child', 'completed'],
          effort_hours: 30,
        }),
        testHelper.createTestIssue(complexProject.id, {
          title: 'Child Issue 2',
          description_md: '子Issue 2です\n\n詳細説明:\n- 機能A実装\n- テスト作成\n- ドキュメント更新',
          status: 'open',
          progress_pct: 0,
          parent_id: parentIssue.id,
          start_date: new Date('2024-02-16'),
          end_date: new Date('2024-04-30'),
          labels: ['child', 'pending'],
          effort_hours: 45,
        }),
      ]);
    });

    it('階層構造を持つデータのエクスポート・インポート', async () => {
      // エクスポート
      const exportResponse = await request(app.getHttpServer())
        .post(`/api/backup/export/${complexProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      // エクスポートデータの基本検証
      expect(exportResponse.body.length).toBeGreaterThan(100);

      // インポート
      const importResponse = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', exportResponse.body, 'complex-project.zip')
        .field('projectName', 'Imported Complex Project')
        .expect(200);

      // インポート結果の検証
      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: importResponse.body.projectId },
        include: { 
          issues: {
            include: {
              parent: true,
              children: true,
            }
          }
        },
      });

      expect(importedProject).toBeDefined();
      expect(importedProject?.issues.length).toBe(3);
      
      const importedParent = importedProject?.issues.find(issue => issue.title === 'Parent Issue');
      expect(importedParent).toBeDefined();
      expect(importedParent?.children.length).toBe(2);
    });

    it('特殊文字を含むデータの整合性', async () => {
      const specialCharsProject = await testHelper.createTestProject({
        name: 'Special Characters Test 特殊文字テスト',
        description_md: 'Unicode文字列: 🚀🎯📊\n\nJSON特殊文字: "quotes" \\backslash \\n\\t\\r',
      });

      await testHelper.createTestIssue(specialCharsProject.id, {
        title: 'JSON特殊文字 "quotes" \\backslash',
        description_md: 'エモジ: 🔥💡⚡\n改行\tタブ\r復帰',
        labels: ['special', 'unicode', 'エモジ'],
        assignee: 'User "Admin" <admin@test.com>',
      });

      // エクスポート・インポートサイクル
      const exportResponse = await request(app.getHttpServer())
        .post(`/api/backup/export/${specialCharsProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      const importResponse = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', exportResponse.body, 'special-chars.zip')
        .field('projectName', 'Imported Special Chars')
        .expect(200);

      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: importResponse.body.projectId },
        include: { issues: true },
      });

      expect(importedProject?.description_md).toContain('🚀🎯📊');
      expect(importedProject?.issues[0].title).toContain('"quotes"');
      expect(importedProject?.issues[0].description_md).toContain('🔥💡⚡');
    });

    it('日付フォーマットの整合性', async () => {
      const dateProject = await testHelper.createTestProject({
        name: 'Date Format Test',
      });

      const specificDates = [
        new Date('2024-01-01T00:00:00.000Z'), // 年始
        new Date('2024-12-31T23:59:59.999Z'), // 年末
        new Date('2024-02-29T12:30:45.123Z'), // うるう年
        new Date('2024-07-15T15:30:00.000Z'), // 夏時間
      ];

      for (const [index, date] of specificDates.entries()) {
        await testHelper.createTestIssue(dateProject.id, {
          title: `Date Test Issue ${index + 1}`,
          start_date: date,
          end_date: new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000), // 1週間後
        });
      }

      // エクスポート・インポート
      const exportResponse = await request(app.getHttpServer())
        .post(`/api/backup/export/${dateProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      const importResponse = await request(app.getHttpServer())
        .post('/api/backup/import')
        .set('Authorization', authHeader)
        .attach('file', exportResponse.body, 'date-test.zip')
        .field('projectName', 'Imported Date Test')
        .expect(200);

      const importedProject = await testHelper.prisma.project.findUnique({
        where: { id: importResponse.body.projectId },
        include: { issues: true },
      });

      expect(importedProject?.issues.length).toBe(4);
      
      // 日付の精度確認（ミリ秒レベルまで）
      for (let i = 0; i < specificDates.length; i++) {
        const importedIssue = importedProject?.issues[i];
        expect(importedIssue?.start_date.getTime()).toBe(specificDates[i].getTime());
      }
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量データのエクスポート時間', async () => {
      const largeProject = await testHelper.createTestProject({
        name: 'Performance Test Project',
      });

      // 500個のIssue作成
      const issuePromises = Array.from({ length: 500 }, (_, index) =>
        testHelper.createTestIssue(largeProject.id, {
          title: `Performance Test Issue ${index + 1}`,
          description_md: `Performance test issue number ${index + 1}\n\n`.repeat(10), // 長いテキスト
          labels: Array.from({ length: 5 }, (_, i) => `label-${i}`),
          effort_hours: Math.floor(Math.random() * 40) + 1,
        })
      );

      await Promise.all(issuePromises);

      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .post(`/api/backup/export/${largeProject.id}`)
        .set('Authorization', authHeader)
        .expect(200);
      const endTime = Date.now();

      const exportTime = endTime - startTime;
      console.log(`Export time for 500 issues: ${exportTime}ms`);

      // 10秒以内に完了することを期待
      expect(exportTime).toBeLessThan(10000);
      
      // 生成されたZIPファイルのサイズチェック
      expect(response.body.length).toBeGreaterThan(50000); // 50KB以上
    }, 15000); // 15秒のタイムアウト

    it('並行エクスポートの処理能力', async () => {
      const projects = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          testHelper.createTestProject({
            name: `Concurrent Test Project ${index + 1}`,
          })
        )
      );

      // 各プロジェクトにIssueを追加
      for (const project of projects) {
        await Promise.all(
          Array.from({ length: 50 }, (_, index) =>
            testHelper.createTestIssue(project.id, {
              title: `Concurrent Issue ${index + 1}`,
              description_md: 'Concurrent test issue',
            })
          )
        );
      }

      const startTime = Date.now();
      const exportPromises = projects.map(project =>
        request(app.getHttpServer())
          .post(`/api/backup/export/${project.id}`)
          .set('Authorization', authHeader)
          .expect(200)
      );

      const responses = await Promise.all(exportPromises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      console.log(`Concurrent export time for 10 projects: ${totalTime}ms`);

      // 並行処理により、個別処理の合計時間より短くなることを期待
      expect(totalTime).toBeLessThan(30000); // 30秒以内

      // すべてのエクスポートが成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.length).toBeGreaterThan(1000);
      });
    }, 60000); // 60秒のタイムアウト
  });
});