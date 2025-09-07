import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheInvalidationService, CacheInvalidationEvent } from '../scheduling/services/cache-invalidation.service';
import { BatchScheduleUpdateService, BatchUpdateRequest } from '../scheduling/services/batch-schedule-update.service';

// AC3: Enhanced project service with sub-200ms performance optimizations
@Injectable()
export class ProjectsEnhancedService {
  constructor(
    private prisma: PrismaService,
    private cacheInvalidationService: CacheInvalidationService,
    private batchUpdateService: BatchScheduleUpdateService
  ) {}

  // AC3: Optimized Gantt schedule data retrieval with aggressive caching and query optimization
  async getOptimizedGanttSchedule(
    projectId: string,
    options: { 
      includeHistory?: boolean;
      useCache?: boolean;
      cacheStrategy?: 'aggressive' | 'conservative';
    } = {}
  ) {
    const startTime = Date.now();
    const { includeHistory = false, useCache = true, cacheStrategy = 'aggressive' } = options;

    try {
      // Check cache first if enabled
      if (useCache) {
        const cachedResult = await this.getCachedScheduleData(projectId, includeHistory);
        if (cachedResult) {
          return {
            ...cachedResult,
            performance: {
              ...cachedResult.performance,
              cacheHit: true,
              totalResponseTime: Date.now() - startTime
            }
          };
        }
      }

      // Optimized single query to get all schedule data with pre-calculated values
      const scheduleData = await this.prisma.$queryRaw`
        WITH latest_schedule AS (
          SELECT DISTINCT ON (csv.project_id)
            csv.computed_schedule_id,
            csv.calculated_at,
            csv.algorithm,
            csv.computed_end_date as project_end_date,
            csv.total_duration,
            csv.critical_path
          FROM computed_schedule_view csv
          WHERE csv.project_id = ${projectId}::uuid
          ORDER BY csv.project_id, csv.calculated_at DESC
        ),
        schedule_tasks AS (
          SELECT 
            csv.task_id,
            csv.task_title,
            csv.assignee_id,
            csv.task_status,
            csv.progress,
            csv.earliest_start_date,
            csv.earliest_finish_date,
            csv.latest_start_date,
            csv.latest_finish_date,
            -- Optimized float calculation (convert minutes to days with precision)
            ROUND((csv.total_float / 1440.0)::numeric, 3) as total_float_days,
            csv.critical_path,
            csv.risk_level,
            csv.estimate_value,
            csv.estimate_unit
          FROM computed_schedule_view csv
          INNER JOIN latest_schedule ls ON csv.computed_schedule_id = ls.computed_schedule_id
          ORDER BY csv.earliest_start_date ASC, csv.critical_path DESC
        )
        SELECT 
          ls.*,
          -- Aggregate all tasks into single JSON for minimal data transfer
          jsonb_build_object(
            'tasks', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'taskId', st.task_id,
                  'title', st.task_title,
                  'assigneeId', st.assignee_id,
                  'status', st.task_status,
                  'progress', st.progress,
                  'earliestStartDate', st.earliest_start_date,
                  'earliestFinishDate', st.earliest_finish_date,
                  'latestStartDate', st.latest_start_date,
                  'latestFinishDate', st.latest_finish_date,
                  'totalFloat', st.total_float_days,
                  'criticalPath', st.critical_path,
                  'riskLevel', st.risk_level,
                  'estimateValue', st.estimate_value,
                  'estimateUnit', st.estimate_unit
                )
              ) FROM schedule_tasks st
            ),
            'summary', jsonb_build_object(
              'totalTasks', (SELECT COUNT(*) FROM schedule_tasks),
              'criticalTasks', (SELECT COUNT(*) FROM schedule_tasks WHERE critical_path = true),
              'nearCriticalTasks', (SELECT COUNT(*) FROM schedule_tasks WHERE risk_level = 'near_critical'),
              'avgFloatTime', (
                SELECT ROUND(AVG(total_float_days)::numeric, 2) 
                FROM schedule_tasks 
                WHERE critical_path = false
              )
            )
          ) as schedule_data
        FROM latest_schedule ls;
      `;

      const queryTime = Date.now() - startTime;

      if (!scheduleData || scheduleData.length === 0) {
        throw new NotFoundException('No computed schedule found for this project');
      }

      const schedule = scheduleData[0];
      const scheduleDataObj = schedule.schedule_data as any;

      // Include historical data only if explicitly requested to minimize response size
      let history = null;
      if (includeHistory) {
        history = await this.getScheduleHistory(projectId, 5); // Limit to 5 most recent
      }

      const responseTime = Date.now() - startTime;
      const result = {
        schedule: {
          computedScheduleId: schedule.computed_schedule_id,
          calculatedAt: schedule.calculated_at,
          algorithm: schedule.algorithm,
          projectEndDate: schedule.project_end_date,
          totalDuration: schedule.total_duration,
          criticalPath: schedule.critical_path,
          tasks: scheduleDataObj.tasks || [],
          summary: scheduleDataObj.summary || {}
        },
        history,
        performance: {
          queryTime,
          responseTime,
          taskCount: scheduleDataObj.tasks?.length || 0,
          cacheHit: false
        },
        cacheStatus: responseTime < 200 ? 'optimal' : 'slow'
      };

      // Cache result if performance is good and caching is enabled
      if (useCache && responseTime < 300) { // Cache if under 300ms
        await this.cacheScheduleData(projectId, result, cacheStrategy);
      }

      return result;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to retrieve schedule data: ${error.message}`);
    }
  }

  // AC4: Batch update operations with optimized performance
  async executeBatchScheduleUpdate(
    projectId: string,
    updates: any[],
    options: {
      conflictResolution?: 'fail' | 'skip' | 'overwrite';
      validateConstraints?: boolean;
      invalidateCache?: boolean;
    } = {}
  ) {
    const batchRequest: BatchUpdateRequest = {
      projectId,
      updates,
      options: {
        conflictResolution: options.conflictResolution || 'fail',
        validateConstraints: options.validateConstraints ?? true,
        refreshMaterializedView: true
      }
    };

    const result = await this.batchUpdateService.executeBatchUpdate(batchRequest);

    // Invalidate cache if updates were successful
    if (result.successfulUpdates > 0 && options.invalidateCache !== false) {
      const invalidationEvent: CacheInvalidationEvent = {
        projectId,
        entityType: 'issue',
        operation: 'bulk_update',
        timestamp: new Date(),
        metadata: {
          updatedCount: result.successfulUpdates,
          scheduleAffecting: true
        }
      };

      await this.cacheInvalidationService.invalidateCache(invalidationEvent, {
        strategy: result.successfulUpdates > 10 ? 'batched' : 'immediate',
        priority: 'normal'
      });
    }

    return result;
  }

  // AC5: Schedule versioning integration
  async createScheduleVersion(
    projectId: string,
    versionType: string,
    createdBy: string,
    changes: any,
    computedScheduleId?: string
  ) {
    const versionId = await this.prisma.$queryRaw`
      SELECT create_schedule_version(
        ${projectId}::uuid,
        ${versionType}::varchar,
        ${createdBy}::uuid,
        ${computedScheduleId || null}::uuid,
        ${JSON.stringify(changes.summary || {})}::jsonb,
        ${JSON.stringify(changes.dependencies || [])}::jsonb,
        ${JSON.stringify(changes.tasks || [])}::jsonb,
        ${JSON.stringify(changes.algorithm || {})}::jsonb,
        ${changes.duration || null}::int
      ) as version_id
    `;

    return versionId[0]?.version_id;
  }

  async getScheduleVersionHistory(projectId: string, limit: number = 10) {
    return await this.prisma.$queryRaw`
      SELECT 
        sv.id,
        sv.version_number,
        sv.version_type,
        sv.created_at,
        sv.created_by,
        sv.is_applied,
        sv.applied_at,
        sv.changes_summary,
        sv.calculation_duration_ms,
        u.name as created_by_name
      FROM schedule_versions sv
      LEFT JOIN users u ON sv.created_by = u.id
      WHERE sv.project_id = ${projectId}::uuid
      ORDER BY sv.version_number DESC
      LIMIT ${limit}
    `;
  }

  // Private helper methods for caching

  private async getCachedScheduleData(
    projectId: string,
    includeHistory: boolean
  ): Promise<any | null> {
    try {
      // This would integrate with your caching system (Redis, etc.)
      // For now, return null to indicate no cache hit
      return null;
    } catch (error) {
      // Cache miss or error - proceed with database query
      return null;
    }
  }

  private async cacheScheduleData(
    projectId: string,
    data: any,
    strategy: 'aggressive' | 'conservative'
  ): Promise<void> {
    try {
      const ttl = strategy === 'aggressive' ? 300 : 60; // 5 min vs 1 min TTL
      const cacheKey = `gantt:${projectId}:${data.schedule.calculatedAt}`;
      
      // This would integrate with your caching system
      // Example: await redis.setex(cacheKey, ttl, JSON.stringify(data));
      
    } catch (error) {
      // Cache write failure - log but don't fail the request
      console.warn(`Failed to cache schedule data for project ${projectId}:`, error);
    }
  }

  private async getScheduleHistory(projectId: string, limit: number) {
    return await this.prisma.$queryRaw`
      SELECT 
        cs.id,
        cs.calculated_at,
        cs.algorithm,
        cs.applied,
        cs.applied_at,
        cs.total_duration,
        COUNT(tsh.task_id) as task_count,
        -- Performance summary
        jsonb_build_object(
          'criticalPathLength', jsonb_array_length(cs.critical_path),
          'hasConflicts', CASE WHEN jsonb_array_length(cs.conflicts) > 0 THEN true ELSE false END
        ) as summary
      FROM computed_schedules cs
      LEFT JOIN task_schedule_history tsh ON cs.id = tsh.computed_schedule_id
      WHERE cs.project_id = ${projectId}::uuid
      GROUP BY cs.id, cs.calculated_at, cs.algorithm, cs.applied, cs.applied_at, cs.total_duration, cs.critical_path, cs.conflicts
      ORDER BY cs.calculated_at DESC
      LIMIT ${limit}
    `;
  }

  // AC7: Intelligent cache invalidation on data changes
  async invalidateProjectCache(
    projectId: string,
    changeType: 'dependency' | 'schedule' | 'task' | 'bulk',
    entityId?: string,
    metadata?: any
  ) {
    const invalidationEvent: CacheInvalidationEvent = {
      projectId,
      entityType: changeType === 'task' ? 'issue' : changeType as any,
      entityId,
      operation: 'update',
      timestamp: new Date(),
      metadata
    };

    // Choose invalidation strategy based on change impact
    let strategy: 'immediate' | 'batched' | 'scheduled' = 'immediate';
    let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

    if (changeType === 'dependency') {
      strategy = 'immediate';
      priority = 'high'; // Dependencies affect critical path
    } else if (changeType === 'bulk') {
      strategy = 'batched';
      priority = 'normal';
    } else if (metadata?.scheduleAffecting === false) {
      strategy = 'scheduled';
      priority = 'low';
    }

    return await this.cacheInvalidationService.invalidateCache(
      invalidationEvent,
      { strategy, priority }
    );
  }

  // AC6: Zero-downtime migration support
  async getMigrationStatus(): Promise<any> {
    return await this.prisma.$queryRaw`
      SELECT 
        migration_name,
        phase,
        started_at,
        progress_percentage,
        success,
        error_message
      FROM schema_migration_control
      WHERE phase != 'completed'
      ORDER BY started_at DESC
      LIMIT 5
    `;
  }

  async triggerZeroDowntimeMigration(migrationName: string, migrationData: any) {
    return await this.prisma.$queryRaw`
      SELECT manage_migration_phase(
        ${migrationName}::varchar,
        'preparing'::varchar,
        ${JSON.stringify(migrationData)}::jsonb
      ) as result
    `;
  }
}