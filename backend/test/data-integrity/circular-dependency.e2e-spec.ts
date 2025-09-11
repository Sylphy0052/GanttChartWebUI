import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * 循環依存関係検出テスト
 * 
 * 対象テストシナリオ:
 * 1. 直接循環依存の検出（A -> B -> A）
 * 2. 間接循環依存の検出（A -> B -> C -> A）
 * 3. 複雑な循環依存の検出（多段階）
 * 4. セルフ依存関係の防止（A -> A）
 * 5. 大規模な依存関係グラフでの循環検出
 * 6. 依存関係削除後の循環解消確認
 * 
 * 合格基準:
 * - すべての循環依存が検出される
 * - 循環依存作成時の適切なエラー応答
 * - 既存の正常な依存関係が影響を受けない
 * - パフォーマンスが許容範囲内
 */
describe('Circular Dependency Detection Tests (e2e)', () => {
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
    testPassword = 'CircularDepTestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'Circular Dependency Test Project',
        description: 'Project for circular dependency testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${testPassword}`);

    console.log('🔄 Circular dependency detection tests initialized');
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    await prismaService.dependency.deleteMany({
      where: { 
        OR: [
          { predecessor_issue: { project_id: testProjectId } },
          { successor_issue: { project_id: testProjectId } }
        ]
      }
    });
    await prismaService.issue.deleteMany({
      where: { project_id: testProjectId },
    });
    await prismaService.project.deleteMany({
      where: { id: testProjectId },
    });
    
    await app.close();
  });

  async function createTestIssue(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/projects/${testProjectId}/issues`)
      .set('Authorization', `Basic ${authHeader}`)
      .send({
        title: `Circular Test Issue ${name}`,
        description: `Issue ${name} for circular dependency testing`,
        status: 'open',
        priority: 'medium'
      });

    expect(response.status).toBe(HttpStatus.CREATED);
    return response.body.id;
  }

  async function createDependency(predecessorId: string, successorId: string): Promise<any> {
    return await request(app.getHttpServer())
      .post(`/projects/${testProjectId}/dependencies`)
      .set('Authorization', `Basic ${authHeader}`)
      .send({
        predecessor_issue_id: predecessorId,
        successor_issue_id: successorId,
        type: 'FS'
      });
  }

  describe('1. 直接循環依存検出', () => {
    it('should detect simple circular dependency (A -> B -> A)', async () => {
      console.log('\n🔀 Testing simple circular dependency detection');

      // テスト用Issueを2つ作成
      const issueA = await createTestIssue('A');
      const issueB = await createTestIssue('B');

      console.log('  Created Issues: A, B');

      // A -> B の依存関係を作成
      const depAB = await createDependency(issueA, issueB);
      expect(depAB.status).toBe(HttpStatus.CREATED);
      console.log('  Created dependency A -> B');

      // B -> A の依存関係作成を試行（循環依存）
      const depBA = await createDependency(issueB, issueA);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(depBA.status);

      console.log(`  Circular dependency B -> A rejected: ${depBA.status}`);
      console.log(`  Error message: ${depBA.body.message}`);

      // エラーメッセージに循環依存の言及があることを確認
      const errorMessage = depBA.body.message?.toLowerCase() || '';
      const hasCircularMessage = ['circular', 'cycle', 'loop', '循環'].some(term => 
        errorMessage.includes(term)
      );
      expect(hasCircularMessage).toBe(true);

      console.log('✅ Simple circular dependency detected correctly');
    });

    it('should prevent self-dependency (A -> A)', async () => {
      console.log('\n🔂 Testing self-dependency prevention');

      const issueA = await createTestIssue('Self');

      // 自分自身への依存関係作成を試行
      const selfDep = await createDependency(issueA, issueA);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(selfDep.status);

      console.log(`  Self-dependency A -> A rejected: ${selfDep.status}`);
      console.log('✅ Self-dependency prevented correctly');
    });
  });

  describe('2. 間接循環依存検出', () => {
    it('should detect indirect circular dependency (A -> B -> C -> A)', async () => {
      console.log('\n🔗 Testing indirect circular dependency detection');

      // テスト用Issueを3つ作成
      const issueA = await createTestIssue('Indirect-A');
      const issueB = await createTestIssue('Indirect-B');
      const issueC = await createTestIssue('Indirect-C');

      console.log('  Created Issues: Indirect-A, Indirect-B, Indirect-C');

      // A -> B -> C の依存関係チェーンを作成
      const depAB = await createDependency(issueA, issueB);
      expect(depAB.status).toBe(HttpStatus.CREATED);
      console.log('  Created dependency A -> B');

      const depBC = await createDependency(issueB, issueC);
      expect(depBC.status).toBe(HttpStatus.CREATED);
      console.log('  Created dependency B -> C');

      // C -> A の依存関係作成を試行（間接循環依存）
      const depCA = await createDependency(issueC, issueA);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(depCA.status);

      console.log(`  Indirect circular dependency C -> A rejected: ${depCA.status}`);
      console.log('✅ Indirect circular dependency detected correctly');
    });

    it('should detect complex multi-level circular dependencies', async () => {
      console.log('\n🔄 Testing complex multi-level circular dependency');

      // テスト用Issueを5つ作成（A -> B -> C -> D -> E -> A）
      const issues = {};
      const issueNames = ['Complex-A', 'Complex-B', 'Complex-C', 'Complex-D', 'Complex-E'];
      
      for (const name of issueNames) {
        issues[name] = await createTestIssue(name);
      }

      console.log(`  Created Issues: ${issueNames.join(', ')}`);

      // 依存関係チェーンを構築
      const chainDependencies = [
        ['Complex-A', 'Complex-B'],
        ['Complex-B', 'Complex-C'],
        ['Complex-C', 'Complex-D'],
        ['Complex-D', 'Complex-E']
      ];

      for (const [predecessor, successor] of chainDependencies) {
        const dep = await createDependency(issues[predecessor], issues[successor]);
        expect(dep.status).toBe(HttpStatus.CREATED);
        console.log(`  Created dependency ${predecessor} -> ${successor}`);
      }

      // E -> A の依存関係作成を試行（5段階の循環依存）
      const circularDep = await createDependency(issues['Complex-E'], issues['Complex-A']);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(circularDep.status);

      console.log(`  Complex circular dependency E -> A rejected: ${circularDep.status}`);
      console.log('✅ Complex multi-level circular dependency detected correctly');
    });
  });

  describe('3. 部分的循環依存検出', () => {
    it('should detect circular dependencies in subgraphs', async () => {
      console.log('\n🌐 Testing circular dependency detection in subgraphs');

      // 複雑なグラフを作成: A -> B, A -> C, B -> D, C -> D
      const issueA = await createTestIssue('Graph-A');
      const issueB = await createTestIssue('Graph-B'); 
      const issueC = await createTestIssue('Graph-C');
      const issueD = await createTestIssue('Graph-D');

      console.log('  Created graph Issues: A, B, C, D');

      // 正常な依存関係を構築
      const normalDeps = [
        [issueA, issueB], // A -> B
        [issueA, issueC], // A -> C  
        [issueB, issueD], // B -> D
        [issueC, issueD]  // C -> D
      ];

      for (const [pred, succ] of normalDeps) {
        const dep = await createDependency(pred, succ);
        expect(dep.status).toBe(HttpStatus.CREATED);
      }

      console.log('  Created normal dependency graph');

      // D -> B の依存関係作成を試行（B -> D -> B の循環）
      const circularDB = await createDependency(issueD, issueB);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(circularDB.status);

      console.log(`  Subgraph circular dependency D -> B rejected: ${circularDB.status}`);

      // D -> A の依存関係作成を試行（より長い循環）
      const circularDA = await createDependency(issueD, issueA);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(circularDA.status);

      console.log(`  Long circular dependency D -> A rejected: ${circularDA.status}`);
      console.log('✅ Subgraph circular dependencies detected correctly');
    });
  });

  describe('4. パフォーマンステスト', () => {
    it('should detect circular dependencies efficiently in large graphs', async () => {
      console.log('\n⚡ Testing circular dependency detection performance');

      const graphSize = 10; // 10ノードのグラフ
      const largeGraphIssues = [];

      // 大きなグラフ用のIssueを作成
      for (let i = 0; i < graphSize; i++) {
        const issueId = await createTestIssue(`Perf-${i}`);
        largeGraphIssues.push(issueId);
      }

      console.log(`  Created ${graphSize} Issues for performance test`);

      // 線形チェーンを作成 (0 -> 1 -> 2 -> ... -> 9)
      for (let i = 0; i < graphSize - 1; i++) {
        const dep = await createDependency(largeGraphIssues[i], largeGraphIssues[i + 1]);
        expect(dep.status).toBe(HttpStatus.CREATED);
      }

      console.log('  Created linear dependency chain');

      // 最後から最初への依存関係作成を試行（循環完成）
      const startTime = Date.now();
      const circularDep = await createDependency(
        largeGraphIssues[graphSize - 1], 
        largeGraphIssues[0]
      );
      const detectionTime = Date.now() - startTime;

      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(circularDep.status);

      console.log(`  Circular dependency detection time: ${detectionTime}ms`);
      console.log(`  Performance check: ${detectionTime < 1000 ? 'PASS' : 'SLOW'} (< 1000ms)`);

      // パフォーマンス要件確認
      expect(detectionTime).toBeLessThan(5000); // 5秒以内

      console.log('✅ Performance test passed');
    });
  });

  describe('5. 依存関係削除と循環解消', () => {
    it('should allow previously blocked dependencies after cycle removal', async () => {
      console.log('\n🗑️  Testing dependency removal and cycle resolution');

      // 循環を含むグラフを作成
      const issueX = await createTestIssue('Removal-X');
      const issueY = await createTestIssue('Removal-Y');
      const issueZ = await createTestIssue('Removal-Z');

      // X -> Y -> Z の依存関係を作成
      const depXY = await createDependency(issueX, issueY);
      const depYZ = await createDependency(issueY, issueZ);
      
      expect(depXY.status).toBe(HttpStatus.CREATED);
      expect(depYZ.status).toBe(HttpStatus.CREATED);

      console.log('  Created dependencies: X -> Y -> Z');

      // Z -> X の依存関係作成を試行（循環のため失敗するはず）
      const blockedDep = await createDependency(issueZ, issueX);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(blockedDep.status);

      console.log(`  Z -> X blocked by circular dependency: ${blockedDep.status}`);

      // 既存の依存関係リストを取得
      const depsBeforeRemoval = await request(app.getHttpServer())
        .get(`/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Basic ${authHeader}`);

      const dependencyToRemove = depsBeforeRemoval.body.find(dep => 
        dep.predecessor_issue_id === issueX && dep.successor_issue_id === issueY
      );

      if (dependencyToRemove) {
        // X -> Y の依存関係を削除（循環を断ち切る）
        const removalResponse = await request(app.getHttpServer())
          .delete(`/dependencies/${dependencyToRemove.id}`)
          .set('Authorization', `Basic ${authHeader}`);

        expect(removalResponse.status).toBe(HttpStatus.OK);
        console.log('  Removed dependency X -> Y');

        // Z -> X の依存関係作成を再試行（今度は成功するはず）
        const unblocked_dep = await createDependency(issueZ, issueX);
        expect(unblocked_dep.status).toBe(HttpStatus.CREATED);

        console.log('  Z -> X dependency now allowed after cycle removal');
        console.log('✅ Cycle removal and dependency unblocking works correctly');
      }
    });
  });

  describe('6. エラーメッセージ品質', () => {
    it('should provide informative error messages for circular dependencies', async () => {
      console.log('\n💬 Testing circular dependency error message quality');

      // シンプルな循環を作成してエラーメッセージをテスト
      const issueMsg1 = await createTestIssue('Msg-1');
      const issueMsg2 = await createTestIssue('Msg-2');
      const issueMsg3 = await createTestIssue('Msg-3');

      // Msg-1 -> Msg-2 -> Msg-3 -> Msg-1 の循環を作ろうとする
      await createDependency(issueMsg1, issueMsg2);
      await createDependency(issueMsg2, issueMsg3);

      const circularResponse = await createDependency(issueMsg3, issueMsg1);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(circularResponse.status);

      const errorMessage = circularResponse.body.message || '';
      console.log(`  Error message: "${errorMessage}"`);

      // エラーメッセージの品質確認
      const informativeTerms = [
        'circular', 'cycle', 'loop', 'dependency', 
        '循環', 'サイクル', 'ループ', '依存'
      ];

      const hasInformativeTerms = informativeTerms.some(term => 
        errorMessage.toLowerCase().includes(term.toLowerCase())
      );

      expect(hasInformativeTerms).toBe(true);

      // 追加的な情報が含まれているかチェック（Issue IDや詳細など）
      const hasDetailedInfo = errorMessage.length > 20; // 十分に詳細
      console.log(`  Message length: ${errorMessage.length} characters`);
      console.log(`  Has detailed info: ${hasDetailedInfo}`);

      expect(hasDetailedInfo).toBe(true);
      console.log('✅ Error messages are informative');
    });
  });

  describe('7. 境界ケーステスト', () => {
    it('should handle edge cases correctly', async () => {
      console.log('\n🎯 Testing edge cases');

      // 空の依存関係リストでの操作
      const edgeIssue1 = await createTestIssue('Edge-1');
      const edgeIssue2 = await createTestIssue('Edge-2');

      // 最初の依存関係作成（循環検査が空のグラフで動作するか）
      const firstDep = await createDependency(edgeIssue1, edgeIssue2);
      expect(firstDep.status).toBe(HttpStatus.CREATED);
      console.log('  First dependency in empty graph: OK');

      // 同じ依存関係の重複作成を試行
      const duplicateDep = await createDependency(edgeIssue1, edgeIssue2);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(duplicateDep.status);
      console.log(`  Duplicate dependency rejected: ${duplicateDep.status}`);

      // 存在しないIssueでの依存関係作成
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const invalidDep = await createDependency(edgeIssue1, nonExistentId);
      expect([HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.UNPROCESSABLE_ENTITY])
        .toContain(invalidDep.status);
      console.log(`  Non-existent Issue dependency rejected: ${invalidDep.status}`);

      console.log('✅ Edge cases handled correctly');
    });
  });
});