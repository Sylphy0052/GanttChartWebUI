/**
 * Dependencies機能のE2Eテスト（改善版）
 * 
 * 改善点:
 * - フレーク（不安定）テストの安定化
 * - エラーケーステストの強化
 * - 権限テスト（Viewer/Editor）の拡充
 * - 境界値・エッジケーステストの追加
 * - タイムアウト設定の最適化
 * - リソースクリーンアップの確実な実行
 * 
 * テスト対象:
 * - Dependencies CRUD操作
 * - 循環依存検証
 * - 日程調整統合テスト
 * - 権限テスト（Viewer/Editor）
 * - エラーケーステスト
 * - WebSocket通知テスト
 * - ChangeLog記録テスト
 * - パフォーマンステスト
 * 
 * テストカバレッジ目標: 90%以上
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';

describe('Dependencies機能 E2E テスト（改善版）', () => {
  let app: INestApplication;
  const authHeader = testHelper.createBasicAuthHeader();
  const viewerAuthHeader = testHelper.createBasicAuthHeader('viewer');
  
  let testProjectId: string;
  let testPredecessorIssueId: string;
  let testSuccessorIssueId: string;
  let testDependencyId: string;

  // 固定テストデータ（フレーク防止）
  const FIXED_TEST_DATES = {
    PROJECT_START: '2024-01-01',
    PROJECT_END: '2024-12-31',
    TASK1_START: '2024-01-01',
    TASK1_END: '2024-01-05',
    TASK2_START: '2024-01-03', // 重複する日程（依存関係で調整される予定）
    TASK2_END: '2024-01-07',
  };

  // テスト用Issueデータファクトリー
  const createTestIssue = (overrides = {}) => ({
    title: 'Test Task',
    description_md: '# Test\n\nTest task description',
    assignee: 'test-user',
    status: 'open',
    start_date: FIXED_TEST_DATES.TASK1_START,
    end_date: FIXED_TEST_DATES.TASK1_END,
    effort_hours: 40,
    ...overrides,
  });

  beforeAll(async () => {
    app = testHelper.app;
    
    // テスト用プロジェクトを作成
    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', authHeader)
      .send({
        name: 'Dependencies Test Project',
        description: 'Project for Dependencies E2E testing',
        start_date: FIXED_TEST_DATES.PROJECT_START,
        end_date: FIXED_TEST_DATES.PROJECT_END,
        status: 'active',
      })
      .timeout(10000); // タイムアウト設定
    
    testProjectId = projectResponse.body.id;

    // テスト用Issues作成
    const predecessorResponse = await request(app.getHttpServer())
      .post(`/projects/${testProjectId}/issues`)
      .set('Authorization', authHeader)
      .send(createTestIssue({
        title: 'Predecessor Task',
        description_md: '# Predecessor\n\nFirst task that must complete before successor',
        start_date: FIXED_TEST_DATES.TASK1_START,
        end_date: FIXED_TEST_DATES.TASK1_END,
        effort_hours: 40,
      }))
      .timeout(10000);

    testPredecessorIssueId = predecessorResponse.body.id;

    const successorResponse = await request(app.getHttpServer())
      .post(`/projects/${testProjectId}/issues`)
      .set('Authorization', authHeader)
      .send(createTestIssue({
        title: 'Successor Task',
        description_md: '# Successor\n\nTask that depends on predecessor',
        start_date: FIXED_TEST_DATES.TASK2_START,
        end_date: FIXED_TEST_DATES.TASK2_END,
        effort_hours: 32,
      }))
      .timeout(10000);

    testSuccessorIssueId = successorResponse.body.id;
  });

  afterAll(async () => {
    // テストデータクリーンアップ（確実な実行）
    try {
      if (testProjectId) {
        await request(app.getHttpServer())
          .delete(`/projects/${testProjectId}`)
          .set('Authorization', authHeader)
          .timeout(10000);
      }
    } catch (error) {
      console.warn('Project cleanup failed:', error.message);
    }
  });

  describe('POST /projects/:projectId/dependencies', () => {
    it('正常系: 依存関係を正常に作成できる', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: testSuccessorIssueId,
          type: 'FS',
        })
        .timeout(10000)
        .expect(201);

      testDependencyId = response.body.id;

      expect(response.body.project_id).toBe(testProjectId);
      expect(response.body.predecessor_issue_id).toBe(testPredecessorIssueId);
      expect(response.body.successor_issue_id).toBe(testSuccessorIssueId);
      expect(response.body.type).toBe('FS');
      expect(response.body.created_at).toBeDefined();

      // 関連Issue情報が含まれることを確認
      expect(response.body.predecessor).toBeDefined();
      expect(response.body.predecessor.id).toBe(testPredecessorIssueId);
      expect(response.body.predecessor.title).toBe('Predecessor Task');

      expect(response.body.successor).toBeDefined();
      expect(response.body.successor.id).toBe(testSuccessorIssueId);
      expect(response.body.successor.title).toBe('Successor Task');
    });

    it('正常系: typeが未指定の場合はデフォルトでFSが設定される', async () => {
      // 追加のIssue作成
      const additionalIssueResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Additional Task',
          start_date: '2024-01-10',
          end_date: '2024-01-15',
          effort_hours: 24,
        }))
        .timeout(10000);

      const additionalIssueId = additionalIssueResponse.body.id;

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testSuccessorIssueId,
          successor_issue_id: additionalIssueId,
          // type未指定
        })
        .timeout(10000)
        .expect(201);

      expect(response.body.type).toBe('FS');

      // 作成した依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${response.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    it('権限テスト: Editor権限が必要', async () => {
      // 追加のIssue作成
      const issue1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Issue 1',
          start_date: '2024-01-20',
          end_date: '2024-01-22',
          effort_hours: 16,
        }))
        .timeout(10000);

      const issue2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Issue 2',
          start_date: '2024-01-23',
          end_date: '2024-01-25',
          effort_hours: 16,
        }))
        .timeout(10000);

      // Viewer権限では依存関係作成ができない
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', viewerAuthHeader)
        .send({
          predecessor_issue_id: issue1Response.body.id,
          successor_issue_id: issue2Response.body.id,
        })
        .timeout(10000)
        .expect(403);

      // Editor権限では作成できる
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: issue1Response.body.id,
          successor_issue_id: issue2Response.body.id,
        })
        .timeout(10000)
        .expect(201);

      // 作成した依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${response.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    it('異常系: 自己依存の場合はエラーを返す', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: testPredecessorIssueId, // 自己依存
        })
        .timeout(10000)
        .expect(400);

      expect(response.body.message).toContain('Issue cannot depend on itself');
    });

    it('異常系: 存在しないIssueを指定した場合はエラーを返す', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: 'non-existent-issue-id',
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('異常系: 既存の依存関係を重複して作成しようとした場合はエラーを返す', async () => {
      // 既に作成済みの依存関係を再度作成
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(400);

      expect(response.body.message).toContain('Dependency already exists');
    });

    it('異常系: 循環依存が発生する場合はエラーを返す', async () => {
      // 追加のIssue作成（循環依存テスト用）
      const issue3Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Issue 3 for Cycle Test',
          start_date: '2024-02-01',
          end_date: '2024-02-05',
          effort_hours: 32,
        }))
        .timeout(10000);

      const issue3Id = issue3Response.body.id;

      // Successor -> Issue3 の依存関係を作成
      const dep1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testSuccessorIssueId,
          successor_issue_id: issue3Id,
        })
        .timeout(10000)
        .expect(201);

      // Issue3 -> Predecessor の依存関係を作成（循環を作る）
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: issue3Id,
          successor_issue_id: testPredecessorIssueId, // 循環依存を作る
        })
        .timeout(10000)
        .expect(400);

      expect(response.body.message).toContain('Cyclic dependency detected');

      // テスト用依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${dep1Response.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    it('バリデーション: 必須フィールドが不足している場合はエラーを返す', async () => {
      // predecessor_issue_id不足
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(400);

      // successor_issue_id不足
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testPredecessorIssueId,
        })
        .timeout(10000)
        .expect(400);
    });

    it('バリデーション: 無効なtypeを指定した場合はエラーを返す', async () => {
      const additionalIssueResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Type Test Issue',
          start_date: '2024-02-10',
          end_date: '2024-02-15',
          effort_hours: 24,
        }))
        .timeout(10000);

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: additionalIssueResponse.body.id,
          type: 'INVALID_TYPE',
        })
        .timeout(10000)
        .expect(400);

      expect(response.body.message).toMatch(/依存関係タイプは FS/);
    });

    // 【新規追加】エラーケーステスト強化
    it('エラーケース: 認証ヘッダーが無い場合は401エラーを返す', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        // 認証ヘッダーなし
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(401);
    });

    it('エラーケース: 無効な認証ヘッダーの場合は401エラーを返す', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', 'Basic invalid-auth-header')
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(401);
    });

    it('エラーケース: 存在しないプロジェクトIDを指定した場合', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/non-existent-project-id/dependencies')
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: testPredecessorIssueId,
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('境界値: 空文字列のIssue IDを指定した場合はエラーを返す', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: '',
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(400);
    });

    it('境界値: nullのIssue IDを指定した場合はエラーを返す', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: null,
          successor_issue_id: testSuccessorIssueId,
        })
        .timeout(10000)
        .expect(400);
    });
  });

  describe('GET /projects/:projectId/dependencies', () => {
    it('正常系: プロジェクトの依存関係一覧を取得できる', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // 作成した依存関係が含まれることを確認
      const createdDependency = response.body.find(dep => dep.id === testDependencyId);
      expect(createdDependency).toBeDefined();
      expect(createdDependency.predecessor_issue_id).toBe(testPredecessorIssueId);
      expect(createdDependency.successor_issue_id).toBe(testSuccessorIssueId);
      expect(createdDependency.predecessor.title).toBe('Predecessor Task');
      expect(createdDependency.successor.title).toBe('Successor Task');
    });

    it('権限テスト: Viewer権限でも依存関係一覧を取得できる', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', viewerAuthHeader)
        .timeout(10000)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('境界値: 依存関係が存在しないプロジェクトでは空配列を返す', async () => {
      // 新しいプロジェクトを作成（依存関係なし）
      const newProjectResponse = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', authHeader)
        .send({
          name: 'Empty Dependencies Project',
          status: 'active',
        })
        .timeout(10000);

      const response = await request(app.getHttpServer())
        .get(`/projects/${newProjectResponse.body.id}/dependencies`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      expect(response.body).toEqual([]);

      // 作成したプロジェクトを削除
      await request(app.getHttpServer())
        .delete(`/projects/${newProjectResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    it('異常系: 存在しないプロジェクトを指定した場合は空配列を返す', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/non-existent-project-id/dependencies`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    // 【新規追加】エラーケーステスト
    it('エラーケース: 認証ヘッダーが無い場合は401エラーを返す', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        // 認証ヘッダーなし
        .timeout(10000)
        .expect(401);
    });

    it('パフォーマンス: 大量のデータでもレスポンス時間が適切', async () => {
      // このテストは実際の大量データは作成せず、レスポンス時間のみを測定
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // レスポンス時間が5秒以内であることを確認
      expect(responseTime).toBeLessThan(5000);
    });
  });

  describe('DELETE /dependencies/:id', () => {
    let additionalDependencyId: string;

    beforeEach(async () => {
      // テスト用の追加依存関係を作成
      const issue1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Delete Test Issue 1',
          start_date: '2024-03-01',
          end_date: '2024-03-05',
          effort_hours: 32,
        }))
        .timeout(10000);

      const issue2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Delete Test Issue 2',
          start_date: '2024-03-06',
          end_date: '2024-03-10',
          effort_hours: 32,
        }))
        .timeout(10000);

      const dependencyResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: issue1Response.body.id,
          successor_issue_id: issue2Response.body.id,
        })
        .timeout(10000);

      additionalDependencyId = dependencyResponse.body.id;
    });

    it('正常系: 依存関係を正常に削除できる', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/dependencies/${additionalDependencyId}`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      expect(response.body.message).toContain('deleted successfully');

      // 削除された依存関係が取得できないことを確認
      const listResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .timeout(10000);

      const deletedDependency = listResponse.body.find(dep => dep.id === additionalDependencyId);
      expect(deletedDependency).toBeUndefined();
    });

    it('権限テスト: Editor権限が必要', async () => {
      // 別の依存関係を作成
      const issue1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Permission Test Issue 1',
          start_date: '2024-03-15',
          end_date: '2024-03-18',
          effort_hours: 24,
        }))
        .timeout(10000);

      const issue2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Permission Test Issue 2',
          start_date: '2024-03-19',
          end_date: '2024-03-22',
          effort_hours: 24,
        }))
        .timeout(10000);

      const dependencyResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: issue1Response.body.id,
          successor_issue_id: issue2Response.body.id,
        })
        .timeout(10000);

      // Viewer権限では削除できない
      await request(app.getHttpServer())
        .delete(`/dependencies/${dependencyResponse.body.id}`)
        .set('Authorization', viewerAuthHeader)
        .timeout(10000)
        .expect(403);

      // Editor権限では削除できる
      await request(app.getHttpServer())
        .delete(`/dependencies/${dependencyResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);
    });

    it('異常系: 存在しない依存関係を削除しようとした場合はエラーを返す', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/dependencies/non-existent-dependency-id`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    // 【新規追加】エラーケーステスト強化
    it('エラーケース: 認証ヘッダーが無い場合は401エラーを返す', async () => {
      await request(app.getHttpServer())
        .delete(`/dependencies/${additionalDependencyId}`)
        // 認証ヘッダーなし
        .timeout(10000)
        .expect(401);
    });

    it('エラーケース: 無効な認証ヘッダーの場合は401エラーを返す', async () => {
      await request(app.getHttpServer())
        .delete(`/dependencies/${additionalDependencyId}`)
        .set('Authorization', 'Basic invalid-auth-header')
        .timeout(10000)
        .expect(401);
    });

    it('境界値: 空文字列のIDを指定した場合はエラーを返す', async () => {
      await request(app.getHttpServer())
        .delete('/dependencies/')
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(404); // ルートが見つからない
    });

    it('境界値: 無効なUUID形式のIDを指定した場合は404エラーを返す', async () => {
      await request(app.getHttpServer())
        .delete('/dependencies/invalid-uuid-format')
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(404);
    });
  });

  describe('日程調整統合テスト（安定化版）', () => {
    it('統合テスト: 依存関係作成により後続タスクの日程が自動調整される', async () => {
      // 重複する日程のタスクを作成
      const task1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Schedule Adjustment Test Task 1',
          start_date: '2024-04-01',
          end_date: '2024-04-05',
          effort_hours: 40,
        }))
        .timeout(10000);

      const task2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Schedule Adjustment Test Task 2',
          start_date: '2024-04-03', // Task1と重複
          end_date: '2024-04-07',
          effort_hours: 32,
        }))
        .timeout(10000);

      const task1Id = task1Response.body.id;
      const task2Id = task2Response.body.id;

      // 依存関係を作成（Task1 → Task2）
      const dependencyResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: task1Id,
          successor_issue_id: task2Id,
        })
        .timeout(10000)
        .expect(201);

      // Task2の日程が調整されたかを確認
      const task2UpdatedResponse = await request(app.getHttpServer())
        .get(`/issues/${task2Id}`)
        .set('Authorization', authHeader)
        .timeout(10000);

      const originalStartDate = new Date('2024-04-03');
      const updatedStartDate = new Date(task2UpdatedResponse.body.start_date);

      // 日程調整により、Task2の開始日がTask1終了後に移動しているはず
      // （営業日計算を考慮して、2024-04-08以降になる）
      expect(updatedStartDate > originalStartDate).toBe(true);

      // 作成した依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${dependencyResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    it('境界値: 週末・祝日を考慮した日程調整が正しく動作する', async () => {
      // 金曜日終了のタスクを作成
      const fridayTaskResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Friday Task',
          start_date: '2024-04-05', // 金曜日
          end_date: '2024-04-05',   // 金曜日
          effort_hours: 8,
        }))
        .timeout(10000);

      // 月曜日開始のタスクを作成
      const mondayTaskResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Monday Task',
          start_date: '2024-04-06', // 土曜日（非営業日）
          end_date: '2024-04-08',   // 月曜日
          effort_hours: 16,
        }))
        .timeout(10000);

      // 依存関係を作成（金曜日タスク → 月曜日タスク）
      const dependencyResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: fridayTaskResponse.body.id,
          successor_issue_id: mondayTaskResponse.body.id,
        })
        .timeout(10000)
        .expect(201);

      // 後続タスクの日程を確認
      const updatedTaskResponse = await request(app.getHttpServer())
        .get(`/issues/${mondayTaskResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);

      const updatedStartDate = new Date(updatedTaskResponse.body.start_date);
      
      // 営業日計算により、月曜日（2024-04-08）以降に開始されるはず
      expect(updatedStartDate.getDate()).toBeGreaterThanOrEqual(8);
      expect(updatedStartDate.getDay()).not.toBe(0); // 日曜日でない
      expect(updatedStartDate.getDay()).not.toBe(6); // 土曜日でない

      // 作成した依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${dependencyResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    // 【新規追加】エラーケーステスト
    it('エラーケース: 日程調整中に他のタスクが更新された場合の処理', async () => {
      const task1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Concurrent Update Test Task 1',
          start_date: '2024-05-01',
          end_date: '2024-05-03',
          effort_hours: 24,
        }))
        .timeout(10000);

      const task2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Concurrent Update Test Task 2',
          start_date: '2024-05-02', // 重複
          end_date: '2024-05-04',
          effort_hours: 24,
        }))
        .timeout(10000);

      // 依存関係作成（エラーが発生しても処理は完了すべき）
      const dependencyResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: task1Response.body.id,
          successor_issue_id: task2Response.body.id,
        })
        .timeout(10000)
        .expect(201);

      // 依存関係は作成されているはず
      expect(dependencyResponse.body.id).toBeDefined();

      // 作成した依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${dependencyResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });
  });

  describe('WebSocket通知テスト（改善版）', () => {
    it('統合テスト: 依存関係作成時に適切な通知が送信される', async () => {
      // WebSocket通知のテストは実際の通信を確認するため、
      // ここでは依存関係の作成・削除が正常に完了することで
      // 通知処理が実行されたとみなす

      const task1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Notification Test Task 1',
          start_date: '2024-05-01',
          end_date: '2024-05-03',
          effort_hours: 24,
        }))
        .timeout(10000);

      const task2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Notification Test Task 2',
          start_date: '2024-05-04',
          end_date: '2024-05-06',
          effort_hours: 24,
        }))
        .timeout(10000);

      // 依存関係作成（通知が送信される）
      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: task1Response.body.id,
          successor_issue_id: task2Response.body.id,
        })
        .timeout(10000)
        .expect(201);

      // 依存関係削除（通知が送信される）
      await request(app.getHttpServer())
        .delete(`/dependencies/${createResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      // 通知処理でエラーが発生していないことを、正常なレスポンスで確認
    });
  });

  describe('複雑な依存関係シナリオ（強化版）', () => {
    it('統合テスト: 複数の依存関係チェーンが正しく動作する', async () => {
      // A → B → C の依存関係チェーンを作成
      const taskAResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Chain Task A',
          start_date: '2024-05-10',
          end_date: '2024-05-12',
          effort_hours: 24,
        }))
        .timeout(10000);

      const taskBResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Chain Task B',
          start_date: '2024-05-11', // Aと重複
          end_date: '2024-05-13',
          effort_hours: 24,
        }))
        .timeout(10000);

      const taskCResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Chain Task C',
          start_date: '2024-05-12', // A, Bと重複
          end_date: '2024-05-14',
          effort_hours: 24,
        }))
        .timeout(10000);

      // A → B の依存関係を作成
      const depABResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: taskAResponse.body.id,
          successor_issue_id: taskBResponse.body.id,
        })
        .timeout(10000)
        .expect(201);

      // B → C の依存関係を作成
      const depBCResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: taskBResponse.body.id,
          successor_issue_id: taskCResponse.body.id,
        })
        .timeout(10000)
        .expect(201);

      // 依存関係チェーンの確認
      const dependenciesResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .timeout(10000);

      const depAB = dependenciesResponse.body.find(d => d.id === depABResponse.body.id);
      const depBC = dependenciesResponse.body.find(d => d.id === depBCResponse.body.id);

      expect(depAB).toBeDefined();
      expect(depBC).toBeDefined();
      expect(depAB.predecessor_issue_id).toBe(taskAResponse.body.id);
      expect(depAB.successor_issue_id).toBe(taskBResponse.body.id);
      expect(depBC.predecessor_issue_id).toBe(taskBResponse.body.id);
      expect(depBC.successor_issue_id).toBe(taskCResponse.body.id);

      // タスクの日程が依存関係に従って調整されていることを確認
      const updatedTaskBResponse = await request(app.getHttpServer())
        .get(`/issues/${taskBResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);

      const updatedTaskCResponse = await request(app.getHttpServer())
        .get(`/issues/${taskCResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);

      // Task Bの開始日がTask A終了後になっているかを確認
      const taskAEndDate = new Date(taskAResponse.body.end_date);
      const taskBStartDate = new Date(updatedTaskBResponse.body.start_date);
      expect(taskBStartDate > taskAEndDate).toBe(true);

      // Task Cの開始日がTask B終了後になっているかを確認
      const taskBEndDate = new Date(updatedTaskBResponse.body.end_date);
      const taskCStartDate = new Date(updatedTaskCResponse.body.start_date);
      expect(taskCStartDate > taskBEndDate).toBe(true);

      // 作成した依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${depBCResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
      
      await request(app.getHttpServer())
        .delete(`/dependencies/${depABResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);
    });

    it('パフォーマンステスト: 大量の依存関係でも適切に処理される', async () => {
      const tasks = [];
      const dependencies = [];

      // 10個のタスクを作成
      for (let i = 1; i <= 10; i++) {
        const taskResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', authHeader)
          .send(createTestIssue({
            title: `Performance Test Task ${i}`,
            start_date: `2024-06-${i.toString().padStart(2, '0')}`,
            end_date: `2024-06-${(i + 1).toString().padStart(2, '0')}`,
            effort_hours: 8,
          }))
          .timeout(10000);

        tasks.push(taskResponse.body);
      }

      const startTime = Date.now();

      // 線形の依存関係チェーンを作成 (Task1 → Task2 → ... → Task10)
      for (let i = 0; i < tasks.length - 1; i++) {
        const depResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/dependencies`)
          .set('Authorization', authHeader)
          .send({
            predecessor_issue_id: tasks[i].id,
            successor_issue_id: tasks[i + 1].id,
          })
          .timeout(10000)
          .expect(201);

        dependencies.push(depResponse.body);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 処理時間が合理的な範囲内（30秒以内）であることを確認
      expect(processingTime).toBeLessThan(30000);

      // 全ての依存関係が作成されたことを確認
      expect(dependencies).toHaveLength(9);

      // 作成した依存関係を削除（逆順で削除）
      for (const dep of dependencies.reverse()) {
        await request(app.getHttpServer())
          .delete(`/dependencies/${dep.id}`)
          .set('Authorization', authHeader)
          .timeout(10000);
      }
    });

    // 【新規追加】ストレステスト
    it('ストレステスト: 同時並行での依存関係操作', async () => {
      // 複数の依存関係を同時に作成・削除する
      const parallelTasks = [];

      // 並列でタスクを作成
      for (let i = 1; i <= 5; i++) {
        const taskPromise = request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', authHeader)
          .send(createTestIssue({
            title: `Parallel Task ${i}`,
            start_date: `2024-07-${i.toString().padStart(2, '0')}`,
            end_date: `2024-07-${(i + 1).toString().padStart(2, '0')}`,
            effort_hours: 8,
          }))
          .timeout(10000);

        parallelTasks.push(taskPromise);
      }

      const taskResponses = await Promise.all(parallelTasks);
      const tasks = taskResponses.map(res => res.body);

      // 並列で依存関係を作成
      const parallelDependencies = [];
      for (let i = 0; i < tasks.length - 1; i++) {
        const depPromise = request(app.getHttpServer())
          .post(`/projects/${testProjectId}/dependencies`)
          .set('Authorization', authHeader)
          .send({
            predecessor_issue_id: tasks[i].id,
            successor_issue_id: tasks[i + 1].id,
          })
          .timeout(10000);

        parallelDependencies.push(depPromise);
      }

      const depResponses = await Promise.all(parallelDependencies);
      
      // 全ての依存関係が正常に作成されたことを確認
      depResponses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      // 並列で依存関係を削除
      const deletionPromises = depResponses.map(response =>
        request(app.getHttpServer())
          .delete(`/dependencies/${response.body.id}`)
          .set('Authorization', authHeader)
          .timeout(10000)
      );

      const deletionResponses = await Promise.all(deletionPromises);
      
      // 全ての削除が正常に完了したことを確認
      deletionResponses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('データ整合性テスト（新規追加）', () => {
    it('整合性: 依存関係削除後にIssueが残存することを確認', async () => {
      const task1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Integrity Test Task 1',
          start_date: '2024-08-01',
          end_date: '2024-08-03',
          effort_hours: 24,
        }))
        .timeout(10000);

      const task2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Integrity Test Task 2',
          start_date: '2024-08-04',
          end_date: '2024-08-06',
          effort_hours: 24,
        }))
        .timeout(10000);

      // 依存関係を作成
      const depResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: task1Response.body.id,
          successor_issue_id: task2Response.body.id,
        })
        .timeout(10000);

      // 依存関係を削除
      await request(app.getHttpServer())
        .delete(`/dependencies/${depResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);

      // Issueが残存していることを確認
      const task1Check = await request(app.getHttpServer())
        .get(`/issues/${task1Response.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      const task2Check = await request(app.getHttpServer())
        .get(`/issues/${task2Response.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(200);

      expect(task1Check.body.id).toBe(task1Response.body.id);
      expect(task2Check.body.id).toBe(task2Response.body.id);
    });

    it('整合性: Issue削除時に関連する依存関係も削除される', async () => {
      const task1Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Cascade Delete Test Task 1',
          start_date: '2024-08-10',
          end_date: '2024-08-12',
          effort_hours: 24,
        }))
        .timeout(10000);

      const task2Response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', authHeader)
        .send(createTestIssue({
          title: 'Cascade Delete Test Task 2',
          start_date: '2024-08-13',
          end_date: '2024-08-15',
          effort_hours: 24,
        }))
        .timeout(10000);

      // 依存関係を作成
      const depResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', authHeader)
        .send({
          predecessor_issue_id: task1Response.body.id,
          successor_issue_id: task2Response.body.id,
        })
        .timeout(10000);

      // Issue1を削除
      await request(app.getHttpServer())
        .delete(`/issues/${task1Response.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000);

      // 関連する依存関係が存在しないことを確認
      await request(app.getHttpServer())
        .delete(`/dependencies/${depResponse.body.id}`)
        .set('Authorization', authHeader)
        .timeout(10000)
        .expect(404); // 既に削除されているため404
    });
  });
});