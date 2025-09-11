import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * セキュリティテスト: SQL Injection攻撃の防御検証
 * 
 * 対象攻撃ベクター:
 * 1. クエリパラメータでのSQL Injection
 * 2. リクエストボディでのSQL Injection
 * 3. HTTPヘッダーでのSQL Injection
 * 4. Union-based SQL Injection
 * 5. Blind SQL Injection
 * 6. Time-based SQL Injection
 * 
 * 期待動作:
 * - Prisma ORM使用によりSQL Injectionは基本的に不可能
 * - 悪意のあるペイロードが適切にサニタイズされる
 * - データベースエラーが外部に漏洩しない
 */
describe('SQL Injection Security Tests (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  
  // テスト用プロジェクトデータ
  let testProjectId: string;
  let validPassword: string;
  let authHeader: string;
  let testIssueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // テスト用プロジェクト作成
    validPassword = 'TestSecurePassword123!';
    const hashedPassword = await bcrypt.hash(validPassword, 10);
    
    const testProject = await prismaService.project.create({
      data: {
        name: 'SQL Injection Test Project',
        description: 'Project for SQL injection testing',
        shared_password_hash: hashedPassword,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    testProjectId = testProject.id;
    authHeader = btoa(`${testProjectId}:${validPassword}`);

    // テスト用Issue作成
    const testIssue = await prismaService.issue.create({
      data: {
        title: 'Test Issue for SQL Injection',
        description: 'Test description',
        status: 'open',
        priority: 'medium',
        project_id: testProjectId,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
      },
    });
    
    testIssueId = testIssue.id;
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    await prismaService.issue.deleteMany({
      where: { project_id: testProjectId },
    });
    await prismaService.project.deleteMany({
      where: { name: 'SQL Injection Test Project' },
    });
    
    await app.close();
  });

  describe('1. クエリパラメータでのSQL Injection攻撃防御', () => {
    const sqlInjectionPayloads = [
      // 基本的なSQL Injection
      "'; DROP TABLE projects; --",
      "' OR '1'='1",
      "' OR 1=1 --",
      "' OR 'x'='x",
      "'; DELETE FROM issues; --",
      
      // Union-based攻撃
      "' UNION SELECT null,null,null,null,null --",
      "' UNION SELECT 1,2,3,4,5 --",
      "' UNION ALL SELECT null,@@version,null,null,null --",
      
      // Boolean-based blind injection  
      "' AND (SELECT COUNT(*) FROM projects)>0 --",
      "' AND (SELECT LENGTH(name) FROM projects WHERE id='" + testProjectId + "')>5 --",
      
      // エラーベース攻撃
      "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT @@version), 0x7e)) --",
      "' AND (SELECT * FROM (SELECT COUNT(*), CONCAT(version(), FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) a) --",
      
      // Second-order injection
      "admin'/**/OR/**/1=1#",
      "' OR (SELECT * FROM (SELECT SLEEP(2))a) --",
    ];

    sqlInjectionPayloads.forEach((payload, index) => {
      it(`should prevent SQL injection in project ID parameter (payload ${index + 1})`, async () => {
        const response = await request(app.getHttpServer())
          .get(`/projects/${encodeURIComponent(payload)}`)
          .set('Authorization', `Basic ${authHeader}`);

        // SQL Injectionが成功していないことを確認
        expect(response.status).not.toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect([
          HttpStatus.BAD_REQUEST,
          HttpStatus.UNAUTHORIZED, 
          HttpStatus.FORBIDDEN,
          HttpStatus.NOT_FOUND
        ]).toContain(response.status);
        
        // データベースエラーメッセージが漏洩していないことを確認
        expect(response.body.message).not.toMatch(/SQL|database|query|prisma|postgres/i);
      });
    });
  });

  describe('2. リクエストボディでのSQL Injection攻撃防御', () => {
    const sqlInjectionPayloads = [
      // Issue作成時のSQL Injection試行
      {
        title: "'; DROP TABLE issues; --",
        description: "' OR 1=1 --",
        status: 'open',
        priority: 'high'
      },
      {
        title: "Normal Title",
        description: "' UNION SELECT null,null,null,null,null --",
        status: 'open',
        priority: 'medium'
      },
      {
        title: "' OR (SELECT COUNT(*) FROM projects)>0 --",
        description: "Normal description", 
        status: "' AND SLEEP(5) --",
        priority: 'low'
      },
      // JSON内でのSQL Injection
      {
        title: "Test Issue",
        description: "{\"malicious\": \"'; DELETE FROM projects; --\"}",
        status: 'open',
        priority: 'medium'
      }
    ];

    sqlInjectionPayloads.forEach((payload, index) => {
      it(`should prevent SQL injection in Issue creation (payload ${index + 1})`, async () => {
        const response = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send(payload);

        // SQL Injectionが成功していない、またはバリデーションエラー
        expect([
          HttpStatus.CREATED, // 正常に作成された（サニタイズ済み）
          HttpStatus.BAD_REQUEST, // バリデーションエラー
          HttpStatus.FORBIDDEN // 権限エラー
        ]).toContain(response.status);

        // データベースエラーが露出していないことを確認
        if (response.status !== HttpStatus.CREATED) {
          expect(response.body.message).not.toMatch(/SQL|database|query|prisma|postgres/i);
        }
      });
    });

    it('should prevent SQL injection in Issue update operations', async () => {
      const maliciousUpdate = {
        title: "'; UPDATE projects SET shared_password_hash='hacked'; --",
        description: "' OR 1=1 --",
        status: "'; DROP TABLE issues; --",
        priority: 'critical'
      };

      const response = await request(app.getHttpServer())
        .put(`/projects/${testProjectId}/issues/${testIssueId}`)
        .set('Authorization', `Basic ${authHeader}`)
        .send(maliciousUpdate);

      expect([
        HttpStatus.OK, // 正常に更新（サニタイズ済み）
        HttpStatus.BAD_REQUEST,
        HttpStatus.FORBIDDEN,
        HttpStatus.NOT_FOUND
      ]).toContain(response.status);
    });
  });

  describe('3. HTTPヘッダーでのSQL Injection攻撃防御', () => {
    const maliciousHeaders = [
      { 'X-Forwarded-For': "'; DROP TABLE projects; --" },
      { 'User-Agent': "' OR 1=1 --" },
      { 'Referer': "' UNION SELECT password FROM users --" },
      { 'Accept-Language': "'; DELETE FROM issues; --" },
      { 'X-Real-IP': "' AND SLEEP(10) --" },
    ];

    maliciousHeaders.forEach((header, index) => {
      it(`should handle malicious SQL in HTTP headers (header ${index + 1})`, async () => {
        const response = await request(app.getHttpServer())
          .get(`/projects/${testProjectId}`)
          .set('Authorization', `Basic ${authHeader}`)
          .set(header);

        // ヘッダー内のSQL Injectionが影響しないことを確認
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toHaveProperty('id', testProjectId);
      });
    });
  });

  describe('4. Advanced SQL Injection攻撃防御', () => {
    it('should prevent Second-Order SQL injection attacks', async () => {
      // 第1段階: 悪意のあるデータを保存
      const maliciousIssue = {
        title: "'; DROP TABLE projects; --",
        description: "This could be dangerous if not handled properly",
        status: 'open',
        priority: 'medium'
      };

      const createResponse = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/issues`)
        .set('Authorization', `Basic ${authHeader}`)
        .send(maliciousIssue);

      if (createResponse.status === HttpStatus.CREATED) {
        const createdIssueId = createResponse.body.id;

        // 第2段階: 保存されたデータを使用する操作
        const fetchResponse = await request(app.getHttpServer())
          .get(`/projects/${testProjectId}/issues/${createdIssueId}`)
          .set('Authorization', `Basic ${authHeader}`);

        expect(fetchResponse.status).toBe(HttpStatus.OK);
        
        // プロジェクトがまだ存在することを確認（DROP文が実行されていない）
        const projectResponse = await request(app.getHttpServer())
          .get(`/projects/${testProjectId}`)
          .set('Authorization', `Basic ${authHeader}`);

        expect(projectResponse.status).toBe(HttpStatus.OK);

        // クリーンアップ
        await request(app.getHttpServer())
          .delete(`/projects/${testProjectId}/issues/${createdIssueId}`)
          .set('Authorization', `Basic ${authHeader}`);
      }
    });

    it('should prevent Time-based SQL injection attacks', async () => {
      const timeBasedPayloads = [
        "'; WAITFOR DELAY '00:00:05'; --",
        "' OR SLEEP(5) --", 
        "'; SELECT pg_sleep(5); --",
        "' AND (SELECT * FROM (SELECT SLEEP(5))a) --"
      ];

      for (const payload of timeBasedPayloads) {
        const startTime = Date.now();
        
        const response = await request(app.getHttpServer())
          .get(`/projects/${encodeURIComponent(payload)}`)
          .set('Authorization', `Basic ${authHeader}`);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // レスポンスが異常に遅くないことを確認（5秒以上の遅延がない）
        expect(duration).toBeLessThan(5000);
        expect([
          HttpStatus.BAD_REQUEST,
          HttpStatus.UNAUTHORIZED,
          HttpStatus.FORBIDDEN, 
          HttpStatus.NOT_FOUND
        ]).toContain(response.status);
      }
    });
  });

  describe('5. NoSQL Injection攻撃防御（将来対応）', () => {
    // 現在はPostgreSQLを使用しているが、将来的にNoSQLを使用する可能性に備えて
    it('should prevent NoSQL injection patterns', async () => {
      const nosqlPayloads = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$where": "this.name == this.description"}',
        '{"username": {"$ne": null}, "password": {"$ne": null}}'
      ];

      for (const payload of nosqlPayloads) {
        const response = await request(app.getHttpServer())
          .post(`/projects/${testProjectId}/issues`)
          .set('Authorization', `Basic ${authHeader}`)
          .send({
            title: payload,
            description: 'Test description',
            status: 'open',
            priority: 'medium'
          });

        expect([
          HttpStatus.CREATED, // 正常処理（文字列として扱われる）
          HttpStatus.BAD_REQUEST // バリデーションエラー
        ]).toContain(response.status);
      }
    });
  });

  describe('6. データベースエラー情報漏洩防止', () => {
    it('should not expose database schema information', async () => {
      // 故意に存在しないテーブルを参照するようなペイロード
      const schemaExplorationPayloads = [
        "' AND (SELECT COUNT(*) FROM information_schema.tables)>0 --",
        "'; SELECT table_name FROM information_schema.tables; --",
        "' UNION SELECT column_name FROM information_schema.columns --"
      ];

      for (const payload of schemaExplorationPayloads) {
        const response = await request(app.getHttpServer())
          .get(`/projects/${encodeURIComponent(payload)}`)
          .set('Authorization', `Basic ${authHeader}`);

        // データベーススキーマ情報が漏洩していないことを確認
        expect(response.body.message).not.toMatch(/information_schema|pg_catalog|tables|columns/i);
        expect(response.body.message).not.toMatch(/relation|does|not|exist/i);
      }
    });

    it('should handle malformed SQL gracefully', async () => {
      const malformedQueries = [
        "' AND ((('",
        "'; SELECT * FROM (((",
        "' GROUP BY 1,2,3,4,5,6,7,8,9,10 --",
        "' ORDER BY 100 --",
        "'; DECLARE @cmd varchar(8000); --"
      ];

      for (const query of malformedQueries) {
        const response = await request(app.getHttpServer())
          .get(`/projects/${encodeURIComponent(query)}`)
          .set('Authorization', `Basic ${authHeader}`);

        // 内部エラーが露出していないことを確認
        expect(response.status).not.toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        if (response.status >= 400) {
          expect(response.body.message).not.toMatch(/syntax|error|unexpected|token/i);
        }
      }
    });
  });

  describe('7. データベース接続情報保護', () => {
    it('should not expose database connection details in error responses', async () => {
      // 大量のデータを要求してタイムアウトやリソース不足を誘発
      const resourceExhaustionPayload = "' UNION ALL " + "SELECT 1 UNION ALL ".repeat(1000) + "SELECT 1 --";

      const response = await request(app.getHttpServer())
        .get(`/projects/${encodeURIComponent(resourceExhaustionPayload)}`)
        .set('Authorization', `Basic ${authHeader}`);

      // データベース接続情報が漏洩していないことを確認
      expect(response.body.message).not.toMatch(/localhost|postgres|database|connection|pool/i);
      expect(response.body.message).not.toMatch(/prisma|db|host|port|user/i);
    });
  });
});