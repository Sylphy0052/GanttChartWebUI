import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private queryCount = 0;
  private slowQueryThreshold = 100; // ms

  constructor() {
    super({
      // Enhanced configuration for production performance
      datasourceUrl: process.env.DATABASE_URL,
      
      // Logging configuration for performance monitoring
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
      
      // Error formatting
      errorFormat: 'pretty',
      
      // Connection pool configuration (via DATABASE_URL query parameters)
      // Example: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20&schema=public
    });
  }

  async onModuleInit() {
    // Enable query logging and performance monitoring
    this.$on('query' as never, this.handleQuery.bind(this));
    this.$on('error' as never, this.handleError.bind(this));

    await this.$connect();
    this.logger.log('✅ Connected to PostgreSQL database with optimized configuration');
    
    // Log connection pool info
    await this.logConnectionPoolInfo();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('📤 Disconnected from database');
  }

  private handleQuery(event: Prisma.QueryEvent) {
    this.queryCount++;
    const { query, duration, params } = event;
    
    // Log slow queries for performance monitoring
    if (duration > this.slowQueryThreshold) {
      this.logger.warn(`🐌 Slow query detected (${duration}ms):`, {
        query: this.sanitizeQuery(query),
        duration,
        params: params ? JSON.stringify(params).substring(0, 200) : undefined,
        queryNumber: this.queryCount
      });
    }
    
    // Debug logging for development
    if (process.env.NODE_ENV === 'development' && duration > 50) {
      this.logger.debug(`Query ${this.queryCount}: ${duration}ms - ${this.sanitizeQuery(query).substring(0, 100)}...`);
    }
  }

  private handleError(event: Prisma.LogEvent) {
    this.logger.error('❌ Database error:', {
      target: event.target,
      message: event.message,
      timestamp: event.timestamp
    });
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data and normalize for logging
    return query
      .replace(/(\$\d+)/g, '?') // Replace parameter placeholders
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  private async logConnectionPoolInfo() {
    try {
      // Get database connection info
      const result = await this.$queryRaw`
        SELECT 
          datname,
          numbackends,
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted
        FROM pg_stat_database 
        WHERE datname = current_database()
      ` as any[];

      if (result.length > 0) {
        const stats = result[0];
        this.logger.log('📊 Database connection stats:', {
          database: stats.datname,
          activeConnections: stats.numbackends,
          commits: stats.xact_commit,
          rollbacks: stats.xact_rollback,
          cacheHitRatio: stats.blks_hit / (stats.blks_hit + stats.blks_read) * 100
        });
      }
    } catch (error) {
      this.logger.debug('Could not retrieve connection pool info:', error.message);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.$queryRaw`SELECT 1`;
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        this.logger.warn(`Health check slow: ${duration}ms`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('❌ Database health check failed:', error);
      return false;
    }
  }

  /**
   * Execute a transaction with performance monitoring
   */
  async executeTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await this.$transaction(fn, {
        maxWait: options?.maxWait || 5000, // 5 seconds
        timeout: options?.timeout || 10000, // 10 seconds
        isolationLevel: options?.isolationLevel,
      });
      
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        this.logger.warn(`Long transaction detected: ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Transaction failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): { totalQueries: number; avgQueryTime?: number } {
    return {
      totalQueries: this.queryCount
    };
  }

  /**
   * Reset query statistics
   */
  resetQueryStats(): void {
    this.queryCount = 0;
    this.logger.log('Query statistics reset');
  }

  /**
   * Set slow query threshold for logging
   */
  setSlowQueryThreshold(thresholdMs: number): void {
    this.slowQueryThreshold = thresholdMs;
    this.logger.log(`Slow query threshold set to ${thresholdMs}ms`);
  }

  /**
   * Get current database performance metrics
   */
  async getDatabasePerformanceMetrics() {
    try {
      const metrics = await this.$queryRaw`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
          (SELECT sum(xact_commit) FROM pg_stat_database) as total_commits,
          (SELECT sum(xact_rollback) FROM pg_stat_database) as total_rollbacks,
          (SELECT sum(blks_hit) FROM pg_stat_database) as cache_hits,
          (SELECT sum(blks_read) FROM pg_stat_database) as disk_reads,
          (SELECT round((sum(blks_hit) * 100.0) / (sum(blks_hit) + sum(blks_read)), 2) FROM pg_stat_database) as cache_hit_ratio
      ` as any[];

      return metrics[0] || {};
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {};
    }
  }
}