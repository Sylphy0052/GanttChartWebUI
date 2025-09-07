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
import { ForwardPass, TaskNode } from './algorithms/forward-pass';
import { BackwardPass, BackwardPassResult } from './algorithms/backward-pass';
import { ConstraintSolver } from './algorithms/constraint-solver';

// AC4: Incremental scheduling update interface
interface IncrementalUpdateResult {
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
interface CalendarConfiguration {
  workingDays: number[];
  workingHoursPerDay: number;
  holidays: Date[];
  workingTimeSlots: Array<{
    startTime: string; // "09:00"
    endTime: string;   // "17:00"
  }>;
  timezone: string;
}

@Injectable()
export class SchedulingService {
  constructor(
    private prisma: PrismaService,
    private conflictResolutionService: ConflictResolutionService,
    private auditLogService: AuditLogService
  ) {}

  // AC7: Full schedule calculation with complete CPM implementation
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

  // AC7: Incremental update endpoint
  async calculateIncrementalUpdate(
    projectId: string,
    changedTaskIds: string[],
    request: ScheduleCalculateRequest,
    userId: string
  ): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();

    try {
      // Validate project and get current schedule
      await this.validateProject(projectId);
      const issues = await this.getProjectIssues(projectId);
      const dependencies = await this.getProjectDependencies(projectId);

      // AC4: Determine affected task chain for incremental update
      const affectedTaskIds = await this.determineAffectedTaskChain(changedTaskIds, dependencies);
      
      // Only recalculate affected tasks
      const affectedIssues = issues.filter(issue => affectedTaskIds.includes(issue.id));
      const relevantDependencies = dependencies.filter(dep => 
        affectedTaskIds.includes(dep.predecessor.id) || affectedTaskIds.includes(dep.successor.id)
      );

      // Perform incremental CPM calculation
      const result = await this.calculateCPMSchedule(affectedIssues, relevantDependencies, request.constraints);
      
      const calculationTime = Date.now() - startTime;
      const optimizationRatio = affectedTaskIds.length / issues.length;

      return {
        affectedTaskIds,
        updatedTaskSchedules: result.schedule.taskSchedules,
        newCriticalPath: result.schedule.criticalPathTasks,
        performanceMetrics: {
          tasksRecalculated: affectedTaskIds.length,
          calculationTime,
          optimizationRatio
        }
      };
    } catch (error) {
      throw new BadRequestException(`Incremental update failed: ${error.message}`);
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

  // AC2 & AC3: Complete CPM implementation with backward pass and critical path analysis
  private async calculateCPMSchedule(issues: any[], dependencies: any[], constraints: any) {
    try {
      // Convert issues and dependencies to TaskNode format for forward pass
      const taskNodes: TaskNode[] = this.convertIssuesToTaskNodes(issues, dependencies);
      
      // AC5: Extract enhanced calendar constraints from request
      const calendarConfig: CalendarConfiguration = {
        workingDays: constraints?.workingDays || [1, 2, 3, 4, 5], // Mon-Fri
        workingHoursPerDay: constraints?.workingHoursPerDay || 8,
        holidays: (constraints?.holidays || []).map((h: string) => new Date(h)),
        workingTimeSlots: constraints?.workingTimeSlots || [{ startTime: '09:00', endTime: '17:00' }],
        timezone: constraints?.timezone || 'UTC'
      };

      const projectStartDate = constraints?.startDate ? new Date(constraints.startDate) : new Date();
      const projectDeadline = constraints?.deadline ? new Date(constraints.deadline) : undefined;

      // Initialize forward pass algorithm with enhanced calendar support
      const forwardPass = new ForwardPass(
        calendarConfig.workingDays,
        calendarConfig.workingHoursPerDay,
        calendarConfig.holidays
      );

      // AC1: Perform forward pass calculation (already implemented)
      const forwardPassResult = forwardPass.calculate(
        taskNodes,
        projectStartDate,
        {
          workingDays: calendarConfig.workingDays,
          workingHoursPerDay: calendarConfig.workingHoursPerDay,
          holidays: calendarConfig.holidays
        }
      );

      // AC2: Perform backward pass calculation
      const backwardPass = new BackwardPass();
      const backwardPassResult: BackwardPassResult = backwardPass.calculate(
        forwardPassResult,
        projectDeadline
      );

      // AC3: Convert results with complete CPM data including float and critical path
      const computedSchedule = this.convertCPMResultToSchedule(
        forwardPassResult,
        backwardPassResult,
        projectStartDate,
        forwardPass
      );

      // AC6: Enhanced conflict detection with comprehensive error reporting
      const conflicts = this.detectAdvancedSchedulingConflicts(
        forwardPassResult,
        backwardPassResult,
        taskNodes,
        calendarConfig,
        projectDeadline
      );

      return {
        schedule: computedSchedule,
        conflicts
      };
    } catch (error) {
      throw new BadRequestException(`CPM calculation failed: ${error.message}`);
    }
  }

  // AC4: Determine affected task chain for incremental updates
  private async determineAffectedTaskChain(changedTaskIds: string[], dependencies: any[]): Promise<string[]> {
    const affectedTasks = new Set<string>(changedTaskIds);
    const visited = new Set<string>();

    // Trace forward through successors
    const traceForward = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      dependencies
        .filter(dep => dep.predecessor.id === taskId)
        .forEach(dep => {
          affectedTasks.add(dep.successor.id);
          traceForward(dep.successor.id);
        });
    };

    // Trace backward through predecessors
    const traceBackward = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      dependencies
        .filter(dep => dep.successor.id === taskId)
        .forEach(dep => {
          affectedTasks.add(dep.predecessor.id);
          traceBackward(dep.predecessor.id);
        });
    };

