// T032: Placeholder CPM Scheduler for dependency type expansion
// This is a minimal implementation to support compilation
// Full CPM implementation will be provided in future iterations

import { 
  TaskSchedule, 
  ScheduleConstraints, 
  ConflictInfo,
  BusinessHours
} from '../entities/computed-schedule.entity';

export interface CPMResult {
  taskSchedules: TaskSchedule[];
  criticalPath: string[];
  totalDuration: number;
  conflicts: ConflictInfo[];
}

export interface CPMTask {
  id: string;
  duration: number;
  dependencies: Array<{
    predecessorId: string;
    type: 'FS' | 'SS' | 'SF' | 'FF';
    lag: number;
  }>;
  earliestStart?: number;
  earliestFinish?: number;
  latestStart?: number;
  latestFinish?: number;
  floatTime?: number;
  isCritical?: boolean;
}

export class CPMScheduler {
  constructor(
    private constraints: ScheduleConstraints,
    private businessHours: BusinessHours = {
      startTime: '09:00',
      endTime: '17:00', 
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      timeZone: 'UTC'
    }
  ) {}

  /**
   * T032: Calculate schedule using Critical Path Method
   * Supports all dependency types: FS, SS, SF, FF with lag
   */
  calculate(tasks: CPMTask[], projectStartDate: Date): CPMResult {
    // Step 1: Forward Pass - Calculate earliest start/finish times
    const forwardPassTasks = this.performForwardPass(tasks, projectStartDate);
    
    // Step 2: Backward Pass - Calculate latest start/finish times
    const backwardPassTasks = this.performBackwardPass(forwardPassTasks);
    
    // Step 3: Calculate float and identify critical path
    const finalTasks = this.calculateFloatAndCriticalPath(backwardPassTasks);
    
    // Step 4: Generate task schedules
    const taskSchedules = this.generateTaskSchedules(finalTasks, projectStartDate);
    
    // Step 5: Identify conflicts
    const conflicts = this.identifyConflicts(taskSchedules);
    
    // Step 6: Extract critical path
    const criticalPath = finalTasks
      .filter(task => task.isCritical)
      .map(task => task.id);
    
    // Step 7: Calculate total duration
    const totalDuration = Math.max(
      ...finalTasks.map(task => task.earliestFinish || 0)
    );

    return {
      taskSchedules,
      criticalPath,
      totalDuration,
      conflicts
    };
  }

  // AC7: Incremental calculation for performance optimization
  async calculateIncrementalSchedule(
    tasks: CPMTask[], 
    changedTaskIds: string[], 
    previousResult?: CPMResult
  ): Promise<CPMResult> {
    // For now, perform full calculation - optimization can be added later
    // In a full implementation, this would:
    // 1. Identify affected tasks downstream from changed tasks
    // 2. Only recalculate those affected tasks
    // 3. Merge results with unchanged tasks from previous calculation
    
    console.log(`Incremental calculation requested for tasks: ${changedTaskIds.join(', ')}`);
    
    // Currently performing full recalculation
    // TODO: Implement true incremental logic for performance
    return this.calculate(tasks, new Date());
  }

  // Method for compatibility with existing code
  async calculateSchedule(tasks: CPMTask[]): Promise<CPMResult> {
    return this.calculate(tasks, new Date());
  }

  private performForwardPass(tasks: CPMTask[], projectStartDate: Date): CPMTask[] {
    const processedTasks = new Map<string, CPMTask>();
    const taskQueue = [...tasks];

    // Initialize all tasks
    tasks.forEach(task => {
      processedTasks.set(task.id, {
        ...task,
        earliestStart: 0,
        earliestFinish: 0
      });
    });

    // Process tasks in dependency order
    while (taskQueue.length > 0) {
      const currentTask = taskQueue.shift()!;
      const task = processedTasks.get(currentTask.id)!;

      // Calculate earliest start based on predecessors
      let maxEarliestStart = 0;
      let canProcess = true;

      for (const dependency of task.dependencies) {
        const predecessor = processedTasks.get(dependency.predecessorId);
        
        if (!predecessor || predecessor.earliestFinish === undefined) {
          // Predecessor not yet processed, re-queue this task
          taskQueue.push(currentTask);
          canProcess = false;
          break;
        }

        let requiredStart = 0;
        switch (dependency.type) {
          case 'FS': // Finish-to-Start
            requiredStart = predecessor.earliestFinish! + dependency.lag;
            break;
          case 'SS': // Start-to-Start
            requiredStart = predecessor.earliestStart! + dependency.lag;
            break;
          case 'SF': // Start-to-Finish
            requiredStart = predecessor.earliestStart! - task.duration + dependency.lag;
            break;
          case 'FF': // Finish-to-Finish
            requiredStart = predecessor.earliestFinish! - task.duration + dependency.lag;
            break;
        }

        maxEarliestStart = Math.max(maxEarliestStart, requiredStart);
      }

      if (canProcess) {
        task.earliestStart = maxEarliestStart;
        task.earliestFinish = task.earliestStart + task.duration;
      }
    }

    return Array.from(processedTasks.values());
  }

