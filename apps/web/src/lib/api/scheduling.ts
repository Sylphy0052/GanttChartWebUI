import { apiClient, ApiResponse } from './client';
import {
  SchedulingRequest,
  SchedulingResult,
  SchedulingOptions,
  SchedulingPreferences,
  SchedulingExportOptions,
  WorkingHoursConfig,
} from '../../types/scheduling';

export class SchedulingApiClient {
  private readonly basePath = '/projects';

  /**
   * Calculate project schedule using CPM algorithm
   */
  async calculateSchedule(
    projectId: string,
    options: Partial<SchedulingOptions> = {},
    etag?: string
  ): Promise<SchedulingResult> {
    const defaultOptions: SchedulingOptions = {
      algorithm: 'CPM',
      workingHours: {
        workingDaysPerWeek: 5,
        hoursPerDay: 8,
        workingDays: [1, 2, 3, 4, 5], // Monday to Friday
        startTime: '09:00',
        endTime: '17:00',
      },
      holidays: [],
      resourceConstraints: true,
      bufferPercentage: 10,
      maxIterations: 100,
    };

    const requestData: SchedulingRequest = {
      projectId,
      options: { ...defaultOptions, ...options },
    };

    const requestOptions: any = {};
    if (etag) {
      requestOptions.ifMatch = etag;
    }

    try {
      const response = await apiClient.post<SchedulingResult>(
        `${this.basePath}/${projectId}/schedule/calculate`,
        requestData,
        requestOptions
      );
      
      return response.data;
    } catch (error: any) {
      if (apiClient.isOptimisticLockingConflict(error)) {
        throw new Error('Schedule has been modified by another user. Please refresh and try again.');
      }
      throw error;
    }
  }

  /**
   * Get current project schedule
   */
  async getSchedule(projectId: string): Promise<SchedulingResult | null> {
    try {
      const response = await apiClient.get<SchedulingResult>(
        `${this.basePath}/${projectId}/schedule`
      );
      
      return response.data;
    } catch (error: any) {
      if (error.status === 404) {
        return null; // No schedule calculated yet
      }
      throw error;
    }
  }

  /**
   * Apply calculated schedule to project
   */
  async applySchedule(
    projectId: string,
    scheduleId: string,
    etag: string
  ): Promise<{ success: boolean; appliedAt: Date }> {
    try {
      const response = await apiClient.post<{ success: boolean; appliedAt: Date }>(
        `${this.basePath}/${projectId}/schedule/${scheduleId}/apply`,
        {},
        { ifMatch: etag }
      );
      
      return response.data;
    } catch (error: any) {
      if (apiClient.isOptimisticLockingConflict(error)) {
        throw new Error('Schedule has been modified. Please recalculate and try again.');
      }
      throw error;
    }
  }

  /**
   * Preview schedule changes without applying
   */
  async previewSchedule(
    projectId: string,
    options: Partial<SchedulingOptions> = {}
  ): Promise<SchedulingResult> {
    const requestData: SchedulingRequest = {
      projectId,
      options: options as SchedulingOptions,
    };

    const response = await apiClient.post<SchedulingResult>(
      `${this.basePath}/${projectId}/schedule/preview`,
      requestData
    );
    
    return response.data;
  }

  /**
   * Get schedule calculation history
   */
  async getScheduleHistory(
    projectId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    schedules: SchedulingResult[];
    total: number;
    hasMore: boolean;
  }> {
    const response = await apiClient.get<{
      schedules: SchedulingResult[];
      total: number;
      hasMore: boolean;
    }>(`${this.basePath}/${projectId}/schedule/history`, {
      params: { limit, offset },
    });
    
    return response.data;
  }

