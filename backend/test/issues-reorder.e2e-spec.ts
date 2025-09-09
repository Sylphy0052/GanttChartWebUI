/**
 * Issue並び替え・階層変更・WBS機能のE2Eテスト
 * 
 * テスト対象:
 * - Issue並び替えAPI（POST /issues/reorder）
 * - Issue階層変更API（PATCH /issues/:id/hierarchy）
 * - WBS番号生成の統合動作
 * - 楽観的排他制御の実際の動作
 * - リアルタイム通知の動作確認
 * 
 * テストケース:
 * - 正常系: 複数Issue並び替え、階層変更、WBS番号自動更新
 * - 異常系: version競合、循環参照、バリデーションエラー
 * - 境界値: 空配列、重複ID、大量Issue処理
 * - 統合: 並び替え→階層変更→WBS更新の連続操作
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';
import { PrismaService } from '../src/database/prisma.service';

describe('Issue並び替え・階層変更・WBS機能 E2E テスト', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  const authHeader = testHelper.createBasicAuthHeader();
  let testProjectId: string;
  let testIssues: any[] = [];

  beforeAll(async () => {
    app = testHelper.app;
    prismaService = app.get<PrismaService>(PrismaService);
    
    // テスト用プロジェクトを作成
    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', authHeader)
      .send({
        name: 'Reorder Test Project',
        description: 'Project for Issue reordering and hierarchy testing',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'active',
      });
    
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    if (testProjectId) {
      await request(app.getHttpServer())
        .delete(`/projects/${testProjectId}`)
        .set('Authorization', authHeader);
    }
  });

  beforeEach(async () => {
    // 各テスト前にIssueをクリーンアップ
    await prismaService.issue.updateMany({
      where: { project_id: testProjectId },
      data: { is_deleted: true, deleted_at: new Date() },
    });
    testIssues = [];
  });

  /**
   * テスト用Issueを作成するヘルパー関数
   */
  async function createTestIssue(title: string, sortOrder: number, parentId?: string) {
    const issueData: any = {
      title,
      sort_order: sortOrder,
    };
    if (parentId) {
      issueData.parent_id = parentId;
    }

    const response = await request(app.getHttpServer())
      .post(`/projects/${testProjectId}/issues`)
      .set('Authorization', authHeader)
      .send(issueData);

    testIssues.push(response.body);
    return response.body;
  }

  /**
   * Issue一覧を取得してWBS番号をチェックするヘルパー関数
   */
  async function getIssuesAndCheckWBS() {
    const response = await request(app.getHttpServer())
      .get(`/projects/${testProjectId}/issues`)
      .set('Authorization', authHeader);

    return response.body;
  }

  describe('Issue並び替えAPI (POST /issues/reorder)', () => {
    it('should successfully reorder multiple issues and update WBS numbers', async () => {
      // テスト用Issueを3つ作成
      const issue1 = await createTestIssue('Issue 1', 10);
      const issue2 = await createTestIssue('Issue 2', 20);
      const issue3 = await createTestIssue('Issue 3', 30);

      // 並び替え実行: issue3 -> issue1 -> issue2 の順序に変更
      const reorderData = {
        issues: [
          { id: issue3.id, sort_order: 5, version: issue3.version },
          { id: issue1.id, sort_order: 15, version: issue1.version },
          { id: issue2.id, sort_order: 25, version: issue2.version },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send(reorderData)
        .expect(200);

      expect(response.body).toHaveLength(3);

      // 並び替え後のsort_orderを確認
      const reorderedIssue3 = response.body.find(issue => issue.id === issue3.id);
      const reorderedIssue1 = response.body.find(issue => issue.id === issue1.id);
      const reorderedIssue2 = response.body.find(issue => issue.id === issue2.id);

      expect(reorderedIssue3.sort_order).toBe(5);
      expect(reorderedIssue1.sort_order).toBe(15);
      expect(reorderedIssue2.sort_order).toBe(25);

      // versionがインクリメントされていることを確認
      expect(reorderedIssue3.version).toBe(issue3.version + 1);
      expect(reorderedIssue1.version).toBe(issue1.version + 1);
      expect(reorderedIssue2.version).toBe(issue2.version + 1);

      // WBS番号が正しく更新されていることを確認
      const issuesWithWBS = await getIssuesAndCheckWBS();
      const sortedIssues = issuesWithWBS.sort((a, b) => a.sort_order - b.sort_order);

      expect(sortedIssues[0].wbs_number).toBe('1'); // issue3
      expect(sortedIssues[1].wbs_number).toBe('2'); // issue1
      expect(sortedIssues[2].wbs_number).toBe('3'); // issue2
    });

    it('should handle empty issues array', async () => {
      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send({ issues: [] })
        .expect(400);
    });

    it('should handle duplicate issue IDs', async () => {
      const issue1 = await createTestIssue('Issue 1', 10);

      const reorderData = {
        issues: [
          { id: issue1.id, sort_order: 5, version: issue1.version },
          { id: issue1.id, sort_order: 15, version: issue1.version }, // 重複ID
        ],
      };

      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send(reorderData)
        .expect(400);
    });

    it('should handle optimistic locking conflicts', async () => {
      const issue1 = await createTestIssue('Issue 1', 10);

      // 古いversionで並び替えを試行（楽観的排他制御エラー）
      const reorderData = {
        issues: [
          { id: issue1.id, sort_order: 5, version: 999 }, // 存在しないversion
        ],
      };

      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send(reorderData)
        .expect(409);
    });

    it('should handle non-existent issue IDs', async () => {
      const reorderData = {
        issues: [
          { id: 'non-existent-issue', sort_order: 5, version: 1 },
        ],
      };

      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send(reorderData)
        .expect(404);
    });

    it('should handle concurrent reorder operations', async () => {
      const issue1 = await createTestIssue('Issue 1', 10);
      const issue2 = await createTestIssue('Issue 2', 20);

      // 2つの同時並び替えリクエスト
      const reorderData1 = {
        issues: [
          { id: issue1.id, sort_order: 25, version: issue1.version },
        ],
      };

      const reorderData2 = {
        issues: [
          { id: issue2.id, sort_order: 5, version: issue2.version },
        ],
      };

      // 並行実行
      const [response1, response2] = await Promise.allSettled([
        request(app.getHttpServer())
          .post('/issues/reorder')
          .set('Authorization', authHeader)
          .send(reorderData1),
        request(app.getHttpServer())
          .post('/issues/reorder')
          .set('Authorization', authHeader)
          .send(reorderData2),
      ]);

      // 両方成功するはず（異なるIssueを更新しているため）
      expect(response1.status).toBe('fulfilled');
      expect(response2.status).toBe('fulfilled');
    });
  });

  describe('Issue階層変更API (PATCH /issues/:id/hierarchy)', () => {
    it('should successfully change issue hierarchy and update WBS numbers', async () => {
      // 親子関係のテストデータ作成
      const parentIssue = await createTestIssue('Parent Issue', 10);
      const childIssue1 = await createTestIssue('Child Issue 1', 20, parentIssue.id);
      const childIssue2 = await createTestIssue('Child Issue 2', 30);

      // childIssue2 を parentIssue の子にする
      const hierarchyChangeData = {
        new_parent_id: parentIssue.id,
        version: childIssue2.version,
      };

      const response = await request(app.getHttpServer())
        .patch(`/issues/${childIssue2.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(200);

      expect(response.body.parent_id).toBe(parentIssue.id);
      expect(response.body.version).toBe(childIssue2.version + 1);

      // WBS番号が正しく更新されていることを確認
      const issuesWithWBS = await getIssuesAndCheckWBS();
      
      const updatedParent = issuesWithWBS.find(issue => issue.id === parentIssue.id);
      const updatedChild1 = issuesWithWBS.find(issue => issue.id === childIssue1.id);
      const updatedChild2 = issuesWithWBS.find(issue => issue.id === childIssue2.id);

      expect(updatedParent.wbs_number).toBe('1');
      // 子Issue2つのWBS番号は sort_order に基づいて決定される
      expect(updatedChild1.wbs_number).toBe('1.1'); // sort_order: 20
      expect(updatedChild2.wbs_number).toBe('1.2'); // sort_order: 30
    });

    it('should successfully remove parent (set to null)', async () => {
      // 親子関係のテストデータ作成
      const parentIssue = await createTestIssue('Parent Issue', 10);
      const childIssue = await createTestIssue('Child Issue', 20, parentIssue.id);

      // 親を削除（null に設定）
      const hierarchyChangeData = {
        new_parent_id: null,
        version: childIssue.version,
      };

      const response = await request(app.getHttpServer())
        .patch(`/issues/${childIssue.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(200);

      expect(response.body.parent_id).toBeNull();
      expect(response.body.version).toBe(childIssue.version + 1);

      // WBS番号が正しく更新されていることを確認
      const issuesWithWBS = await getIssuesAndCheckWBS();
      const updatedChild = issuesWithWBS.find(issue => issue.id === childIssue.id);

      expect(updatedChild.wbs_number).toBe('2'); // ルートレベルのIssueとして2番目
    });

    it('should prevent self-reference', async () => {
      const issue = await createTestIssue('Self Reference Test', 10);

      const hierarchyChangeData = {
        new_parent_id: issue.id, // 自分自身を親に設定
        version: issue.version,
      };

      await request(app.getHttpServer())
        .patch(`/issues/${issue.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(400);
    });

    it('should prevent circular reference', async () => {
      // 階層構造作成: A -> B -> C
      const issueA = await createTestIssue('Issue A', 10);
      const issueB = await createTestIssue('Issue B', 20, issueA.id);
      const issueC = await createTestIssue('Issue C', 30, issueB.id);

      // Issue A の親を Issue C にしようとする（循環参照）
      const hierarchyChangeData = {
        new_parent_id: issueC.id,
        version: issueA.version,
      };

      await request(app.getHttpServer())
        .patch(`/issues/${issueA.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(400);
    });

    it('should handle non-existent issue', async () => {
      const hierarchyChangeData = {
        new_parent_id: null,
        version: 1,
      };

      await request(app.getHttpServer())
        .patch('/issues/non-existent-issue/hierarchy')
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(404);
    });

    it('should handle non-existent parent issue', async () => {
      const issue = await createTestIssue('Test Issue', 10);

      const hierarchyChangeData = {
        new_parent_id: 'non-existent-parent',
        version: issue.version,
      };

      await request(app.getHttpServer())
        .patch(`/issues/${issue.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(400);
    });

    it('should handle optimistic locking conflicts', async () => {
      const issue = await createTestIssue('Test Issue', 10);

      const hierarchyChangeData = {
        new_parent_id: null,
        version: 999, // 存在しないversion
      };

      await request(app.getHttpServer())
        .patch(`/issues/${issue.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send(hierarchyChangeData)
        .expect(409);
    });
  });

  describe('WBS番号生成の統合テスト', () => {
    it('should maintain correct WBS numbers through complex operations', async () => {
      // 複雑な階層構造を作成
      const root1 = await createTestIssue('Root 1', 100);
      const root2 = await createTestIssue('Root 2', 200);
      const child1_1 = await createTestIssue('Child 1.1', 110, root1.id);
      const child1_2 = await createTestIssue('Child 1.2', 120, root1.id);
      const grandchild1_1_1 = await createTestIssue('Grandchild 1.1.1', 111, child1_1.id);

      // 初期状態のWBS番号確認
      let issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === root1.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === root2.id)?.wbs_number).toBe('2');
      expect(issuesWithWBS.find(i => i.id === child1_1.id)?.wbs_number).toBe('1.1');
      expect(issuesWithWBS.find(i => i.id === child1_2.id)?.wbs_number).toBe('1.2');
      expect(issuesWithWBS.find(i => i.id === grandchild1_1_1.id)?.wbs_number).toBe('1.1.1');

      // Root2 を Root1 の子にする
      await request(app.getHttpServer())
        .patch(`/issues/${root2.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send({
          new_parent_id: root1.id,
          version: root2.version,
        });

      // WBS番号が正しく更新されているか確認
      issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === root1.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === child1_1.id)?.wbs_number).toBe('1.1');
      expect(issuesWithWBS.find(i => i.id === child1_2.id)?.wbs_number).toBe('1.2');
      expect(issuesWithWBS.find(i => i.id === root2.id)?.wbs_number).toBe('1.3'); // 新しく Root1 の3番目の子になる
      expect(issuesWithWBS.find(i => i.id === grandchild1_1_1.id)?.wbs_number).toBe('1.1.1');
    });

    it('should handle WBS numbers correctly with sort_order changes', async () => {
      // 3つのルートレベルIssue作成
      const issue1 = await createTestIssue('Issue 1', 30);
      const issue2 = await createTestIssue('Issue 2', 10);
      const issue3 = await createTestIssue('Issue 3', 20);

      // 初期状態確認（sort_order順）
      let issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === issue2.id)?.wbs_number).toBe('1'); // sort_order: 10
      expect(issuesWithWBS.find(i => i.id === issue3.id)?.wbs_number).toBe('2'); // sort_order: 20
      expect(issuesWithWBS.find(i => i.id === issue1.id)?.wbs_number).toBe('3'); // sort_order: 30

      // 並び替え実行（issue1を最初に）
      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send({
          issues: [
            { id: issue1.id, sort_order: 5, version: issue1.version },
          ],
        });

      // WBS番号が正しく更新されているか確認
      issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === issue1.id)?.wbs_number).toBe('1'); // sort_order: 5
      expect(issuesWithWBS.find(i => i.id === issue2.id)?.wbs_number).toBe('2'); // sort_order: 10
      expect(issuesWithWBS.find(i => i.id === issue3.id)?.wbs_number).toBe('3'); // sort_order: 20
    });
  });

  describe('境界値・大量データテスト', () => {
    it('should handle maximum hierarchy depth', async () => {
      // 深い階層構造（5レベル）を作成
      let parentIssue = await createTestIssue('Level 1', 10);
      
      for (let level = 2; level <= 5; level++) {
        const childIssue = await createTestIssue(`Level ${level}`, level * 10, parentIssue.id);
        parentIssue = childIssue;
      }

      const issuesWithWBS = await getIssuesAndCheckWBS();
      const deepestChild = issuesWithWBS.find(issue => issue.title === 'Level 5');
      
      expect(deepestChild.wbs_number).toBe('1.1.1.1.1');
      expect(deepestChild.wbs_level).toBe(5);
    });

    it('should handle many siblings correctly', async () => {
      // 10個の兄弟Issueを作成
      const siblings = [];
      for (let i = 1; i <= 10; i++) {
        const sibling = await createTestIssue(`Sibling ${i}`, i * 10);
        siblings.push(sibling);
      }

      const issuesWithWBS = await getIssuesAndCheckWBS();
      
      // 各兄弟が正しいWBS番号を持つことを確認
      for (let i = 0; i < 10; i++) {
        const sibling = issuesWithWBS.find(issue => issue.id === siblings[i].id);
        expect(sibling.wbs_number).toBe(`${i + 1}`);
        expect(sibling.wbs_level).toBe(1);
      }
    });

    it('should handle batch reorder of many issues', async () => {
      // 20個のIssueを作成
      const issues = [];
      for (let i = 1; i <= 20; i++) {
        const issue = await createTestIssue(`Batch Issue ${i}`, i * 10);
        issues.push(issue);
      }

      // 全Issueを逆順に並び替え
      const reorderData = {
        issues: issues.reverse().map((issue, index) => ({
          id: issue.id,
          sort_order: (index + 1) * 5,
          version: issue.version,
        })),
      };

      const response = await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send(reorderData)
        .expect(200);

      expect(response.body).toHaveLength(20);

      // WBS番号が正しく更新されているか確認
      const issuesWithWBS = await getIssuesAndCheckWBS();
      const sortedIssues = issuesWithWBS.sort((a, b) => a.sort_order - b.sort_order);

      for (let i = 0; i < 20; i++) {
        expect(sortedIssues[i].wbs_number).toBe(`${i + 1}`);
      }
    });
  });

  describe('統合シナリオテスト', () => {
    it('should handle complete project workflow: create -> reorder -> hierarchy -> reorder', async () => {
      // 1. 初期プロジェクト構造作成
      const projectA = await createTestIssue('Project A', 100);
      const projectB = await createTestIssue('Project B', 200);
      const taskA1 = await createTestIssue('Task A1', 110, projectA.id);
      const taskA2 = await createTestIssue('Task A2', 120, projectA.id);

      // 2. WBS確認
      let issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === projectA.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === projectB.id)?.wbs_number).toBe('2');
      expect(issuesWithWBS.find(i => i.id === taskA1.id)?.wbs_number).toBe('1.1');
      expect(issuesWithWBS.find(i => i.id === taskA2.id)?.wbs_number).toBe('1.2');

      // 3. プロジェクトの順序変更
      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send({
          issues: [
            { id: projectB.id, sort_order: 50, version: projectB.version },
          ],
        });

      // 4. WBS確認（Project B が最初に）
      issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === projectB.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === projectA.id)?.wbs_number).toBe('2');
      expect(issuesWithWBS.find(i => i.id === taskA1.id)?.wbs_number).toBe('2.1');
      expect(issuesWithWBS.find(i => i.id === taskA2.id)?.wbs_number).toBe('2.2');

      // 5. TaskA2をProject Bの子にする
      await request(app.getHttpServer())
        .patch(`/issues/${taskA2.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send({
          new_parent_id: projectB.id,
          version: taskA2.version + 1, // 並び替えでversionが更新されている
        });

      // 6. 最終WBS確認
      issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === projectB.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === taskA2.id)?.wbs_number).toBe('1.1'); // Project B の最初の子
      expect(issuesWithWBS.find(i => i.id === projectA.id)?.wbs_number).toBe('2');
      expect(issuesWithWBS.find(i => i.id === taskA1.id)?.wbs_number).toBe('2.1'); // Project A の唯一の子

      // 7. すべての操作が正常に完了したことを確認
      expect(issuesWithWBS).toHaveLength(4);
      expect(issuesWithWBS.filter(i => i.wbs_level === 1)).toHaveLength(2); // ルートレベル2つ
      expect(issuesWithWBS.filter(i => i.wbs_level === 2)).toHaveLength(2); // 子レベル2つ
    });
  });

  describe('エラー処理・リカバリテスト', () => {
    it('should maintain data consistency after failed operations', async () => {
      const issue1 = await createTestIssue('Issue 1', 10);
      const issue2 = await createTestIssue('Issue 2', 20);

      // 初期WBS確認
      let issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === issue1.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === issue2.id)?.wbs_number).toBe('2');

      // 失敗する並び替え操作（存在しないIssue ID）
      await request(app.getHttpServer())
        .post('/issues/reorder')
        .set('Authorization', authHeader)
        .send({
          issues: [
            { id: issue1.id, sort_order: 30, version: issue1.version },
            { id: 'non-existent', sort_order: 40, version: 1 },
          ],
        })
        .expect(404);

      // データの一貫性確認（WBS番号が変更されていない）
      issuesWithWBS = await getIssuesAndCheckWBS();
      expect(issuesWithWBS.find(i => i.id === issue1.id)?.wbs_number).toBe('1');
      expect(issuesWithWBS.find(i => i.id === issue2.id)?.wbs_number).toBe('2');
      expect(issuesWithWBS.find(i => i.id === issue1.id)?.version).toBe(issue1.version); // version変更されていない
    });

    it('should handle database transaction rollback correctly', async () => {
      const issue = await createTestIssue('Test Issue', 10);

      // 存在しない親への階層変更（トランザクションが失敗するはず）
      await request(app.getHttpServer())
        .patch(`/issues/${issue.id}/hierarchy`)
        .set('Authorization', authHeader)
        .send({
          new_parent_id: 'non-existent-parent',
          version: issue.version,
        })
        .expect(400);

      // Issue が変更されていないことを確認
      const unchangedIssue = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${issue.id}`)
        .set('Authorization', authHeader);

      expect(unchangedIssue.body.parent_id).toBeNull();
      expect(unchangedIssue.body.version).toBe(issue.version);
    });
  });
});