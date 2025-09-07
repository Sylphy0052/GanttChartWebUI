import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

interface QueryMetrics {
  count: number;
  totalTime: number;
  avgTime: number;
}

@Injectable()
export class PrismaPerformanceService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaPerformanceService.name);
  private queryMetrics = new Map<string, QueryMetrics>();

  constructor() {
    super({
      // Connection pooling configuration
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ]
    });
  }

  async onModuleInit() {
    // Set up query performance monitoring
    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      const duration = event.duration;
      const query = event.query;
      
      // Log slow queries (>100ms)
      if (duration > 100) {
        this.logger.warn(`Slow query detected: ${duration}ms`, {
          query: query.substring(0, 200) + '...',
          duration,
          params: event.params
        });
      }

      // Track query metrics
      this.trackQueryMetrics(query, duration);
    });

    this.$on('error' as never, (event: Prisma.LogEvent) => {
      this.logger.error('Database error:', event);
    });

    await this.$connect();
    this.logger.log('Connected to database with performance monitoring enabled');
  }

  private trackQueryMetrics(query: string, duration: number) {
    // Extract query type (SELECT, INSERT, UPDATE, DELETE)
    const queryType = query.trim().split(' ')[0].toUpperCase();
    const key = this.getQueryKey(query);
    
    const existing = this.queryMetrics.get(key);
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
    } else {
      this.queryMetrics.set(key, {
        count: 1,
        totalTime: duration,
        avgTime: duration
      });
    }
  }

  private getQueryKey(query: string): string {
    // Normalize query to group similar queries together
    return query
      .replace(/\$\d+/g, '$?') // Replace parameter placeholders
      .replace(/\d+/g, 'N')    // Replace numbers
      .replace(/['"][^'"]*['"]/g, 'STRING') // Replace string literals
      .substring(0, 100); // Limit length
  }

  /**
   * Get query performance statistics
   */
  getPerformanceStats() {
    const stats = Array.from(this.queryMetrics.entries())
      .map(([query, metrics]) => ({
        query: query.substring(0, 100) + '...',
        ...metrics
      }))
      .sort((a, b) => b.avgTime - a.avgTime) // Sort by average time desc
      .slice(0, 20); // Top 20 slowest queries

    return {
      totalQueries: Array.from(this.queryMetrics.values()).reduce((sum, m) => sum + m.count, 0),
      slowestQueries: stats,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceStats() {
    this.queryMetrics.clear();
    this.logger.log('Performance statistics reset');
  }

  /**
   * Execute query with performance tracking
   */
  async executeWithTracking<T>(
    queryFn: () => Promise<T>,
    queryName: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      if (duration > 50) { // Log queries over 50ms
        this.logger.debug(`Query ${queryName} completed in ${duration}ms`);
      }
      
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Query ${queryName} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Optimized query for project list with member counts
   */
  async findProjectsWithMemberCounts(userId: string) {
    return this.executeWithTracking(
      () => this.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.visibility,
          p.scheduling_enabled,
          p.created_at,
          p.updated_at,
          COUNT(DISTINCT pm_all.id) as member_count,
          COUNT(DISTINCT i.id) as issue_count,
          pm_user.role as user_role
        FROM projects p
        INNER JOIN project_members pm_user ON p.id = pm_user.project_id 
          AND pm_user.user_id = ${userId}
          AND pm_user.is_active = true
        LEFT JOIN project_members pm_all ON p.id = pm_all.project_id 
          AND pm_all.is_active = true
        LEFT JOIN issues i ON p.id = i.project_id 
          AND i.deleted_at IS NULL
        GROUP BY p.id, p.name, p.visibility, p.scheduling_enabled, 
                 p.created_at, p.updated_at, pm_user.role
        ORDER BY p.updated_at DESC
      `,
      'findProjectsWithMemberCounts'
    );
  }

  /**
   * Optimized query for Gantt chart data
   */
  async findGanttDataOptimized(projectId: string, options: {
    includeCompleted?: boolean;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const { includeCompleted = true, startDate, endDate } = options;

    return this.executeWithTracking(
      () => this.$queryRaw`
        WITH issue_hierarchy AS (
          SELECT 
            i.id,
            i.title,
            i.description,
            i.parent_issue_id,
            i.start_date,
            i.due_date,
            i.progress,
            i.status,
            i.assignee_id,
            i.estimate_value,
            i.spent,
            i.order_index,
            u.name as assignee_name,
            u.email as assignee_email,
            0 as hierarchy_level
          FROM issues i
          LEFT JOIN users u ON i.assignee_id = u.id
          WHERE i.project_id = ${projectId}
            AND i.deleted_at IS NULL
            ${includeCompleted ? Prisma.empty : Prisma.sql`AND i.status != 'done'`}
            ${startDate ? Prisma.sql`AND (i.start_date >= ${startDate}::date OR i.due_date >= ${startDate}::date)` : Prisma.empty}
            ${endDate ? Prisma.sql`AND (i.start_date <= ${endDate}::date OR i.due_date <= ${endDate}::date)` : Prisma.empty}
        )
        SELECT 
          ih.*,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', d.id,
                'predecessorId', d.predecessor_id,
                'successorId', d.successor_id,
                'type', d.type,
                'lag', d.lag
              )
            ) FILTER (WHERE d.id IS NOT NULL), 
            '[]'::json
          ) as dependencies
        FROM issue_hierarchy ih
        LEFT JOIN dependencies d ON (ih.id = d.predecessor_id OR ih.id = d.successor_id)
          AND d.project_id = ${projectId}
        GROUP BY ih.id, ih.title, ih.description, ih.parent_issue_id,
                 ih.start_date, ih.due_date, ih.progress, ih.status,
                 ih.assignee_id, ih.estimate_value, ih.spent, ih.order_index,
                 ih.assignee_name, ih.assignee_email, ih.hierarchy_level
        ORDER BY ih.parent_issue_id NULLS FIRST, ih.order_index
      `,
      'findGanttDataOptimized'
    );
  }

  /**
   * Optimized WBS tree query with single database call
   */
  async findWBSTreeOptimized(projectId: string, options: {
    includeCompleted?: boolean;
    maxDepth?: number;
  } = {}) {
    const { includeCompleted = true, maxDepth = 10 } = options;

    return this.executeWithTracking(
      () => this.$queryRaw`
        WITH RECURSIVE wbs_tree AS (
          -- Base case: root nodes
          SELECT 
            i.id,
            i.title,
            i.description,
            i.parent_issue_id,
            i.status,
            i.start_date,
            i.due_date,
            i.estimate_value,
            i.progress,
            i.version,
            i.order_index,
            i.assignee_id,
            u.name as assignee_name,
            wn.sort_index,
            0 as level,
            ARRAY[i.order_index] as path,
            i.id::text as tree_path
          FROM issues i
          LEFT JOIN users u ON i.assignee_id = u.id
          LEFT JOIN wbs_nodes wn ON i.id = wn.issue_id
          WHERE i.project_id = ${projectId}
            AND i.parent_issue_id IS NULL
            AND i.deleted_at IS NULL
            ${includeCompleted ? Prisma.empty : Prisma.sql`AND i.status != 'done'`}
          
          UNION ALL
          
          -- Recursive case: child nodes
          SELECT 
            i.id,
            i.title,
            i.description,
            i.parent_issue_id,
            i.status,
            i.start_date,
            i.due_date,
            i.estimate_value,
            i.progress,
            i.version,
            i.order_index,
            i.assignee_id,
            u.name as assignee_name,
            wn.sort_index,
            wt.level + 1,
            wt.path || i.order_index,
            wt.tree_path || '.' || i.id::text
          FROM issues i
          LEFT JOIN users u ON i.assignee_id = u.id
          LEFT JOIN wbs_nodes wn ON i.id = wn.issue_id
          INNER JOIN wbs_tree wt ON i.parent_issue_id = wt.id
          WHERE i.deleted_at IS NULL
            AND wt.level < ${maxDepth}
            ${includeCompleted ? Prisma.empty : Prisma.sql`AND i.status != 'done'`}
        )
        SELECT * FROM wbs_tree
        ORDER BY tree_path, level, order_index
      `,
      'findWBSTreeOptimized'
    );
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics() {
    return this.executeWithTracking(
      () => this.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
      `,
      'getDatabaseMetrics'
    );
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats() {
    return this.executeWithTracking(
      () => this.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan,
          CASE 
            WHEN idx_scan = 0 THEN 'Unused'
            WHEN idx_scan < 100 THEN 'Low Usage'
            WHEN idx_scan < 1000 THEN 'Medium Usage'
            ELSE 'High Usage'
          END as usage_level
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `,
      'getIndexUsageStats'
    );
  }
}