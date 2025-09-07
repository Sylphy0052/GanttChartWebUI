export class ComputedScheduleEntity {
  id: string;
  projectId: string;
  
  calculatedAt: Date;
  calculatedBy: string;
  algorithm: string;
  
  originalEndDate: Date;
  computedEndDate: Date;
  totalDuration: number;
  
  constraints: {
    workingDays: number[];
    workingHoursPerDay: number;
    startDate?: Date;
    holidays?: Date[];
  };
  
  taskSchedules: Array<{
    taskId: string;
    originalStartDate: Date;
    originalEndDate: Date;
    computedStartDate: Date;
    computedEndDate: Date;
    floatTime: number;
    criticalPath: boolean;
  }>;
  
  criticalPath: string[];
  
  conflicts: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    affectedTasks: string[];
    suggestedActions: string[];
  }>;
  
  applied: boolean;
  appliedAt?: Date;
  rollbackId?: string;

  constructor(partial: Partial<ComputedScheduleEntity>) {
    Object.assign(this, partial);
  }
}