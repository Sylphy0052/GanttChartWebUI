import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictInfo, ConflictType, ConflictSeverity } from '../dto/schedule-response.dto';

export enum ConflictPattern {
  UPDATE_CONFLICT = 'UPDATE_CONFLICT',       // Version mismatch during update
  DELETE_CONFLICT = 'DELETE_CONFLICT',       // Attempting to modify deleted resource
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',   // Scheduling conflicts with existing schedule
  DEPENDENCY_CONFLICT = 'DEPENDENCY_CONFLICT', // Dependency constraint violations
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT'    // Resource allocation conflicts
}

export interface ConflictContext {
  userId: string;
  timestamp: Date;
  operation: 'update' | 'delete' | 'schedule' | 'bulk';
  entityType: 'issue' | 'dependency' | 'project' | 'schedule';
  entityId: string;
  projectId: string;
}

export interface DetectedConflict {
  id: string;
  pattern: ConflictPattern;
  severity: ConflictSeverity;
  entityId: string;
  projectId: string;
  description: string;
  currentVersion: number;
  attemptedVersion: number;
  currentData: any;
  attemptedData: any;
  conflictFields: string[];
  timestamp: Date;
  suggestedResolution: string[];
}

@Injectable()
export class ConflictDetectionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Enhanced optimistic locking with detailed conflict analysis
   */
  async detectOptimisticConflict(
    entityType: 'issue' | 'dependency' | 'project',
    entityId: string,
    currentVersion: number,
    attemptedData: any,
    context: ConflictContext
  ): Promise<DetectedConflict | null> {
    let currentEntity: any;
    
    // Fetch current entity data
    switch (entityType) {
      case 'issue':
        currentEntity = await this.prisma.issue.findUnique({
          where: { id: entityId },
          include: {
            project: true,
            parentIssue: true,
            childIssues: true,
            predecessors: true,
            successors: true
          }
        });
        break;
      case 'dependency':
        currentEntity = await this.prisma.dependency.findUnique({
          where: { id: entityId },
          include: {
            project: true,
            predecessor: true,
            successor: true
          }
        });
        break;
      case 'project':
        currentEntity = await this.prisma.project.findUnique({
          where: { id: entityId },
          include: {
            issues: { where: { deletedAt: null } },
            dependencies: true
          }
        });
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    if (!currentEntity) {
      return this.createConflict(
        ConflictPattern.DELETE_CONFLICT,
        ConflictSeverity.ERROR,
        entityId,
        context.projectId,
        'Entity has been deleted',
        0,
        currentVersion,
        null,
        attemptedData,
        [],
        ['Entity no longer exists - refresh data']
      );
    }

    // Version conflict check
    if (currentEntity.version !== currentVersion) {
      const conflictFields = this.identifyConflictingFields(
        currentEntity,
        attemptedData,
        entityType
      );

      return this.createConflict(
        ConflictPattern.UPDATE_CONFLICT,
        conflictFields.length > 0 ? ConflictSeverity.ERROR : ConflictSeverity.WARNING,
        entityId,
        context.projectId,
        `Entity modified by another user (v${currentEntity.version} vs v${currentVersion})`,
        currentEntity.version,
        currentVersion,
        currentEntity,
        attemptedData,
        conflictFields,
        this.generateResolutionSuggestions(conflictFields, currentEntity, attemptedData)
      );
    }

    return null;
  }

  /**
   * Detect scheduling conflicts
   */
  async detectSchedulingConflicts(
    projectId: string,
    taskSchedules: Array<{
      taskId: string;
      startDate: Date;
      endDate: Date;
      assigneeId?: string;
    }>,
    context: ConflictContext
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    // Get current project state
    const currentIssues = await this.prisma.issue.findMany({
      where: { 
        projectId,
        deletedAt: null
      },
      include: {
        predecessors: { include: { predecessor: true } },
        successors: { include: { successor: true } }
      }
    });

    const currentDependencies = await this.prisma.dependency.findMany({
      where: { projectId }
    });

    // Check for each task schedule
    for (const schedule of taskSchedules) {
      const currentIssue = currentIssues.find(i => i.id === schedule.taskId);
      if (!currentIssue) {
        conflicts.push(this.createConflict(
          ConflictPattern.SCHEDULE_CONFLICT,
          ConflictSeverity.ERROR,
          schedule.taskId,
          projectId,
          'Task no longer exists',
          0,
          0,
          null,
          schedule,
          ['taskId'],
          ['Remove task from schedule or refresh project data']
        ));
        continue;
      }

      // Check dependency violations
      const dependencyConflicts = await this.checkDependencyConflicts(
        currentIssue,
        schedule,
        currentIssues,
        projectId
      );
      conflicts.push(...dependencyConflicts);

      // Check resource conflicts
      if (schedule.assigneeId) {
        const resourceConflicts = await this.checkResourceConflicts(
          schedule,
          taskSchedules.filter(s => s.assigneeId === schedule.assigneeId),
          projectId
        );
        conflicts.push(...resourceConflicts);
      }

      // Check business rule violations
      const businessConflicts = this.checkBusinessRuleConflicts(
        currentIssue,
        schedule,
        projectId
      );
      conflicts.push(...businessConflicts);
    }

    return conflicts;
  }

  /**
   * Check for data integrity violations
   */
  async checkDataIntegrity(
    projectId: string,
    context: ConflictContext
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    // Check orphaned dependencies
    const orphanedDeps = await this.prisma.dependency.findMany({
      where: {
        projectId,
        OR: [
          { predecessor: { deletedAt: { not: null } } },
          { successor: { deletedAt: { not: null } } }
        ]
      },
      include: {
        predecessor: true,
        successor: true
      }
    });

    for (const dep of orphanedDeps) {
      conflicts.push(this.createConflict(
        ConflictPattern.DEPENDENCY_CONFLICT,
        ConflictSeverity.WARNING,
        dep.id,
        projectId,
        'Dependency references deleted task',
        1,
        1,
        dep,
        null,
        ['predecessorId', 'successorId'],
        ['Remove dependency', 'Restore referenced task']
      ));
    }

    // Check circular dependencies
    const circularDeps = await this.detectCircularDependencies(projectId);
    for (const cycle of circularDeps) {
      conflicts.push(this.createConflict(
        ConflictPattern.DEPENDENCY_CONFLICT,
        ConflictSeverity.ERROR,
        cycle.join(','),
        projectId,
        `Circular dependency detected: ${cycle.join(' → ')}`,
        1,
        1,
        { taskIds: cycle },
        null,
        ['dependencies'],
        ['Break circular dependency by removing one dependency link']
      ));
    }

    // Check invalid date ranges
    const invalidDateIssues = await this.prisma.issue.findMany({
      where: {
        projectId,
        deletedAt: null,
        AND: [
          { startDate: { not: null } },
          { dueDate: { not: null } }
        ]
      }
    });

    for (const issue of invalidDateIssues) {
      if (issue.startDate && issue.dueDate && issue.startDate > issue.dueDate) {
        conflicts.push(this.createConflict(
          ConflictPattern.SCHEDULE_CONFLICT,
          ConflictSeverity.ERROR,
          issue.id,
          projectId,
          'Start date is after due date',
          issue.version,
          issue.version,
          issue,
          null,
          ['startDate', 'dueDate'],
          ['Adjust start date', 'Adjust due date']
        ));
      }
    }

    return conflicts;
  }

  // Private helper methods

  private createConflict(
    pattern: ConflictPattern,
    severity: ConflictSeverity,
    entityId: string,
    projectId: string,
    description: string,
    currentVersion: number,
    attemptedVersion: number,
    currentData: any,
    attemptedData: any,
    conflictFields: string[],
    suggestedResolution: string[]
  ): DetectedConflict {
    return {
      id: `${pattern}_${entityId}_${Date.now()}`,
      pattern,
      severity,
      entityId,
      projectId,
      description,
      currentVersion,
      attemptedVersion,
      currentData,
      attemptedData,
      conflictFields,
      timestamp: new Date(),
      suggestedResolution
    };
  }

  private identifyConflictingFields(
    current: any, 
    attempted: any, 
    entityType: string
  ): string[] {
    const conflicts: string[] = [];
    const fieldsToCheck = this.getFieldsToCheck(entityType);

    for (const field of fieldsToCheck) {
      if (attempted[field] !== undefined && 
          JSON.stringify(current[field]) !== JSON.stringify(attempted[field])) {
        conflicts.push(field);
      }
    }

    return conflicts;
  }

  private getFieldsToCheck(entityType: string): string[] {
    switch (entityType) {
      case 'issue':
        return ['title', 'description', 'status', 'priority', 'startDate', 'dueDate', 
                'progress', 'assigneeId', 'parentIssueId', 'estimateValue'];
      case 'dependency':
        return ['predecessorId', 'successorId', 'type', 'lag'];
      case 'project':
        return ['name', 'visibility', 'schedulingEnabled'];
      default:
        return [];
    }
  }

  private generateResolutionSuggestions(
    conflictFields: string[], 
    current: any, 
    attempted: any
  ): string[] {
    const suggestions: string[] = [];

    if (conflictFields.length === 0) {
      suggestions.push('No field conflicts detected - safe to retry');
    } else {
      suggestions.push('Review changes and resolve conflicts manually');
      suggestions.push(`Conflicted fields: ${conflictFields.join(', ')}`);
      
      if (conflictFields.includes('status') || conflictFields.includes('progress')) {
        suggestions.push('Consider merging status/progress changes');
      }
      
      if (conflictFields.includes('startDate') || conflictFields.includes('dueDate')) {
        suggestions.push('Coordinate schedule changes with team');
      }
    }

    return suggestions;
  }

  private async checkDependencyConflicts(
    issue: any,
    schedule: any,
    allIssues: any[],
    projectId: string
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    // Check predecessor constraints
    for (const predDep of issue.predecessors) {
      const predecessor = allIssues.find(i => i.id === predDep.predecessorId);
      if (!predecessor || !predecessor.dueDate) continue;

      const requiredStartDate = new Date(predecessor.dueDate);
      if (predDep.lag > 0) {
        requiredStartDate.setDate(requiredStartDate.getDate() + predDep.lag);
      }

      if (new Date(schedule.startDate) < requiredStartDate) {
        conflicts.push(this.createConflict(
          ConflictPattern.DEPENDENCY_CONFLICT,
          ConflictSeverity.WARNING,
          issue.id,
          projectId,
          `Task starts before predecessor "${predecessor.title}" completes`,
          issue.version,
          issue.version,
          issue,
          schedule,
          ['startDate'],
          [`Delay start to ${requiredStartDate.toISOString()}`, 'Adjust predecessor timeline']
        ));
      }
    }

    return conflicts;
  }

  private async checkResourceConflicts(
    schedule: any,
    assigneeSchedules: any[],
    projectId: string
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    // Check for overlapping assignments
    const overlapping = assigneeSchedules.filter(s => 
      s.taskId !== schedule.taskId &&
      this.datesOverlap(
        new Date(s.startDate), new Date(s.endDate),
        new Date(schedule.startDate), new Date(schedule.endDate)
      )
    );

    if (overlapping.length > 0) {
      conflicts.push(this.createConflict(
        ConflictPattern.RESOURCE_CONFLICT,
        ConflictSeverity.WARNING,
        schedule.taskId,
        projectId,
        `Resource overallocation: ${overlapping.length} overlapping tasks`,
        1,
        1,
        schedule,
        overlapping,
        ['assigneeId', 'startDate', 'endDate'],
        ['Reschedule overlapping tasks', 'Assign additional resources', 'Reduce scope']
      ));
    }

    return conflicts;
  }

  private checkBusinessRuleConflicts(
    issue: any,
    schedule: any,
    projectId: string
  ): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];

    // Check if task is locked from scheduling
    if (issue.scheduleLocked) {
      conflicts.push(this.createConflict(
        ConflictPattern.SCHEDULE_CONFLICT,
        ConflictSeverity.ERROR,
        issue.id,
        projectId,
        'Task is locked and cannot be rescheduled',
        issue.version,
        issue.version,
        issue,
        schedule,
        ['scheduleLocked'],
        ['Unlock task before scheduling', 'Skip task from automatic scheduling']
      ));
    }

    // Check completed task modification
    if (issue.status === 'done' && 
        (new Date(schedule.startDate).getTime() !== new Date(issue.startDate).getTime() ||
         new Date(schedule.endDate).getTime() !== new Date(issue.dueDate).getTime())) {
      conflicts.push(this.createConflict(
        ConflictPattern.SCHEDULE_CONFLICT,
        ConflictSeverity.WARNING,
        issue.id,
        projectId,
        'Attempting to reschedule completed task',
        issue.version,
        issue.version,
        issue,
        schedule,
        ['status', 'startDate', 'dueDate'],
        ['Keep completed task dates unchanged', 'Reopen task if rescheduling needed']
      ));
    }

    return conflicts;
  }

  private async detectCircularDependencies(projectId: string): Promise<string[][]> {
    const cycles: string[][] = [];
    const dependencies = await this.prisma.dependency.findMany({
      where: { projectId }
    });

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!graph.has(dep.predecessorId)) {
        graph.set(dep.predecessorId, []);
      }
      graph.get(dep.predecessorId)!.push(dep.successorId);
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const [startNode] of graph) {
      if (!visited.has(startNode)) {
        if (dfs(startNode)) break; // Found one cycle
      }
    }

    return cycles;
  }

  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 <= end2 && start2 <= end1;
  }
}