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
  }>;
  executionTime: number; // milliseconds
}

export interface UpdateConflict {
  taskId: string;
  error: string;
}

// AC4: Enhanced conflict detection
export interface ConflictValidationResult {
  isValid: boolean;
  conflicts: UpdateConflict[];
}

@Injectable()
export class BatchScheduleUpdateService {
  constructor(private prisma: PrismaService) {}

  /**
   * AC4: Batch update multiple task schedules with conflict detection
   * Optimized for handling 100+ task updates efficiently
   */
  async batchUpdateSchedules(request: BatchUpdateRequest): Promise<BatchUpdateResponse> {
    const startTime = Date.now();
    
    if (!request.updates || request.updates.length === 0) {
      throw new BadRequestException('No updates provided');
    }

    // Validate basic constraints
    if (request.options.validateConstraints) {
      const validationResult = await this.validateConstraints(
        request.projectId,
        request.updates
      );
      
      if (!validationResult.isValid && request.options.conflictResolution === 'fail') {
        return {
          success: false,
          totalUpdates: request.updates.length,
          successfulUpdates: 0,
          failedUpdates: request.updates.length,
          conflicts: validationResult.conflicts,
          executionTime: Date.now() - startTime
        };
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const successfulUpdates: string[] = [];
        const failedUpdates: UpdateConflict[] = [];

        for (const update of request.updates) {
          try {
            // Skip conflicting updates if resolution is 'skip'
            if (request.options.conflictResolution === 'skip') {
              const hasConflict = await this.checkSingleUpdateConflict(
                tx,
                request.projectId,
                update
              );
              if (hasConflict) {
                failedUpdates.push({
                  taskId: update.taskId,
                  error: 'Update skipped due to conflict'
                });
                continue;
              }
            }

            await tx.issue.update({
              where: { id: update.taskId },
              data: {
                ...(update.startDate && { startDate: update.startDate }),
                ...(update.dueDate && { dueDate: update.dueDate }),
                ...(update.estimateValue && { estimateValue: update.estimateValue }),
                ...(update.estimateUnit && { estimateUnit: update.estimateUnit }),
                ...(update.status && { status: update.status }),
                ...(update.progress !== undefined && { progress: update.progress }),
                ...(update.assigneeId && { assigneeId: update.assigneeId }),
                updatedAt: new Date()
              }
            });

            successfulUpdates.push(update.taskId);
          } catch (error) {
            failedUpdates.push({
              taskId: update.taskId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Refresh materialized view if requested
        if (request.options.refreshMaterializedView && successfulUpdates.length > 0) {
          // Placeholder for materialized view refresh
          // await this.refreshScheduleMaterializedView(tx, request.projectId);
        }

        return {
          successfulUpdates,
          failedUpdates
        };
      });

      return {
        success: result.failedUpdates.length === 0,
        totalUpdates: request.updates.length,
        successfulUpdates: result.successfulUpdates.length,
        failedUpdates: result.failedUpdates.length,
        conflicts: result.failedUpdates,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      throw new BadRequestException(
        `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * AC4: Validate constraints across multiple updates
   */
  private async validateConstraints(
    projectId: string,
    updates: ScheduleUpdate[]
  ): Promise<ConflictValidationResult> {
    const conflicts: UpdateConflict[] = [];

    return this.prisma.$transaction(async (tx) => {
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
          predecessor: {
            select: {
              id: true,
              startDate: true,
              dueDate: true
            }
          },
          successor: {
            select: {
              id: true,
              startDate: true,
              dueDate: true
            }
          }
        }
      });

      // Check each update for dependency violations
      for (const update of updates) {
        if (!update.startDate && !update.dueDate) continue;

        // Check predecessor constraints - TEMP: Add explicit type annotation and null checks for Docker startup fix
        const predecessorDeps = dependencies.filter((d: any) => d.successorId === update.taskId);
        for (const dep of predecessorDeps) {
          if (dep.type === 'FS' && update.startDate && dep.predecessor.dueDate) {
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

        // Check successor constraints - TEMP: Add explicit type annotation and null checks for Docker startup fix
        const successorDeps = dependencies.filter((d: any) => d.predecessorId === update.taskId);
        for (const dep of successorDeps) {
          if (dep.type === 'FS' && update.dueDate && dep.successor.startDate) {
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

      return {
        isValid: conflicts.length === 0,
        conflicts
      };
    });
  }

  /**
   * Check if a single update has conflicts (used for skip resolution)
   */
  private async checkSingleUpdateConflict(
    tx: any,
    projectId: string,
    update: ScheduleUpdate
  ): Promise<boolean> {
    if (!update.startDate && !update.dueDate) return false;

    const dependencies = await tx.dependency.findMany({
      where: {
        projectId,
        OR: [
          { predecessorId: update.taskId },
          { successorId: update.taskId }
        ]
      },
      include: {
        predecessor: {
          select: {
            id: true,
            startDate: true,
            dueDate: true
          }
        },
        successor: {
          select: {
            id: true,
            startDate: true,
            dueDate: true
          }
        }
      }
    });

    // Simple conflict check - can be expanded
    for (const dep of dependencies) {
      if (dep.type === 'FS') {
        if (dep.successorId === update.taskId && update.startDate && dep.predecessor.dueDate) {
          const requiredStart = new Date(dep.predecessor.dueDate);
          requiredStart.setDate(requiredStart.getDate() + (dep.lag || 0));
          if (update.startDate < requiredStart) return true;
        }
        
        if (dep.predecessorId === update.taskId && update.dueDate && dep.successor.startDate) {
          const maxEnd = new Date(dep.successor.startDate);
          maxEnd.setDate(maxEnd.getDate() - (dep.lag || 0));
          if (update.dueDate > maxEnd) return true;
        }
      }
    }

    return false;
  }

  /**
   * AC4: Get batch update status for monitoring large operations
   */
  async getBatchUpdateStatus(projectId: string): Promise<{
    inProgress: boolean;
    lastUpdate: Date | null;
    pendingUpdates: number;
  }> {
    // Placeholder implementation - would track actual batch operations in production
    return {
      inProgress: false,
      lastUpdate: null,
      pendingUpdates: 0
    };
  }
}