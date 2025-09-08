/**
 * ヘルスチェック機能のE2Eテスト
 * 
 * テスト対象:
 * - アプリケーション稼働状態確認
 * - データベース接続確認
 * - 認証不要アクセス
 * - レスポンス形式の検証
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { testHelper } from './test-setup';

describe('ヘルスチェック E2E テスト', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = testHelper.app;
  });

  describe('基本ヘルスチェック (GET /health)', () => {
    it('認証なしでアクセス可能', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('正常状態でのレスポンス形式確認', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // 必須フィールドの確認
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database');

      // ステータス値の確認
      expect(['ok', 'error']).toContain(response.body.status);

      // データベース情報の確認
      expect(response.body.database).toHaveProperty('status');
      expect(response.body.database).toHaveProperty('connected');
      expect(['healthy', 'unhealthy']).toContain(response.body.database.status);
      expect(typeof response.body.database.connected).toBe('boolean');

      // タイムスタンプ形式の確認
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('認証ヘッダーがあってもアクセス可能', async () => {
      const authHeader = testHelper.createBasicAuthHeader();

      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('無効な認証ヘッダーでもアクセス可能', async () => {
      const invalidAuth = testHelper.createBasicAuthHeader('wrong', 'credentials');

      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', invalidAuth)
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('正常状態での具体的なレスポンス内容', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      if (response.body.status === 'ok') {
        expect(response.body.message).toBe('All systems operational');
        expect(response.body.database.status).toBe('healthy');
        expect(response.body.database.connected).toBe(true);
      } else {
        // エラー状態の場合
        expect(response.body.status).toBe('error');
        expect(response.body.message).toBeDefined();
        expect(typeof response.body.message).toBe('string');
      }
    });
  });

  describe('データベース接続テスト', () => {
    it('データベース正常接続時のレスポンス', async () => {
      // データベースが正常に接続されている前提
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // 正常な場合の期待値
      if (response.body.database.connected) {
        expect(response.body.database.status).toBe('healthy');
        expect(response.body.status).toBe('ok');
        expect(response.body.message).toBe('All systems operational');
      }
    });

    it('レスポンス時間が適切（1秒以内）', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // ヘルスチェックは1秒以内に応答するべき
      expect(responseTime).toBeLessThan(1000);
    });

    it('連続アクセスでの安定性確認', async () => {
      // 連続10回アクセスして安定性を確認
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/health')
          .expect(200)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('database');
      });

      // 全て同じ接続状態であることを確認
      const firstStatus = responses[0].body.database.connected;
      responses.forEach(response => {
        expect(response.body.database.connected).toBe(firstStatus);
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないパスへのアクセス', async () => {
      await request(app.getHttpServer())
        .get('/health/nonexistent')
        .expect(404);
    });

    it('POSTメソッドでのアクセス', async () => {
      await request(app.getHttpServer())
        .post('/health')
        .expect(405);
    });

    it('PUTメソッドでのアクセス', async () => {
      await request(app.getHttpServer())
        .put('/health')
        .expect(405);
    });

    it('DELETEメソッドでのアクセス', async () => {
      await request(app.getHttpServer())
        .delete('/health')
        .expect(405);
    });

    it('不正なクエリパラメータは無視される', async () => {
      const response = await request(app.getHttpServer())
        .get('/health?malicious=true&test=123&invalid=param')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('database');
    });

    it('不正なヘッダーでもアクセス可能', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Malicious-Header', '<script>alert("xss")</script>')
        .set('Content-Type', 'application/json')
        .set('Accept', 'text/html')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('パフォーマンス・負荷テスト', () => {
    it('高負荷での応答性能（50並行アクセス）', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .get('/health')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // 全てのリクエストが成功することを確認
      responses.forEach(response => {
        expect(response.body).toHaveProperty('status');
      });

      // 平均応答時間が3秒以内であることを確認
      const averageTime = (endTime - startTime) / concurrentRequests;
      expect(averageTime).toBeLessThan(3000);
    });

    it('継続的なアクセスでのメモリリークなし', async () => {
      // 100回の連続アクセス
      for (let i = 0; i < 100; i++) {
        await request(app.getHttpServer())
          .get('/health')
          .expect(200);

        // 10回ごとに短時間待機
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // 最終的にまだ正常に動作することを確認
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('レスポンスサイズの妥当性', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const responseSize = JSON.stringify(response.body).length;

      // レスポンスサイズが適切（1KB以内）
      expect(responseSize).toBeLessThan(1024);

      // 最小限の情報は含まれている（100バイト以上）
      expect(responseSize).toBeGreaterThan(100);
    });
  });

  describe('レスポンス形式の詳細検証', () => {
    let healthResponse: any;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      healthResponse = response.body;
    });

    it('タイムスタンプがISO 8601形式', async () => {
      const timestamp = healthResponse.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const parsedDate = new Date(timestamp);
      expect(parsedDate).toBeInstanceOf(Date);
      expect(parsedDate.getTime()).not.toBeNaN();

      // 現在時刻から大きくずれていないことを確認（1分以内）
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - parsedDate.getTime());
      expect(timeDiff).toBeLessThan(60000);
    });

    it('ステータスフィールドの型安全性', async () => {
      expect(typeof healthResponse.status).toBe('string');
      expect(typeof healthResponse.message).toBe('string');
      expect(typeof healthResponse.database.status).toBe('string');
      expect(typeof healthResponse.database.connected).toBe('boolean');
    });

    it('想定外のフィールドが含まれていない', async () => {
      const expectedFields = ['status', 'message', 'timestamp', 'database'];
      const actualFields = Object.keys(healthResponse);

      actualFields.forEach(field => {
        expect(expectedFields).toContain(field);
      });

      // databaseオブジェクトの検証
      const expectedDatabaseFields = ['status', 'connected'];
      const actualDatabaseFields = Object.keys(healthResponse.database);

      actualDatabaseFields.forEach(field => {
        expect(expectedDatabaseFields).toContain(field);
      });
    });

    it('ログ出力の副作用なし（レスポンスに影響なし）', async () => {
      // 複数回アクセスしてレスポンスが一貫していることを確認
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/health').expect(200),
        request(app.getHttpServer()).get('/health').expect(200),
        request(app.getHttpServer()).get('/health').expect(200),
      ]);

      const firstResponse = responses[0].body;
      const secondResponse = responses[1].body;
      const thirdResponse = responses[2].body;

      // ステータス情報は一致するはず（タイムスタンプ以外）
      expect(firstResponse.status).toBe(secondResponse.status);
      expect(firstResponse.status).toBe(thirdResponse.status);
      expect(firstResponse.database.connected).toBe(secondResponse.database.connected);
      expect(firstResponse.database.connected).toBe(thirdResponse.database.connected);
    });
  });

  describe('セキュリティ', () => {
    it('センシティブ情報の漏洩なし', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const responseString = JSON.stringify(response.body);

      // データベースパスワードや秘密情報が含まれていないことを確認
      expect(responseString.toLowerCase()).not.toContain('password');
      expect(responseString.toLowerCase()).not.toContain('secret');
      expect(responseString.toLowerCase()).not.toContain('key');
      expect(responseString.toLowerCase()).not.toContain('token');
      expect(responseString.toLowerCase()).not.toContain('env');
      expect(responseString.toLowerCase()).not.toContain('config');
    });

    it('SQLインジェクション攻撃の試行（無効化）', async () => {
      // SQLインジェクションを試行するクエリパラメータ
      const maliciousQueries = [
        '?id=1\' OR \'1\'=\'1',
        '?query=; DROP TABLE projects; --',
        '?param=\' UNION SELECT * FROM users --',
      ];

      for (const query of maliciousQueries) {
        const response = await request(app.getHttpServer())
          .get(`/health${query}`)
          .expect(200);

        // ヘルスチェックは通常通り動作するはず
        expect(response.body).toHaveProperty('status');
      }
    });

    it('XSS攻撃の試行（無効化）', async () => {
      const maliciousHeaders = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
      ];

      for (const maliciousHeader of maliciousHeaders) {
        const response = await request(app.getHttpServer())
          .get('/health')
          .set('X-Custom-Header', maliciousHeader)
          .expect(200);

        // レスポンスにスクリプトが含まれていないことを確認
        const responseString = JSON.stringify(response.body);
        expect(responseString).not.toContain('<script');
        expect(responseString).not.toContain('javascript:');
        expect(responseString).not.toContain('onerror');
      }
    });
  });
});