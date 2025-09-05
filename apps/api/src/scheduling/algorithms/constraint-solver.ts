import { TaskNodeWithSlack, BackwardPassResult } from './backward-pass';
import { ConflictInfo, ConflictType, ConflictSeverity } from '../dto/schedule-response.dto';

export interface ScheduleConstraints {
  workingDays: number[];
  workingHoursPerDay: number;
  startDate?: Date;
  holidays?: Date[];
  resourceConstraints?: Map<string, number>; // resourceId -> capacity
  mandatoryDates?: Map<string, Date>; // taskId -> fixed date
}

export interface ResourceAssignment {
  taskId: string;
  resourceId: string;
  allocation: number; // 0.0 - 1.0
  startDate: Date;
  endDate: Date;
}

export interface ConstraintViolation {
  type: 'resource' | 'date' | 'dependency' | 'capacity';
  severity: 'error' | 'warning';
  taskId: string;
  description: string;
  suggestedFix?: string;
}

export class ConstraintSolver {
  private constraints: ScheduleConstraints;
  private resourceAllocations = new Map<string, ResourceAssignment[]>(); // resourceId -> assignments

  constructor(constraints: ScheduleConstraints) {
    this.constraints = constraints;
  }

  /**
   * Apply constraints to schedule and detect/resolve conflicts
   */
  solve(backwardPassResult: BackwardPassResult): {
    resolvedSchedule: Map<string, TaskNodeWithSlack>;
    violations: ConstraintViolation[];
    conflicts: ConflictInfo[];
    optimizations: string[];
  } {
    const { tasks } = backwardPassResult;
    const resolvedTasks = new Map(tasks);
    const violations: ConstraintViolation[] = [];
    const conflicts: ConflictInfo[] = [];
    const optimizations: string[] = [];

    // 1. Validate working day constraints
    this.validateWorkingDayConstraints(resolvedTasks, violations);

    // 2. Validate mandatory date constraints
    this.validateMandatoryDates(resolvedTasks, violations);

    // 3. Validate resource constraints
    this.validateResourceConstraints(resolvedTasks, violations);

    // 4. Detect scheduling conflicts
    this.detectSchedulingConflicts(resolvedTasks, conflicts);

    // 5. Apply automatic conflict resolution
    this.resolveAutomaticConflicts(resolvedTasks, violations, conflicts);

    // 6. Generate optimization suggestions
    this.generateOptimizations(resolvedTasks, optimizations);

    return {
      resolvedSchedule: resolvedTasks,
      violations,
      conflicts,
      optimizations
    };
  }

  private validateWorkingDayConstraints(
    tasks: Map<string, TaskNodeWithSlack>, 
    violations: ConstraintViolation[]
  ): void {
    tasks.forEach(task => {
      const taskStartDate = this.addWorkingDays(
        this.constraints.startDate || new Date(), 
        task.earliestStart
      );
      const taskEndDate = this.addWorkingDays(
        this.constraints.startDate || new Date(), 
        task.earliestFinish
      );

      // Check if task spans non-working days
      if (!this.isValidWorkingPeriod(taskStartDate, taskEndDate)) {
        violations.push({
          type: 'date',
          severity: 'warning',
          taskId: task.id,
          description: `Task "${task.title}" spans non-working days`,
          suggestedFix: 'Adjust task dates to working days only'
        });
      }

      // Check holiday conflicts
      if (this.hasHolidayConflict(taskStartDate, taskEndDate)) {
        violations.push({
          type: 'date',
          severity: 'warning',
          taskId: task.id,
          description: `Task "${task.title}" conflicts with holidays`,
          suggestedFix: 'Reschedule to avoid holiday periods'
        });
      }
    });
  }

  private validateMandatoryDates(
    tasks: Map<string, TaskNodeWithSlack>,
    violations: ConstraintViolation[]
  ): void {
    if (!this.constraints.mandatoryDates) return;

    this.constraints.mandatoryDates.forEach((mandatoryDate, taskId) => {
      const task = tasks.get(taskId);
      if (!task) return;

      const calculatedEndDate = this.addWorkingDays(
        this.constraints.startDate || new Date(),
        task.earliestFinish
      );

      if (calculatedEndDate > mandatoryDate) {
        violations.push({
          type: 'date',
          severity: 'error',
          taskId: task.id,
          description: `Task "${task.title}" cannot meet mandatory deadline`,
          suggestedFix: 'Reduce task duration or adjust dependencies'
        });
      }
    });
  }

