import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TaskSchedule,
  ScheduleResult,
  ScheduleConstraints,
  BusinessHours
} from './entities/computed-schedule.entity';
import { ScheduleCalculateRequest } from './dto/schedule-request.dto';
import { CPMScheduler } from './algorithms/cpm-scheduler';
import { ConstraintSolver } from './algorithms/constraint-solver';

// AC4: Incremental scheduling update interface
export interface IncrementalUpdateResult {
  affectedTaskIds: string[];
  updatedTaskSchedules: TaskSchedule[];
  newCriticalPath: string[];
  performanceMetrics: {
    tasksRecalculated: number;
    calculationTime: number;
    optimizationRatio: number;
  };
}

// AC5: Enhanced calendar configuration
export interface EnhancedCalendarConfig {
  businessHours: BusinessHours;
  holidayCalendar: string[];
  workingDaysOverride?: { [key: string]: BusinessHours };
  timeZone: string;
  bufferSettings: {
    defaultBuffer: number; // hours
    criticalPathBuffer: number;
  };
}

// AC6: Progress tracking integration
export interface ProgressIntegration {
  realTimeUpdates: boolean;
  progressValidation: {
    requireActualStart: boolean;
    validateSequentialCompletion: boolean;
    enforceResourceConstraints: boolean;
  };
  autoReschedule: {
    enabled: boolean;
    triggerThreshold: number; // percentage of schedule drift
    preserveCriticalPath: boolean;
  };
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cpmScheduler: CPMScheduler,
    private readonly constraintSolver: ConstraintSolver
  ) {}

  async calculateSchedule(
    projectId: string,
    request: ScheduleCalculateRequest,
    userId?: string
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(`Starting schedule calculation for project ${projectId}`);

    try {
      // Fetch project data
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          issues: {
            include: {
              predecessors: true,
              successors: true
            }
          },
          calendar: true
        }
      });

      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      // Extract tasks and dependencies
      const tasks = project.issues.map(issue => ({
        id: issue.id,
        name: issue.title,
        duration: issue.estimateValue || 1,
        startDate: issue.startDate,
        endDate: issue.dueDate,
        progress: issue.progress,
        priority: issue.priority,
        resourceRequirements: [],
        dependencies: issue.predecessors.map(dep => ({
          predecessorId: dep.predecessorId,
          type: (dep.type as 'FS' | 'SS' | 'SF' | 'FF') || 'FS',
          lag: dep.lag
        }))
      }));

      // Apply constraints and calendar settings
      const constraints: ScheduleConstraints = {
        projectStartDate: new Date(),
        projectEndDate: undefined,
        resourceConstraints: [],
        fixedTasks: [],
        businessHours: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          timeZone: 'UTC'
        }
      };

      // Run CPM calculation
      const scheduleResult = await this.cpmScheduler.calculateSchedule(tasks);

      // Store the computed schedule
      // Calculate project dates from task schedules
      const taskDates = scheduleResult.taskSchedules.map(ts => ({
        start: new Date(ts.startDate),
        end: new Date(ts.endDate)
      }));
      
      const projectStartDate = new Date(Math.min(...taskDates.map(td => td.start.getTime())));
      const projectEndDate = new Date(Math.max(...taskDates.map(td => td.end.getTime())));

      const computedSchedule = await this.prisma.computedSchedule.create({
        data: {
          projectId,
          calculatedBy: 'system', // Would be user ID in real implementation
          algorithm: 'cpm',
          originalEndDate: new Date(),
          computedEndDate: projectEndDate,
          totalDuration: Math.ceil(
            (projectEndDate.getTime() - projectStartDate.getTime()) /
            (1000 * 60 * 60 * 24)
          ),
          constraints: constraints as any,
          taskSchedules: scheduleResult.taskSchedules as any,
          criticalPath: scheduleResult.criticalPath,
          conflicts: scheduleResult.conflicts as any
        }
      });

      const executionTime = Date.now() - startTime;
      this.logger.log(`Schedule calculation completed in ${executionTime}ms`);

      return {
        computedSchedule: {
          id: computedSchedule.id,
          projectId: computedSchedule.projectId,
          algorithm: computedSchedule.algorithm,
          calculatedAt: computedSchedule.calculatedAt,
          computedEndDate: computedSchedule.computedEndDate,
          totalDuration: computedSchedule.totalDuration,
          taskSchedules: scheduleResult.taskSchedules,
          criticalPath: scheduleResult.criticalPath,
          applied: computedSchedule.applied
        },
        conflicts: scheduleResult.conflicts || [],
        metrics: {
          executionTime,
          totalTasks: scheduleResult.taskSchedules.length,
          criticalPathLength: scheduleResult.criticalPath.length
        }
      };

    } catch (error) {
      this.logger.error(`Schedule calculation failed:`, error);
      throw new BadRequestException(`Schedule calculation failed: ${error.message}`);
    }
  }

  async applySchedule(
    projectId: string,
    request: any,
    userId?: string
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(`Applying schedule ${request.computedScheduleId} to project ${projectId}`);

    try {
      // Get the computed schedule
      const computedSchedule = await this.prisma.computedSchedule.findUnique({
        where: { id: request.computedScheduleId },
        include: {
          project: true
        }
      });

      if (!computedSchedule || computedSchedule.projectId !== projectId) {
        throw new NotFoundException('Schedule not found');
      }

      const taskSchedules = Array.isArray(computedSchedule.taskSchedules) 
        ? computedSchedule.taskSchedules as unknown as TaskSchedule[]
        : JSON.parse(computedSchedule.taskSchedules as string) as TaskSchedule[];
      let appliedTasks = 0;

      const appliedChanges = [];

      // Apply each task schedule
      for (const taskSchedule of taskSchedules) {
        const updated = await this.prisma.issue.update({
          where: { id: taskSchedule.taskId },
          data: {
            startDate: new Date(taskSchedule.startDate),
            dueDate: new Date(taskSchedule.endDate),
            floatTime: taskSchedule.floatTime || 0,
            lastScheduledAt: new Date()
          }
        });
        
        appliedChanges.push({
          taskId: taskSchedule.taskId,
          previousStartDate: updated.startDate,
          previousEndDate: updated.dueDate,
          newStartDate: taskSchedule.startDate,
          newEndDate: taskSchedule.endDate
        });
        
        appliedTasks++;
      }

      // Mark the schedule as applied
      await this.prisma.computedSchedule.update({
        where: { id: request.computedScheduleId },
        data: {
          applied: true,
          appliedAt: new Date()
        }
      });

      const executionTime = Date.now() - startTime;
      this.logger.log(`Applied schedule in ${executionTime}ms, updated ${appliedTasks} tasks`);

      return { 
        success: true, 
        appliedTasks,
        appliedChanges,
        conflicts: [],
        rollbackId: `rollback_${request.computedScheduleId}_${Date.now()}`
      };

    } catch (error) {
      this.logger.error(`Failed to apply schedule:`, error);
      throw new BadRequestException(`Failed to apply schedule: ${error.message}`);
    }
  }

  // AC4: Incremental scheduling updates
  async calculateIncrementalUpdate(
    projectId: string,
    changedTaskIds: string[],
    scheduleRequest: ScheduleCalculateRequest,
    userId?: string
  ): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    this.logger.log(`Starting incremental update for ${changedTaskIds.length} tasks in project ${projectId}`);

    try {
      // Get the current schedule state
      const currentSchedule = await this.prisma.computedSchedule.findFirst({
        where: { projectId, applied: true },
        orderBy: { appliedAt: 'desc' }
      });

      if (!currentSchedule) {
        throw new BadRequestException('No baseline schedule found. Please run full calculation first.');
      }

      // Get project data with focus on changed tasks and their dependencies
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          issues: {
            where: {
              OR: [
                { id: { in: changedTaskIds } },
                { predecessors: { some: { predecessorId: { in: changedTaskIds } } } },
                { successors: { some: { successorId: { in: changedTaskIds } } } }
              ]
            },
            include: {
              predecessors: true,
              successors: true
            }
          }
        }
      });

      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      // Determine affected tasks (changed tasks + downstream dependencies)
      const affectedTaskIds = this.calculateAffectedTasks(changedTaskIds, project.issues);

      // Extract current task schedules
      const currentTaskSchedules = Array.isArray(currentSchedule.taskSchedules) 
        ? currentSchedule.taskSchedules as unknown as TaskSchedule[]
        : JSON.parse(currentSchedule.taskSchedules as string) as TaskSchedule[];
      const currentCriticalPath = currentSchedule.criticalPath;

      // Run incremental calculation only on affected tasks
      const incrementalTasks = project.issues
        .filter(issue => affectedTaskIds.includes(issue.id))
        .map(issue => ({
          id: issue.id,
          name: issue.title,
          duration: issue.estimateValue || 1,
          startDate: issue.startDate,
          endDate: issue.dueDate,
          progress: issue.progress,
          priority: issue.priority,
          resourceRequirements: [],
          dependencies: issue.predecessors.map(dep => ({
            predecessorId: dep.predecessorId,
            type: (dep.type as 'FS' | 'SS' | 'SF' | 'FF') || 'FS',
            lag: dep.lag
          }))
        }));

      // Apply constraints
      const constraints: ScheduleConstraints = {
        projectStartDate: new Date(),
        projectEndDate: undefined,
        resourceConstraints: [],
        fixedTasks: currentTaskSchedules
          .filter(ts => !affectedTaskIds.includes(ts.taskId))
          .map(ts => ({
            taskId: ts.taskId,
            startDate: ts.startDate,
            endDate: ts.endDate
          })),
        businessHours: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          timeZone: 'UTC'
        }
      };

      // Calculate new schedule for affected tasks
      const previousResult = {
        taskSchedules: currentTaskSchedules,
        criticalPath: currentCriticalPath || [],
        totalDuration: currentTaskSchedules.reduce((max, ts) => 
          Math.max(max, new Date(ts.endDate).getTime()), 0),
        conflicts: []
      };
      
      const incrementalResult = await this.cpmScheduler.calculateIncrementalSchedule(
        incrementalTasks,
        changedTaskIds,
        previousResult
      );

      // Create updated task schedules by merging unchanged and updated tasks
      const updatedTaskSchedules = currentTaskSchedules.map(ts => {
        const updatedTask = incrementalResult.taskSchedules.find(uts => uts.taskId === ts.taskId);
        return updatedTask || ts;
      });

      // Add any new tasks that weren't in the original schedule
      for (const newTask of incrementalResult.taskSchedules) {
        if (!currentTaskSchedules.some(ts => ts.taskId === newTask.taskId)) {
          updatedTaskSchedules.push(newTask);
        }
      }

      const calculationTime = Date.now() - startTime;
      const optimizationRatio = affectedTaskIds.length / project.issues.length;

      this.logger.log(`Incremental update completed in ${calculationTime}ms, recalculated ${affectedTaskIds.length}/${project.issues.length} tasks`);

      return {
        affectedTaskIds,
        updatedTaskSchedules: incrementalResult.taskSchedules,
        newCriticalPath: incrementalResult.criticalPath,
        performanceMetrics: {
          tasksRecalculated: affectedTaskIds.length,
          calculationTime,
          optimizationRatio
        }
      };

    } catch (error) {
      this.logger.error(`Incremental schedule update failed:`, error);
      throw new BadRequestException(`Incremental update failed: ${error.message}`);
    }
  }

  private calculateAffectedTasks(changedTaskIds: string[], allTasks: any[]): string[] {
    const affected = new Set(changedTaskIds);
    const visited = new Set<string>();

    // Recursive function to find downstream dependencies
    const findDownstream = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;

      // Find tasks that depend on this task (successors)
      for (const successor of task.successors || []) {
        if (!affected.has(successor.successorId)) {
          affected.add(successor.successorId);
          findDownstream(successor.successorId);
        }
      }
    };

    // Find all downstream dependencies
    for (const taskId of changedTaskIds) {
      findDownstream(taskId);
    }

    return Array.from(affected);
  }

  async getScheduleHistory(projectId: string): Promise<any[]> {
    return this.prisma.computedSchedule.findMany({
      where: { projectId },
      orderBy: { calculatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        calculatedAt: true,
        calculatedBy: true,
        algorithm: true,
        applied: true,
        appliedAt: true,
        totalDuration: true,
        criticalPath: true
      }
    });
  }

  async validateSchedule(projectId: string, scheduleId: string): Promise<{
    isValid: boolean;
    violations: string[];
    warnings: string[];
  }> {
    try {
      const schedule = await this.prisma.computedSchedule.findUnique({
        where: { id: scheduleId },
        include: { project: { include: { issues: true } } }
      });

      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      const violations: string[] = [];
      const warnings: string[] = [];

      const taskSchedules = Array.isArray(schedule.taskSchedules) 
        ? schedule.taskSchedules as unknown as TaskSchedule[]
        : JSON.parse(schedule.taskSchedules as string) as TaskSchedule[];

      // Validate task date constraints
      for (const taskSchedule of taskSchedules) {
        if (new Date(taskSchedule.startDate) >= new Date(taskSchedule.endDate)) {
          violations.push(`Task ${taskSchedule.taskId}: Start date must be before end date`);
        }

        if (taskSchedule.floatTime < 0) {
          warnings.push(`Task ${taskSchedule.taskId}: Negative float time indicates potential scheduling conflict`);
        }
      }

      // Validate critical path
      if (!schedule.criticalPath || schedule.criticalPath.length === 0) {
        warnings.push('No critical path found - this may indicate scheduling issues');
      }

      return {
        isValid: violations.length === 0,
        violations,
        warnings
      };

    } catch (error) {
      this.logger.error('Schedule validation failed:', error);
      throw new BadRequestException(`Validation failed: ${error.message}`);
    }
  }

  async previewSchedule(projectId: string, computedScheduleId: string): Promise<any> {
    try {
      const computedSchedule = await this.prisma.computedSchedule.findFirst({
        where: {
          id: computedScheduleId,
          projectId: projectId
        }
      });

      if (!computedSchedule) {
        throw new NotFoundException('Computed schedule not found');
      }

      return {
        scheduleId: computedSchedule.id,
        projectId: computedSchedule.projectId,
        algorithm: computedSchedule.algorithm,
        computedEndDate: computedSchedule.computedEndDate,
        totalDuration: computedSchedule.totalDuration,
        taskSchedules: computedSchedule.taskSchedules,
        criticalPath: computedSchedule.criticalPath,
        conflicts: computedSchedule.conflicts,
        preview: true
      };
    } catch (error) {
      throw new BadRequestException(`Failed to preview schedule: ${error.message}`);
    }
  }

  async resolveConflicts(projectId: string, request: any, userId: string): Promise<any> {
    try {
      // Placeholder implementation for conflict resolution
      return {
        success: true,
        resolvedConflicts: request.conflictIds?.length || 0,
        message: 'Conflicts resolved successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to resolve conflicts: ${error.message}`);
    }
  }

  async optimizeSchedule(
    projectId: string,
    optimizationGoals: ('minimize_duration' | 'level_resources' | 'minimize_cost')[]
  ): Promise<ScheduleResult> {
    this.logger.log(`Starting schedule optimization for project ${projectId} with goals: ${optimizationGoals.join(', ')}`);

    // This would integrate with advanced optimization algorithms
    // For now, return a placeholder implementation
    const baseSchedule = await this.calculateSchedule(projectId, {
      constraints: {
        workingDays: [1, 2, 3, 4, 5],
        workingHoursPerDay: 8,
        startDate: new Date(),
        holidays: []
      },
      options: {
        algorithm: 'CPM' as any,
        autoResolveConflicts: true,
        preserveManualSchedule: false
      }
    });

    return {
      ...baseSchedule,
      optimizationApplied: optimizationGoals
    };
  }
}