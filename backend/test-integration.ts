/**
 * 統合テスト: NestJS + Prisma 統合の確認
 * 
 * 受け入れ条件：
 * 1. NestJSアプリケーションが正常に起動する
 * 2. /healthエンドポイントでDB接続状態が確認できる
 * 3. Prismaサービスが他のモジュールで注入可能
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/database/prisma.service';
import { HealthController } from './src/health/health.controller';

describe('NestJS-Prisma Integration', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let healthController: HealthController;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);
    healthController = app.get<HealthController>(HealthController);
  });

  afterAll(async () => {
    await app.close();
  });

  it('受け入れ条件1: NestJSアプリケーションが正常に起動する', () => {
    expect(app).toBeDefined();
    expect(prismaService).toBeDefined();
    expect(healthController).toBeDefined();
  });

  it('受け入れ条件2: /healthエンドポイントでDB接続状態が確認できる', async () => {
    const result = await healthController.checkHealth();
    
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.database).toBeDefined();
  });

  it('受け入れ条件3: Prismaサービスが他のモジュールで注入可能', () => {
    expect(prismaService).toBeInstanceOf(PrismaService);
    expect(typeof prismaService.testConnection).toBe('function');
    expect(typeof prismaService.$connect).toBe('function');
    expect(typeof prismaService.$disconnect).toBe('function');
  });

  it('データベース接続テストが機能する', async () => {
    const isConnected = await prismaService.testConnection();
    expect(typeof isConnected).toBe('boolean');
  });
});

console.log('✅ 統合テスト設定完了');
console.log('実行: npm test -- test-integration.ts');