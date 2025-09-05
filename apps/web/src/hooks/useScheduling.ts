import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSchedulingStore } from '@/stores/scheduling-store';
import { schedulingApi } from '@/lib/api/scheduling';
import { conflictsApi } from '@/lib/api/conflicts';
import { auditLogsApi } from '@/lib/api/audit-logs';
import {
  SchedulingOptions,
  SchedulingResult,
  DetectedConflict,
  ConflictResolutionRequest,
  AuditLogQuery,
} from '@/types/scheduling';

// Query keys for React Query
export const SCHEDULING_QUERY_KEYS = {
  schedule: (projectId: string) => ['scheduling', 'schedule', projectId],
  scheduleHistory: (projectId: string) => ['scheduling', 'history', projectId],
  conflicts: (projectId: string) => ['scheduling', 'conflicts', projectId],
  auditLogs: (projectId: string, query?: any) => ['scheduling', 'audit-logs', projectId, query],
  preferences: (projectId: string) => ['scheduling', 'preferences', projectId],
  performance: (projectId: string) => ['scheduling', 'performance', projectId],
  criticalPath: (projectId: string) => ['scheduling', 'critical-path', projectId],
};

export interface UseSchedulingOptions {
  projectId: string;
  enabled?: boolean;
  refetchInterval?: number;
  onCalculationComplete?: (result: SchedulingResult) => void;
  onConflictDetected?: (conflicts: DetectedConflict[]) => void;
  onError?: (error: Error) => void;
}

export interface UseSchedulingReturn {
  // Current state
  currentSchedule: SchedulingResult | undefined;
  isCalculating: boolean;
  calculationProgress: number;
  detectedConflicts: DetectedConflict[];
  
  // Queries
  scheduleQuery: any;
  conflictsQuery: any;
  auditLogsQuery: any;
  preferencesQuery: any;
  
  // Mutations
  calculateSchedule: any;
  previewSchedule: any;
  applySchedule: any;
  resolveConflict: any;
  resolveBulkConflicts: any;
  previewConflictResolution: any;
  
  // Actions
  refreshData: () => void;
  clearCalculation: () => void;
  
  // UI helpers
  hasConflicts: boolean;
  criticalConflictsCount: number;
  isReadyToApply: boolean;
  calculationStatus: 'idle' | 'calculating' | 'completed' | 'error';
}

