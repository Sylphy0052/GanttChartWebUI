import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * アプリケーションのエントリーポイント
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // プロキシ信頼設定（本番環境でのLoad Balancer/Reverse Proxy対応）
  if (process.env.NODE_ENV === 'production') {
    const expressInstance = app.getHttpAdapter().getInstance();
    expressInstance.set('trust proxy', 1);
  }

  // セキュリティミドルウェア（Helmet）の設定
  app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
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
    ? ['https://your-domain.com'] // 本番環境では実際のドメインに変更
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