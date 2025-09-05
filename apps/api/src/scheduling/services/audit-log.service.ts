import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SchedulingAuditLog {
  projectId: string;
  entityType: 'schedule' | 'conflict' | 'performance';
  entityId: string;
  action: string;
  actor: string;
  before?: any;
  after?: any;
  metadata: {
    operation?: 'calculate' | 'apply' | 'resolve' | 'bulk_resolve' | 'preview' | 'integrity_check';
    algorithm?: 'cpm' | 'simple';
    conflictPattern?: string;
    resolutionStrategy?: string;
    performance?: PerformanceMetrics;
    errors?: string[];
    warnings?: string[];
    [key: string]: any;
  };
}

export interface PerformanceMetrics {
  operationType: 'schedule_calculation' | 'conflict_detection' | 'conflict_resolution' | 'bulk_operation';
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  resourceUsage: {
    tasksProcessed: number;
    conflictsDetected: number;
    conflictsResolved: number;
    apiCalls: number;
    memoryUsage?: number; // MB
  };
  success: boolean;
  errorRate: number;
  throughput: number; // operations per second
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log scheduling operation
   */
  async logSchedulingOperation(
    projectId: string,
    operation: 'calculate' | 'apply' | 'preview',
    data: {
      entityId?: string;
      algorithm?: 'cpm' | 'simple';
      tasksProcessed?: number;
      duration?: number;
      success: boolean;
      errors?: string[];
      warnings?: string[];
      before?: any;
      after?: any;
    },
    userId: string
  ): Promise<void> {
    await this.createAuditLog({
      projectId,
      entityType: 'schedule',
      entityId: data.entityId || projectId,
      action: `schedule_${operation}`,
      actor: userId,
      before: data.before,
      after: data.after,
      metadata: {
        operation,
        algorithm: data.algorithm,
        performance: data.duration ? {
          operationType: 'schedule_calculation',
          startTime: new Date(Date.now() - data.duration),
          endTime: new Date(),
          duration: data.duration,
          resourceUsage: {
            tasksProcessed: data.tasksProcessed || 0,
            conflictsDetected: 0,
            conflictsResolved: 0,
            apiCalls: 1
          },
          success: data.success,
          errorRate: data.errors ? data.errors.length / (data.tasksProcessed || 1) : 0,
          throughput: data.tasksProcessed ? data.tasksProcessed / (data.duration / 1000) : 0
        } : undefined,
        errors: data.errors,
        warnings: data.warnings
      }
    });
  }

  /**
   * Log conflict resolution operation
   */
  async logConflictResolution(
    projectId: string,
    conflictId: string,
    resolutionData: {
      conflictPattern: string;
      strategy: string;
      success: boolean;
      before?: any;
      after?: any;
      warnings?: string[];
      duration?: number;
    },
    userId: string
  ): Promise<void> {
    await this.createAuditLog({
      projectId,
      entityType: 'conflict',
      entityId: conflictId,
      action: 'conflict_resolution',
      actor: userId,
      before: resolutionData.before,
      after: resolutionData.after,
      metadata: {
        operation: 'resolve',
        conflictPattern: resolutionData.conflictPattern,
        resolutionStrategy: resolutionData.strategy,
        performance: resolutionData.duration ? {
          operationType: 'conflict_resolution',
          startTime: new Date(Date.now() - resolutionData.duration),
          endTime: new Date(),
          duration: resolutionData.duration,
          resourceUsage: {
            tasksProcessed: 1,
            conflictsDetected: 1,
            conflictsResolved: resolutionData.success ? 1 : 0,
            apiCalls: 1
          },
          success: resolutionData.success,
          errorRate: resolutionData.success ? 0 : 1,
          throughput: 1 / (resolutionData.duration / 1000)
        } : undefined,
        warnings: resolutionData.warnings
      }
    });
  }

