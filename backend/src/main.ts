import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * プロダクション環境でのセキュリティ設定検証
 */
function validateProductionEnvironment(): void {
  const logger = new Logger('SecurityValidation');
  
  if (process.env.NODE_ENV !== 'production') {
    return; // 本番環境以外では検証をスキップ
  }

  const requiredVars = ['JWT_SECRET', 'DATABASE_URL'];
  const missingVars: string[] = [];
  const insecureVars: string[] = [];

  // 必須環境変数の存在チェック
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // セキュリティ関連の危険な設定チェック
  if (process.env.JWT_SECRET === 'change-this-to-a-strong-secret-key-in-production') {
    insecureVars.push('JWT_SECRET (using default value)');
  }
  
  if (process.env.BASIC_AUTH_PASSWORD === 'change-this-secure-password') {
    insecureVars.push('BASIC_AUTH_PASSWORD (using default value)');
  }

  if (process.env.AUTH_TYPE === 'none') {
    insecureVars.push('AUTH_TYPE (authentication disabled)');
  }

  // JWT秘密鍵の強度チェック
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    insecureVars.push('JWT_SECRET (too short, minimum 32 characters recommended)');
  }

  // エラーがある場合は起動を停止
  if (missingVars.length > 0 || insecureVars.length > 0) {
    logger.error('🚨 PRODUCTION SECURITY VALIDATION FAILED');
    
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    if (insecureVars.length > 0) {
      logger.error(`Insecure configuration detected: ${insecureVars.join(', ')}`);
    }
    
    logger.error('Please review your .env.production file and ensure all security settings are properly configured.');
    process.exit(1);
  }

  logger.log('✅ Production security validation passed');
}

/**
 * アプリケーションのエントリーポイント
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // プロダクション環境でのセキュリティ検証
  validateProductionEnvironment();
  
  const app = await NestFactory.create(AppModule);

  // プロキシ信頼設定（本番環境でのLoad Balancer/Reverse Proxy対応）
  if (process.env.NODE_ENV === 'production') {
    const expressInstance = app.getHttpAdapter().getInstance();
    expressInstance.set('trust proxy', 1);
  }

  // セキュリティミドルウェア（Helmet）の設定
  app.use(helmet({
    // Content Security Policy（強化版）
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: process.env.NODE_ENV === 'production' 
          ? ["'self'"] // 本番環境では厳格化
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 開発環境では緩和
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: process.env.NODE_ENV === 'production' 
          ? ["'self'", "wss:"] // 本番環境ではWSS（暗号化）のみ
          : ["'self'", "ws:", "wss:"], // 開発環境ではWSも許可
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // Cross Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // WebSocket接続のため無効化
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // HSTS (HTTPSが有効な場合のみ)
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    // X-Frame-Options
    frameguard: { action: 'deny' },
    // X-Content-Type-Options
    noSniff: true,
    // X-XSS-Protection
    xssFilter: true,
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,
  }));

  // レート制限の設定
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分
    max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // 本番: 1000req/min, 開発: 10000req/min
    message: {
      error: 'Too many requests from this IP',
      retryAfter: 60
    },
    standardHeaders: true, // X-RateLimit-* ヘッダーを返す
    legacyHeaders: false, // X-RateLimit-* の古い形式を無効化
    // 除外パス（ヘルスチェックなど）
    skip: (req) => {
      return req.path === '/health' || req.path === '/nginx_status';
    }
  });

  // 認証関連エンドポイント用の厳格なレート制限
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 15分間に5回まで
    message: {
      error: 'Too many authentication attempts',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // レート制限の適用
  app.use(limiter);
  
  // 認証関連のパスに厳格なレート制限を適用
  app.use('/projects/*/auth', authLimiter);
  app.use('/auth', authLimiter);

  // グローバルバリデーションパイプ設定（セキュリティ強化）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOで定義されていないプロパティを除外
      forbidNonWhitelisted: true, // 未定義プロパティがあればエラー
      transform: true, // 自動型変換
      transformOptions: {
        enableImplicitConversion: true, // 暗黙的型変換を有効化
      },
      stopAtFirstError: false, // 複数エラーを返す
      disableErrorMessages: process.env.NODE_ENV === 'production', // 本番環境では詳細エラーを隠す
    }),
  );

  // グローバル例外フィルター設定
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS設定（セキュリティ強化）
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com']) // 環境変数から取得
    : ['http://localhost:3000', 'http://localhost:3011', 'http://localhost:5173'];

  app.enableCors({
    origin: (origin, callback) => {
      // Origin が undefined の場合（同一オリジンリクエスト）は許可
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // プリフライトキャッシュ時間（24時間）
  });

  // ポート設定 - Dockerコンテナ内では0.0.0.0でバインド
  const port = process.env.PORT || 3001;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
  
  await app.listen(port, host);
  logger.log(`🚀 Application is running on: http://${host}:${port}`);
  logger.log(`🔒 Security features enabled: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'} mode`);
  logger.log('📊 Available endpoints:');
  logger.log('  GET    /health - Health check');
  logger.log('  GET    /projects - Get all projects');
  logger.log('  POST   /projects - Create project');
  logger.log('  GET    /projects/:id - Get project by ID');
  logger.log('  PATCH  /projects/:id - Update project');
  logger.log('  DELETE /projects/:id - Delete project');
  logger.log(`⚡ Rate limits: ${process.env.NODE_ENV === 'production' ? '1000' : '10000'} req/min`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Application failed to start:', error);
  process.exit(1);
});