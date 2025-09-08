/**
 * E2Eテストのセットアップファイル
 * すべてのE2Eテストで共通で使用される設定とヘルパー関数
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * テストアプリケーションのセットアップ
 */
export class TestHelper {
  public app: INestApplication;
  public prisma: PrismaService;
  
  /**
   * テストアプリケーション初期化
   */
  async setupTestApp(): Promise<void> {
    // テスト環境設定
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.AUTH_TYPE = 'basic';
    process.env.BASIC_AUTH_USERNAME = 'testuser';
    process.env.BASIC_AUTH_PASSWORD = 'testpass';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.prisma = this.app.get<PrismaService>(PrismaService);
    
    await this.app.init();
  }

  /**
   * テストデータベース初期化
   */
  async setupTestDatabase(): Promise<void> {
    // テスト用データベースファイルのクリーンアップ
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }

    // マイグレーション実行
    await this.prisma.$executeRaw`PRAGMA foreign_keys = ON;`;
    
    // テーブル作成（必要に応じて）
    await this.createTestTables();
  }

  /**
   * テストテーブル作成
   */
  private async createTestTables(): Promise<void> {
    try {
      // Prismaスキーマから自動生成されるテーブルを使用
      // 実際の運用ではmigrationファイルが適用される
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.warn('Test table creation skipped - using Prisma migrations');
    }
  }

  /**
   * テストデータのクリーンアップ
   */
  async cleanupDatabase(): Promise<void> {
    // テスト後のクリーンアップ
    const tableNames = ['Task', 'Project', 'GlobalSettings'];
    
    for (const tableName of tableNames) {
      try {
        await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}";`);
      } catch (error) {
        // テーブルが存在しない場合は無視
        console.debug(`Table ${tableName} cleanup skipped`);
      }
    }
  }

  /**
   * アプリケーション終了処理
   */
  async teardownApp(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    
    if (this.app) {
      await this.app.close();
    }

    // テストデータベースファイル削除
    const dbPath = path.resolve('./test.db');
    if (await fs.pathExists(dbPath)) {
      await fs.remove(dbPath);
    }
  }

  /**
   * Basic認証ヘッダーを生成
   */
  createBasicAuthHeader(username: string = 'testuser', password: string = 'testpass'): string {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  /**
   * プロジェクトパスワード認証ヘッダーを生成
   */
  createProjectPasswordHeaders(projectId: string): { [key: string]: string } {
    return {
      'x-project-id': projectId,
      'x-project-password-auth': 'true',
    };
  }

  /**
   * テストデータ生成: プロジェクト
   */
  async createTestProject(overrides: Partial<any> = {}): Promise<any> {
    const defaultProject = {
      name: 'Test Project',
      description: 'A test project for E2E testing',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31'),
      status: 'active',
      shared_password_hash: null,
      ...overrides,
    };

    return await this.prisma.project.create({
      data: defaultProject,
    });
  }

  /**
   * テストデータ生成: タスク
   */
  async createTestTask(projectId: string, overrides: Partial<any> = {}): Promise<any> {
    const defaultTask = {
      project_id: projectId,
      name: 'Test Task',
      description: 'A test task for E2E testing',
      start_date: new Date('2024-06-01'),
      end_date: new Date('2024-06-15'),
      status: 'pending',
      progress: 0,
      assignee: null,
      dependencies: [],
      ...overrides,
    };

    return await this.prisma.task.create({
      data: defaultTask,
    });
  }

  /**
   * テストファイル生成: ZIPファイル
   */
  async createTestZipFile(): Promise<Buffer> {
    const testData = {
      project: {
        name: 'Imported Project',
        description: 'Test project from import',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'active',
      },
      tasks: [
        {
          name: 'Imported Task 1',
          description: 'First imported task',
          start_date: '2024-01-01',
          end_date: '2024-01-15',
          status: 'pending',
          progress: 0,
        },
      ],
    };

    // 簡易ZIP作成（実際の実装ではarchiverライブラリを使用）
    const jsonString = JSON.stringify(testData, null, 2);
    return Buffer.from(jsonString);
  }

  /**
   * レスポンス検証ヘルパー
   */
  expectValidProject(project: any): void {
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('description');
    expect(project).toHaveProperty('start_date');
    expect(project).toHaveProperty('end_date');
    expect(project).toHaveProperty('status');
    expect(project).toHaveProperty('created_at');
    expect(project).toHaveProperty('updated_at');
    expect(project.deleted_at).toBeNull();
  }

  /**
   * エラーレスポンス検証ヘルパー
   */
  expectErrorResponse(response: any, statusCode: number, messageContains?: string): void {
    expect(response.status).toBe(statusCode);
    if (messageContains) {
      expect(response.body.message).toContain(messageContains);
    }
  }
}

// グローバルなテストヘルパーインスタンス
export const testHelper = new TestHelper();

// Jestグローバル設定
beforeAll(async () => {
  await testHelper.setupTestApp();
  await testHelper.setupTestDatabase();
}, 60000);

afterAll(async () => {
  await testHelper.teardownApp();
}, 30000);

afterEach(async () => {
  await testHelper.cleanupDatabase();
});