  /**
   * Log bulk conflict resolution
   */
  async logBulkConflictResolution(
    projectId: string,
    operationData: {
      totalConflicts: number;
      resolved: number;
      failed: number;
      strategy: string;
      duration: number;
      conflicts: Array<{ id: string; pattern: string; success: boolean }>;
    },
    userId: string
  ): Promise<void> {
    await this.createAuditLog({
      projectId,
      entityType: 'conflict',
      entityId: `bulk_${Date.now()}`,
      action: 'bulk_conflict_resolution',
      actor: userId,
      metadata: {
        operation: 'bulk_resolve',
        resolutionStrategy: operationData.strategy,
        performance: {
          operationType: 'bulk_operation',
          startTime: new Date(Date.now() - operationData.duration),
          endTime: new Date(),
          duration: operationData.duration,
          resourceUsage: {
            tasksProcessed: operationData.totalConflicts,
            conflictsDetected: operationData.totalConflicts,
            conflictsResolved: operationData.resolved,
            apiCalls: 1
          },
          success: operationData.failed === 0,
          errorRate: operationData.failed / operationData.totalConflicts,
          throughput: operationData.totalConflicts / (operationData.duration / 1000)
        },
        bulkResults: {
          totalConflicts: operationData.totalConflicts,
          resolved: operationData.resolved,
          failed: operationData.failed,
          conflictBreakdown: operationData.conflicts.reduce((acc, c) => {
            acc[c.pattern] = (acc[c.pattern] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      }
    });
  }

  /**
   * Log performance metrics
   */
  async logPerformanceMetrics(
    projectId: string,
    metrics: PerformanceMetrics,
    userId: string
  ): Promise<void> {
    await this.createAuditLog({
      projectId,
      entityType: 'performance',
      entityId: `perf_${Date.now()}`,
      action: `performance_${metrics.operationType}`,
      actor: userId,
      metadata: {
        performance: metrics,
        resourceEfficiency: {
          tasksPerSecond: metrics.resourceUsage.tasksProcessed / (metrics.duration / 1000),
          conflictsPerSecond: metrics.resourceUsage.conflictsDetected / (metrics.duration / 1000),
          resolutionRate: metrics.resourceUsage.conflictsResolved / metrics.resourceUsage.conflictsDetected,
          memoryEfficiency: metrics.resourceUsage.memoryUsage 
            ? metrics.resourceUsage.tasksProcessed / metrics.resourceUsage.memoryUsage 
            : undefined
        }
      }
    });
  }

  /**
   * Log data integrity check results
   */
  async logDataIntegrityCheck(
    projectId: string,
    checkResults: {
      totalIssues: number;
      conflictsFound: number;
      severity: { errors: number; warnings: number };
      patterns: Record<string, number>;
      duration: number;
    },
    userId: string
  ): Promise<void> {
    await this.createAuditLog({
      projectId,
      entityType: 'schedule',
      entityId: `integrity_${Date.now()}`,
      action: 'data_integrity_check',
      actor: userId,
      metadata: {
        operation: 'integrity_check',
        integrityResults: checkResults,
        performance: {
          operationType: 'conflict_detection',
          startTime: new Date(Date.now() - checkResults.duration),
          endTime: new Date(),
          duration: checkResults.duration,
          resourceUsage: {
            tasksProcessed: checkResults.totalIssues,
            conflictsDetected: checkResults.conflictsFound,
            conflictsResolved: 0,
            apiCalls: 1
          },
          success: checkResults.severity.errors === 0,
          errorRate: checkResults.severity.errors / checkResults.totalIssues,
          throughput: checkResults.totalIssues / (checkResults.duration / 1000)
        }
      }
    });
  }

  /**
   * Get scheduling operation history
   */
  async getSchedulingHistory(
    projectId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      actions?: string[];
      limit?: number;
    } = {}
  ) {
    const where = {
      projectId,
      entityType: { in: ['schedule', 'conflict'] },
      ...(options.startDate && { createdAt: { gte: options.startDate } }),
      ...(options.endDate && { createdAt: { lte: options.endDate } }),
      ...(options.actions && { action: { in: options.actions } })
    };

    const logs = await this.prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50
    });

    return logs.map(log => ({
      ...log,
      metadata: typeof log.metadata === 'object' ? log.metadata : {},
    }));
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(
    projectId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    summary: {
      totalOperations: number;
      avgDuration: number;
      successRate: number;
      throughput: number;
    };
    operationBreakdown: Record<string, {
      count: number;
      avgDuration: number;
      successRate: number;
    }>;
    performanceTrend: Array<{
      date: Date;
      operations: number;
      avgDuration: number;
      successRate: number;
    }>;
  }> {
    const logs = await this.prisma.activityLog.findMany({
      where: {
        projectId,
        entityType: 'performance',
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const operations = logs
      .map(log => log.metadata as any)
      .filter(meta => meta.performance);

    // Calculate summary metrics
    const totalOperations = operations.length;
    const avgDuration = operations.reduce((sum, op) => sum + op.performance.duration, 0) / totalOperations;
    const successRate = operations.filter(op => op.performance.success).length / totalOperations;
    const totalThroughput = operations.reduce((sum, op) => sum + op.performance.throughput, 0);

    // Group by operation type
    const operationBreakdown = operations.reduce((acc, op) => {
      const type = op.performance.operationType;
      if (!acc[type]) {
        acc[type] = { count: 0, totalDuration: 0, successes: 0 };
      }
      acc[type].count++;
      acc[type].totalDuration += op.performance.duration;
      if (op.performance.success) acc[type].successes++;
      return acc;
    }, {} as Record<string, any>);

    Object.keys(operationBreakdown).forEach(type => {
      const stats = operationBreakdown[type];
      operationBreakdown[type] = {
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
        successRate: stats.successes / stats.count
      };
    });

    // Generate trend data (daily aggregation)
    const trendMap = new Map<string, { operations: number; totalDuration: number; successes: number }>();
    
    operations.forEach(op => {
      const date = new Date(op.performance.startTime).toDateString();
      if (!trendMap.has(date)) {
        trendMap.set(date, { operations: 0, totalDuration: 0, successes: 0 });
      }
      const trend = trendMap.get(date)!;
      trend.operations++;
      trend.totalDuration += op.performance.duration;
      if (op.performance.success) trend.successes++;
    });

    const performanceTrend = Array.from(trendMap.entries()).map(([dateStr, stats]) => ({
      date: new Date(dateStr),
      operations: stats.operations,
      avgDuration: stats.totalDuration / stats.operations,
      successRate: stats.successes / stats.operations
    }));

    return {
      summary: {
        totalOperations,
        avgDuration,
        successRate,
        throughput: totalThroughput / totalOperations
      },
      operationBreakdown,
      performanceTrend
    };
  }

  private async createAuditLog(logData: SchedulingAuditLog): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          projectId: logData.projectId,
          entityType: logData.entityType,
          entityId: logData.entityId,
          action: logData.action,
          actor: logData.actor,
          before: logData.before,
          after: logData.after,
          metadata: logData.metadata
        }
      });
    } catch (error) {
      // Log audit logging errors separately to avoid circular issues
      console.error('Failed to create audit log:', error);
    }
  }
}