    // Start tracing from changed tasks
    changedTaskIds.forEach(taskId => {
      traceForward(taskId);
      traceBackward(taskId);
    });

    return Array.from(affectedTasks);
  }

  private convertIssuesToTaskNodes(issues: any[], dependencies: any[]): TaskNode[] {
    const taskNodes: TaskNode[] = [];

    // Create a map for quick dependency lookup
    const dependencyMap = new Map<string, any[]>();
    dependencies.forEach(dep => {
      const successorId = dep.successor.id;
      if (!dependencyMap.has(successorId)) {
        dependencyMap.set(successorId, []);
      }
      dependencyMap.get(successorId)!.push({
        id: dep.predecessor.id,
        type: dep.type || 'FS', // Default to Finish-to-Start
        lag: dep.lag || 0
      });
    });

    // Convert issues to TaskNodes
    issues.forEach(issue => {
      const predecessors = dependencyMap.get(issue.id) || [];
      
      // Find successors by looking through dependencies
      const successors = dependencies
        .filter(dep => dep.predecessor.id === issue.id)
        .map(dep => ({
          id: dep.successor.id,
          type: dep.type || 'FS',
          lag: dep.lag || 0
        }));

      // Calculate duration in days from estimate
      const durationInDays = this.convertEstimateToDays(
        issue.estimateValue || 1,
        issue.estimateUnit || 'h'
      );

      const taskNode: TaskNode = {
        id: issue.id,
        title: issue.title,
        duration: durationInDays,
        startDate: issue.startDate || new Date(),
        endDate: issue.dueDate || new Date(),
        assigneeId: issue.assigneeId,
        predecessors,
        successors,
        earliestStart: 0, // Will be calculated by forward pass
        earliestFinish: 0, // Will be calculated by forward pass
        isCompleted: issue.status === 'done',
        progress: issue.progress || 0
      };

      taskNodes.push(taskNode);
    });

    return taskNodes;
  }

  private convertEstimateToDays(value: number, unit: string): number {
    switch (unit) {
      case 'h':
        return Math.max(0.125, value / 8); // Convert hours to days, minimum 1 hour = 0.125 days
      case 'd':
        return Math.max(0.125, value);
      default:
        return Math.max(0.125, value / 8); // Default to hours
    }
  }

  // AC2 & AC3: Convert CPM results with backward pass data
  private convertCPMResultToSchedule(
    forwardPassResult: any,
    backwardPassResult: BackwardPassResult,
    projectStartDate: Date,
    forwardPass: ForwardPass
  ): ComputedSchedule {
    const taskSchedules: TaskSchedule[] = [];
    
    backwardPassResult.tasks.forEach((taskNode, taskId) => {
      // Calculate actual dates from working days
      const computedStartDate = forwardPass.addWorkingDays(
        projectStartDate,
        taskNode.earliestStart
      );
      const computedEndDate = forwardPass.addWorkingDays(
        projectStartDate,
        taskNode.earliestFinish
      );

      // AC3: Include float time and critical path information
      taskSchedules.push({
        taskId,
        originalStartDate: taskNode.startDate,
        originalEndDate: taskNode.endDate,
        computedStartDate,
        computedEndDate,
        floatTime: taskNode.totalFloat, // AC3: Total float from backward pass
        criticalPath: taskNode.isCritical, // AC3: Critical path flag
        // Additional CPM data
        latestStart: forwardPass.addWorkingDays(projectStartDate, taskNode.latestStart),
        latestFinish: forwardPass.addWorkingDays(projectStartDate, taskNode.latestFinish),
        freeFloat: taskNode.freeFloat
      });
    });

    // Calculate project end date from backward pass
    const maxLatestFinish = Math.max(...Array.from(backwardPassResult.tasks.values())
      .map(task => task.latestFinish));
    
    const projectEndDate = forwardPass.addWorkingDays(
      projectStartDate,
      maxLatestFinish
    );

    return {
      taskSchedules,
      projectEndDate,
      totalDuration: maxLatestFinish,
      criticalPathTasks: backwardPassResult.criticalPath, // AC3: True critical path
      // Additional backward pass insights
      criticalPathStats: {
        length: backwardPassResult.criticalPath.length,
        totalTasks: taskSchedules.length,
        criticalRatio: backwardPassResult.criticalPath.length / taskSchedules.length,
        avgFloatTime: Array.from(backwardPassResult.totalFloat.values()).reduce((a, b) => a + b, 0) / taskSchedules.length
      }
    };
  }