  private validateResourceConstraints(
    tasks: Map<string, TaskNodeWithSlack>,
    violations: ConstraintViolation[]
  ): void {
    if (!this.constraints.resourceConstraints) return;

    // Build resource allocation timeline
    this.resourceAllocations.clear();
    
    tasks.forEach(task => {
      if (task.assigneeId) {
        const startDate = this.addWorkingDays(
          this.constraints.startDate || new Date(),
          task.earliestStart
        );
        const endDate = this.addWorkingDays(
          this.constraints.startDate || new Date(),
          task.earliestFinish
        );

        const assignment: ResourceAssignment = {
          taskId: task.id,
          resourceId: task.assigneeId,
          allocation: 1.0, // Assume full allocation
          startDate,
          endDate
        };

        if (!this.resourceAllocations.has(task.assigneeId)) {
          this.resourceAllocations.set(task.assigneeId, []);
        }
        this.resourceAllocations.get(task.assigneeId)!.push(assignment);
      }
    });

    // Check for resource overallocation
    this.resourceAllocations.forEach((assignments, resourceId) => {
      const conflicts = this.detectResourceConflicts(assignments);
      conflicts.forEach(conflict => {
        violations.push({
          type: 'resource',
          severity: 'error',
          taskId: conflict.taskIds.join(','),
          description: `Resource ${resourceId} overallocated: ${conflict.description}`,
          suggestedFix: 'Reschedule conflicting tasks or add resources'
        });
      });
    });
  }

  private detectSchedulingConflicts(
    tasks: Map<string, TaskNodeWithSlack>,
    conflicts: ConflictInfo[]
  ): void {
    tasks.forEach(task => {
      // Check for dependency date conflicts
      task.predecessors.forEach(pred => {
        const predTask = tasks.get(pred.id);
        if (!predTask) return;

        const requiredStart = this.calculateRequiredStart(predTask, pred.type, pred.lag);
        if (task.earliestStart < requiredStart) {
          conflicts.push({
            type: ConflictType.DEPENDENCY,
            taskId: task.id,
            description: `Task starts before predecessor "${predTask.title}" completes`,
            severity: ConflictSeverity.ERROR
          });
        }
      });

      // Check for resource conflicts
      if (task.assigneeId) {
        const resourceAssignments = this.resourceAllocations.get(task.assigneeId) || [];
        const taskAssignment = resourceAssignments.find(a => a.taskId === task.id);
        
        if (taskAssignment) {
          const overlappingAssignments = resourceAssignments.filter(a => 
            a.taskId !== task.id && 
            this.datesOverlap(taskAssignment.startDate, taskAssignment.endDate, a.startDate, a.endDate)
          );

          if (overlappingAssignments.length > 0) {
            conflicts.push({
              type: ConflictType.RESOURCE,
              taskId: task.id,
              description: `Resource conflict with tasks: ${overlappingAssignments.map(a => a.taskId).join(', ')}`,
              severity: ConflictSeverity.WARNING
            });
          }
        }
      }
    });
  }

  private resolveAutomaticConflicts(
    tasks: Map<string, TaskNodeWithSlack>,
    violations: ConstraintViolation[],
    conflicts: ConflictInfo[]
  ): void {
    // Auto-resolve resource conflicts by leveling
    this.performResourceLeveling(tasks);

    // Auto-resolve working day violations
    this.adjustForWorkingDays(tasks);

    // Update conflicts after resolution attempts
    const unresolvedConflicts = conflicts.filter(conflict => 
      !this.isConflictResolved(tasks, conflict)
    );
    
    // Replace conflicts array with unresolved ones
    conflicts.splice(0, conflicts.length, ...unresolvedConflicts);
  }

  private generateOptimizations(
    tasks: Map<string, TaskNodeWithSlack>,
    optimizations: string[]
  ): void {
    // Resource utilization optimization
    const resourceUtilization = this.calculateResourceUtilization();
    const underutilizedResources = resourceUtilization.filter(ru => ru.utilization < 0.6);
    
    if (underutilizedResources.length > 0) {
      optimizations.push(
        `Consider redistributing work from ${underutilizedResources.length} underutilized resources`
      );
    }

    // Critical path optimization
    const criticalTasks = Array.from(tasks.values()).filter(t => t.isCritical);
    if (criticalTasks.length > tasks.size * 0.4) {
      optimizations.push('High critical path ratio - consider parallel execution or resource addition');
    }

    // Float utilization
    const highFloatTasks = Array.from(tasks.values()).filter(t => t.totalFloat > 5);
    if (highFloatTasks.length > 0) {
      optimizations.push(`${highFloatTasks.length} tasks have significant float - opportunity for resource reallocation`);
    }
  }

  // Helper methods

  private isValidWorkingPeriod(startDate: Date, endDate: Date): boolean {
    const current = new Date(startDate);
    while (current <= endDate) {
      if (!this.isWorkingDay(current)) {
        return false;
      }
      current.setDate(current.getDate() + 1);
    }
    return true;
  }

  private hasHolidayConflict(startDate: Date, endDate: Date): boolean {
    if (!this.constraints.holidays) return false;
    
    return this.constraints.holidays.some(holiday => 
      holiday >= startDate && holiday <= endDate
    );
  }

  private isWorkingDay(date: Date): boolean {
    if (!this.constraints.workingDays.includes(date.getDay())) {
      return false;
    }

    if (this.constraints.holidays) {
      const dateStr = date.toDateString();
      return !this.constraints.holidays.some(holiday => holiday.toDateString() === dateStr);
    }

    return true;
  }