export function useScheduling(options: UseSchedulingOptions): UseSchedulingReturn {
  const {
    projectId,
    enabled = true,
    refetchInterval,
    onCalculationComplete,
    onConflictDetected,
    onError,
  } = options;

  const queryClient = useQueryClient();
  
  // Zustand store
  const {
    currentSchedule,
    isCalculating,
    calculationProgress,
    detectedConflicts,
    setCurrentProject,
    calculateSchedule: storeCalculateSchedule,
    detectConflicts,
    refreshConflicts,
  } = useSchedulingStore();

  // Set current project when hook is used
  useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);

  // Query: Current Schedule
  const scheduleQuery = useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.schedule(projectId),
    queryFn: () => schedulingApi.getSchedule(projectId),
    enabled: enabled && !!projectId,
    refetchInterval,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle success/error in useEffect
  useEffect(() => {
    if (scheduleQuery.data && onCalculationComplete) {
      onCalculationComplete(scheduleQuery.data);
    }
  }, [scheduleQuery.data, onCalculationComplete]);

  useEffect(() => {
    if (scheduleQuery.error && onError) {
      onError(scheduleQuery.error);
    }
  }, [scheduleQuery.error, onError]);

  // Query: Conflicts
  const conflictsQuery = useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.conflicts(projectId),
    queryFn: () => conflictsApi.getConflicts(projectId),
    enabled: enabled && !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Handle conflicts detection
  useEffect(() => {
    if (conflictsQuery.data && conflictsQuery.data.length > 0 && onConflictDetected) {
      onConflictDetected(conflictsQuery.data);
    }
  }, [conflictsQuery.data, onConflictDetected]);

  // Query: Audit Logs
  const auditLogsQuery = useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.auditLogs(projectId),
    queryFn: () => auditLogsApi.getAuditLogs(projectId, { limit: 50 }),
    enabled: enabled && !!projectId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query: Preferences
  const preferencesQuery = useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.preferences(projectId),
    queryFn: () => schedulingApi.getSchedulingPreferences(projectId),
    enabled: enabled && !!projectId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Mutation: Calculate Schedule
  const calculateSchedule = useMutation({
    mutationFn: (options?: Partial<SchedulingOptions>) =>
      storeCalculateSchedule(options),
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.schedule(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.conflicts(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.auditLogs(projectId) });
      
      if (onCalculationComplete) {
        onCalculationComplete(data);
      }
    },
    onError: (error: Error) => {
      if (onError) {
        onError(error);
      }
    },
  });

  // Mutation: Preview Schedule
  const previewSchedule = useMutation({
    mutationFn: (options?: Partial<SchedulingOptions>) =>
      schedulingApi.previewSchedule(projectId, options),
    onError: (error: Error) => {
      if (onError) {
        onError(error);
      }
    },
  });

  // Mutation: Apply Schedule
  const applySchedule = useMutation({
    mutationFn: ({ scheduleId, etag }: { scheduleId: string; etag: string }) =>
      schedulingApi.applySchedule(projectId, scheduleId, etag),
    onSuccess: () => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.schedule(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.auditLogs(projectId) });
      // Also invalidate gantt data if available
      queryClient.invalidateQueries({ queryKey: ['gantt', projectId] });
    },
    onError,
  });

  // Mutation: Resolve Single Conflict
  const resolveConflict = useMutation({
    mutationFn: ({
      conflictId,
      strategy,
      options,
    }: {
      conflictId: string;
      strategy: any;
      options: any;
    }) =>
      conflictsApi.resolveConflict(projectId, conflictId, strategy, options, 'current-user'),
    onSuccess: () => {
      // Optimistically update conflicts
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.conflicts(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.schedule(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.auditLogs(projectId) });
    },
    onError,
  });

  // Mutation: Resolve Bulk Conflicts
  const resolveBulkConflicts = useMutation({
    mutationFn: ({
      conflictIds,
      strategy,
      options,
    }: {
      conflictIds: string[];
      strategy: any;
      options: any;
    }) =>
      conflictsApi.resolveBulkConflicts(projectId, conflictIds, strategy, options, 'current-user'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.conflicts(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.schedule(projectId) });
      queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.auditLogs(projectId) });
    },
    onError,
  });

  // Actions
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['scheduling', projectId] });
  }, [queryClient, projectId]);

  const clearCalculation = useCallback(() => {
    queryClient.removeQueries({ queryKey: SCHEDULING_QUERY_KEYS.schedule(projectId) });
  }, [queryClient, projectId]);

  // Computed values
  const hasConflicts = useMemo(() => {
    return (conflictsQuery.data?.length ?? 0) > 0;
  }, [conflictsQuery.data]);

  const criticalConflictsCount = useMemo(() => {
    if (!conflictsQuery.data) return 0;
    return conflictsQuery.data.filter((c: DetectedConflict) => c.severity === 'CRITICAL').length;
  }, [conflictsQuery.data]);

  const isReadyToApply = useMemo(() => {
    return !!(
      currentSchedule &&
      !isCalculating &&
      criticalConflictsCount === 0
    );
  }, [currentSchedule, isCalculating, criticalConflictsCount]);

  const calculationStatus = useMemo((): 'idle' | 'calculating' | 'completed' | 'error' => {
    if (calculateSchedule.isError) return 'error';
    if (isCalculating) return 'calculating';
    if (currentSchedule) return 'completed';
    return 'idle';
  }, [calculateSchedule.isError, isCalculating, currentSchedule]);

  return {
    // Current state
    currentSchedule,
    isCalculating,
    calculationProgress,
    detectedConflicts,
    
    // Queries
    scheduleQuery,
    conflictsQuery,
    auditLogsQuery,
    preferencesQuery,
    
    // Mutations
    calculateSchedule,
    previewSchedule,
    applySchedule,
    resolveConflict,
    resolveBulkConflicts,
    previewConflictResolution: {
      mutateAsync: async (params: { conflictIds: string[], strategy: any, options: any }) => {
        return conflictsApi.previewResolution(projectId, params.conflictIds, params.strategy, params.options);
      }
    },
    
    // Actions
    refreshData,
    clearCalculation,
    
    // UI helpers
    hasConflicts,
    criticalConflictsCount,
    isReadyToApply,
    calculationStatus,
  };
}

