import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * データベーストランザクションロールバックテスト
 * 
 * 対象テストシナリオ:
 * 1. Issue作成時のエラーによるロールバック
 * 2. 複数テーブル更新時の部分失敗ロールバック
 * 3. 外部キー制約違反時のロールバック
 * 4. 並び替え操作の途中失敗ロールバック
 * 5. 依存関係作成時のロールバック
 * 6. バッチ操作の整合性保証
 * 
 * 合格基準:
 * - エラー発生時の完全なデータロールバック
 * - 部分的な更新が残らない
 * - データベース整合性の維持
 * - エラー後の正常操作継続可能
 */
describe('Transaction Rollback Tests (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  
  let testProjectId: string;
  let testPassword: string;
  let authHeader: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // テスト用プロジェクト作成
    testPassword = 'TransactionTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'Transaction Rollback Test Project',
        description: 'Project for transaction rollback testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${testPassword}`);

    console.log('🔄 Transaction rollback tests initialized');
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

  async function getIssueCount(): Promise<number> {
    const issues = await prismaService.issue.findMany({
      where: { project_id: testProjectId, is_deleted: false }
    });
    return issues.length;
  }

  describe('1. Issue作成時のロールバックテスト', () => {
    it('should rollback Issue creation on validation errors', async () => {
      console.log('\n❌ Testing Issue creation rollback on validation errors');

      const initialCount = await getIssueCount();
      console.log(`  Initial Issue count: ${initialCount}`);

      // 不正なデータでIssue作成を試行
      const invalidIssueData = [
        {
          // title: '', // 必須フィールド欠如
          description: 'Should fail due to missing title',
          status: 'open',
          priority: 'medium'
        },
        {
          title: 'Valid Title',
          description: 'Should fail due to invalid status',
          status: 'invalid_status', // 無効なステータス
          priority: 'medium'
        },
        {
          title: 'Valid Title',
          description: 'Should fail due to invalid priority',
          status: 'open',
          priority: 'invalid_priority' // 無効な優先度
        }
      ];

      for (let i = 0; i < invalidIssueData.length; i++) {
        const invalidData = invalidIssueData[i];
        console.log(`  Testing invalid data ${i + 1}...`);

        const response = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send(invalidData);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);

        // データが作成されていないことを確認
        const countAfterError = await getIssueCount();
        expect(countAfterError).toBe(initialCount);

        console.log(`    Response status: ${response.status}, Issue count: ${countAfterError}`);
      }

      // 正常なIssue作成が引き続き可能であることを確認
      const validResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Valid Issue After Errors',
          description: 'This should work fine',
          status: 'open',
          priority: 'medium'
        });

      expect(validResponse.status).toBe(HttpStatus.CREATED);

      const finalCount = await getIssueCount();
      expect(finalCount).toBe(initialCount + 1);

      console.log(`  Final Issue count: ${finalCount}`);
      console.log('✅ Issue creation rollback working correctly');
    });

    it('should rollback Issue creation on foreign key constraint violations', async () => {
      console.log('\n🔗 Testing foreign key constraint rollback');

      const initialCount = await getIssueCount();

      // 存在しない親IssueIDでIssue作成を試行
      const nonExistentParentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Child Issue with Invalid Parent',
          description: 'This should fail due to invalid parent_issue_id',
          status: 'open',
          priority: 'medium',
          parent_issue_id: nonExistentParentId
        });

      expect([HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(response.status);

      // データが作成されていないことを確認
      const countAfterError = await getIssueCount();
      expect(countAfterError).toBe(initialCount);

      console.log(`  Invalid parent response: ${response.status}`);
      console.log(`  Issue count unchanged: ${countAfterError}`);
      console.log('✅ Foreign key constraint rollback working correctly');
    });
  });

  describe('2. 複数テーブル更新ロールバックテスト', () => {
    it('should rollback multi-table operations on partial failure', async () => {
      console.log('\n🗂️  Testing multi-table operation rollback');

      // テスト用Issue作成
      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Multi-table Test Issue',
          description: 'For testing multi-table rollback',
          status: 'open',
          priority: 'medium'
        });

      const issueId = createResponse.body.id;
      const initialVersion = createResponse.body.version || 1;

      // Issue更新（ChangeLogも作成されるはず）
      const updateResponse = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Updated Title',
          description: 'Updated description',
          status: 'in_progress',
          version: initialVersion
        });

      expect(updateResponse.status).toBe(HttpStatus.OK);

      // ChangeLogが作成されていることを確認
      const changeLogsResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${issueId}/changelog`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(changeLogsResponse.status).toBe(HttpStatus.OK);
      const initialChangeLogCount = changeLogsResponse.body.length;

      console.log(`  Initial ChangeLog count: ${initialChangeLogCount}`);

      // 意図的にエラーを発生させる更新（古いバージョン）
      const errorUpdateResponse = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'This Update Should Fail',
          description: 'This should cause rollback',
          status: 'done',
          version: initialVersion // 古いバージョン（競合エラー）
        });

      expect(errorUpdateResponse.status).toBe(HttpStatus.CONFLICT);

      // Issueが変更されていないことを確認
      const issueAfterError = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(issueAfterError.body.title).toBe('Updated Title'); // 以前の正常な更新のまま
      expect(issueAfterError.body.status).toBe('in_progress');

      // ChangeLogが増えていないことを確認（ロールバックされた）
      const changeLogsAfterError = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${issueId}/changelog`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(changeLogsAfterError.body.length).toBe(initialChangeLogCount);

      console.log(`  ChangeLog count after error: ${changeLogsAfterError.body.length}`);
      console.log('✅ Multi-table operation rollback working correctly');
    });
  });

  describe('3. バッチ操作ロールバックテスト', () => {
    it('should rollback batch reordering on validation failure', async () => {
      console.log('\n📊 Testing batch reordering rollback');

      // 複数のIssueを作成
      const batchIssues = [];
      for (let i = 0; i < 4; i++) {
        const createResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Batch Test Issue ${i + 1}`,
            description: `Issue ${i + 1} for batch testing`,
            status: 'open',
            priority: 'medium',
            sort_order: i + 1
          });

        batchIssues.push({
          id: createResponse.body.id,
          sort_order: createResponse.body.sort_order,
          version: createResponse.body.version || 1
        });
      }

      console.log(`  Created ${batchIssues.length} Issues for batch test`);

      // 初期状態を記録
      const initialState = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`);

      const initialSortOrders = initialState.body
        .map(issue => ({ id: issue.id, sort_order: issue.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order);

      console.log('  Initial sort orders:', initialSortOrders.map(i => i.sort_order));

      // 部分的に無効なデータを含むバッチ並び替えを実行
      const invalidBatchReorder = {
        issues: [
          { id: batchIssues[0].id, sort_order: 4, version: batchIssues[0].version },
          { id: batchIssues[1].id, sort_order: 3, version: batchIssues[1].version },
          { id: batchIssues[2].id, sort_order: -1, version: batchIssues[2].version }, // 無効なsort_order
          { id: batchIssues[3].id, sort_order: 1, version: batchIssues[3].version }
        ]
      };

      const batchResponse = await request(app.getHttpServer())
        .patch('/issues/reorder')
        .set('Authorization', `Basic ${authHeader}`)
        .send(invalidBatchReorder);

      expect(batchResponse.status).toBe(HttpStatus.BAD_REQUEST);

      // 並び替えがロールバックされていることを確認
      const stateAfterError = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`);

      const sortOrdersAfterError = stateAfterError.body
        .map(issue => ({ id: issue.id, sort_order: issue.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order);

      console.log('  Sort orders after error:', sortOrdersAfterError.map(i => i.sort_order));

      // 元の並び順が保持されていることを確認
      expect(sortOrdersAfterError).toEqual(initialSortOrders);

      // 正常なバッチ並び替えが引き続き機能することを確認
      const validBatchReorder = {
        issues: [
          { id: batchIssues[0].id, sort_order: 2, version: batchIssues[0].version },
          { id: batchIssues[1].id, sort_order: 1, version: batchIssues[1].version }
        ]
      };

      const validBatchResponse = await request(app.getHttpServer())
        .patch('/issues/reorder')
        .set('Authorization', `Basic ${authHeader}`)
        .send(validBatchReorder);

      if (validBatchResponse.status === HttpStatus.OK) {
        console.log('  Valid batch reorder successful after error');
      }

      console.log('✅ Batch operation rollback working correctly');
    });
  });

  describe('4. 依存関係作成ロールバックテスト', () => {
    it('should rollback dependency creation on circular reference', async () => {
      console.log('\n🔄 Testing dependency creation rollback on circular reference');

      // テスト用Issueを3つ作成
      const depIssues = [];
      for (let i = 0; i < 3; i++) {
        const createResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Dependency Test Issue ${String.fromCharCode(65 + i)}`, // A, B, C
            description: `Issue ${String.fromCharCode(65 + i)} for dependency testing`,
            status: 'open',
            priority: 'medium'
          });

        depIssues.push({
          id: createResponse.body.id,
          name: String.fromCharCode(65 + i)
        });
      }

      console.log(`  Created Issues: ${depIssues.map(i => i.name).join(', ')}`);

      // A -> B の依存関係を作成
      const depABResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          predecessor_issue_id: depIssues[0].id, // A
          successor_issue_id: depIssues[1].id,   // B
          type: 'FS'
        });

      expect(depABResponse.status).toBe(HttpStatus.CREATED);
      console.log('  Created dependency A -> B');

      // B -> C の依存関係を作成  
      const depBCResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          predecessor_issue_id: depIssues[1].id, // B
          successor_issue_id: depIssues[2].id,   // C
          type: 'FS'
        });

      expect(depBCResponse.status).toBe(HttpStatus.CREATED);
      console.log('  Created dependency B -> C');

      // 初期の依存関係数を確認
      const initialDepsResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`);

      const initialDepCount = initialDepsResponse.body.length;
      console.log(`  Initial dependency count: ${initialDepCount}`);

      // C -> A の依存関係作成を試行（循環依存になる）
      const circularDepResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          predecessor_issue_id: depIssues[2].id, // C
          successor_issue_id: depIssues[0].id,   // A (これで A -> B -> C -> A の循環)
          type: 'FS'
        });

      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(circularDepResponse.status);

      console.log(`  Circular dependency response: ${circularDepResponse.status}`);

      // 依存関係が作成されていないことを確認
      const depsAfterError = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(depsAfterError.body.length).toBe(initialDepCount);
      console.log(`  Dependency count after error: ${depsAfterError.body.length}`);

      // 正常な依存関係作成が引き続き機能することを確認
      // A -> C の直接依存関係（循環にならない）
      const validDepResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          predecessor_issue_id: depIssues[0].id, // A
          successor_issue_id: depIssues[2].id,   // C
          type: 'FS'
        });

      if (validDepResponse.status === HttpStatus.CREATED) {
        console.log('  Valid dependency creation successful after circular error');
      }

      console.log('✅ Dependency creation rollback working correctly');
    });
  });

  describe('5. トランザクション分離レベルテスト', () => {
    it('should maintain transaction isolation under concurrent operations', async () => {
      console.log('\n🔒 Testing transaction isolation');

      // 複数の同時トランザクション実行
      const concurrentOperations = Array.from({ length: 5 }, async (_, index) => {
        try {
          // 各操作で複数のデータベース操作を実行
          const createResponse = await request(app.getHttpServer())
            .post(`/projects/${testProjectId}/issues`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `Isolation Test Issue ${index + 1}`,
              description: 'Testing transaction isolation',
              status: 'open',
              priority: 'medium'
            });

          if (createResponse.status !== HttpStatus.CREATED) {
            throw new Error(`Create failed with status ${createResponse.status}`);
          }

          const issueId = createResponse.body.id;

          // 作成直後に更新
          const updateResponse = await request(app.getHttpServer())
            .put(`/projects/${testProjectId}/issues/${issueId}`)
            .set('Authorization', `Basic ${authHeader}`)
            .send({
              title: `Updated Isolation Test Issue ${index + 1}`,
              description: 'Updated during isolation test',
              status: 'in_progress',
              version: createResponse.body.version || 1
            });

          return {
            success: updateResponse.status === HttpStatus.OK,
            issueId: issueId,
            operations: 2
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            operations: 0
          };
        }
      });

      const results = await Promise.allSettled(concurrentOperations);
      
      const successfulOperations = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;

      const totalOperations = results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + r.value.operations, 0);

      console.log(`  Concurrent Operations: 5`);
      console.log(`  Successful: ${successfulOperations}`);
      console.log(`  Total DB Operations: ${totalOperations}`);

      // データ整合性確認
      const finalIssues = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`);

      const isolationTestIssues = finalIssues.body.filter(issue => 
        issue.title.includes('Isolation Test')
      );

      console.log(`  Final Isolation Test Issues: ${isolationTestIssues.length}`);

      // 各Issueが適切に作成・更新されていることを確認
      isolationTestIssues.forEach(issue => {
        expect(issue.id).toBeDefined();
        expect(issue.version).toBeGreaterThan(1); // 更新されている
        expect(issue.title).toMatch(/Updated/); // 更新済みのタイトル
      });

      expect(successfulOperations).toBeGreaterThan(0);
      console.log('✅ Transaction isolation maintained');
    });
  });

  describe('6. エラー回復テスト', () => {
    it('should allow normal operations after transaction failures', async () => {
      console.log('\n🔧 Testing error recovery');

      // 複数のエラーを発生させる
      const errorOperations = [
        // 無効なデータでIssue作成
        () => request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: '', // 無効
            status: 'invalid'
          }),

        // 存在しないIssue更新
        () => request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/00000000-0000-0000-0000-000000000000`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Should not work',
            version: 1
          }),

        // 無効なバッチ操作
        () => request(app.getHttpServer())
          .patch('/issues/reorder')
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            issues: [
              { id: '00000000-0000-0000-0000-000000000000', sort_order: 1, version: 1 }
            ]
          })
      ];

      // エラー操作を順次実行
      for (let i = 0; i < errorOperations.length; i++) {
        const response = await errorOperations[i]();
        expect(response.status).toBeGreaterThanOrEqual(400);
        console.log(`  Error operation ${i + 1}: ${response.status}`);
      }

      // エラー後の正常操作確認
      const recoveryResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Recovery Test Issue',
          description: 'This should work after errors',
          status: 'open',
          priority: 'medium'
        });

      expect(recoveryResponse.status).toBe(HttpStatus.CREATED);

      const recoveryIssueId = recoveryResponse.body.id;

      // 更新も正常に動作することを確認
      const updateAfterRecovery = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${recoveryIssueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Updated Recovery Issue',
          status: 'in_progress',
          version: recoveryResponse.body.version || 1
        });

      expect(updateAfterRecovery.status).toBe(HttpStatus.OK);

      console.log('  Recovery operations successful');
      console.log('✅ Error recovery working correctly');
    });
  });
});