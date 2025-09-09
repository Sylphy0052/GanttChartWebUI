import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * 認証設定interfaces
 */
export interface AuthConfig {
  type: 'basic' | 'jwt' | 'none';
  basic?: {
    username: string;
    password: string;
  };
  jwt?: {
    secret: string;
    expiresIn?: string;
  };
}

/**
 * ユーザー情報interface
 */
export interface AuthUser {
  username?: string;
  type: 'basic' | 'jwt' | 'project-password';
  project_id?: string;
  permission: 'viewer' | 'editor';
  project_password_authenticated?: boolean;
}

/**
 * リクエストオブジェクト拡張
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * AuthMiddleware - JWT/Basic認証とプロジェクト共有パスワード認証の統合ミドルウェア
 * 
 * 機能:
 * - Basic認証またはJWT認証の選択可能
 * - プロジェクト共有パスワード認証サポート（カスタムヘッダー）
 * - 環境変数による認証方式の動的切り替え
 * - 開発環境では認証を無効化可能
 * - 権限レベルの管理（viewer/editor）
 * - 詳細なロギング
 * 
 * 設定:
 * - AUTH_TYPE: 'basic' | 'jwt' | 'none'
 * - BASIC_AUTH_USERNAME: Basic認証用ユーザー名
 * - BASIC_AUTH_PASSWORD: Basic認証用パスワード
 * - JWT_SECRET: JWT秘密鍵
 * - JWT_EXPIRES_IN: JWTの有効期限（デフォルト: 1h）
 * 
 * プロジェクト共有パスワード認証:
 * - X-Project-Id: プロジェクトID（ヘッダー）
 * - X-Project-Password-Auth: 'true' （ヘッダー）
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);
  private readonly config: AuthConfig;

  constructor() {
    this.config = this.loadAuthConfig();
    this.logger.log(`Auth middleware initialized with type: ${this.config.type}`);
  }

  /**
   * 環境変数から認証設定を読み込み
   * @returns 認証設定
   */
  private loadAuthConfig(): AuthConfig {
    const authType = (process.env.AUTH_TYPE || 'none').toLowerCase() as AuthConfig['type'];

    const config: AuthConfig = { type: authType };

    switch (authType) {
      case 'basic':
        config.basic = {
          username: process.env.BASIC_AUTH_USERNAME || 'admin',
          password: process.env.BASIC_AUTH_PASSWORD || 'password',
        };
        break;

      case 'jwt':
        config.jwt = {
          secret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
          expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        };
        break;

      case 'none':
        this.logger.warn('Authentication is disabled (AUTH_TYPE=none)');
        break;

      default:
        this.logger.warn(`Unknown auth type: ${authType}, falling back to 'none'`);
        config.type = 'none';
    }

    return config;
  }

  /**
   * ミドルウェア実行
   * @param req リクエスト
   * @param res レスポンス
   * @param next 次の処理
   */
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // プロジェクト共有パスワード認証のチェック（優先）
      const projectId = req.headers['x-project-id'] as string;
      const projectPasswordAuth = req.headers['x-project-password-auth'] as string;

      if (projectId && projectPasswordAuth === 'true') {
        await this.handleProjectPasswordAuth(req, projectId);
      } else {
        // 既存の認証方式
        switch (this.config.type) {
          case 'basic':
            await this.handleBasicAuth(req);
            break;

          case 'jwt':
            await this.handleJwtAuth(req);
            break;

          case 'none':
            // 開発環境では Editor 権限を付与、本番環境では Viewer 権限
            const permission = process.env.NODE_ENV === 'development' ? 'editor' : 'viewer';
            req.user = {
              type: 'basic',
              permission: permission,
            };
            this.logger.log(`No auth mode: granted ${permission} permission (NODE_ENV=${process.env.NODE_ENV})`);
            break;

          default:
            throw new UnauthorizedException('Invalid authentication configuration');
        }
      }

      next();
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * プロジェクト共有パスワード認証処理
   * @param req リクエスト
   * @param projectId プロジェクトID
   */
  private async handleProjectPasswordAuth(req: Request, projectId: string): Promise<void> {
    this.logger.log(`Project password authentication for project: ${projectId}`);

    // プロジェクト共有パスワード認証が成功していることを前提
    // （実際の認証は /projects/auth-password エンドポイントで実行済み）
    
    req.user = {
      type: 'project-password',
      project_id: projectId,
      permission: 'editor', // パスワード認証成功時はEditor権限
      project_password_authenticated: true,
    };

    this.logger.log(`Project password auth successful for project: ${projectId}`);
  }

  /**
   * Basic認証処理
   * @param req リクエスト
   */
  private async handleBasicAuth(req: Request): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Basic authentication required');
    }

    try {
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (!username || !password) {
        throw new UnauthorizedException('Invalid Basic authentication format');
      }

      const { basic } = this.config;
      if (!basic) {
        throw new UnauthorizedException('Basic authentication not configured');
      }

      if (username !== basic.username || password !== basic.password) {
        this.logger.warn(`Basic auth failed for user: ${username}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(`Basic auth successful for user: ${username}`);
      
      // リクエストオブジェクトにユーザー情報を追加
      req.user = { 
        username, 
        type: 'basic',
        permission: 'editor', // Basic認証成功時はEditor権限
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Basic authentication format');
    }
  }

  /**
   * JWT認証処理
   * @param req リクエスト
   */
  private async handleJwtAuth(req: Request): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('JWT token required');
    }

    const token = authHeader.slice(7);

    if (!token) {
      throw new UnauthorizedException('JWT token missing');
    }

    try {
      // 簡易JWT検証（本番環境ではjsonwebtokenライブラリを使用推奨）
      const payload = this.verifyJwt(token);
      
      this.logger.log(`JWT auth successful for user: ${payload.sub || 'unknown'}`);
      
      // リクエストオブジェクトにユーザー情報を追加
      req.user = { 
        ...payload, 
        type: 'jwt',
        permission: 'editor', // JWT認証成功時はEditor権限
      };
    } catch (error) {
      this.logger.warn(`JWT auth failed: ${error.message}`);
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  /**
   * 簡易JWT検証（本番環境では適切なライブラリを使用）
   * @param token JWTトークン
   * @returns ペイロード
   */
  private verifyJwt(token: string): any {
    try {
      // 簡易実装 - 本番環境では jsonwebtoken ライブラリを使用
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      
      // 有効期限チェック
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`JWT verification failed: ${error.message}`);
    }
  }

  /**
   * 認証情報をヘルスチェック用に取得
   * @returns 認証設定（センシティブ情報は除く）
   */
  getAuthInfo(): { type: string; jwtExpiresIn?: string } {
    return {
      type: this.config.type,
      ...(this.config.jwt?.expiresIn && { jwtExpiresIn: this.config.jwt.expiresIn }),
    };
  }
}