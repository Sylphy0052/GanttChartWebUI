import { TaskNode, ForwardPassResult } from './forward-pass';

export interface BackwardPassResult {
  tasks: Map<string, TaskNodeWithSlack>;
  criticalPath: string[];
  totalFloat: Map<string, number>;
  freeFloat: Map<string, number>;
}

export interface TaskNodeWithSlack extends TaskNode {
  latestStart: number;
  latestFinish: number;
  totalFloat: number;   // Latest Start - Earliest Start
  freeFloat: number;    // Minimum successor ES - Current EF
  isCritical: boolean;
}

export class BackwardPass {
  private readonly FLOAT_TOLERANCE = 0.1; // Days

  /**
   * Calculate backward pass - determines latest start and finish times, float, and critical path
   */
  calculate(forwardPassResult: ForwardPassResult, projectDeadline?: Date): BackwardPassResult {
    const { tasks: forwardTasks, projectEarliestFinish } = forwardPassResult;
    
    // Initialize backward pass data
    const backwardTasks = new Map<string, TaskNodeWithSlack>();
    
    // Copy forward pass results and initialize backward pass fields
    forwardTasks.forEach((task, id) => {
      backwardTasks.set(id, {
        ...task,
        latestStart: 0,
        latestFinish: projectDeadline ? 
          this.getWorkingDaysFromProjectStart(task.startDate, projectDeadline) : 
          projectEarliestFinish,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: false
      });
    });

    // Set latest finish for end tasks (no successors)
    const endTasks = Array.from(backwardTasks.values()).filter(task => task.successors.length === 0);
    
    endTasks.forEach(task => {
      task.latestFinish = projectDeadline ? 
        this.getWorkingDaysFromProjectStart(task.startDate, projectDeadline) :
        projectEarliestFinish;
    });

    // Process tasks in reverse topological order
    const reverseSortedTasks = this.reverseTopologicalSort(Array.from(backwardTasks.values()));
    
    reverseSortedTasks.forEach(task => {
      this.calculateTaskLatestTimes(task, backwardTasks);
    });

    // Calculate float values
    this.calculateFloatValues(backwardTasks);

    // Identify critical path
    const criticalPath = this.identifyCriticalPath(backwardTasks);

    // Separate float maps for easier access
    const totalFloat = new Map<string, number>();
    const freeFloat = new Map<string, number>();
    
    backwardTasks.forEach((task, id) => {
      totalFloat.set(id, task.totalFloat);
      freeFloat.set(id, task.freeFloat);
    });

    return {
      tasks: backwardTasks,
      criticalPath,
      totalFloat,
      freeFloat
    };
  }

  private calculateTaskLatestTimes(
    task: TaskNodeWithSlack,
    taskMap: Map<string, TaskNodeWithSlack>
  ): void {
    if (task.successors.length === 0) {
      // End task - latest finish already set
      task.latestStart = task.latestFinish - task.duration;
      return;
    }

    let minLatestFinish = Infinity;

    // Calculate based on successors
    task.successors.forEach(succ => {
      const successorTask = taskMap.get(succ.id);
      if (!successorTask) {
        throw new Error(`Successor task not found: ${succ.id}`);
      }

      let requiredFinish: number;

      switch (succ.type) {
        case 'FS': // Finish-to-Start (default)
          requiredFinish = successorTask.latestStart - succ.lag;
          break;
        case 'SS': // Start-to-Start  
          requiredFinish = successorTask.latestStart - succ.lag + task.duration;
          break;
        case 'FF': // Finish-to-Finish
          requiredFinish = successorTask.latestFinish - succ.lag;
          break;
        case 'SF': // Start-to-Finish
          requiredFinish = successorTask.latestFinish - succ.lag + task.duration;
          break;
        default:
          requiredFinish = successorTask.latestStart - succ.lag;
      }

      minLatestFinish = Math.min(minLatestFinish, requiredFinish);
    });

    task.latestFinish = minLatestFinish;
    task.latestStart = task.latestFinish - task.duration;
  }

  private calculateFloatValues(taskMap: Map<string, TaskNodeWithSlack>): void {
    taskMap.forEach(task => {
      // Total Float = Latest Start - Earliest Start
      task.totalFloat = task.latestStart - task.earliestStart;

      // Free Float = minimum(successor ES - current EF) for all successors
      if (task.successors.length === 0) {
        task.freeFloat = task.totalFloat; // End tasks
      } else {
        let minSuccessorES = Infinity;
        
        task.successors.forEach(succ => {
          const successorTask = taskMap.get(succ.id);
          if (successorTask) {
            // Adjust for dependency type and lag
            let adjustedSuccessorES: number;
            
            switch (succ.type) {
              case 'FS':
                adjustedSuccessorES = successorTask.earliestStart - succ.lag;
                break;
              case 'SS':
                adjustedSuccessorES = successorTask.earliestStart - succ.lag + task.duration;
                break;
              case 'FF':
                adjustedSuccessorES = successorTask.earliestFinish - task.duration - succ.lag;
                break;
              case 'SF':
                adjustedSuccessorES = successorTask.earliestFinish - task.duration - succ.lag;
                break;
              default:
                adjustedSuccessorES = successorTask.earliestStart - succ.lag;
            }
            
            minSuccessorES = Math.min(minSuccessorES, adjustedSuccessorES);
          }
        });

        task.freeFloat = Math.max(0, minSuccessorES - task.earliestFinish);
      }

      // Task is critical if total float is near zero
      task.isCritical = Math.abs(task.totalFloat) <= this.FLOAT_TOLERANCE;
    });
  }

