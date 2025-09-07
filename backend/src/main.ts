import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * アプリケーションのエントリーポイント
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // グローバルバリデーションパイプ設定
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOで定義されていないプロパティを除外
      forbidNonWhitelisted: true, // 未定義プロパティがあればエラー
      transform: true, // 自動型変換
      transformOptions: {
        enableImplicitConversion: true, // 暗黙的型変換を有効化
      },
      stopAtFirstError: false, // 複数エラーを返す
    }),
  );

  // グローバル例外フィルター設定
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS設定（開発環境用）
  if (process.env.NODE_ENV === 'development') {
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    });
  }

  // ポート設定
  const port = process.env.PORT || 3001;
  
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log('📊 Available endpoints:');
  logger.log('  GET    /health - Health check');
  logger.log('  GET    /projects - Get all projects');
  logger.log('  POST   /projects - Create project');
  logger.log('  GET    /projects/:id - Get project by ID');
  logger.log('  PATCH  /projects/:id - Update project');
  logger.log('  DELETE /projects/:id - Delete project');
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Application failed to start:', error);
  process.exit(1);
});