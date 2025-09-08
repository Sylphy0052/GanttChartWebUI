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
    const tableNames = ['Issue', 'Project', 'GlobalSettings'];
    
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
      description_md: 'A test project for E2E testing',
      shared_password_hash: null,
      ...overrides,
    };

    return await this.prisma.project.create({
      data: defaultProject,
    });
  }

  /**
   * テストデータ生成: Issue
   */
  async createTestIssue(projectId: string, overrides: Partial<any> = {}): Promise<any> {
    // パラメータからproject_idを除外し、正しい形式を生成
    const { project_id, parent_id, ...cleanOverrides } = overrides;
    
    const defaultIssue = {
      project: {
        connect: { id: projectId }
      },
      title: 'Test Issue',
      description_md: 'A test issue for E2E testing',
      status: 'open' as const,
      progress_pct: 0,
      start_date: new Date('2024-06-01'),
      end_date: new Date('2024-06-15'),
      assignee: null,
      is_blocked: false,
      sort_order: 0,
      labels: [],
      effort_hours: null,
      ...(parent_id && { parent: { connect: { id: parent_id } } }),
      ...cleanOverrides,
    };

    return await this.prisma.issue.create({
      data: defaultIssue,
    });
  }

  // 後方互換性のため、createTestTaskメソッドも提供
  async createTestTask(projectId: string, overrides: Partial<any> = {}): Promise<any> {
    return this.createTestIssue(projectId, overrides);
  }

  /**
   * テストファイル生成: ZIPファイル
   */
  async createTestZipFile(): Promise<Buffer> {
    const testData = {
      project: {
        name: 'Imported Project',
        description_md: 'Test project from import',
      },
      issues: [
        {
          title: 'Imported Issue 1',
          description_md: 'First imported issue',
          start_date: '2024-01-01',
          end_date: '2024-01-15',
          status: 'open',
          progress_pct: 0,
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
    expect(project).toHaveProperty('description_md');
    expect(project).toHaveProperty('created_at');
    expect(project).toHaveProperty('updated_at');
    expect(project.is_deleted).toBe(false);
  }

  /**
   * UUID形式の検証ヘルパー
   */
  expectValidUuid(uuid: string): void {
    expect(uuid).toMatch(/^c[a-z0-9]{24}$/); // CUID format
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