  // AC6: Enhanced conflict detection with comprehensive error reporting  
  private detectAdvancedSchedulingConflicts(
    forwardPassResult: any,
    backwardPassResult: BackwardPassResult,
    taskNodes: TaskNode[],
    calendarConfig: CalendarConfiguration,
    projectDeadline?: Date
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Existing basic conflict detection
    forwardPassResult.tasks.forEach((taskNode: TaskNode) => {
      // Check for impossible dates (negative duration, etc.)
      if (taskNode.earliestStart < 0) {
        conflicts.push({
          id: `negative_start_${taskNode.id}`,
          type: 'scheduling',
          severity: 'error',
          description: `Task "${taskNode.title}" has negative start time due to impossible dependency constraints`,
          affectedTasks: [taskNode.id],
          suggestedActions: [
            'Review task dependencies for circular references',
            'Adjust dependency lag times',
            'Consider breaking complex dependencies into smaller tasks'
          ]
        });
      }

      if (taskNode.earliestFinish <= taskNode.earliestStart) {
        conflicts.push({
          id: `invalid_duration_${taskNode.id}`,
          type: 'scheduling',
          severity: 'error',
          description: `Task "${taskNode.title}" has invalid duration (${taskNode.duration} days)`,
          affectedTasks: [taskNode.id],
          suggestedActions: [
            'Set minimum duration of 1 hour (0.125 days)',
            'Review task estimate and complexity',
            'Split task into smaller, measurable units'
          ]
        });
      }
    });

    // AC6: Advanced conflict detection using backward pass results
    backwardPassResult.tasks.forEach(task => {
      // Detect over-allocated resources
      if (task.totalFloat < 0) {
        conflicts.push({
          id: `negative_float_${task.id}`,
          type: 'resource_conflict',
          severity: 'error',
          description: `Task "${task.title}" has negative float (${task.totalFloat.toFixed(1)} days) - impossible to complete on time`,
          affectedTasks: [task.id],
          suggestedActions: [
            'Extend project deadline',
            'Reduce task scope or duration',
            'Reallocate resources from non-critical path tasks',
            'Parallelize dependencies where possible'
          ]
        });
      }

      // Detect near-critical tasks that could become critical
      if (task.totalFloat > 0 && task.totalFloat <= 1 && !task.isCritical) {
        conflicts.push({
          id: `near_critical_${task.id}`,
          type: 'scheduling',
          severity: 'warning',
          description: `Task "${task.title}" has minimal float (${task.totalFloat.toFixed(1)} days) and could become critical`,
          affectedTasks: [task.id],
          suggestedActions: [
            'Monitor task progress closely',
            'Prepare contingency resources',
            'Consider starting task earlier if possible'
          ]
        });
      }

      // AC5: Calendar-based conflicts
      if (calendarConfig.holidays.length > 0) {
        const taskDuration = task.duration;
        const holidaysInPeriod = this.countHolidaysInPeriod(task.startDate, task.endDate, calendarConfig.holidays);
        
        if (holidaysInPeriod > taskDuration * 0.3) {
          conflicts.push({
            id: `holiday_conflict_${task.id}`,
            type: 'calendar_conflict',
            severity: 'warning',
            description: `Task "${task.title}" has ${holidaysInPeriod} holidays during its ${taskDuration.toFixed(1)} day duration`,
            affectedTasks: [task.id],
            suggestedActions: [
              'Adjust task scheduling to avoid major holiday periods',
              'Account for extended duration due to non-working days',
              'Consider resource availability during holidays'
            ]
          });
        }
      }
    });

    // Deadline conflicts
    if (projectDeadline) {
      const projectCompletionDate = Math.max(...Array.from(backwardPassResult.tasks.values())
        .map(task => task.latestFinish));
      
      if (projectCompletionDate > this.dateToWorkingDays(projectDeadline)) {
        const overrun = projectCompletionDate - this.dateToWorkingDays(projectDeadline);
        conflicts.push({
          id: `deadline_overrun`,
          type: 'deadline_conflict', 
          severity: 'error',
          description: `Project completion date exceeds deadline by ${overrun.toFixed(1)} working days`,
          affectedTasks: backwardPassResult.criticalPath,
          suggestedActions: [
            'Compress critical path activities',
            'Add resources to critical path tasks',
            'Negotiate deadline extension',
            'Reduce project scope',
            'Implement fast-tracking or crashing techniques'
          ]
        });
      }
    }

    // Resource over-allocation detection
    const resourceAllocations = this.analyzeResourceAllocations(backwardPassResult.tasks);
    resourceAllocations.forEach(allocation => {
      if (allocation.overallocation > 1.5) { // 150% allocation
        conflicts.push({
          id: `resource_overallocation_${allocation.resourceId}`,
          type: 'resource_conflict',
          severity: 'error',
          description: `Resource ${allocation.resourceId} is over-allocated by ${((allocation.overallocation - 1) * 100).toFixed(0)}%`,
          affectedTasks: allocation.conflictingTasks,
          suggestedActions: [
            'Redistribute tasks among team members',
            'Adjust task scheduling to reduce resource conflicts',
            'Add additional resources or team members',
            'Consider task dependencies to sequence work better'
          ]
        });
      }
    });

    return conflicts;
  }

