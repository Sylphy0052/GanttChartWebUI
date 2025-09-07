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
  private resourceAllocations: Map<string, ResourceAssignment[]> = new Map();
  private violations: ConstraintViolation[] = [];

  constructor(constraints: ScheduleConstraints) {
    this.constraints = constraints;
  }

  /**
   * Solve constraints for given backward pass result
   */
  solve(backwardPassResult: BackwardPassResult): {
    tasks: Map<string, TaskNodeWithSlack>;
    conflicts: ConflictInfo[];
    violations: ConstraintViolation[];
  } {
    const { tasks } = backwardPassResult;
    const conflicts: ConflictInfo[] = [];
    this.violations = [];

    // First pass: Apply calendar constraints
    this.applyCalendarConstraints(tasks);

    // Second pass: Apply resource constraints
    this.applyResourceConstraints(tasks);

    // Third pass: Detect conflicts
    this.detectSchedulingConflicts(tasks, conflicts);

    // Fourth pass: Auto-resolve where possible
    this.resolveAutomaticConflicts(tasks, this.violations, conflicts);

    return {
      tasks,
      conflicts,
      violations: this.violations
    };
  }

  /**
   * Apply working days and holiday constraints
   */
  private applyCalendarConstraints(tasks: Map<string, TaskNodeWithSlack>): void {
    const { workingDays = [1, 2, 3, 4, 5], holidays = [] } = this.constraints;
    
    tasks.forEach(task => {
      // Adjust start dates to working days
      const adjustedStartDate = this.adjustToNextWorkingDay(
        this.addWorkingDays(new Date(), task.earliestStart),
        workingDays,
        holidays
      );

      const adjustedEndDate = this.adjustToNextWorkingDay(
        this.addWorkingDays(adjustedStartDate, task.duration),
        workingDays,
        holidays
      );

      // Update task timing if adjustments were made
      const originalStartTime = task.earliestStart;
      task.earliestStart = this.getWorkingDays(new Date(), adjustedStartDate);
      task.earliestFinish = this.getWorkingDays(new Date(), adjustedEndDate);

      if (Math.abs(task.earliestStart - originalStartTime) > 0.1) {
        this.violations.push({
          type: 'date',
          severity: 'warning',
          taskId: task.id,
          description: `Task scheduled adjusted to working days`,
          suggestedFix: 'Review task scheduling constraints'
        });
      }
    });
  }

  /**
   * Apply resource capacity constraints
   */
  private applyResourceConstraints(tasks: Map<string, TaskNodeWithSlack>): void {
    // Clear existing allocations
    this.resourceAllocations.clear();

    // Build resource allocations map
    tasks.forEach(task => {
      if (task.assigneeId) {
        const assignments = this.resourceAllocations.get(task.assigneeId) || [];
        assignments.push({
          taskId: task.id,
          resourceId: task.assigneeId,
          allocation: 1.0, // Full allocation by default
          startDate: this.addWorkingDays(new Date(), task.earliestStart),
          endDate: this.addWorkingDays(new Date(), task.earliestFinish)
        });
        this.resourceAllocations.set(task.assigneeId, assignments);
      }
    });

    // Check for over-allocation
    this.resourceAllocations.forEach((assignments, resourceId) => {
      const conflicts = this.detectResourceConflicts(assignments);
      conflicts.forEach(conflict => {
        this.violations.push({
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
            id: `dependency_${task.id}_${pred.id}`,
            type: 'dependency',
            severity: 'error',
            description: `Task starts before predecessor "${predTask.title}" completes`,
            affectedTasks: [task.id, pred.id],
            suggestedActions: ['Adjust task dependencies', 'Review task constraints']
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
              id: `resource_${task.id}_${task.assigneeId}`,
              type: 'resource',
              severity: 'warning',
              description: `Resource conflict with tasks: ${overlappingAssignments.map(a => a.taskId).join(', ')}`,
              affectedTasks: [task.id, ...overlappingAssignments.map(a => a.taskId)],
              suggestedActions: ['Reschedule conflicting tasks', 'Assign different resources']
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
    const remainingConflicts = conflicts.filter(conflict => 
      !this.isConflictResolved(tasks, conflict)
    );
    
    conflicts.length = 0;
    conflicts.push(...remainingConflicts);
  }

  private performResourceLeveling(tasks: Map<string, TaskNodeWithSlack>): void {
    // Implement resource leveling algorithm
    this.resourceAllocations.forEach((assignments, resourceId) => {
      // Sort by earliest start
      assignments.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      // Adjust overlapping tasks
      for (let i = 1; i < assignments.length; i++) {
        const current = assignments[i];
        const previous = assignments[i - 1];

        if (current.startDate < previous.endDate) {
          // Move current task to start after previous
          const newStartDate = previous.endDate;
          const duration = current.endDate.getTime() - current.startDate.getTime();
          const newEndDate = new Date(newStartDate.getTime() + duration);

          current.startDate = newStartDate;
          current.endDate = newEndDate;

          // Update task node
          const task = tasks.get(current.taskId);
          if (task) {
            task.earliestStart = this.getWorkingDays(new Date(), newStartDate);
            task.earliestFinish = this.getWorkingDays(new Date(), newEndDate);
          }
        }
      }
    });
  }

  private adjustForWorkingDays(tasks: Map<string, TaskNodeWithSlack>): void {
    // Ensure all tasks respect working day constraints
    tasks.forEach(task => {
      const startDate = this.addWorkingDays(new Date(), task.earliestStart);
      const endDate = this.addWorkingDays(new Date(), task.earliestFinish);

      const adjustedStart = this.adjustToNextWorkingDay(
        startDate,
        this.constraints.workingDays || [1, 2, 3, 4, 5],
        this.constraints.holidays || []
      );

      const adjustedEnd = this.adjustToNextWorkingDay(
        endDate,
        this.constraints.workingDays || [1, 2, 3, 4, 5],
        this.constraints.holidays || []
      );

      task.earliestStart = this.getWorkingDays(new Date(), adjustedStart);
      task.earliestFinish = this.getWorkingDays(new Date(), adjustedEnd);
    });
  }

  private calculateRequiredStart(
    predecessorTask: TaskNodeWithSlack,
    dependencyType: string,
    lag: number
  ): number {
    switch (dependencyType) {
      case 'FS': // Finish-to-Start
        return predecessorTask.earliestFinish + lag;
      case 'SS': // Start-to-Start
        return predecessorTask.earliestStart + lag;
      case 'FF': // Finish-to-Finish
        return predecessorTask.earliestFinish - predecessorTask.duration + lag;
      case 'SF': // Start-to-Finish  
        return predecessorTask.earliestStart - predecessorTask.duration + lag;
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

    // Check for overlapping assignments
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
    return start1 < end2 && start2 < end1;
  }

  private adjustToNextWorkingDay(date: Date, workingDays: number[], holidays: Date[]): Date {
    const result = new Date(date);
    
    while (!this.isWorkingDay(result, workingDays, holidays)) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }

  private isWorkingDay(date: Date, workingDays: number[], holidays: Date[]): boolean {
    // Check if day of week is working day
    if (!workingDays.includes(date.getDay())) {
      return false;
    }

    // Check if date is not a holiday
    const dateStr = date.toDateString();
    return !holidays.some(holiday => holiday.toDateString() === dateStr);
  }

  private addWorkingDays(startDate: Date, workingDays: number): Date {
    const result = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < workingDays) {
      result.setDate(result.getDate() + 1);
      if (this.isWorkingDay(
        result,
        this.constraints.workingDays || [1, 2, 3, 4, 5],
        this.constraints.holidays || []
      )) {
        daysAdded++;
      }
    }

    return result;
  }

  private getWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (this.isWorkingDay(
        current,
        this.constraints.workingDays || [1, 2, 3, 4, 5],
        this.constraints.holidays || []
      )) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  }

  private isConflictResolved(tasks: Map<string, TaskNodeWithSlack>, conflict: ConflictInfo): boolean {
    // Simple check - implementation would need more sophisticated logic
    const affectedTasks = conflict.affectedTasks || [];
    return affectedTasks.every(taskId => {
      const task = tasks.get(taskId);
      return task !== undefined;
    });
  }

  /**
   * Get constraint solver statistics
   */
  getStatistics(): {
    totalViolations: number;
    errorViolations: number;
    warningViolations: number;
    resourceConflicts: number;
    dateViolations: number;
  } {
    const errorViolations = this.violations.filter(v => v.severity === 'error').length;
    const warningViolations = this.violations.filter(v => v.severity === 'warning').length;
    const resourceConflicts = this.violations.filter(v => v.type === 'resource').length;
    const dateViolations = this.violations.filter(v => v.type === 'date').length;

    return {
      totalViolations: this.violations.length,
      errorViolations,
      warningViolations,
      resourceConflicts,
      dateViolations
    };
  }

  /**
   * Reset solver state
   */
  reset(): void {
    this.resourceAllocations.clear();
    this.violations = [];
  }
}