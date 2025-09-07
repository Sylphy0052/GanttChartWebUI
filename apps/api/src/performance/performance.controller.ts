import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaPerformanceService } from '../prisma/prisma-performance.service';

interface IndexUsageStat {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_tup_read: number;
  idx_tup_fetch: number;
  idx_scan: number;
  usage_level: string;
}

interface TableMetric {
  schemaname: string;
  tablename: string;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
  n_live_tup: number;
  n_dead_tup: number;
  last_vacuum: Date | null;
  last_autovacuum: Date | null;
  last_analyze: Date | null;
  last_autoanalyze: Date | null;
}

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaPerf: PrismaPerformanceService,
  ) {}

  @Get('database-metrics')
  @ApiOperation({ 
    summary: 'Get database performance metrics',
    description: 'Returns connection stats, cache hit ratio, and query performance data'
  })
  @ApiResponse({ status: 200, description: 'Database metrics retrieved successfully' })
  async getDatabaseMetrics() {
    const [
      connectionStats,
      queryStats,
      performanceStats,
      indexUsage
    ] = await Promise.all([
      this.prisma.getDatabasePerformanceMetrics(),
      this.prisma.getQueryStats(),
      this.prismaPerf.getPerformanceStats(),
      this.prismaPerf.getIndexUsageStats()
    ]);

    return {
      connection: connectionStats,
      queries: {
        ...queryStats,
        ...performanceStats
      },
      indexes: {
        usage: indexUsage.result,
        retrievedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }

  @Get('query-performance')
  @ApiOperation({ 
    summary: 'Get query performance statistics',
    description: 'Returns the slowest queries and performance metrics'
  })
  @ApiResponse({ status: 200, description: 'Query performance data retrieved' })
  async getQueryPerformance() {
    return this.prismaPerf.getPerformanceStats();
  }

  @Get('slow-queries')
  @ApiOperation({ 
    summary: 'Get slow query analysis',
    description: 'Returns queries that exceed performance thresholds'
  })
  @ApiResponse({ status: 200, description: 'Slow queries analysis completed' })
  async getSlowQueries(@Query('threshold') threshold?: string) {
    const thresholdMs = threshold ? parseInt(threshold) : 100;
    
    const stats = this.prismaPerf.getPerformanceStats();
    const slowQueries = stats.slowestQueries.filter(q => q.avgTime > thresholdMs);

    return {
      threshold: thresholdMs,
      slowQueryCount: slowQueries.length,
      slowQueries,
      recommendations: this.generateOptimizationRecommendations(slowQueries)
    };
  }

  @Get('index-usage')
  @ApiOperation({ 
    summary: 'Get database index usage statistics',
    description: 'Returns which indexes are being used and their efficiency'
  })
  @ApiResponse({ status: 200, description: 'Index usage statistics retrieved' })
  async getIndexUsage() {
    const { result: indexStats } = await this.prismaPerf.getIndexUsageStats();
    const indexArray = Array.isArray(indexStats) ? indexStats as IndexUsageStat[] : [];
    
    return {
      indexes: indexArray,
      analysis: {
        totalIndexes: indexArray.length,
        unusedIndexes: indexArray.filter(idx => idx.usage_level === 'Unused').length,
        highUsageIndexes: indexArray.filter(idx => idx.usage_level === 'High Usage').length
      },
      retrievedAt: new Date().toISOString()
    };
  }

  @Get('connection-pool')
  @ApiOperation({ 
    summary: 'Get connection pool status',
    description: 'Returns current database connection pool information'
  })
  @ApiResponse({ status: 200, description: 'Connection pool status retrieved' })
  async getConnectionPoolStatus() {
    const metrics = await this.prisma.getDatabasePerformanceMetrics();
    
    return {
      activeConnections: metrics.active_connections || 0,
      idleConnections: metrics.idle_connections || 0,
      totalConnections: (metrics.active_connections || 0) + (metrics.idle_connections || 0),
      cacheHitRatio: metrics.cache_hit_ratio || 0,
      totalCommits: metrics.total_commits || 0,
      totalRollbacks: metrics.total_rollbacks || 0,
      healthStatus: await this.prisma.isHealthy() ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    };
  }

  @Post('reset-stats')
  @ApiOperation({ 
    summary: 'Reset performance statistics',
    description: 'Clears all collected performance data and starts fresh'
  })
  @ApiResponse({ status: 200, description: 'Performance statistics reset successfully' })
  async resetPerformanceStats() {
    this.prisma.resetQueryStats();
    this.prismaPerf.resetPerformanceStats();
    
    return {
      message: 'Performance statistics have been reset',
      timestamp: new Date().toISOString()
    };
  }

  @Get('table-stats')
  @ApiOperation({ 
    summary: 'Get database table statistics',
    description: 'Returns row counts, update frequencies, and vacuum information'
  })
  @ApiResponse({ status: 200, description: 'Table statistics retrieved' })
  async getTableStats() {
    const { result: tableMetrics } = await this.prismaPerf.getDatabaseMetrics();
    const metricsArray = Array.isArray(tableMetrics) ? tableMetrics as TableMetric[] : [];
    
    const mostActiveTable = metricsArray.length > 0 
      ? metricsArray.reduce((prev, current) => 
          (prev.n_live_tup > current.n_live_tup) ? prev : current
        )
      : null;

    const tablesNeedingVacuum = metricsArray.filter(table => {
      const deadRatio = table.n_dead_tup / (table.n_live_tup || 1);
      return deadRatio > 0.1; // More than 10% dead tuples
    });

    const analysis = {
      totalTables: metricsArray.length,
      mostActiveTable,
      tablesNeedingVacuum: tablesNeedingVacuum.length
    };

    return {
      tables: metricsArray,
      analysis,
      retrievedAt: new Date().toISOString()
    };
  }

  @Get('performance-report')
  @ApiOperation({ 
    summary: 'Get comprehensive performance report',
    description: 'Returns a complete performance analysis with recommendations'
  })
  @ApiResponse({ status: 200, description: 'Performance report generated' })
  async getPerformanceReport() {
    const [
      dbMetrics,
      queryStats,
      indexUsage,
      tableStats
    ] = await Promise.all([
      this.prisma.getDatabasePerformanceMetrics(),
      this.prismaPerf.getPerformanceStats(),
      this.prismaPerf.getIndexUsageStats(),
      this.prismaPerf.getDatabaseMetrics()
    ]);

    const slowQueries = queryStats.slowestQueries.filter(q => q.avgTime > 100);
    const indexArray = Array.isArray(indexUsage.result) ? indexUsage.result as IndexUsageStat[] : [];
    const unusedIndexes = indexArray.filter(idx => idx.usage_level === 'Unused');

    return {
      summary: {
        overallHealth: this.calculateOverallHealth(dbMetrics, slowQueries.length),
        cacheHitRatio: dbMetrics.cache_hit_ratio || 0,
        activeConnections: dbMetrics.active_connections || 0,
        slowQueryCount: slowQueries.length,
        unusedIndexCount: unusedIndexes.length
      },
      metrics: {
        database: dbMetrics,
        queries: queryStats,
        tables: tableStats.result
      },
      recommendations: [
        ...this.generateOptimizationRecommendations(slowQueries),
        ...this.generateIndexRecommendations(unusedIndexes),
        ...this.generateConnectionRecommendations(dbMetrics)
      ],
      generatedAt: new Date().toISOString()
    };
  }

  private generateOptimizationRecommendations(slowQueries: any[]): string[] {
    const recommendations: string[] = [];
    
    if (slowQueries.length > 5) {
      recommendations.push('Consider adding indexes for frequently used WHERE clauses');
    }
    
    if (slowQueries.some(q => q.avgTime > 500)) {
      recommendations.push('Review queries taking over 500ms - consider query optimization');
    }
    
    if (slowQueries.some(q => q.query && q.query.includes('SELECT *'))) {
      recommendations.push('Replace SELECT * with specific column selection');
    }
    
    return recommendations;
  }

  private generateIndexRecommendations(unusedIndexes: IndexUsageStat[]): string[] {
    const recommendations: string[] = [];
    
    if (unusedIndexes.length > 3) {
      recommendations.push(`Consider removing ${unusedIndexes.length} unused indexes to improve write performance`);
    }
    
    return recommendations;
  }

  private generateConnectionRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.active_connections && metrics.active_connections > 50) {
      recommendations.push('High number of active connections - consider connection pooling optimization');
    }
    
    if (metrics.cache_hit_ratio && metrics.cache_hit_ratio < 95) {
      recommendations.push('Low cache hit ratio - consider increasing shared_buffers');
    }
    
    return recommendations;
  }

  private calculateOverallHealth(metrics: any, slowQueryCount: number): 'excellent' | 'good' | 'needs_attention' | 'critical' {
    const cacheHitRatio = metrics.cache_hit_ratio || 0;
    const activeConnections = metrics.active_connections || 0;
    
    if (cacheHitRatio > 98 && activeConnections < 20 && slowQueryCount < 3) {
      return 'excellent';
    } else if (cacheHitRatio > 95 && activeConnections < 40 && slowQueryCount < 5) {
      return 'good';
    } else if (cacheHitRatio > 90 && activeConnections < 60 && slowQueryCount < 10) {
      return 'needs_attention';
    } else {
      return 'critical';
    }
  }
}