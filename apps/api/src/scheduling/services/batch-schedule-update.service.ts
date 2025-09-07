import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// AC4: Batch schedule update interfaces
export interface BatchUpdateRequest {
  projectId: string;
  updates: ScheduleUpdate[];
  options: {
    conflictResolution: 'fail' | 'skip' | 'overwrite';
    validateConstraints: boolean;
    refreshMaterializedView: boolean;
  };
}

export interface ScheduleUpdate {
  taskId: string;
  startDate?: Date;
  dueDate?: Date;
  estimateValue?: number;
  estimateUnit?: string;
  status?: string;
  progress?: number;
  assigneeId?: string;
}

export interface BatchUpdateResponse {
  success: boolean;
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  conflicts: Array<{
    taskId: string;
    error: string;
    conflictType: 'version' | 'constraint' | 'dependency' | 'validation';
  }>;
  performance: {
    batchDuration: number;
    avgUpdateTime: number;
    databaseRoundtrips: number;
    lockWaitTime: number;
  };
  refreshStatus: 'queued' | 'completed' | 'failed';
}

@Injectable()
export class BatchScheduleUpdateService {
  constructor(private prisma: PrismaService) {}

  // AC4: Main batch update method with minimized database roundtrips
  async executeBatchUpdate(request: BatchUpdateRequest): Promise<BatchUpdateResponse> {
    const startTime = Date.now();
    let lockWaitStart = 0;
    let lockWaitTime = 0;
    let databaseRoundtrips = 0;

    const response: BatchUpdateResponse = {
      success: false,
      totalUpdates: request.updates.length,
      successfulUpdates: 0,
      failedUpdates: 0,
      conflicts: [],
      performance: {
        batchDuration: 0,
        avgUpdateTime: 0,
        databaseRoundtrips: 0,
        lockWaitTime: 0
      },
      refreshStatus: 'queued'
    };

    try {
      // Validate batch size to prevent overwhelming the system
      if (request.updates.length > 1000) {
        throw new BadRequestException('Batch size exceeds maximum limit of 1000 updates');
      }

      // Use advisory locks to prevent concurrent batch updates on same project
      lockWaitStart = Date.now();
      const lockResult = await this.prisma.$queryRaw`
        SELECT pg_try_advisory_lock(hashtext(${request.projectId})) as acquired
      `;
      
      if (!(lockResult as any)[0].acquired) {
        throw new BadRequestException('Another batch update is in progress for this project');
      }
      
      lockWaitTime = Date.now() - lockWaitStart;

      // Execute batch update in optimized transaction
      const batchResult = await this.prisma.$transaction(async (tx) => {
        databaseRoundtrips++;
        
        // Batch 1: Validate all tasks exist and get current versions
        const taskIds = request.updates.map(update => update.taskId);
        const existingTasks = await tx.issue.findMany({
          where: {
            id: { in: taskIds },
            projectId: request.projectId,
            deletedAt: null
          },
          select: {
            id: true,
            version: true,
            startDate: true,
            dueDate: true,
            estimateValue: true,
            estimateUnit: true,
            status: true,
            progress: true,
            assigneeId: true,
            updatedAt: true
          }
        });
        databaseRoundtrips++;

        const taskMap = new Map(existingTasks.map(task => [task.id, task]));
        const validUpdates: Array<ScheduleUpdate & { currentVersion: number }> = [];
        
        // Validate and prepare updates
        for (const update of request.updates) {
          const existingTask = taskMap.get(update.taskId);
          
          if (!existingTask) {
            response.conflicts.push({
              taskId: update.taskId,
              error: 'Task not found or deleted',
              conflictType: 'validation'
            });
            response.failedUpdates++;
            continue;
          }

          // Validate constraints if requested
          if (request.options.validateConstraints) {
            const constraintViolation = this.validateScheduleConstraints(update, existingTask);
            if (constraintViolation) {
              response.conflicts.push({
                taskId: update.taskId,
                error: constraintViolation,
                conflictType: 'constraint'
              });
              response.failedUpdates++;
              continue;
            }
          }

          validUpdates.push({
            ...update,
            currentVersion: existingTask.version
          });
        }

        if (validUpdates.length === 0) {
          return { updatedTasks: [], affectedDependencies: [] };
        }

        // Batch 2: Check for dependency conflicts
        let affectedDependencies: any[] = [];
        if (request.options.validateConstraints) {
          const dependencyConflicts = await this.validateDependencyConstraints(
            tx, validUpdates, request.projectId
          );
          databaseRoundtrips++;
          
          dependencyConflicts.forEach(conflict => {
            response.conflicts.push({
              taskId: conflict.taskId,
              error: conflict.error,
              conflictType: 'dependency'
            });
            response.failedUpdates++;
          });

          // Remove updates with dependency conflicts
          const conflictingTaskIds = new Set(dependencyConflicts.map(c => c.taskId));
          const safeUpdates = validUpdates.filter(u => !conflictingTaskIds.has(u.taskId));
          
          if (safeUpdates.length !== validUpdates.length) {
            validUpdates.splice(0, validUpdates.length, ...safeUpdates);
          }
        }

        if (validUpdates.length === 0) {
          return { updatedTasks: [], affectedDependencies };
        }

        // Batch 3: Execute all updates in single query for minimal lock contention
        const updateResults = await Promise.all(
          validUpdates.map(update => 
            tx.issue.update({
              where: { 
                id: update.taskId,
                version: update.currentVersion // Optimistic locking
              },
              data: {
                ...(update.startDate && { startDate: update.startDate }),
                ...(update.dueDate && { dueDate: update.dueDate }),
                ...(update.estimateValue && { estimateValue: update.estimateValue }),
                ...(update.estimateUnit && { estimateUnit: update.estimateUnit }),
                ...(update.status && { status: update.status }),
                ...(update.progress !== undefined && { progress: update.progress }),
                ...(update.assigneeId !== undefined && { assigneeId: update.assigneeId }),
                version: { increment: 1 },
                updatedAt: new Date()
              },
              select: { id: true, version: true, updatedAt: true }
            }).catch(error => {
              // Handle optimistic locking failures
              if (error.code === 'P2025') {
                response.conflicts.push({
                  taskId: update.taskId,
                  error: 'Task was modified by another user (version conflict)',
                  conflictType: 'version'
                });
                response.failedUpdates++;
                return null;
              }
              throw error;
            })
          )
        );
        databaseRoundtrips++;

        const successfulUpdates = updateResults.filter(result => result !== null);
        response.successfulUpdates = successfulUpdates.length;

        // Batch 4: Get affected dependencies for materialized view refresh
        if (response.successfulUpdates > 0) {
          const updatedTaskIds = successfulUpdates.map(task => task!.id);
          affectedDependencies = await tx.dependency.findMany({
            where: {
              OR: [
                { predecessorId: { in: updatedTaskIds } },
                { successorId: { in: updatedTaskIds } }
              ]
            },
            select: { id: true, predecessorId: true, successorId: true, type: true, lag: true }
          });
          databaseRoundtrips++;
        }

        return { 
          updatedTasks: successfulUpdates.filter(task => task !== null),
          affectedDependencies
        };
      }, {
        isolationLevel: 'ReadCommitted', // Reduce lock contention
        timeout: 30000 // 30 second timeout
      });

      // Release advisory lock
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(hashtext(${request.projectId}))
      `;
      databaseRoundtrips++;

      // Queue materialized view refresh if requested and updates were successful
      if (request.options.refreshMaterializedView && response.successfulUpdates > 0) {
        try {
          await this.queueMaterializedViewRefresh(request.projectId, {
            operation_type: 'batch_update',
            updated_count: response.successfulUpdates,
            affected_dependencies: batchResult.affectedDependencies.length
          });
          response.refreshStatus = 'queued';
        } catch (refreshError) {
          console.error('Failed to queue materialized view refresh:', refreshError);
          response.refreshStatus = 'failed';
        }
      }

      const totalDuration = Date.now() - startTime;
      response.performance = {
        batchDuration: totalDuration,
        avgUpdateTime: response.successfulUpdates > 0 ? totalDuration / response.successfulUpdates : 0,
        databaseRoundtrips,
        lockWaitTime
      };

      response.success = response.successfulUpdates > 0 && response.conflicts.length === 0;

      return response;
    } catch (error) {
      // Ensure advisory lock is released on error
      try {
        await this.prisma.$queryRaw`
          SELECT pg_advisory_unlock(hashtext(${request.projectId}))
        `;
      } catch (unlockError) {
        console.error('Failed to release advisory lock:', unlockError);
      }

      throw new BadRequestException(`Batch update failed: ${error.message}`);
    }
  }

  // AC4: Optimized bulk dependency update
  async executeBulkDependencyUpdate(
    projectId: string,
    dependencyUpdates: Array<{
      id: string;
      predecessorId?: string;
      successorId?: string;
      type?: string;
      lag?: number;
    }>
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      // Batch validate all dependencies exist
      const dependencyIds = dependencyUpdates.map(update => update.id);
      const existingDependencies = await tx.dependency.findMany({
        where: {
          id: { in: dependencyIds },
          projectId
        }
      });

      const existingIds = new Set(existingDependencies.map(d => d.id));

      // Filter valid updates
      const validUpdates = dependencyUpdates.filter(update => {
        if (!existingIds.has(update.id)) {
          errors.push(`Dependency ${update.id} not found`);
          return false;
        }
        return true;
      });

      // Execute updates in batch
      if (validUpdates.length > 0) {
        const updatePromises = validUpdates.map(update =>
          tx.dependency.update({
            where: { id: update.id },
            data: {
              ...(update.predecessorId && { predecessorId: update.predecessorId }),
              ...(update.successorId && { successorId: update.successorId }),
              ...(update.type && { type: update.type }),
              ...(update.lag !== undefined && { lag: update.lag }),
              updatedAt: new Date()
            }
          })
        );

        await Promise.all(updatePromises);
        updated = validUpdates.length;

        // Queue refresh for dependency changes
        await this.queueMaterializedViewRefresh(projectId, {
          operation_type: 'dependency_batch',
          updated_count: updated
        });
      }
    });

    return { updated, errors };
  }

  // Private helper methods

  private validateScheduleConstraints(update: ScheduleUpdate, existingTask: any): string | null {
    // Validate date logic
    if (update.startDate && update.dueDate && update.startDate >= update.dueDate) {
      return 'Start date must be before due date';
    }

    // Validate estimate constraints
    if (update.estimateValue !== undefined && update.estimateValue <= 0) {
      return 'Estimate value must be positive';
    }

    // Validate progress constraints
    if (update.progress !== undefined && (update.progress < 0 || update.progress > 100)) {
      return 'Progress must be between 0 and 100';
    }

    // Validate status transitions
    if (update.status) {
      const validStatuses = ['todo', 'doing', 'blocked', 'review', 'done'];
      if (!validStatuses.includes(update.status)) {
        return `Invalid status: ${update.status}`;
      }
    }

    return null;
  }

  private async validateDependencyConstraints(
    tx: any,
    updates: (ScheduleUpdate & { currentVersion: number })[],
    projectId: string
  ): Promise<Array<{ taskId: string; error: string }>> {
    const conflicts: Array<{ taskId: string; error: string }> = [];

    // Get all dependencies that might be affected
    const taskIds = updates.map(u => u.taskId);
    const dependencies = await tx.dependency.findMany({
      where: {
        projectId,
        OR: [
          { predecessorId: { in: taskIds } },
          { successorId: { in: taskIds } }
        ]
      },
      include: {
        predecessor: { select: { id: true, dueDate: true } },
        successor: { select: { id: true, startDate: true } }
      }
    });

    // Check each update for dependency violations
    for (const update of updates) {
      if (!update.startDate && !update.dueDate) continue;

      // Check predecessor constraints
      const predecessorDeps = dependencies.filter(d => d.successorId === update.taskId);
      for (const dep of predecessorDeps) {
        if (dep.type === 'FS' && update.startDate) {
          const requiredStartDate = new Date(dep.predecessor.dueDate);
          requiredStartDate.setDate(requiredStartDate.getDate() + (dep.lag || 0));

          if (update.startDate < requiredStartDate) {
            conflicts.push({
              taskId: update.taskId,
              error: `Start date violates dependency constraint with task ${dep.predecessorId}`
            });
          }
        }
      }

      // Check successor constraints
      const successorDeps = dependencies.filter(d => d.predecessorId === update.taskId);
      for (const dep of successorDeps) {
        if (dep.type === 'FS' && update.dueDate) {
          const maxAllowedEndDate = new Date(dep.successor.startDate);
          maxAllowedEndDate.setDate(maxAllowedEndDate.getDate() - (dep.lag || 0));

          if (update.dueDate > maxAllowedEndDate) {
            conflicts.push({
              taskId: update.taskId,
              error: `Due date violates dependency constraint with task ${dep.successorId}`
            });
          }
        }
      }
    }

    return conflicts;
  }

  private async queueMaterializedViewRefresh(
    projectId: string, 
    metadata: any
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO computed_schedule_refresh_queue (
        project_id, operation_type, priority, metadata
      ) VALUES (
        ${projectId}::uuid, 
        'batch_update', 
        2,
        ${JSON.stringify(metadata)}::jsonb
      )
      ON CONFLICT DO NOTHING
    `;

    // Send notification for immediate processing
    await this.prisma.$queryRaw`
      SELECT pg_notify('computed_schedule_batch_refresh', 
        ${JSON.stringify({
          project_id: projectId,
          operation_type: 'batch_update',
          priority: 2,
          timestamp: new Date().toISOString()
        })}
      )
    `;
  }
}