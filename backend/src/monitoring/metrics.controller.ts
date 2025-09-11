import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * MetricsController - Prometheusメトリクス公開エンドポイント
 * 
 * 機能:
 * - Prometheus形式でのメトリクス公開
 * - メトリクス統計情報の提供
 * - 監視システムとの統合
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Prometheusメトリクスエンドポイント
   * Prometheus形式でアプリケーションメトリクスを公開
   * 
   * @returns {string} Prometheus形式のメトリクス
   */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    console.log('Prometheus metrics endpoint called');
    return await this.metricsService.getPrometheusMetrics();
  }

  /**
   * メトリクス統計情報エンドポイント
   * 開発・運用での監視状況確認用
   * 
   * @returns {object} メトリクス統計情報
   */
  @Get('stats')
  getMetricsStats() {
    console.log('Metrics stats endpoint called');
    return {
      timestamp: new Date().toISOString(),
      stats: this.metricsService.getMetricsStats(),
    };
  }
}