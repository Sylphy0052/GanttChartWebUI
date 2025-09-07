import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService - データベース接続とPrismaクライアント管理
 * 
 * 機能:
 * - PrismaClientの初期化と管理
 * - アプリケーション起動時のDB接続確立
 * - アプリケーション終了時の安全な接続切断
 * - トランザクション処理のサポート
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  
  /**
   * コンストラクタ - Prismaクライアントを初期化
   */
  constructor() {
    super({
      // エラーログを有効化（開発環境）
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      // 接続エラー時の動作
      errorFormat: 'pretty',
    });
  }

  /**
   * モジュール初期化時にデータベース接続を確立
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      console.log('✅ Database connection established successfully');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * モジュール終了時にデータベース接続を安全に切断
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      console.log('✅ Database connection closed successfully');
    } catch (error) {
      console.error('❌ Error during database disconnection:', error);
    }
  }

  /**
   * データベース接続状態をテスト
   * @returns Promise<boolean> - 接続成功時true
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * トランザクション実行のヘルパーメソッド
   * @param fn - トランザクション内で実行する関数
   * @returns Promise<T> - 実行結果
   */
  async executeTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return await this.$transaction(fn);
  }
}