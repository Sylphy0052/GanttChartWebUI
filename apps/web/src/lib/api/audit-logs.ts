import { apiClient, ApiResponse } from './client';
import {
  AuditLogQuery,
  AuditLogEntry,
  AuditLogSummary,
  AuditTrend,
  AuditOperation,
  PerformanceData,
  AuditMetadata,
} from '../../types/scheduling';

export class AuditLogsApiClient {
  private readonly basePath = '/projects';

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(
    projectId: string,
    query: AuditLogQuery = {}
  ): Promise<{
    entries: AuditLogEntry[];
    total: number;
    hasMore: boolean;
    summary: {
      totalOperations: number;
      successRate: number;
      averagePerformance: PerformanceData;
    };
  }> {
    const params: any = {};
    
    if (query.operation) params.operation = query.operation;
    if (query.startDate) params.startDate = query.startDate.toISOString();
    if (query.endDate) params.endDate = query.endDate.toISOString();
    if (query.userId) params.userId = query.userId;
    if (query.limit) params.limit = query.limit;
    if (query.offset) params.offset = query.offset;

    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/audit-logs`,
      { params }
    );
    
    return response.data;
  }

  /**
   * Get detailed audit log entry
   */
  async getAuditLogEntry(
    projectId: string,
    entryId: string
  ): Promise<AuditLogEntry & {
    relatedEntries: AuditLogEntry[];
    impactAnalysis: {
      tasksAffected: number;
      scheduleChanges: Array<{
        taskId: string;
        field: string;
        before: any;
        after: any;
        impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      }>;
      resourceChanges: Array<{
        resourceId: string;
        utilizationChange: number;
        conflictsResolved: number;
      }>;
    };
  }> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/audit-logs/${entryId}`
    );
    
