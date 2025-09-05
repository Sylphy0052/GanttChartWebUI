import { apiClient, ApiResponse } from './client';
import {
  ConflictDetectionRequest,
  DetectedConflict,
  ConflictResolutionRequest,
  ConflictResolutionResult,
  ConflictContext,
  ResolutionStrategy,
  ResolutionOptions,
  ConflictType,
} from '../../types/scheduling';

export class ConflictsApiClient {
  private readonly basePath = '/projects';

  /**
   * Detect conflicts for a project
   */
  async detectConflicts(
    projectId: string,
    etag: string,
    context: ConflictContext
  ): Promise<DetectedConflict[]> {
    const requestData: ConflictDetectionRequest = {
      projectId,
      etag,
      context,
    };

    try {
      const response = await apiClient.post<DetectedConflict[]>(
        `${this.basePath}/${projectId}/conflicts/detect`,
        requestData
      );
      
      return response.data;
    } catch (error: any) {
      if (apiClient.isOptimisticLockingConflict(error)) {
        throw new Error('Project data has been modified. Please refresh and try again.');
      }
      throw error;
    }
  }

  /**
   * Get all existing conflicts for a project
   */
  async getConflicts(
    projectId: string,
    filters?: {
      type?: ConflictType[];
      severity?: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>;
      entityType?: Array<'TASK' | 'DEPENDENCY' | 'RESOURCE' | 'PROJECT'>;
      resolved?: boolean;
    }
  ): Promise<DetectedConflict[]> {
    const params: any = {};
    if (filters) {
      if (filters.type) params.type = filters.type.join(',');
      if (filters.severity) params.severity = filters.severity.join(',');
      if (filters.entityType) params.entityType = filters.entityType.join(',');
      if (filters.resolved !== undefined) params.resolved = filters.resolved;
    }

    const response = await apiClient.get<DetectedConflict[]>(
      `${this.basePath}/${projectId}/conflicts`,
      { params }
    );
    
    return response.data;
  }

