import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * HealthController - アプリケーションとデータベースのヘルスチェック
 * 
 * 機能:
 * - アプリケーションの稼働状態確認
 * - データベース接続状態の確認
 * - 監視・運用での健全性チェック
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * ヘルスチェックエンドポイント
   * アプリケーションとデータベースの状態を確認
   * 
   * @returns {object} ヘルスチェック結果
   */
  @Get()
  async checkHealth() {
    console.log('Health check endpoint called');
    
    try {
      // データベース接続テスト
      const isDbHealthy = await this.prismaService.testConnection();
      console.log('Database test result:', isDbHealthy);
      
      if (!isDbHealthy) {
        return {
          status: 'error',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          database: {
            status: 'unhealthy',
            connected: false,
          },
        };
      }

      return {
        status: 'ok',
        message: 'All systems operational',
        timestamp: new Date().toISOString(),
        database: {
          status: 'healthy',
          connected: true,
        },
      };
    } catch (error) {
      console.error('Health check error:', error);
      
      return {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error',
      };
    }
  }
}