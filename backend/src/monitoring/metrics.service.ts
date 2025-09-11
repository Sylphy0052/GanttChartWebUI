import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface MetricCollection {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: Record<string, string>;
}

/**
 * MetricsService - Prometheusメトリクス収集サービス
 * 
 * 機能:
 * - カスタムビジネスメトリクス収集
 * - HTTPリクエストメトリクス
 * - データベースメトリクス
 * - WebSocketメトリクス
 * - システムパフォーマンスメトリクス
 */
@Injectable()
export class MetricsService {
  private metrics: Map<string, MetricCollection> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private dbOperationTimes: number[] = [];
  private websocketConnections = 0;
  private websocketMessages = 0;

  constructor(private readonly prismaService: PrismaService) {
    this.initializeDefaultMetrics();
  }

  /**
   * デフォルトメトリクスの初期化
   */
  private initializeDefaultMetrics() {
    this.setMetric('app_info', {
      name: 'app_info',
      help: 'Application information',
      type: 'gauge',
      value: 1,
      labels: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'unknown',
        node_version: process.version,
      }
    });

    this.setMetric('nodejs_memory_heap_used_bytes', {
      name: 'nodejs_memory_heap_used_bytes',
      help: 'Process heap memory usage in bytes',
      type: 'gauge',
      value: 0,
    });

    this.setMetric('nodejs_memory_heap_total_bytes', {
      name: 'nodejs_memory_heap_total_bytes',
      help: 'Process heap memory total in bytes',
      type: 'gauge',
      value: 0,
    });

    this.setMetric('http_requests_total', {
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      type: 'counter',
      value: 0,
    });

    this.setMetric('http_request_duration_seconds', {
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      type: 'histogram',
      value: 0,
    });

    this.setMetric('database_operations_total', {
      name: 'database_operations_total',
      help: 'Total number of database operations',
      type: 'counter',
      value: 0,
    });

    this.setMetric('database_operation_duration_seconds', {
      name: 'database_operation_duration_seconds',
      help: 'Database operation duration in seconds',
      type: 'histogram',
      value: 0,
    });

    this.setMetric('websocket_connections_active', {
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      type: 'gauge',
      value: 0,
    });

    this.setMetric('websocket_messages_total', {
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      type: 'counter',
      value: 0,
    });

    // ビジネスメトリクス
    this.setMetric('gantt_projects_total', {
      name: 'gantt_projects_total',
      help: 'Total number of projects',
      type: 'gauge',
      value: 0,
    });

    this.setMetric('gantt_issues_total', {
      name: 'gantt_issues_total',
      help: 'Total number of issues',
      type: 'gauge',
      value: 0,
    });

