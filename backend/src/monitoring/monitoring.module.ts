import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

/**
 * MonitoringModule - アプリケーション監視機能の提供
 * 
 * 機能:
 * - Prometheusメトリクス収集
 * - カスタムビジネスメトリクス管理
 * - パフォーマンス監視
 * - メトリクス公開エンドポイント
 */
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService], // 他のモジュールからも使用可能
})
export class MonitoringModule {}