  /**
   * Compare two schedules
   */
  async compareSchedules(
    projectId: string,
    scheduleId1: string,
    scheduleId2: string
  ): Promise<{
    differences: Array<{
      taskId: string;
      field: string;
      schedule1Value: any;
      schedule2Value: any;
      impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    summary: {
      totalDifferences: number;
      impactDistribution: Record<string, number>;
      recommendedSchedule: string;
    };
  }> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/schedule/compare/${scheduleId1}/${scheduleId2}`
    );
    
    return response.data;
  }

  /**
   * Get critical path details
   */
  async getCriticalPath(
    projectId: string,
    scheduleId?: string
  ): Promise<{
    criticalTasks: string[];
    totalDuration: number;
    bottleneckTasks: Array<{
      taskId: string;
      impact: number; // hours saved if optimized
      suggestions: string[];
    }>;
  }> {
    const url = scheduleId 
      ? `${this.basePath}/${projectId}/schedule/${scheduleId}/critical-path`
      : `${this.basePath}/${projectId}/schedule/critical-path`;
    
    const response = await apiClient.get<any>(url);
    return response.data;
  }

  /**
   * Optimize schedule for specific criteria
   */
  async optimizeSchedule(
    projectId: string,
    criteria: {
      optimizeFor: 'DURATION' | 'RESOURCE_UTILIZATION' | 'COST' | 'RISK';
      constraints: {
        maxDuration?: number;
        maxBudget?: number;
        fixedMilestones?: Array<{ taskId: string; date: Date }>;
        resourceLimits?: Record<string, number>;
      };
      preferences: {
        allowOvertimeWork: boolean;
        allowResourceReallocation: boolean;
        bufferTimeRequired: boolean;
      };
    },
    etag?: string
  ): Promise<SchedulingResult> {
    const requestOptions: any = {};
    if (etag) {
      requestOptions.ifMatch = etag;
    }

    const response = await apiClient.post<SchedulingResult>(
      `${this.basePath}/${projectId}/schedule/optimize`,
      criteria,
      requestOptions
    );
    
    return response.data;
  }

  /**
   * Get resource utilization analysis
   */
  async getResourceUtilization(
    projectId: string,
    scheduleId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    resources: Array<{
      resourceId: string;
      resourceName: string;
      utilizationPercentage: number;
      overallocatedPeriods: Array<{
        start: Date;
        end: Date;
        overallocation: number; // hours
      }>;
      availableCapacity: number;
      recommendations: string[];
    }>;
    summary: {
      averageUtilization: number;
      overallocatedResources: number;
      underutilizedResources: number;
      optimizationPotential: number; // percentage
    };
  }> {
    const params: any = {};
    if (dateRange) {
      params.startDate = dateRange.start.toISOString();
      params.endDate = dateRange.end.toISOString();
    }

    const url = scheduleId 
      ? `${this.basePath}/${projectId}/schedule/${scheduleId}/resource-utilization`
      : `${this.basePath}/${projectId}/schedule/resource-utilization`;
    
    const response = await apiClient.get<any>(url, { params });
    return response.data;
  }

  /**
   * Validate schedule integrity
   */
  async validateSchedule(
    projectId: string,
    scheduleId?: string
  ): Promise<{
    isValid: boolean;
    validationErrors: Array<{
      type: 'CIRCULAR_DEPENDENCY' | 'DATE_CONSTRAINT' | 'RESOURCE_CONFLICT' | 'DATA_INCONSISTENCY';
      severity: 'ERROR' | 'WARNING' | 'INFO';
      taskId?: string;
      message: string;
      suggestedFix?: string;
    }>;
    recommendations: string[];
  }> {
    const url = scheduleId 
      ? `${this.basePath}/${projectId}/schedule/${scheduleId}/validate`
      : `${this.basePath}/${projectId}/schedule/validate`;
    
    const response = await apiClient.get<any>(url);
    return response.data;
  }

  /**
   * Export schedule data
   */
  async exportSchedule(
    projectId: string,
    scheduleId: string,
    options: SchedulingExportOptions
  ): Promise<Blob> {
    const response = await apiClient.post(
      `${this.basePath}/${projectId}/schedule/${scheduleId}/export`,
      options,
      { responseType: 'blob' }
    );
    
    return response.data as Blob;
  }

  /**
   * Get scheduling preferences for user/project
   */
  async getSchedulingPreferences(
    projectId: string
  ): Promise<SchedulingPreferences> {
    const response = await apiClient.get<SchedulingPreferences>(
      `${this.basePath}/${projectId}/schedule/preferences`
    );
    
    return response.data;
  }

  /**
   * Update scheduling preferences
   */
  async updateSchedulingPreferences(
    projectId: string,
    preferences: Partial<SchedulingPreferences>
  ): Promise<SchedulingPreferences> {
    const response = await apiClient.put<SchedulingPreferences>(
      `${this.basePath}/${projectId}/schedule/preferences`,
      preferences
    );
    
    return response.data;
  }

  /**
   * Cancel ongoing calculation
   */
  async cancelCalculation(projectId: string): Promise<{ cancelled: boolean }> {
    const response = await apiClient.post<{ cancelled: boolean }>(
      `${this.basePath}/${projectId}/schedule/cancel`,
      {}
    );
    
    return response.data;
  }

  /**
   * Get calculation status for long-running operations
   */
  async getCalculationStatus(
    projectId: string,
    calculationId: string
  ): Promise<{
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    progress: number; // 0-100
    estimatedCompletion?: Date;
    currentPhase?: string;
    error?: string;
  }> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/schedule/calculation/${calculationId}/status`
    );
    
    return response.data;
  }

  /**
   * Get schedule impact analysis for task changes
   */
  async analyzeTaskImpact(
    projectId: string,
    taskId: string,
    proposedChanges: {
      startDate?: Date;
      endDate?: Date;
      duration?: number;
      assigneeId?: string;
      priority?: string;
    }
  ): Promise<{
    impactedTasks: Array<{
      taskId: string;
      impactType: 'SCHEDULE_DELAY' | 'RESOURCE_CONFLICT' | 'DEPENDENCY_SHIFT';
      estimatedDelay: number; // hours
      criticalPathAffected: boolean;
    }>;
    projectImpact: {
      totalDelayHours: number;
      newProjectEndDate: Date;
      costImpact: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
    recommendations: Array<{
      action: string;
      benefit: string;
      effort: number; // hours
    }>;
  }> {
    const response = await apiClient.post<any>(
      `${this.basePath}/${projectId}/tasks/${taskId}/impact-analysis`,
      proposedChanges
    );
    
    return response.data;
  }
}

// Export singleton instance
export const schedulingApi = new SchedulingApiClient();
export default schedulingApi;