  private addWorkingDays(startDate: Date, workingDays: number): Date {
    const result = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < workingDays) {
      result.setDate(result.getDate() + 1);
      if (this.isWorkingDay(result)) {
        daysAdded++;
      }
    }

    return result;
  }

  private calculateRequiredStart(
    predecessorTask: TaskNodeWithSlack, 
    dependencyType: string, 
    lag: number
  ): number {
    switch (dependencyType) {
      case 'FS':
        return predecessorTask.earliestFinish + lag;
      case 'SS':
        return predecessorTask.earliestStart + lag;
      case 'FF':
        return predecessorTask.earliestFinish - lag; // Assuming successor duration known
      case 'SF':
        return predecessorTask.earliestStart - lag;
      default:
        return predecessorTask.earliestFinish + lag;
    }
  }

  private detectResourceConflicts(assignments: ResourceAssignment[]): Array<{
    taskIds: string[];
    description: string;
    overallocation: number;
  }> {
    const conflicts: Array<{
      taskIds: string[];
      description: string;
      overallocation: number;
    }> = [];

    // Simple conflict detection - check for overlapping assignments
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a1 = assignments[i];
        const a2 = assignments[j];

        if (this.datesOverlap(a1.startDate, a1.endDate, a2.startDate, a2.endDate)) {
          const overallocation = a1.allocation + a2.allocation;
          if (overallocation > 1.0) {
            conflicts.push({
              taskIds: [a1.taskId, a2.taskId],
              description: `Overlapping assignments (${(overallocation * 100).toFixed(0)}% allocation)`,
              overallocation
            });
          }
        }
      }
    }

    return conflicts;
  }

  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  private performResourceLeveling(tasks: Map<string, TaskNodeWithSlack>): void {
    // Simple resource leveling - delay non-critical tasks when resources conflict
    const criticalTasks = Array.from(tasks.values()).filter(t => t.isCritical);
    const nonCriticalTasks = Array.from(tasks.values()).filter(t => !t.isCritical && t.totalFloat > 0);

    // Sort non-critical tasks by float (most flexible first)
    nonCriticalTasks.sort((a, b) => b.totalFloat - a.totalFloat);

    nonCriticalTasks.forEach(task => {
      if (task.assigneeId) {
        const resourceAssignments = this.resourceAllocations.get(task.assigneeId) || [];
        const conflictingAssignments = resourceAssignments.filter(a => 
          a.taskId !== task.id && 
          criticalTasks.some(ct => ct.id === a.taskId)
        );

        if (conflictingAssignments.length > 0) {
          // Delay task to avoid conflict with critical tasks
          const maxConflictEnd = Math.max(...conflictingAssignments.map(a => 
            this.getWorkingDaysFromDate(this.constraints.startDate || new Date(), a.endDate)
          ));

          if (task.earliestStart < maxConflictEnd) {
            const delay = Math.min(maxConflictEnd - task.earliestStart + 1, task.totalFloat);
            task.earliestStart += delay;
            task.earliestFinish += delay;
          }
        }
      }
    });
  }

  private adjustForWorkingDays(tasks: Map<string, TaskNodeWithSlack>): void {
    tasks.forEach(task => {
      const startDate = this.addWorkingDays(
        this.constraints.startDate || new Date(),
        task.earliestStart
      );

      if (!this.isWorkingDay(startDate)) {
        // Move to next working day
        const adjustedStartDate = this.getNextWorkingDay(startDate);
        const adjustedStart = this.getWorkingDaysFromDate(
          this.constraints.startDate || new Date(),
          adjustedStartDate
        );
        
        const adjustment = adjustedStart - task.earliestStart;
        task.earliestStart = adjustedStart;
        task.earliestFinish += adjustment;
      }
    });
  }

  private isConflictResolved(tasks: Map<string, TaskNodeWithSlack>, conflict: ConflictInfo): boolean {
    // Simple check - implementation would need more sophisticated logic
    const task = tasks.get(conflict.taskId);
    return task !== undefined; // Placeholder
  }

  private calculateResourceUtilization(): Array<{ resourceId: string; utilization: number }> {
    const utilization: Array<{ resourceId: string; utilization: number }> = [];
    
    this.resourceAllocations.forEach((assignments, resourceId) => {
      const totalWorkingDays = this.constraints.workingDays.length * 
        (this.constraints.workingHoursPerDay / 8); // Normalize to full days
      const totalAllocatedDays = assignments.reduce((sum, assignment) => {
        const durationDays = this.getWorkingDaysFromDate(assignment.startDate, assignment.endDate);
        return sum + (durationDays * assignment.allocation);
      }, 0);

      utilization.push({
        resourceId,
        utilization: totalAllocatedDays / totalWorkingDays
      });
    });

    return utilization;
  }

  private getNextWorkingDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    while (!this.isWorkingDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  private getWorkingDaysFromDate(fromDate: Date, toDate: Date): number {
    let workingDays = 0;
    const current = new Date(fromDate);
    
    while (current < toDate) {
      if (this.isWorkingDay(current)) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  }
}