  private performBackwardPass(tasks: CPMTask[]): CPMTask[] {
    // Find project end time (maximum earliest finish)
    const projectEnd = Math.max(...tasks.map(task => task.earliestFinish || 0));
    
    // Initialize latest times
    tasks.forEach(task => {
      // Tasks with no successors have latest finish = earliest finish
      const hasSuccessors = tasks.some(t => 
        t.dependencies.some(dep => dep.predecessorId === task.id)
      );
      
      if (!hasSuccessors) {
        task.latestFinish = task.earliestFinish;
        task.latestStart = task.latestFinish! - task.duration;
      }
    });

    // Calculate latest times for tasks with successors
    const processedTasks = new Set<string>();
    const taskQueue = tasks.filter(task => task.latestFinish !== undefined);

    while (taskQueue.length > 0) {
      const currentTask = taskQueue.shift()!;
      
      if (processedTasks.has(currentTask.id)) {
        continue;
      }
      
      processedTasks.add(currentTask.id);

      // Update predecessors' latest times
      currentTask.dependencies.forEach(dependency => {
        const predecessor = tasks.find(t => t.id === dependency.predecessorId);
        if (!predecessor) return;

        let requiredLatestFinish = 0;
        switch (dependency.type) {
          case 'FS': // Finish-to-Start
            requiredLatestFinish = currentTask.latestStart! - dependency.lag;
            break;
          case 'SS': // Start-to-Start
            requiredLatestFinish = currentTask.latestStart! - dependency.lag + predecessor.duration;
            break;
          case 'SF': // Start-to-Finish
            requiredLatestFinish = currentTask.latestFinish! - dependency.lag + predecessor.duration;
            break;
          case 'FF': // Finish-to-Finish
            requiredLatestFinish = currentTask.latestFinish! - dependency.lag;
            break;
        }

        if (predecessor.latestFinish === undefined || 
            requiredLatestFinish < predecessor.latestFinish) {
          predecessor.latestFinish = requiredLatestFinish;
          predecessor.latestStart = predecessor.latestFinish - predecessor.duration;
          
          if (!processedTasks.has(predecessor.id)) {
            taskQueue.push(predecessor);
          }
        }
      });
    }

    return tasks;
  }

  private calculateFloatAndCriticalPath(tasks: CPMTask[]): CPMTask[] {
    return tasks.map(task => {
      const floatTime = (task.latestStart || 0) - (task.earliestStart || 0);
      const isCritical = Math.abs(floatTime) < 0.001; // Consider floating point precision
      
      return {
        ...task,
        floatTime,
        isCritical
      };
    });
  }

  private generateTaskSchedules(tasks: CPMTask[], projectStartDate: Date): TaskSchedule[] {
    return tasks.map(task => ({
      taskId: task.id,
      startDate: this.addWorkingHours(projectStartDate, task.earliestStart || 0).toISOString(),
      endDate: this.addWorkingHours(projectStartDate, task.earliestFinish || 0).toISOString(),
      duration: task.duration,
      floatTime: task.floatTime || 0,
      isCritical: task.isCritical || false,
      predecessors: task.dependencies.map(dep => ({
        predecessorId: dep.predecessorId,
        dependencyType: dep.type,
        lag: dep.lag
      }))
    }));
  }

  private identifyConflicts(taskSchedules: TaskSchedule[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    
    // Check for resource conflicts (simplified)
    // This would be expanded with actual resource allocation logic
    
    return conflicts;
  }

  private addWorkingHours(baseDate: Date, hours: number): Date {
    // Simplified calculation - would be expanded with business hours logic
    const result = new Date(baseDate);
    result.setHours(result.getHours() + hours);
    return result;
  }
}