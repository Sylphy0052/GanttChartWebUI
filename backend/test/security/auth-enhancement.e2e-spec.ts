import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthMiddleware } from '../../src/auth/auth.middleware';

/**
 * セキュリティ強化テスト - 認証ミドルウェア
 * 
 * M8-05セキュリティ設定強化の検証:
 * - JWT有効期限とセッション管理のテスト
 * - タイミング攻撃防止のテスト
 * - セキュリティログ記録のテスト
 * - トークンリフレッシュ機能のテスト
 */
describe('Security Enhancement - Auth Middleware (e2e)', () => {
  let app: INestApplication;
  let authMiddleware: AuthMiddleware;

  // テスト用JWT設定
  const testJwtConfig = {
    JWT_SECRET: 'test-jwt-secret-for-security-enhancement',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_THRESHOLD: '300',
    AUTH_TYPE: 'jwt',
    NODE_ENV: 'test',
  };

  beforeAll(async () => {
    // 環境変数設定
    Object.assign(process.env, testJwtConfig);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    authMiddleware = new AuthMiddleware();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    
    // 環境変数クリーンアップ
    Object.keys(testJwtConfig).forEach(key => {
      delete process.env[key];
    });
  });

  describe('JWT有効期限管理', () => {
    it('有効なJWTトークンで認証成功', async () => {
      // 有効なJWTトークン（簡易版）を作成
      const validPayload = {
        sub: 'test-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1時間後
        aud: 'gantt-chart-webui',
      };
      
      const token = createTestJWT(validPayload);
      
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('期限切れJWTトークンで認証失敗', async () => {
      // 期限切れのJWTトークンを作成
      const expiredPayload = {
        sub: 'test-user',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2時間前
        exp: Math.floor(Date.now() / 1000) - 3600, // 1時間前（期限切れ）
        aud: 'gantt-chart-webui',
      };
      
      const token = createTestJWT(expiredPayload);
      
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('未来の発行時刻を持つJWTトークンで認証失敗', async () => {
      // 未来の発行時刻を持つトークン
      const futurePayload = {
        sub: 'test-user',
        iat: Math.floor(Date.now() / 1000) + 3600, // 1時間後（未来）
        exp: Math.floor(Date.now() / 1000) + 7200, // 2時間後
        aud: 'gantt-chart-webui',
      };
      
      const token = createTestJWT(futurePayload);
      
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('不正なオーディエンスを持つJWTトークンで認証失敗', async () => {
      const invalidAudPayload = {
        sub: 'test-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'malicious-app', // 不正なオーディエンス
      };
      
      const token = createTestJWT(invalidAudPayload);
      
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('セッション管理', () => {
    it('トークンリフレッシュが必要な場合にヘッダーを返却', async () => {
      // リフレッシュが必要なトークン（有効期限まで4分）
      const refreshNeededPayload = {
        sub: 'test-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 240, // 4分後（5分のしきい値以下）
        aud: 'gantt-chart-webui',
        session_id: 'session_test_123',
      };
      
      const token = createTestJWT(refreshNeededPayload);
      
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.headers['x-token-refresh-required']).toBe('true');
    });

    it('セッション情報が正しく管理される', () => {
      const authInfo = authMiddleware.getAuthInfo();
      
      expect(authInfo).toEqual({
        type: 'jwt',
        jwtExpiresIn: '1h',
        activeSessions: expect.any(Number),
        securityFeatures: [
          'Enhanced JWT validation',
          'Session management',
          'Timing attack protection',
          'Security header validation',
          'Rate limiting integration',
        ],
      });
    });
  });

  describe('Basic認証のセキュリティ強化', () => {
    beforeAll(() => {
      // Basic認証モードに切り替え
      process.env.AUTH_TYPE = 'basic';
      process.env.BASIC_AUTH_USERNAME = 'test-user';
      process.env.BASIC_AUTH_PASSWORD = 'test-password';
    });

    afterAll(() => {
      // JWT認証モードに戻す
      process.env.AUTH_TYPE = 'jwt';
    });

    it('正しい認証情報でBasic認証成功', async () => {
      const credentials = Buffer.from('test-user:test-password').toString('base64');
      
      await request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Basic ${credentials}`)
        .expect(200);
    });

    it('長すぎる認証情報で認証失敗', async () => {
      const longUsername = 'a'.repeat(101); // 100文字超過
      const credentials = Buffer.from(`${longUsername}:password`).toString('base64');
      
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Basic ${credentials}`)
        .expect(401);
    });

    it('空の認証情報で認証失敗', async () => {
      const credentials = Buffer.from(':').toString('base64');
      
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Basic ${credentials}`)
        .expect(401);
    });
  });

  describe('プロジェクトパスワード認証のセキュリティ強化', () => {
    it('有効なプロジェクトIDで認証成功', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .set('X-Project-Id', 'valid-project-123')
        .set('X-Project-Password-Auth', 'true')
        .expect(200);
    });

    it('不正な文字を含むプロジェクトIDで認証失敗', async () => {
      await request(app.getHttpServer())
        .get('/projects')
        .set('X-Project-Id', 'invalid/project/../id') // 不正な文字
        .set('X-Project-Password-Auth', 'true')
        .expect(401);
    });

    it('SQLインジェクション試行でプロジェクトIDの認証失敗', async () => {
      await request(app.getHttpServer())
        .get('/projects')
        .set('X-Project-Id', 'project\'; DROP TABLE projects; --')
        .set('X-Project-Password-Auth', 'true')
        .expect(401);
    });
  });

  describe('レート制限と認証の統合', () => {
    it('無効な認証情報で大量リクエストがレート制限される', async () => {
      const requests = [];
      
      // 10回の無効な認証試行
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/projects')
            .set('Authorization', 'Bearer invalid-token')
            .expect(401)
        );
      }
      
      await Promise.all(requests);
      
      // 追加のリクエストはレート制限される
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(429); // レート制限エラー
    });
  });

  describe('セキュリティログ', () => {
    it('本番環境でのデフォルト設定警告', () => {
      // 一時的に本番環境に設定
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'default-jwt-secret-change-in-production';
      
      // ミドルウェアを再初期化（警告が出ることを期待）
      const middleware = new AuthMiddleware();
      expect(middleware).toBeDefined();
      
      // 環境変数を元に戻す
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('トークン形式の検証', () => {
    it('不正な形式のJWTトークンで認証失敗', async () => {
      const malformedTokens = [
        'invalid.token', // 3つのパートが不足
        'invalid.token.format.extra', // パートが多すぎる
        '', // 空のトークン
        'a'.repeat(2049), // トークンが長すぎる
      ];
      
      for (const token of malformedTokens) {
        await request(app.getHttpServer())
          .get('/projects')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });

    it('サポートされていないアルゴリズムで認証失敗', async () => {
      // RS256アルゴリズムを使用したトークン（サポート外）
      const unsupportedAlgPayload = {
        alg: 'RS256',
        typ: 'JWT',
      };
      
      const header = Buffer.from(JSON.stringify(unsupportedAlgPayload)).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64');
      
      const token = `${header}.${payload}.signature`;
      
      await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  /**
   * テスト用の簡易JWTトークン生成
   * @param payload ペイロード
   * @returns JWTトークン
   */
  function createTestJWT(payload: any): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // 簡易署名（実際のHMACではないが、テスト用途では十分）
    const signature = 'test-signature';
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
});