  private identifyCriticalPath(taskMap: Map<string, TaskNodeWithSlack>): string[] {
    const criticalTasks = Array.from(taskMap.values())
      .filter(task => task.isCritical)
      .sort((a, b) => a.earliestStart - b.earliestStart);

    // Trace connected critical path
    const criticalPath: string[] = [];
    const visited = new Set<string>();

    // Start with critical tasks that have no critical predecessors
    const startCriticalTasks = criticalTasks.filter(task =>
      !task.predecessors.some(pred => {
        const predTask = taskMap.get(pred.id);
        return predTask?.isCritical;
      })
    );

    const tracePath = (task: TaskNodeWithSlack) => {
      if (visited.has(task.id)) return;
      
      visited.add(task.id);
      criticalPath.push(task.id);

      // Find critical successors
      const criticalSuccessors = task.successors
        .map(succ => taskMap.get(succ.id))
        .filter(succTask => succTask?.isCritical && !visited.has(succTask.id))
        .sort((a, b) => a!.earliestStart - b!.earliestStart);

      criticalSuccessors.forEach(succTask => {
        if (succTask) tracePath(succTask);
      });
    };

    startCriticalTasks.forEach(tracePath);

    return criticalPath;
  }

  private reverseTopologicalSort(tasks: TaskNodeWithSlack[]): TaskNodeWithSlack[] {
    const visited = new Set<string>();
    const result: TaskNodeWithSlack[] = [];

    const visit = (task: TaskNodeWithSlack) => {
      if (visited.has(task.id)) return;

      visited.add(task.id);

      // Visit all successors first (reverse order)
      task.successors.forEach(succ => {
        const successorTask = tasks.find(t => t.id === succ.id);
        if (successorTask && !visited.has(successorTask.id)) {
          visit(successorTask);
        }
      });

      result.push(task);
    };

    // Start with tasks that have no successors
    const endTasks = tasks.filter(task => task.successors.length === 0);
    endTasks.forEach(visit);

    // Visit remaining unvisited tasks
    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        visit(task);
      }
    });

    return result;
  }

  private getWorkingDaysFromProjectStart(projectStart: Date, targetDate: Date): number {
    // Simple implementation - should match ForwardPass working day calculation
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((targetDate.getTime() - projectStart.getTime()) / msPerDay);
    return Math.max(0, diffDays);
  }

  /**
   * Get critical path statistics
   */
  getCriticalPathStats(backwardPassResult: BackwardPassResult): {
    criticalPathLength: number;
    totalTasks: number;
    criticalRatio: number;
    avgFloatTime: number;
  } {
    const { tasks, criticalPath } = backwardPassResult;
    const taskValues = Array.from(tasks.values());

    const criticalPathLength = criticalPath.length;
    const totalTasks = taskValues.length;
    const criticalRatio = totalTasks > 0 ? criticalPathLength / totalTasks : 0;
    const avgFloatTime = taskValues.length > 0 
      ? taskValues.reduce((sum, task) => sum + task.totalFloat, 0) / taskValues.length
      : 0;

    return {
      criticalPathLength,
      totalTasks,
      criticalRatio,
      avgFloatTime
    };
  }

  /**
   * Find tasks that can be delayed without affecting project completion
   */
  getOptimizationOpportunities(backwardPassResult: BackwardPassResult): Array<{
    taskId: string;
    title: string;
    totalFloat: number;
    freeFloat: number;
    recommendation: string;
  }> {
    const opportunities: Array<{
      taskId: string;
      title: string;
      totalFloat: number;
      freeFloat: number;
      recommendation: string;
    }> = [];

    backwardPassResult.tasks.forEach(task => {
      if (!task.isCritical && task.totalFloat > 1) { // More than 1 day float
        let recommendation = '';
        
        if (task.freeFloat > 0) {
          recommendation = `Can be delayed by ${task.freeFloat.toFixed(1)} days without affecting other tasks`;
        } else if (task.totalFloat > 0) {
          recommendation = `Can be delayed by ${task.totalFloat.toFixed(1)} days without affecting project completion`;
        }

        if (recommendation) {
          opportunities.push({
            taskId: task.id,
            title: task.title,
            totalFloat: task.totalFloat,
            freeFloat: task.freeFloat,
            recommendation
          });
        }
      }
    });

    return opportunities.sort((a, b) => b.totalFloat - a.totalFloat);
  }
}