// Additional specialized hooks

export function useScheduleComparison(
  projectId: string,
  scheduleId1?: string,
  scheduleId2?: string
) {
  return useQuery({
    queryKey: ['scheduling', 'comparison', projectId, scheduleId1, scheduleId2],
    queryFn: () => schedulingApi.compareSchedules(projectId, scheduleId1!, scheduleId2!),
    enabled: !!(projectId && scheduleId1 && scheduleId2),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCriticalPath(projectId: string, scheduleId?: string) {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.criticalPath(projectId),
    queryFn: () => schedulingApi.getCriticalPath(projectId, scheduleId),
    enabled: !!(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useResourceUtilization(
  projectId: string,
  scheduleId?: string,
  dateRange?: { start: Date; end: Date }
) {
  return useQuery({
    queryKey: ['scheduling', 'resource-utilization', projectId, scheduleId, dateRange],
    queryFn: () => schedulingApi.getResourceUtilization(projectId, scheduleId, dateRange),
    enabled: !!(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePerformanceMetrics(projectId: string) {
  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.performance(projectId),
    queryFn: () => auditLogsApi.getPerformanceTrends(projectId),
    enabled: !!(projectId),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

// Real-time hooks

export function useSchedulingNotifications(
  projectId: string,
  onNotification?: (notification: any) => void
) {
  const { addNotification } = useSchedulingStore();

  useEffect(() => {
    if (!projectId) return;

    // Set up Server-Sent Events for real-time notifications
    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/scheduling/notifications`
    );

    eventSource.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        addNotification(notification);
        if (onNotification) {
          onNotification(notification);
        }
      } catch (error) {
        console.error('Failed to parse scheduling notification:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Scheduling notifications stream error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, addNotification, onNotification]);
}

// Advanced calculation hook with progress tracking
export function useAdvancedCalculation(
  projectId: string,
  options?: {
    onProgress?: (progress: number) => void;
    onPhaseChange?: (phase: string) => void;
  }
) {
  const { setCalculationProgress } = useSchedulingStore();
  
  const mutation = useMutation({
    mutationFn: async (calculationOptions?: Partial<SchedulingOptions>) => {
      // Start calculation
      const result = await schedulingApi.calculateSchedule(
        projectId,
        calculationOptions
      );

      // If long-running, poll for status
      if (result.metrics?.performanceMetrics?.calculationTime > 5000) {
        let progress = 0;
        const pollInterval = setInterval(async () => {
          try {
            const status = await schedulingApi.getCalculationStatus(
              projectId,
              'calculation-id' // This would come from the initial response
            );
            
            progress = status.progress;
            setCalculationProgress(progress);
            
            if (options?.onProgress) {
              options.onProgress(progress);
            }
            
            if (options?.onPhaseChange && status.currentPhase) {
              options.onPhaseChange(status.currentPhase);
            }
            
            if (status.status === 'COMPLETED' || status.status === 'FAILED') {
              clearInterval(pollInterval);
            }
          } catch (error) {
            clearInterval(pollInterval);
            console.error('Failed to get calculation status:', error);
          }
        }, 1000);

        // Cleanup on unmount
        return () => clearInterval(pollInterval);
      }

      return result;
    },
  });

  return mutation;
}