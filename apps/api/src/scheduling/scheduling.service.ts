import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { AuditLogService } from './services/audit-log.service';
import { 
  ScheduleCalculateRequest,
  ScheduleApplyRequest 
} from './dto/schedule-request.dto';
import {
  ScheduleCalculateResponse,
  ScheduleApplyResponse,
  SchedulePreviewResponse,
  ComputedSchedule,
  ConflictInfo,
  TaskSchedule,
  ScheduleMetrics
} from './dto/schedule-response.dto';
import {
  ConflictResolutionRequest,
  ConflictResolutionResponse
} from './dto/conflict-resolution.dto';
import { ComputedScheduleEntity } from './entities/computed-schedule.entity';
import { ForwardPass } from './algorithms/forward-pass';
import { BackwardPass } from './algorithms/backward-pass';
import { ConstraintSolver } from './algorithms/constraint-solver';

@Injectable()
export class SchedulingService {
  constructor(
    private prisma: PrismaService,
    private conflictResolutionService: ConflictResolutionService,
    private auditLogService: AuditLogService
  ) {}

  async calculateSchedule(
    projectId: string,
    request: ScheduleCalculateRequest,
    userId: string
  ): Promise<ScheduleCalculateResponse> {
    const startTime = Date.now();
    let success = false;
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Validate project exists
      const project = await this.validateProject(projectId);
      
      // Get project issues and dependencies
      const issues = await this.getProjectIssues(projectId);
      const dependencies = await this.getProjectDependencies(projectId);
      
      if (issues.length === 0) {
        throw new BadRequestException('Project has no issues to schedule');
      }

      // Perform schedule calculation based on algorithm
      let computedSchedule: ComputedSchedule;
      let conflicts: ConflictInfo[] = [];

      try {
        if (request.options.algorithm === 'cpm') {
          const result = await this.calculateCPMSchedule(issues, dependencies, request.constraints);
          computedSchedule = result.schedule;
          conflicts = result.conflicts;
        } else {
          const result = await this.calculateSimpleSchedule(issues, dependencies, request.constraints);
          computedSchedule = result.schedule;
          conflicts = result.conflicts;
        }
      } catch (error) {
        errors.push(`Schedule calculation failed: ${error.message}`);
        throw new BadRequestException(`Schedule calculation failed: ${error.message}`);
      }

      // Save computed schedule
      const computedScheduleEntity = await this.saveComputedSchedule(
        projectId,
        userId,
        request,
        computedSchedule,
        conflicts
      );

      const calculationTime = Date.now() - startTime;
      success = true;

      // Log scheduling operation
      await this.auditLogService.logSchedulingOperation(
        projectId,
        'calculate',
        {
          entityId: computedScheduleEntity.id,
          algorithm: request.options.algorithm,
          tasksProcessed: issues.length,
          duration: calculationTime,
          success,
          errors,
          warnings: conflicts.filter(c => c.severity === 'warning').map(c => c.description),
          before: { issues: issues.length, dependencies: dependencies.length },
          after: { 
            computedSchedule: computedScheduleEntity.id,
            conflicts: conflicts.length,
            criticalPath: computedSchedule.criticalPathTasks.length
          }
        },
        userId
      );

      const metrics: ScheduleMetrics = {
        calculationTime,
        tasksProcessed: issues.length,
        optimizationSuggestions: this.generateOptimizationSuggestions(computedSchedule, conflicts)
      };

      return {
        computedSchedule: {
          ...computedSchedule,
          // Add computed schedule ID for reference
          id: computedScheduleEntity.id
        } as any,
        conflicts,
        metrics
      };
    } catch (error) {
      const calculationTime = Date.now() - startTime;
      
      // Log failed operation
      await this.auditLogService.logSchedulingOperation(
        projectId,
        'calculate',
        {
          algorithm: request.options.algorithm,
          duration: calculationTime,
          success: false,
          errors: [error.message]
        },
        userId
      );

      throw error;
    }
  }

  async applySchedule(
    projectId: string,
    request: ScheduleApplyRequest,
    userId: string
  ): Promise<ScheduleApplyResponse> {
    // Validate project and computed schedule exist
    await this.validateProject(projectId);
    const computedSchedule = await this.getComputedSchedule(request.computedScheduleId);

    if (computedSchedule.projectId !== projectId) {
      throw new BadRequestException('Computed schedule does not belong to this project');
    }

    // Check for conflicts if not auto-resolving
    const conflicts = computedSchedule.conflicts as ConflictInfo[];
    if (conflicts.length > 0 && request.applyOptions.conflictResolution === 'manual') {
      throw new ConflictException('Manual conflict resolution required');
    }

    try {
      // Apply schedule changes to issues
      const appliedChanges = await this.applyScheduleChanges(
        projectId,
        computedSchedule,
        request.applyOptions,
        userId
      );

      // Mark computed schedule as applied
      await this.markScheduleAsApplied(request.computedScheduleId, userId);

      return {
        success: true,
        appliedChanges,
        conflicts: conflicts.filter(c => c.severity === 'warning'), // Only return warnings
        rollbackId: this.generateRollbackId()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to apply schedule: ${error.message}`);
    }
  }

  async previewSchedule(
    projectId: string,
    computedScheduleId: string
  ): Promise<SchedulePreviewResponse> {
    await this.validateProject(projectId);
    const computedSchedule = await this.getComputedSchedule(computedScheduleId);

    if (computedSchedule.projectId !== projectId) {
      throw new BadRequestException('Computed schedule does not belong to this project');
    }

    // Get current issues to compare
    const currentIssues = await this.getProjectIssues(projectId);
    const taskSchedules = computedSchedule.taskSchedules as TaskSchedule[];
    
    // Calculate changes
    const changedTasks = this.calculateChangedTasks(currentIssues, taskSchedules);
    const estimatedSavingsHours = this.calculateTimeSavings(changedTasks);

    return {
      computedSchedule: {
        taskSchedules,
        projectEndDate: computedSchedule.computedEndDate,
        totalDuration: computedSchedule.totalDuration,
        criticalPathTasks: computedSchedule.criticalPath
      },
      changedTasks,
      affectedTasks: changedTasks.length,
      estimatedSavingsHours
    };
  }

  async resolveConflicts(
    projectId: string,
    request: ConflictResolutionRequest,
    userId: string
  ): Promise<ConflictResolutionResponse> {
    return this.conflictResolutionService.resolveConflict(projectId, request, userId);
  }

  // Private helper methods

  private async validateProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async getProjectIssues(projectId: string) {
    return this.prisma.issue.findMany({
      where: { projectId }
    });
  }

  private async getProjectDependencies(projectId: string) {
    return this.prisma.dependency.findMany({
      where: {
        predecessor: { projectId }
      },
      include: {
        predecessor: true,
        successor: true
      }
    });
  }

  private async calculateCPMSchedule(issues: any[], dependencies: any[], constraints: any) {
    // Implementation will be completed in algorithm implementation phase
    const forwardPass = new ForwardPass();
    const backwardPass = new BackwardPass();
    const dummyConstraints = {
      startDate: new Date(),
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
      workingHoursPerDay: 8,
      holidays: [],
      resourceConstraints: new Map(),
      mandatoryDates: new Map()
    };
    const constraintSolver = new ConstraintSolver(dummyConstraints);

    // Stub implementation
    return {
      schedule: this.createStubSchedule(issues),
      conflicts: []
    };
  }

  private async calculateSimpleSchedule(issues: any[], dependencies: any[], constraints: any) {
    // Simple sequential scheduling implementation
    return {
      schedule: this.createStubSchedule(issues),
      conflicts: []
    };
  }

  private createStubSchedule(issues: any[]): ComputedSchedule {
    const taskSchedules: TaskSchedule[] = issues.map(issue => ({
      taskId: issue.id,
      originalStartDate: issue.startDate || new Date(),
      originalEndDate: issue.dueDate || new Date(),
      computedStartDate: issue.startDate || new Date(),
      computedEndDate: issue.dueDate || new Date(),
      floatTime: 0,
      criticalPath: false
    }));

    return {
      taskSchedules,
      projectEndDate: new Date(),
      totalDuration: 30,
      criticalPathTasks: []
    };
  }

  private async saveComputedSchedule(
    projectId: string,
    userId: string,
    request: ScheduleCalculateRequest,
    schedule: ComputedSchedule,
    conflicts: ConflictInfo[]
  ) {
    // Save to database using Prisma JSON columns
    // Implementation will be completed when database schema is ready
    return new ComputedScheduleEntity({
      id: this.generateId(),
      projectId,
      calculatedAt: new Date(),
      calculatedBy: userId,
      algorithm: request.options.algorithm,
      originalEndDate: new Date(),
      computedEndDate: schedule.projectEndDate,
      totalDuration: schedule.totalDuration,
      constraints: request.constraints,
      taskSchedules: schedule.taskSchedules,
      criticalPath: schedule.criticalPathTasks,
      conflicts,
      applied: false
    });
  }

  private async getComputedSchedule(id: string): Promise<ComputedScheduleEntity> {
    // Stub - will implement database lookup
    throw new NotFoundException('Computed schedule not found');
  }

  private async applyScheduleChanges(
    projectId: string,
    computedSchedule: ComputedScheduleEntity,
    options: any,
    userId: string
  ): Promise<number> {
    // Implementation stub
    return 0;
  }

  private async markScheduleAsApplied(id: string, userId: string) {
    // Implementation stub
  }

  private generateOptimizationSuggestions(schedule: ComputedSchedule, conflicts: ConflictInfo[]): string[] {
    const suggestions: string[] = [];
    
    if (conflicts.length > 0) {
      suggestions.push(`${conflicts.length} conflicts detected - consider adjusting task dependencies`);
    }
    
    if (schedule.criticalPathTasks.length > schedule.taskSchedules.length * 0.3) {
      suggestions.push('High number of critical path tasks - consider resource optimization');
    }

    return suggestions;
  }

  private calculateChangedTasks(currentIssues: any[], scheduledTasks: TaskSchedule[]): TaskSchedule[] {
    // Implementation stub
    return scheduledTasks.filter(task => {
      const currentIssue = currentIssues.find(issue => issue.id === task.taskId);
      return currentIssue && (
        currentIssue.startDate?.getTime() !== task.computedStartDate.getTime() ||
        currentIssue.dueDate?.getTime() !== task.computedEndDate.getTime()
      );
    });
  }

  private calculateTimeSavings(changedTasks: TaskSchedule[]): number {
    // Simple estimation - will be enhanced later
    return changedTasks.length * 2; // Estimate 2 hours saved per optimized task
  }

  private generateRollbackId(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}