    return response.data;
  }

  /**
   * Get audit log summary and statistics
   */
  async getAuditLogSummary(
    projectId: string,
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'WEEKLY',
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<AuditLogSummary> {
    const params: any = { period };
    
    if (timeRange) {
      params.startDate = timeRange.start.toISOString();
      params.endDate = timeRange.end.toISOString();
    }

    const response = await apiClient.get<AuditLogSummary>(
      `${this.basePath}/${projectId}/audit-logs/summary`,
      { params }
    );
    
    return response.data;
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(
    projectId: string,
    operation?: AuditOperation,
    period: 'HOURLY' | 'DAILY' | 'WEEKLY' = 'DAILY',
    duration: number = 30 // days
  ): Promise<{
    trends: Array<{
      timestamp: Date;
      operationCount: number;
      averageResponseTime: number;
      averageMemoryUsage: number;
      successRate: number;
      errorRate: number;
    }>;
    benchmarks: {
      p50ResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      averageMemoryUsage: number;
      peakMemoryUsage: number;
    };
    recommendations: Array<{
      type: 'PERFORMANCE' | 'OPTIMIZATION' | 'SCALING';
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      suggestedAction: string;
      estimatedImpact: string;
    }>;
  }> {
    const params: any = {
      period,
      duration,
    };
    
    if (operation) params.operation = operation;

    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/audit-logs/performance-trends`,
      { params }
    );
    
    return response.data;
  }

  /**
   * Get user activity analytics
   */
  async getUserActivity(
    projectId: string,
    userId?: string,
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    users: Array<{
      userId: string;
      userName: string;
      totalOperations: number;
      operationBreakdown: Record<AuditOperation, number>;
      averageSessionDuration: number; // minutes
      lastActivity: Date;
      productivityScore: number; // 0-100
      preferredOperations: AuditOperation[];
    }>;
    teamMetrics: {
      totalUsers: number;
      activeUsers: number;
      averageOperationsPerUser: number;
      collaborationIndex: number; // 0-100
      peakActivityHours: number[];
    };
  }> {
    const params: any = {};
    
    if (userId) params.userId = userId;
    if (timeRange) {
      params.startDate = timeRange.start.toISOString();
      params.endDate = timeRange.end.toISOString();
    }

    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/audit-logs/user-activity`,
      { params }
    );
    
    return response.data;
  }

  /**
   * Get error analysis and patterns
   */
  async getErrorAnalysis(
    projectId: string,
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    errorSummary: {
      totalErrors: number;
      errorRate: number;
      mostCommonErrors: Array<{
        errorType: string;
        count: number;
        percentage: number;
        lastOccurrence: Date;
      }>;
    };
    errorPatterns: Array<{
      pattern: string;
      frequency: number;
      typicalContext: AuditOperation[];
      suggestedFix: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    resolution: {
      autoResolved: number;
      manuallyResolved: number;
      unresolved: number;
      averageResolutionTime: number; // hours
    };
  }> {
    const params: any = {};
    
    if (timeRange) {
      params.startDate = timeRange.start.toISOString();
      params.endDate = timeRange.end.toISOString();
    }

    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/audit-logs/error-analysis`,
      { params }
    );
    
    return response.data;
  }

  /**
   * Export audit logs in various formats
   */
  async exportAuditLogs(
    projectId: string,
    options: {
      format: 'CSV' | 'JSON' | 'EXCEL' | 'PDF';
      query?: AuditLogQuery;
      includeMetadata: boolean;
      includePerformanceData: boolean;
      includeChanges: boolean;
      groupBy?: 'DATE' | 'USER' | 'OPERATION';
      customFields?: string[];
    }
  ): Promise<Blob> {
    const response = await apiClient.post(
      `${this.basePath}/${projectId}/audit-logs/export`,
      options,
      { responseType: 'blob' }
    );
    
    return response.data as Blob;
  }

  /**
   * Search audit logs with advanced filters
   */
  async searchAuditLogs(
    projectId: string,
    searchCriteria: {
      keywords?: string[];
      operations?: AuditOperation[];
      resultTypes?: Array<'SUCCESS' | 'FAILURE' | 'PARTIAL'>;
      userIds?: string[];
      performanceThresholds?: {
        minResponseTime?: number;
        maxResponseTime?: number;
        minMemoryUsage?: number;
        maxMemoryUsage?: number;
      };
      metadataFilters?: Record<string, any>;
      timeRange?: {
        start: Date;
        end: Date;
      };
      sortBy?: 'TIMESTAMP' | 'PERFORMANCE' | 'IMPACT';
      sortOrder?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    results: AuditLogEntry[];
    total: number;
    searchMetrics: {
      searchTime: number; // ms
      indexesUsed: string[];
      resultRelevanceScores: number[];
    };
    suggestions: {
      relatedSearches: string[];
      filterSuggestions: Array<{
        field: string;
        value: any;
        count: number;
      }>;
    };
  }> {
    const response = await apiClient.post<any>(
      `${this.basePath}/${projectId}/audit-logs/search`,
      searchCriteria
    );
    
    return response.data;
  }

  /**
   * Create custom audit log dashboard
   */
  async createCustomDashboard(
    projectId: string,
    dashboard: {
      name: string;
      description: string;
      widgets: Array<{
        type: 'CHART' | 'TABLE' | 'METRIC' | 'ALERT';
        title: string;
        query: AuditLogQuery;
        visualization: {
          chartType?: 'LINE' | 'BAR' | 'PIE' | 'SCATTER';
          xAxis?: string;
          yAxis?: string;
          groupBy?: string;
          aggregation?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
        };
        refreshInterval: number; // minutes
        position: { x: number; y: number; width: number; height: number };
      }>;
      filters: {
        global: boolean;
        available: Array<{
          field: string;
          type: 'SELECT' | 'RANGE' | 'DATE' | 'TEXT';
          options?: any[];
        }>;
      };
      sharing: {
        public: boolean;
        allowedUsers?: string[];
        embedToken?: string;
      };
    }
  ): Promise<{ dashboardId: string; url: string }> {
    const response = await apiClient.post<{ dashboardId: string; url: string }>(
      `${this.basePath}/${projectId}/audit-logs/dashboards`,
      dashboard
    );
    
    return response.data;
  }

  /**
   * Get system health metrics based on audit logs
   */
  async getSystemHealthMetrics(
    projectId: string
  ): Promise<{
    overallHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
    healthScore: number; // 0-100
    metrics: {
      availability: number; // percentage
      responseTime: {
        current: number;
        target: number;
        trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
      };
      errorRate: {
        current: number;
        target: number;
        trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
      };
      throughput: {
        current: number; // operations per hour
        capacity: number;
        utilization: number; // percentage
      };
    };
    alerts: Array<{
      level: 'WARNING' | 'ERROR' | 'CRITICAL';
      message: string;
      timestamp: Date;
      component: string;
      recommendedAction: string;
    }>;
    recommendations: Array<{
      category: 'PERFORMANCE' | 'RELIABILITY' | 'SCALABILITY' | 'SECURITY';
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      estimatedEffort: string;
      expectedBenefit: string;
    }>;
  }> {
    const response = await apiClient.get<any>(
      `${this.basePath}/${projectId}/audit-logs/health-metrics`
    );
    
    return response.data;
  }

  /**
   * Set up real-time audit log monitoring
   */
  createAuditLogStream(
    projectId: string,
    filters: {
      operations?: AuditOperation[];
      users?: string[];
      severity?: Array<'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'>;
    },
    onUpdate: (entry: AuditLogEntry) => void,
    onError: (error: Error) => void
  ): () => void {
    const params = new URLSearchParams();
    if (filters.operations) params.set('operations', filters.operations.join(','));
    if (filters.users) params.set('users', filters.users.join(','));
    if (filters.severity) params.set('severity', filters.severity.join(','));

    const eventSource = new EventSource(
      `${apiClient['baseURL']}/projects/${projectId}/audit-logs/stream?${params}`
    );

    eventSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        onUpdate(entry);
      } catch (error) {
        onError(new Error('Failed to parse audit log update'));
      }
    };

    eventSource.onerror = (error) => {
      onError(new Error('Audit log stream error'));
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Archive old audit logs
   */
  async archiveAuditLogs(
    projectId: string,
    options: {
      olderThan: Date;
      includeSuccessful: boolean;
      includeErrors: boolean;
      compressionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      retentionPeriod: number; // months
    }
  ): Promise<{
    archived: number;
    archiveSize: number; // bytes
    archiveLocation: string;
    estimatedSavings: number; // bytes
  }> {
    const response = await apiClient.post<{
      archived: number;
      archiveSize: number;
      archiveLocation: string;
      estimatedSavings: number;
    }>(`${this.basePath}/${projectId}/audit-logs/archive`, options);
    
    return response.data;
  }

  /**
   * Restore archived audit logs
   */
  async restoreArchivedLogs(
    projectId: string,
    archiveLocation: string,
    dateRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    restored: number;
    totalAvailable: number;
    restorationTime: number; // seconds
  }> {
    const response = await apiClient.post<{
      restored: number;
      totalAvailable: number;
      restorationTime: number;
    }>(`${this.basePath}/${projectId}/audit-logs/restore`, {
      archiveLocation,
      dateRange,
    });
    
    return response.data;
  }
}

// Export singleton instance
export const auditLogsApi = new AuditLogsApiClient();
export default auditLogsApi;