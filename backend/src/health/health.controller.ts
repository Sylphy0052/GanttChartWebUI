import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getHealthStatus() {
    try {
      const startTime = Date.now();

      // データベース接続確認
      const dbHealth = await this.checkDatabaseHealth();
      
      // パフォーマンス測定
      const perfHealth = await this.checkPerformanceHealth();

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        response_time_ms: responseTime,
        environment: process.env.NODE_ENV,
        database: dbHealth,
        performance: perfHealth,
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        environment: process.env.NODE_ENV
      };
    }
  }

  /**
   * Prometheus メトリクス形式でのヘルスメトリクス出力
   * /health/metrics エンドポイント
   */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getPrometheusMetrics() {
    try {
      const startTime = Date.now();
      
      // データベース健全性確認
      const dbHealth = await this.checkDatabaseHealth();
      const perfHealth = await this.checkPerformanceHealth();
      const responseTime = Date.now() - startTime;
      
      const metrics = [];
      
      // 基本健全性メトリクス
      metrics.push('# HELP gantt_health_status Application health status (1=healthy, 0=unhealthy)');
      metrics.push('# TYPE gantt_health_status gauge');
      metrics.push(`gantt_health_status 1`);
      
      // レスポンス時間メトリクス
      metrics.push('# HELP gantt_health_response_time_ms Health check response time in milliseconds');
      metrics.push('# TYPE gantt_health_response_time_ms gauge');
      metrics.push(`gantt_health_response_time_ms ${responseTime}`);
      
      // データベースメトリクス
      metrics.push('# HELP gantt_database_status Database connection status (1=healthy, 0=unhealthy)');
      metrics.push('# TYPE gantt_database_status gauge');
      metrics.push(`gantt_database_status ${dbHealth.status === 'healthy' ? 1 : 0}`);
      
      if (dbHealth.response_time_ms !== undefined) {
        metrics.push('# HELP gantt_database_response_time_ms Database query response time in milliseconds');
        metrics.push('# TYPE gantt_database_response_time_ms gauge');
        metrics.push(`gantt_database_response_time_ms ${dbHealth.response_time_ms}`);
      }
      
      // メモリメトリクス
      const memoryUsage = process.memoryUsage();
      metrics.push('# HELP gantt_memory_heap_used_bytes Node.js heap memory used in bytes');
      metrics.push('# TYPE gantt_memory_heap_used_bytes gauge');
      metrics.push(`gantt_memory_heap_used_bytes ${memoryUsage.heapUsed}`);
      
      metrics.push('# HELP gantt_memory_heap_total_bytes Node.js heap memory total in bytes');
      metrics.push('# TYPE gantt_memory_heap_total_bytes gauge');
      metrics.push(`gantt_memory_heap_total_bytes ${memoryUsage.heapTotal}`);
      
      metrics.push('# HELP gantt_memory_rss_bytes Node.js RSS memory in bytes');
      metrics.push('# TYPE gantt_memory_rss_bytes gauge');
      metrics.push(`gantt_memory_rss_bytes ${memoryUsage.rss}`);
      
      // プロセス稼働時間メトリクス
      metrics.push('# HELP gantt_process_uptime_seconds Process uptime in seconds');
      metrics.push('# TYPE gantt_process_uptime_seconds counter');
      metrics.push(`gantt_process_uptime_seconds ${process.uptime()}`);
      
      return metrics.join('\n') + '\n';
      
    } catch (error) {
      const metrics = [];
      metrics.push('# HELP gantt_health_status Application health status (1=healthy, 0=unhealthy)');
      metrics.push('# TYPE gantt_health_status gauge');
      metrics.push(`gantt_health_status 0`);
      
      metrics.push('# HELP gantt_health_error Health check error indicator');
      metrics.push('# TYPE gantt_health_error gauge');
      metrics.push(`gantt_health_error 1`);
      
      return metrics.join('\n') + '\n';
    }
  }

  /**
   * データベース健全性チェック
   */
  private async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      await this.prismaService.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        response_time_ms: responseTime,
        connection: 'active'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  /**
   * パフォーマンス健全性チェック
   */
  private async checkPerformanceHealth() {
    try {
      const perfMetrics: {
        response_times: { basic_response_ms?: number };
        database_performance: { simple_query_ms?: number };
        memory_performance: { 
          heap_used_mb?: number; 
          heap_total_mb?: number; 
          external_mb?: number; 
          rss_mb?: number; 
        };
      } = {
        response_times: {},
        database_performance: {},
        memory_performance: {},
      };

      // 基本レスポンス時間測定
      const basicStartTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1)); // 最小遅延
      perfMetrics.response_times.basic_response_ms = Date.now() - basicStartTime;

      // データベースパフォーマンス測定
      const dbStartTime = Date.now();
      await this.prismaService.$queryRaw`SELECT 1`;
      perfMetrics.database_performance.simple_query_ms = Date.now() - dbStartTime;

      // メモリ使用量パフォーマンス
      const memoryUsage = process.memoryUsage();
      perfMetrics.memory_performance = {
        heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
      };

      // パフォーマンス判定
      let status = 'healthy';
      const warnings = [];

      if (perfMetrics.database_performance.simple_query_ms && perfMetrics.database_performance.simple_query_ms > 100) {
        status = 'degraded';
        warnings.push('Database response time high');
      }

      if (perfMetrics.memory_performance.heap_used_mb && perfMetrics.memory_performance.heap_used_mb > 512) {
        if (status !== 'degraded') status = 'degraded';
        warnings.push('High heap memory usage');
      }

      return {
        status,
        warnings,
        metrics: perfMetrics
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }
}