  /**
   * Get specific conflict details
   */
  async getConflictDetails(
    projectId: string,
    conflictId: string
  ): Promise<DetectedConflict & {
    resolutionHistory: Array<{
      id: string;
      strategy: ResolutionStrategy;
      appliedAt: Date;
      appliedBy: string;
      result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
      notes?: string;
    }>;
    possibleResolutions: Array<{
      strategy: ResolutionStrategy;
      estimatedImpact: {
        affectedTasks: number;
        timeChange: number; // in hours
        resourceReallocation: boolean;
      };
      autoApplicable: boolean;
      confidence: number; // 0-1
    }>;
  }> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/conflicts/${conflictId}`
    );
    
    return response.data;
  }

  /**
   * Resolve single conflict
   */
  async resolveConflict(
    projectId: string,
    conflictId: string,
    strategy: ResolutionStrategy,
    options: ResolutionOptions,
    userId: string
  ): Promise<ConflictResolutionResult> {
    const requestData: ConflictResolutionRequest = {
      conflictIds: [conflictId],
      strategy,
      options,
      userId,
    };

    try {
      const response = await apiClient.post<ConflictResolutionResult>(
        `${this.basePath}/${projectId}/conflicts/resolve`,
        requestData
      );
      
      return response.data;
    } catch (error: any) {
      if (apiClient.isOptimisticLockingConflict(error)) {
        throw new Error('Conflicts have been modified. Please refresh and try again.');
      }
      throw error;
    }
  }

  /**
   * Resolve multiple conflicts in bulk
   */
  async resolveBulkConflicts(
    projectId: string,
    conflictIds: string[],
    strategy: ResolutionStrategy,
    options: ResolutionOptions,
    userId: string
  ): Promise<ConflictResolutionResult> {
    const requestData: ConflictResolutionRequest = {
      conflictIds,
      strategy: { ...strategy, bulkApply: true },
      options,
      userId,
    };

    try {
      const response = await apiClient.post<ConflictResolutionResult>(
        `${this.basePath}/${projectId}/conflicts/bulk-resolve`,
        requestData
      );
      
      return response.data;
    } catch (error: any) {
      if (apiClient.isOptimisticLockingConflict(error)) {
        throw new Error('Conflicts have been modified during bulk resolution. Please refresh and retry.');
      }
      throw error;
    }
  }

  /**
   * Preview conflict resolution without applying changes
   */
  async previewResolution(
    projectId: string,
    conflictIds: string[],
    strategy: ResolutionStrategy,
    options: ResolutionOptions
  ): Promise<{
    previewResult: ConflictResolutionResult;
    estimatedChanges: Array<{
      entityType: 'TASK' | 'DEPENDENCY' | 'RESOURCE';
      entityId: string;
      changes: Record<string, { from: any; to: any }>;
    }>;
    riskAssessment: {
      overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      specificRisks: Array<{
        type: 'DATA_LOSS' | 'SCHEDULE_DISRUPTION' | 'RESOURCE_CONFLICT' | 'DEPENDENCY_BREAK';
        description: string;
        mitigation: string;
      }>;
    };
  }> {
    const requestData = {
      conflictIds,
      strategy,
      options: { ...options, preview: true },
    };

    const response = await apiClient.post<any>(
      `${this.basePath}/${projectId}/conflicts/preview-resolution`,
      requestData
    );
    
    return response.data;
  }

  /**
   * Auto-resolve conflicts using AI recommendations
   */
  async autoResolveConflicts(
    projectId: string,
    options: {
      aggressiveness: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
      preserveUserChanges: boolean;
      maxAutomaticResolutions: number;
      requireConfirmation: boolean;
      excludeConflictTypes?: ConflictType[];
    }
  ): Promise<{
    autoResolved: string[];
    requiresManualResolution: string[];
    recommendations: Array<{
      conflictId: string;
      recommendedStrategy: ResolutionStrategy;
      confidence: number;
      reasoning: string;
    }>;
  }> {
    const response = await apiClient.post<any>(
      `${this.basePath}/${projectId}/conflicts/auto-resolve`,
      options
    );
    
    return response.data;
  }

  /**
   * Get conflict resolution suggestions based on project history
   */
  async getResolutionSuggestions(
    projectId: string,
    conflictId: string
  ): Promise<Array<{
    strategy: ResolutionStrategy;
    confidence: number; // 0-1
    reasoning: string;
    similarConflictsResolved: number;
    estimatedSuccessRate: number;
    pros: string[];
    cons: string[];
    bestPractice: boolean;
  }>> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/conflicts/${conflictId}/suggestions`
    );
    
    return response.data;
  }

  /**
   * Mark conflicts as acknowledged (but not resolved)
   */
  async acknowledgeConflicts(
    projectId: string,
    conflictIds: string[],
    userId: string,
    notes?: string
  ): Promise<{ acknowledged: string[]; failed: string[] }> {
    const response = await apiClient.post<{ acknowledged: string[]; failed: string[] }>(
      `${this.basePath}/${projectId}/conflicts/acknowledge`,
      {
        conflictIds,
        userId,
        notes,
      }
    );
    
    return response.data;
  }

  /**
   * Dismiss conflicts as non-critical
   */
  async dismissConflicts(
    projectId: string,
    conflictIds: string[],
    userId: string,
    reason: string
  ): Promise<{ dismissed: string[]; failed: string[] }> {
    const response = await apiClient.post<{ dismissed: string[]; failed: string[] }>(
      `${this.basePath}/${projectId}/conflicts/dismiss`,
      {
        conflictIds,
        userId,
        reason,
      }
    );
    
    return response.data;
  }

  /**
   * Get conflict statistics and trends
   */
  async getConflictStatistics(
    projectId: string,
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'WEEKLY'
  ): Promise<{
    summary: {
      total: number;
      resolved: number;
      pending: number;
      dismissed: number;
      byType: Record<ConflictType, number>;
      bySeverity: Record<string, number>;
    };
    trends: Array<{
      date: Date;
      detected: number;
      resolved: number;
      averageResolutionTime: number; // in hours
    }>;
    topConflictSources: Array<{
      source: 'USER_ACTION' | 'SYSTEM_CALCULATION' | 'EXTERNAL_UPDATE' | 'INTEGRATION';
      count: number;
      percentage: number;
    }>;
    resolutionEffectiveness: {
      successRate: number;
      averageResolutionTime: number;
      mostEffectiveStrategy: ResolutionStrategy['type'];
      userSatisfactionScore: number; // 1-5
    };
  }> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/conflicts/statistics`,
      { params: { period } }
    );
    
    return response.data;
  }

  /**
   * Export conflicts data
   */
  async exportConflicts(
    projectId: string,
    options: {
      format: 'CSV' | 'JSON' | 'EXCEL';
      includeResolved: boolean;
      dateRange?: {
        start: Date;
        end: Date;
      };
      conflictTypes?: ConflictType[];
    }
  ): Promise<Blob> {
    const response = await apiClient.post(
      `${this.basePath}/${projectId}/conflicts/export`,
      options,
      { responseType: 'blob' }
    );
    
    return response.data as Blob;
  }

  /**
   * Simulate conflict scenarios for testing
   */
  async simulateConflictScenario(
    projectId: string,
    scenario: {
      name: string;
      description: string;
      changes: Array<{
        entityType: 'TASK' | 'DEPENDENCY' | 'RESOURCE';
        entityId: string;
        modifications: Record<string, any>;
      }>;
      expectedConflicts: number;
    }
  ): Promise<{
    detectedConflicts: DetectedConflict[];
    scenarioAccuracy: number; // percentage match with expected
    performanceMetrics: {
      detectionTime: number;
      memoryUsage: number;
      cpuUsage: number;
    };
  }> {
    const response = await apiClient.post<any>(
      `${this.basePath}/${projectId}/conflicts/simulate`,
      scenario
    );
    
    return response.data;
  }

  /**
   * Get real-time conflict status via SSE
   */
  createConflictStatusStream(
    projectId: string,
    onUpdate: (conflicts: DetectedConflict[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const eventSource = new EventSource(
      `${apiClient['baseURL']}/projects/${projectId}/conflicts/stream`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data.conflicts);
      } catch (error) {
        onError(new Error('Failed to parse conflict update'));
      }
    };

    eventSource.onerror = (error) => {
      onError(new Error('Conflict status stream error'));
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Create conflict resolution workflow
   */
  async createResolutionWorkflow(
    projectId: string,
    workflow: {
      name: string;
      description: string;
      triggers: Array<{
        conflictType: ConflictType;
        severity: string;
        condition: string; // e.g., "severity >= HIGH"
      }>;
      steps: Array<{
        order: number;
        action: 'AUTO_RESOLVE' | 'NOTIFY_USER' | 'ESCALATE' | 'APPLY_STRATEGY';
        parameters: Record<string, any>;
        condition?: string;
      }>;
      notifications: {
        channels: Array<'EMAIL' | 'SLACK' | 'IN_APP'>;
        recipients: string[];
        templates: Record<string, string>;
      };
    }
  ): Promise<{ workflowId: string; status: 'ACTIVE' | 'DRAFT' }> {
    const response = await apiClient.post<{ workflowId: string; status: 'ACTIVE' | 'DRAFT' }>(
      `${this.basePath}/${projectId}/conflicts/workflows`,
      workflow
    );
    
    return response.data;
  }
}

// Export singleton instance
export const conflictsApi = new ConflictsApiClient();
export default conflictsApi;