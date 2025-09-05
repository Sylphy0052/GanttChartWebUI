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
    type: 'resource' | 'dependency' | 'constraint';
    taskId: string;
    description: string;
    severity: 'warning' | 'error';
  }>;
  
  applied: boolean;
  appliedAt?: Date;
  rollbackId?: string;

  constructor(partial: Partial<ComputedScheduleEntity>) {
    Object.assign(this, partial);
  }
}