    this.setMetric('gantt_dependencies_total', {
      name: 'gantt_dependencies_total',
      help: 'Total number of issue dependencies',
      type: 'gauge',
      value: 0,
    });
  }

  /**
   * メトリクスの設定
   */
  private setMetric(name: string, metric: MetricCollection) {
    this.metrics.set(name, metric);
  }

  /**
   * HTTPリクエストメトリクスの記録
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number) {
    const key = `${method}_${path}_${statusCode}`;
    
    // リクエスト数をカウント
    const currentCount = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, currentCount + 1);

    // レスポンス時間を記録
    if (!this.responseTimes.has(key)) {
      this.responseTimes.set(key, []);
    }
    this.responseTimes.get(key)!.push(duration);

    // メトリクス更新
    this.setMetric('http_requests_total', {
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      type: 'counter',
      value: Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0),
      labels: { method, path, status_code: statusCode.toString() }
    });

    this.setMetric('http_request_duration_seconds', {
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      type: 'histogram',
      value: duration / 1000, // ミリ秒から秒に変換
      labels: { method, path }
    });
  }

  /**
   * データベース操作メトリクスの記録
   */
  recordDatabaseOperation(operation: string, duration: number) {
    this.dbOperationTimes.push(duration);
    
    const currentCount = this.metrics.get('database_operations_total')?.value || 0;
    this.setMetric('database_operations_total', {
      name: 'database_operations_total',
      help: 'Total number of database operations',
      type: 'counter',
      value: currentCount + 1,
      labels: { operation }
    });

    this.setMetric('database_operation_duration_seconds', {
      name: 'database_operation_duration_seconds',
      help: 'Database operation duration in seconds',
      type: 'histogram',
      value: duration / 1000,
      labels: { operation }
    });
  }

  /**
   * WebSocket接続数の更新
   */
  updateWebSocketConnections(count: number) {
    this.websocketConnections = count;
    this.setMetric('websocket_connections_active', {
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      type: 'gauge',
      value: count,
    });
  }

  /**
   * WebSocketメッセージ数の記録
   */
  recordWebSocketMessage(type: 'sent' | 'received') {
    this.websocketMessages++;
    this.setMetric('websocket_messages_total', {
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      type: 'counter',
      value: this.websocketMessages,
      labels: { type }
    });
  }

  /**
   * メモリ使用量の更新
   */
  updateMemoryMetrics() {
    const memoryUsage = process.memoryUsage();
    
    this.setMetric('nodejs_memory_heap_used_bytes', {
      name: 'nodejs_memory_heap_used_bytes',
      help: 'Process heap memory usage in bytes',
      type: 'gauge',
      value: memoryUsage.heapUsed,
    });

    this.setMetric('nodejs_memory_heap_total_bytes', {
      name: 'nodejs_memory_heap_total_bytes',
      help: 'Process heap memory total in bytes',
      type: 'gauge',
      value: memoryUsage.heapTotal,
    });
  }

  /**
   * ビジネスメトリクスの更新
   */
  async updateBusinessMetrics() {
    try {
      // プロジェクト数の取得
      const projectCount = await this.prismaService.project.count({
        where: { is_deleted: false }
      });

      this.setMetric('gantt_projects_total', {
        name: 'gantt_projects_total',
        help: 'Total number of active projects',
        type: 'gauge',
        value: projectCount,
      });

      // Issue数の取得
      const issueCount = await this.prismaService.issue.count({
        where: { is_deleted: false }
      });

      this.setMetric('gantt_issues_total', {
        name: 'gantt_issues_total',
        help: 'Total number of active issues',
        type: 'gauge',
        value: issueCount,
      });

      // 依存関係数の取得
      const dependencyCount = await this.prismaService.dependency.count();

      this.setMetric('gantt_dependencies_total', {
        name: 'gantt_dependencies_total',
        help: 'Total number of issue dependencies',
        type: 'gauge',
        value: dependencyCount,
      });

    } catch (error) {
      console.error('Failed to update business metrics:', error);
    }
  }

  /**
   * Prometheus形式でメトリクスを取得
   */
  async getPrometheusMetrics(): Promise<string> {
    // 最新のメトリクスを更新
    this.updateMemoryMetrics();
    await this.updateBusinessMetrics();

    let output = '';

    for (const [name, metric] of this.metrics) {
      // メトリクスヘルプとタイプ
      output += `# HELP ${metric.name} ${metric.help}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;

      // メトリクス値
      if (metric.labels && Object.keys(metric.labels).length > 0) {
        const labelString = Object.entries(metric.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        output += `${metric.name}{${labelString}} ${metric.value}\n`;
      } else {
        output += `${metric.name} ${metric.value}\n`;
      }
      output += '\n';
    }

    // HTTPリクエストの詳細メトリクス
    for (const [key, count] of this.requestCounts) {
      const [method, path, statusCode] = key.split('_');
      output += `http_requests_total{method="${method}",path="${path}",status_code="${statusCode}"} ${count}\n`;
    }

    // レスポンス時間のヒストグラム
    for (const [key, times] of this.responseTimes) {
      const [method, path] = key.split('_').slice(0, 2);
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      output += `http_request_duration_seconds{method="${method}",path="${path}"} ${avg / 1000}\n`;
    }

    return output;
  }

  /**
   * メトリクス統計の取得
   */
  getMetricsStats() {
    return {
      total_metrics: this.metrics.size,
      http_requests: Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0),
      db_operations: this.dbOperationTimes.length,
      websocket_connections: this.websocketConnections,
      websocket_messages: this.websocketMessages,
      memory_heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }

  /**
   * メトリクスのリセット（テスト用）
   */
  resetMetrics() {
    this.requestCounts.clear();
    this.responseTimes.clear();
    this.dbOperationTimes.length = 0;
    this.websocketConnections = 0;
    this.websocketMessages = 0;
    this.initializeDefaultMetrics();
  }
}