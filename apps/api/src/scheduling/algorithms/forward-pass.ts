export interface TaskNode {
  id: string;
  title: string;
  duration: number; // in days
  startDate: Date;
  endDate: Date;
  assigneeId: string | null;
  predecessors: Array<{
    id: string;
    type: 'FS' | 'FF' | 'SS' | 'SF';
    lag: number;
  }>;
  successors: Array<{
    id: string;
    type: 'FS' | 'FF' | 'SS' | 'SF';  
    lag: number;
  }>;
  earliestStart: number; // in days from project start
  earliestFinish: number;
  isCompleted: boolean;
  progress: number; // 0-100
}

export interface ForwardPassResult {
  tasks: Map<string, TaskNode>;
  projectEarliestFinish: number;
  criticalPathCandidates: string[];
}

export class ForwardPass {
  private readonly WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
  private readonly WORKING_HOURS_PER_DAY = 8;

  constructor(
    private workingDays: number[] = [1, 2, 3, 4, 5],
    private workingHoursPerDay: number = 8,
    private holidays: Date[] = []
  ) {}

  /**
   * Calculate forward pass - determines earliest start and finish times
   */
  calculate(
    tasks: TaskNode[],
    projectStartDate: Date,
    constraints: {
      workingDays?: number[];
      workingHoursPerDay?: number;
      holidays?: Date[];
    } = {}
  ): ForwardPassResult {
    // Apply constraints
    this.workingDays = constraints.workingDays || this.workingDays;
    this.workingHoursPerDay = constraints.workingHoursPerDay || this.workingHoursPerDay;
    this.holidays = constraints.holidays || this.holidays;

    const taskMap = new Map<string, TaskNode>();
    const visited = new Set<string>();
    const inProgress = new Set<string>();

    // Initialize task map
    tasks.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        earliestStart: 0,
        earliestFinish: 0
      });
    });

    // Find start tasks (no predecessors)
    const startTasks = tasks.filter(task => task.predecessors.length === 0);

    // Calculate earliest times for start tasks
    startTasks.forEach(task => {
      const taskNode = taskMap.get(task.id)!;
      taskNode.earliestStart = 0; // Project start
      taskNode.earliestFinish = this.calculateEarliestFinish(taskNode, projectStartDate);
    });

    // Process all tasks using topological sort
    const sortedTasks = this.topologicalSort(tasks);
    
    sortedTasks.forEach(task => {
      this.calculateTaskEarliestTimes(task, taskMap, projectStartDate);
    });

    // Find project earliest finish
    const projectEarliestFinish = Math.max(...Array.from(taskMap.values()).map(t => t.earliestFinish));

    // Identify critical path candidates (tasks with maximum earliest finish)
    const criticalPathCandidates = Array.from(taskMap.values())
      .filter(task => task.earliestFinish === projectEarliestFinish)
      .map(task => task.id);

    return {
      tasks: taskMap,
      projectEarliestFinish,
      criticalPathCandidates
    };
  }

  private calculateTaskEarliestTimes(
    task: TaskNode,
    taskMap: Map<string, TaskNode>,
    projectStartDate: Date
  ): void {
    const taskNode = taskMap.get(task.id)!;

    if (task.predecessors.length === 0) {
      // Start task - already calculated
      return;
    }

    let maxEarliestStart = 0;

    // Calculate based on predecessors
    task.predecessors.forEach(pred => {
      const predecessorTask = taskMap.get(pred.id);
      if (!predecessorTask) {
        throw new Error(`Predecessor task not found: ${pred.id}`);
      }

      let requiredStart: number;

      switch (pred.type) {
        case 'FS': // Finish-to-Start (default)
          requiredStart = predecessorTask.earliestFinish + pred.lag;
          break;
        case 'SS': // Start-to-Start
          requiredStart = predecessorTask.earliestStart + pred.lag;
          break;
        case 'FF': // Finish-to-Finish
          requiredStart = predecessorTask.earliestFinish - taskNode.duration + pred.lag;
          break;
        case 'SF': // Start-to-Finish
          requiredStart = predecessorTask.earliestStart - taskNode.duration + pred.lag;
          break;
        default:
          requiredStart = predecessorTask.earliestFinish + pred.lag;
      }

      maxEarliestStart = Math.max(maxEarliestStart, requiredStart);
    });

    taskNode.earliestStart = maxEarliestStart;
    taskNode.earliestFinish = this.calculateEarliestFinish(taskNode, projectStartDate);
  }

  private calculateEarliestFinish(task: TaskNode, projectStartDate: Date): number {
    if (task.isCompleted) {
      // If task is completed, use actual end date
      const actualDays = this.calculateWorkingDays(projectStartDate, task.endDate);
      return actualDays;
    }

    // For incomplete tasks, calculate based on progress and remaining duration
    const completedDuration = task.duration * (task.progress / 100);
    const remainingDuration = task.duration - completedDuration;
    
    return task.earliestStart + remainingDuration;
  }

  private topologicalSort(tasks: TaskNode[]): TaskNode[] {
    const visited = new Set<string>();
    const inProgress = new Set<string>();
    const result: TaskNode[] = [];

    const visit = (task: TaskNode) => {
      if (inProgress.has(task.id)) {
        throw new Error(`Circular dependency detected involving task: ${task.id}`);
      }
      
      if (visited.has(task.id)) {
        return;
      }

      inProgress.add(task.id);

      // Visit all predecessors first
      task.predecessors.forEach(pred => {
        const predecessorTask = tasks.find(t => t.id === pred.id);
        if (predecessorTask) {
          visit(predecessorTask);
        }
      });

      inProgress.delete(task.id);
      visited.add(task.id);
      result.push(task);
    };

    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        visit(task);
      }
    });

    return result;
  }

  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (this.isWorkingDay(current)) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  }

  private isWorkingDay(date: Date): boolean {
    // Check if day of week is working day
    if (!this.workingDays.includes(date.getDay())) {
      return false;
    }

    // Check if date is not a holiday
    const dateStr = date.toDateString();
    return !this.holidays.some(holiday => holiday.toDateString() === dateStr);
  }

  /**
   * Convert working days to calendar date
   */
  addWorkingDays(startDate: Date, workingDays: number): Date {
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

  /**
   * Calculate duration in working days between two dates
   */
  getWorkingDaysBetween(startDate: Date, endDate: Date): number {
    return this.calculateWorkingDays(startDate, endDate);
  }
}