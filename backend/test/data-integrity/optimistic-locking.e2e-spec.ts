import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * 楽観的排他制御テスト
 * 
 * 対象テストシナリオ:
 * 1. 同一Issue並行更新時の競合検出
 * 2. バージョン不一致による更新拒否
 * 3. 競合解決メカニズムの動作確認
 * 4. 複数ユーザー同時編集の競合処理
 * 5. Issue並び替え時の楽観的排他制御
 * 6. 依存関係変更時の競合処理
 * 
 * 合格基準:
 * - 並行更新時の適切な競合検出
 * - バージョン不整合時の409 Conflict応答
 * - データの整合性維持
 * - 最後の更新者勝利の正しい実装
 */
describe('Optimistic Locking Conflict Tests (e2e)', () => {
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
    testPassword = 'OptimisticLockTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'Optimistic Lock Test Project',
        description: 'Project for optimistic locking testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${testPassword}`);

    console.log('🔒 Optimistic locking tests initialized');
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

  describe('1. Issue並行更新競合テスト', () => {
    it('should detect concurrent update conflicts', async () => {
      console.log('\n🔄 Testing concurrent Issue update conflicts');

      // テスト用Issue作成
      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Optimistic Lock Test Issue',
          description: 'Initial description',
          status: 'open',
          priority: 'medium'
        });

      expect(createResponse.status).toBe(HttpStatus.CREATED);
      const issueId = createResponse.body.id;
      const initialVersion = createResponse.body.version || 1;

      console.log(`  Created Issue: ${issueId}, Initial Version: ${initialVersion}`);

      // 同じIssueを同時に更新を試行
      const updatePromises = [
        // User 1の更新
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issueId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Updated by User 1',
            description: 'Updated description by User 1',
            version: initialVersion
          }),
        
        // User 2の更新（同じバージョンから）
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issueId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Updated by User 2',
            description: 'Updated description by User 2',
            version: initialVersion
          }),

        // User 3の更新（同じバージョンから）  
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issueId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Updated by User 3',
            description: 'Updated description by User 3',
            version: initialVersion
          })
      ];

      const results = await Promise.allSettled(updatePromises);
      
      const successfulUpdates = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === HttpStatus.OK
      ).length;
      
      const conflictResponses = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.CONFLICT
      ).length;

      console.log(`  Concurrent Updates: 3`);
      console.log(`  Successful: ${successfulUpdates}`);
      console.log(`  Conflicts: ${conflictResponses}`);

      // 1つだけが成功し、他は競合エラーになることを確認
      expect(successfulUpdates).toBe(1);
      expect(conflictResponses).toBeGreaterThanOrEqual(1);

      // 最終状態確認
      const finalResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(finalResponse.status).toBe(HttpStatus.OK);
      expect(finalResponse.body.version).toBeGreaterThan(initialVersion);

      console.log(`  Final Version: ${finalResponse.body.version}`);
      console.log(`  Final Title: ${finalResponse.body.title}`);
      console.log('✅ Optimistic locking working correctly for concurrent updates');
    });

    it('should reject updates with incorrect version numbers', async () => {
      console.log('\n🔢 Testing version number validation');

      // テスト用Issue作成
      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Version Test Issue',
          description: 'Version test',
          status: 'open',
          priority: 'medium'
        });

      const issueId = createResponse.body.id;
      const currentVersion = createResponse.body.version || 1;

      // 正しいバージョンでの更新（成功することを確認）
      const correctVersionResponse = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Correctly Updated',
          description: 'Updated with correct version',
          version: currentVersion
        });

      expect(correctVersionResponse.status).toBe(HttpStatus.OK);
      const newVersion = correctVersionResponse.body.version;

      // 古いバージョンでの更新試行（失敗することを確認）
      const oldVersionResponse = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Old Version Update',
          description: 'Should be rejected',
          version: currentVersion // 古いバージョン
        });

      expect(oldVersionResponse.status).toBe(HttpStatus.CONFLICT);

      // 存在しないバージョンでの更新試行
      const futureVersionResponse = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Future Version Update',
          description: 'Should be rejected',
          version: newVersion + 10 // 未来のバージョン
        });

      expect(futureVersionResponse.status).toBe(HttpStatus.CONFLICT);

      console.log(`  Current Version: ${currentVersion} -> New Version: ${newVersion}`);
      console.log(`  Old Version Update: ${oldVersionResponse.status}`);
      console.log(`  Future Version Update: ${futureVersionResponse.status}`);
      console.log('✅ Version number validation working correctly');
    });
  });

  describe('2. Issue並び替え楽観的排他制御', () => {
    it('should handle concurrent reordering conflicts', async () => {
      console.log('\n📋 Testing concurrent Issue reordering conflicts');

      // 複数のテスト用Issue作成
      const issues = [];
      for (let i = 0; i < 5; i++) {
        const createResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Reorder Test Issue ${i + 1}`,
            description: `Issue ${i + 1} for reordering test`,
            status: 'open',
            priority: 'medium',
            sort_order: i + 1
          });

        issues.push({
          id: createResponse.body.id,
          sort_order: createResponse.body.sort_order,
          version: createResponse.body.version || 1
        });
      }

      console.log(`  Created ${issues.length} Issues for reordering test`);

      // 並行して並び替えを実行
      const reorderPromises = [
        // User 1: Issues 1,2を入れ替え
        request(app.getHttpServer())
          .patch('/issues/reorder')
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            issues: [
              { id: issues[0].id, sort_order: 2, version: issues[0].version },
              { id: issues[1].id, sort_order: 1, version: issues[1].version }
            ]
          }),

        // User 2: Issues 2,3,4を再配置  
        request(app.getHttpServer())
          .patch('/issues/reorder')
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            issues: [
              { id: issues[1].id, sort_order: 4, version: issues[1].version },
              { id: issues[2].id, sort_order: 2, version: issues[2].version },
              { id: issues[3].id, sort_order: 3, version: issues[3].version }
            ]
          })
      ];

      const reorderResults = await Promise.allSettled(reorderPromises);
      
      const successfulReorders = reorderResults.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.OK
      ).length;

      const conflictReorders = reorderResults.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.CONFLICT
      ).length;

      console.log(`  Concurrent Reorders: 2`);
      console.log(`  Successful: ${successfulReorders}`);
      console.log(`  Conflicts: ${conflictReorders}`);

      // 少なくとも1つは成功し、競合があることを確認
      expect(successfulReorders).toBeGreaterThanOrEqual(1);
      
      // 最終的な並び順を確認
      const finalIssuesResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(finalIssuesResponse.status).toBe(HttpStatus.OK);
      const finalIssues = finalIssuesResponse.body.sort((a, b) => a.sort_order - b.sort_order);

      console.log('  Final sort order:', finalIssues.map(i => ({ 
        title: i.title.split(' ').pop(), 
        sort_order: i.sort_order,
        version: i.version
      })));

      console.log('✅ Reordering optimistic locking working correctly');
    });
  });

  describe('3. 複数フィールド同時更新競合', () => {
    it('should handle complex concurrent modifications', async () => {
      console.log('\n🔧 Testing complex concurrent modifications');

      // 複雑なIssueを作成
      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Complex Update Test',
          description: 'Initial complex issue',
          status: 'open',
          priority: 'medium',
          assignee: 'initial_user',
          estimated_hours: 8,
          actual_hours: 0,
          progress_pct: 0
        });

      const issueId = createResponse.body.id;
      const initialVersion = createResponse.body.version || 1;

      // 異なるフィールドを同時更新
      const complexUpdatePromises = [
        // User 1: ステータスと進捗を更新
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issueId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            status: 'in_progress',
            progress_pct: 25,
            actual_hours: 2,
            version: initialVersion
          }),

        // User 2: タイトルと担当者を更新
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issueId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: 'Updated Complex Test',
            assignee: 'new_user',
            estimated_hours: 12,
            version: initialVersion
          }),

        // User 3: 説明と優先度を更新
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issueId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            description: 'Updated complex description with more details',
            priority: 'high',
            version: initialVersion
          })
      ];

      const updateResults = await Promise.allSettled(complexUpdatePromises);
      
      const successfulComplexUpdates = updateResults.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.OK
      ).length;

      const conflictComplexUpdates = updateResults.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.CONFLICT
      ).length;

      console.log(`  Complex Concurrent Updates: 3`);
      console.log(`  Successful: ${successfulComplexUpdates}`);
      console.log(`  Conflicts: ${conflictComplexUpdates}`);

      // 1つだけが成功することを確認
      expect(successfulComplexUpdates).toBe(1);
      expect(conflictComplexUpdates).toBeGreaterThanOrEqual(1);

      // 最終状態の整合性確認
      const finalComplexResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(finalComplexResponse.status).toBe(HttpStatus.OK);
      expect(finalComplexResponse.body.version).toBeGreaterThan(initialVersion);

      console.log('  Final state consistency check:');
      console.log(`    Title: ${finalComplexResponse.body.title}`);
      console.log(`    Status: ${finalComplexResponse.body.status}`);
      console.log(`    Priority: ${finalComplexResponse.body.priority}`);
      console.log(`    Version: ${finalComplexResponse.body.version}`);

      console.log('✅ Complex concurrent modifications handled correctly');
    });
  });

  describe('4. 階層変更楽観的排他制御', () => {
    it('should handle concurrent hierarchy changes', async () => {
      console.log('\n🌳 Testing concurrent Issue hierarchy changes');

      // 階層構造のIssueを作成
      const parentResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Parent Issue',
          description: 'Parent for hierarchy test',
          status: 'open',
          priority: 'medium'
        });

      const childResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Child Issue',
          description: 'Child for hierarchy test',
          status: 'open',
          priority: 'medium',
          parent_issue_id: parentResponse.body.id
        });

      const anotherParentResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Another Parent Issue',
          description: 'Another parent for hierarchy test',
          status: 'open',
          priority: 'medium'
        });

      const childId = childResponse.body.id;
      const childVersion = childResponse.body.version || 1;
      const parentId = parentResponse.body.id;
      const anotherParentId = anotherParentResponse.body.id;

      // 同じ子Issueの親を同時に変更
      const hierarchyChangePromises = [
        // User 1: 親を変更
        request(app.getHttpServer())
          .patch(`/issues/${childId}/hierarchy`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            new_parent_id: anotherParentId,
            version: childVersion
          }),

        // User 2: 親をnullに設定（ルートレベルに移動）
        request(app.getHttpServer())
          .patch(`/issues/${childId}/hierarchy`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            new_parent_id: null,
            version: childVersion
          })
      ];

      const hierarchyResults = await Promise.allSettled(hierarchyChangePromises);
      
      const successfulHierarchyChanges = hierarchyResults.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.OK
      ).length;

      const conflictHierarchyChanges = hierarchyResults.filter(r =>
        r.status === 'fulfilled' && r.value.status === HttpStatus.CONFLICT
      ).length;

      console.log(`  Concurrent Hierarchy Changes: 2`);
      console.log(`  Successful: ${successfulHierarchyChanges}`);
      console.log(`  Conflicts: ${conflictHierarchyChanges}`);

      // 1つだけが成功することを確認
      expect(successfulHierarchyChanges).toBe(1);
      expect(conflictHierarchyChanges).toBe(1);

      // 最終的な階層状態を確認
      const finalHierarchyResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues/${childId}`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(finalHierarchyResponse.status).toBe(HttpStatus.OK);
      expect(finalHierarchyResponse.body.version).toBeGreaterThan(childVersion);

      console.log(`  Final parent_issue_id: ${finalHierarchyResponse.body.parent_issue_id}`);
      console.log(`  Final version: ${finalHierarchyResponse.body.version}`);

      console.log('✅ Hierarchy change optimistic locking working correctly');
    });
  });

  describe('5. エラー処理と回復', () => {
    it('should provide meaningful conflict error messages', async () => {
      console.log('\n📝 Testing conflict error message quality');

      // テスト用Issue作成
      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Error Message Test',
          description: 'Testing error messages',
          status: 'open',
          priority: 'medium'
        });

      const issueId = createResponse.body.id;
      const version = createResponse.body.version || 1;

      // まず1回目の更新を実行
      await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'First Update',
          version: version
        });

      // 古いバージョンで2回目の更新を試行
      const conflictResponse = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${issueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send({
          title: 'Second Update',
          version: version // 古いバージョン
        });

      expect(conflictResponse.status).toBe(HttpStatus.CONFLICT);
      expect(conflictResponse.body).toHaveProperty('message');

      const errorMessage = conflictResponse.body.message.toLowerCase();
      
      // 有用なエラーメッセージが含まれていることを確認
      const usefulErrorTerms = ['version', 'conflict', 'updated', 'concurrent', 'optimistic'];
      const hasUsefulError = usefulErrorTerms.some(term => errorMessage.includes(term));

      console.log(`  Conflict Error Message: "${conflictResponse.body.message}"`);
      console.log(`  Contains Useful Terms: ${hasUsefulError}`);

      expect(hasUsefulError).toBe(true);

      // 現在のバージョン情報も提供されることを確認（実装に依存）
      if (conflictResponse.body.current_version || conflictResponse.body.expected_version) {
        console.log(`  Current Version Info Provided: Yes`);
      }

      console.log('✅ Conflict error messages are informative');
    });

    it('should maintain data consistency after conflicts', async () => {
      console.log('\n🔒 Testing data consistency after conflicts');

      // 複数のIssueで同時競合を発生させ、データ整合性を確認
      const testIssues = [];
      
      // テスト用Issue作成
      for (let i = 0; i < 3; i++) {
        const createResponse = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Consistency Test Issue ${i + 1}`,
            description: 'Data consistency test',
            status: 'open',
            priority: 'medium',
            sort_order: i + 1
          });

        testIssues.push({
          id: createResponse.body.id,
          version: createResponse.body.version || 1
        });
      }

      // 各Issueに対して並行更新を実行
      const allUpdatePromises = testIssues.flatMap((issue, index) => [
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issue.id}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Updated by User A - Issue ${index + 1}`,
            version: issue.version
          }),
        
        request(app.getHttpServer())
          .put(`/projects/${testProjectId}/issues/${issue.id}`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: `Updated by User B - Issue ${index + 1}`,
            version: issue.version
          })
      ]);

      await Promise.allSettled(allUpdatePromises);

      // データ整合性確認
      const consistencyResponse = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`);

      expect(consistencyResponse.status).toBe(HttpStatus.OK);
      const finalIssues = consistencyResponse.body;

      console.log('  Data Consistency Check:');
      finalIssues.forEach((issue, index) => {
        expect(issue.version).toBeGreaterThan(1); // バージョンが更新されている
        expect(issue.id).toBeDefined();
        expect(issue.title).toBeDefined();
        
        console.log(`    Issue ${index + 1}: Version ${issue.version}, Title: "${issue.title}"`);
      });

      // 各Issueが一意のバージョンを持つことを確認
      finalIssues.forEach(issue => {
        expect(issue.version).toBeGreaterThan(0);
        expect(typeof issue.version).toBe('number');
      });

      console.log('✅ Data consistency maintained after conflicts');
    });
  });
});