  // AC5: Helper methods for calendar integration
  private countHolidaysInPeriod(startDate: Date, endDate: Date, holidays: Date[]): number {
    return holidays.filter(holiday => 
      holiday >= startDate && holiday <= endDate
    ).length;
  }

  private dateToWorkingDays(date: Date): number {
    // Convert date to working days from epoch - simplified implementation
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor(date.getTime() / msPerDay);
  }

  private analyzeResourceAllocations(tasks: Map<string, any>) {
    const resourceMap = new Map<string, { tasks: string[], totalAllocation: number }>();
    
    tasks.forEach(task => {
      if (task.assigneeId) {
        if (!resourceMap.has(task.assigneeId)) {
          resourceMap.set(task.assigneeId, { tasks: [], totalAllocation: 0 });
        }
        const resource = resourceMap.get(task.assigneeId)!;
        resource.tasks.push(task.id);
        resource.totalAllocation += task.duration;
      }
    });

    return Array.from(resourceMap.entries()).map(([resourceId, data]) => ({
      resourceId,
      overallocation: data.totalAllocation / 40, // Assuming 40-hour work weeks
      conflictingTasks: data.tasks
    }));
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

  // AC1: Implement actual database operations for ComputedSchedule materialized view
  private async saveComputedSchedule(
    projectId: string,
    userId: string,
    request: ScheduleCalculateRequest,
    schedule: ComputedSchedule,
    conflicts: ConflictInfo[]
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Create computed schedule record
      const computedSchedule = await tx.computedSchedule.create({
        data: {
          projectId,
          calculatedAt: new Date(),
          calculatedBy: userId,
          algorithm: request.options.algorithm,
          originalEndDate: new Date(), // Current project end date
          computedEndDate: schedule.projectEndDate,
          totalDuration: schedule.totalDuration,
          constraints: request.constraints as any,
          taskSchedules: schedule.taskSchedules as any,
          criticalPath: schedule.criticalPathTasks,
          conflicts: conflicts as any,
          applied: false
        }
      });

      // Create task schedule history records for materialized view
      const taskHistoryRecords = schedule.taskSchedules.map(task => ({
        taskId: task.taskId,
        computedScheduleId: computedSchedule.id,
        originalStartDate: task.originalStartDate,
        originalEndDate: task.originalEndDate,
        computedStartDate: task.computedStartDate,
        computedEndDate: task.computedEndDate,
        floatTime: Math.round(task.floatTime * 1440), // Convert days to minutes
        criticalPath: task.criticalPath,
        conflicts: {} as any
      }));

      await tx.taskScheduleHistory.createMany({
        data: taskHistoryRecords
      });

      // Trigger materialized view refresh
      await tx.$executeRaw`SELECT refresh_computed_schedule_view(${projectId}::uuid);`;

      return new ComputedScheduleEntity({
        id: computedSchedule.id,
        projectId: computedSchedule.projectId,
        calculatedAt: computedSchedule.calculatedAt,
        calculatedBy: computedSchedule.calculatedBy,
        algorithm: computedSchedule.algorithm,
        originalEndDate: computedSchedule.originalEndDate,
        computedEndDate: computedSchedule.computedEndDate,
        totalDuration: computedSchedule.totalDuration,
        constraints: computedSchedule.constraints as any,
        taskSchedules: computedSchedule.taskSchedules as any,
        criticalPath: computedSchedule.criticalPath,
        conflicts: computedSchedule.conflicts as any,
        applied: computedSchedule.applied,
        appliedAt: computedSchedule.appliedAt,
        rollbackId: computedSchedule.rollbackId
      });
    });
  }

  private async getComputedSchedule(id: string): Promise<ComputedScheduleEntity> {
    const computedSchedule = await this.prisma.computedSchedule.findUnique({
      where: { id },
      include: {
        taskHistory: true
      }
    });

    if (!computedSchedule) {
      throw new NotFoundException('Computed schedule not found');
    }

    return new ComputedScheduleEntity({
      id: computedSchedule.id,
      projectId: computedSchedule.projectId,
      calculatedAt: computedSchedule.calculatedAt,
      calculatedBy: computedSchedule.calculatedBy,
      algorithm: computedSchedule.algorithm,
      originalEndDate: computedSchedule.originalEndDate,
      computedEndDate: computedSchedule.computedEndDate,
      totalDuration: computedSchedule.totalDuration,
      constraints: computedSchedule.constraints as any,
      taskSchedules: computedSchedule.taskSchedules as any,
      criticalPath: computedSchedule.criticalPath,
      conflicts: computedSchedule.conflicts as any,
      applied: computedSchedule.applied,
      appliedAt: computedSchedule.appliedAt,
      rollbackId: computedSchedule.rollbackId
    });
  }

  private async applyScheduleChanges(
    projectId: string,
    computedSchedule: ComputedScheduleEntity,
    options: any,
    userId: string
  ): Promise<number> {
    const taskSchedules = computedSchedule.taskSchedules;
    let changesApplied = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const taskSchedule of taskSchedules) {
        await tx.issue.update({
          where: { id: taskSchedule.taskId },
          data: {
            startDate: taskSchedule.computedStartDate,
            dueDate: taskSchedule.computedEndDate,
            floatTime: Math.round(taskSchedule.floatTime * 1440), // Convert to minutes
            lastScheduledAt: new Date()
          }
        });
        changesApplied++;
      }

      // Trigger materialized view refresh after applying changes
      await tx.$executeRaw`SELECT refresh_computed_schedule_view(${projectId}::uuid);`;
    });

    return changesApplied;
  }

  private async markScheduleAsApplied(id: string, userId: string) {
    await this.prisma.computedSchedule.update({
      where: { id },
      data: {
        applied: true,
        appliedAt: new Date()
      }
    });
  }

  private generateOptimizationSuggestions(schedule: ComputedSchedule, conflicts: ConflictInfo[]): string[] {
    const suggestions: string[] = [];
    
    if (conflicts.length > 0) {
      const errorConflicts = conflicts.filter(c => c.severity === 'error').length;
      const warningConflicts = conflicts.filter(c => c.severity === 'warning').length;
      
      if (errorConflicts > 0) {
        suggestions.push(`${errorConflicts} critical conflicts require immediate attention`);
      }
      if (warningConflicts > 0) {
        suggestions.push(`${warningConflicts} potential issues detected - review scheduling constraints`);
      }
    }
    
    const criticalPathRatio = schedule.criticalPathTasks.length / schedule.taskSchedules.length;
    if (criticalPathRatio > 0.3) {
      suggestions.push(`High critical path ratio (${(criticalPathRatio * 100).toFixed(0)}%) - consider resource optimization and task parallelization`);
    }

    // Check for optimization opportunities based on float time
    const lowFloatTasks = schedule.taskSchedules.filter(task => 
      task.floatTime > 0 && task.floatTime <= 2 && !task.criticalPath
    ).length;
    
    if (lowFloatTasks > 0) {
      suggestions.push(`${lowFloatTasks} tasks have minimal float time - monitor closely for schedule risk`);
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
    // Enhanced estimation considering float time and critical path
    return changedTasks.reduce((total, task) => {
      // Critical path optimizations save more time
      const baseSavings = task.criticalPath ? 4 : 2;
      // Tasks with high float have less optimization potential
      const floatFactor = task.floatTime > 5 ? 0.5 : 1;
      return total + (baseSavings * floatFactor);
    }, 0);
  }

  private generateRollbackId(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}