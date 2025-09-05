import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { schedulingApi } from '@/lib/api/scheduling';
import { conflictsApi } from '@/lib/api/conflicts';
import { auditLogsApi } from '@/lib/api/audit-logs';
import {
  SchedulingResult,
  SchedulingOptions,
  DetectedConflict,
  ConflictResolutionResult,
  SchedulingUIState,
  SchedulingNotification,
  SchedulingPreferences,
  AuditLogEntry,
} from '@/types/scheduling';

interface SchedulingState {
  // Current project
  currentProjectId?: string;
  
  // Scheduling data
  currentSchedule?: SchedulingResult;
  scheduleHistory: SchedulingResult[];
  
  // Calculation state
  isCalculating: boolean;
  calculationProgress: number;
  calculationId?: string;
  calculationError?: string;
  
  // Conflicts
  detectedConflicts: DetectedConflict[];
  conflictsPanelOpen: boolean;
  selectedConflicts: string[];
  resolutionInProgress: boolean;
  
  // UI state
  previewMode: boolean;
  auditLogVisible: boolean;
  
  // Notifications
  notifications: SchedulingNotification[];
  unreadNotifications: number;
  
  // Preferences
  preferences?: SchedulingPreferences;
  
  // Audit logs
  auditLogs: AuditLogEntry[];
  auditLogsLoading: boolean;
  
  // Performance metrics
  lastPerformanceMetrics?: {
    calculationTime: number;
    memoryUsage: number;
    iterations: number;
  };
}

interface SchedulingActions {
  // Project management
  setCurrentProject: (projectId: string) => void;
  clearProject: () => void;
  
  // Schedule calculation
  calculateSchedule: (options?: Partial<SchedulingOptions>) => Promise<SchedulingResult>;
  previewSchedule: (options?: Partial<SchedulingOptions>) => Promise<SchedulingResult>;
  applySchedule: (scheduleId: string, etag: string) => Promise<void>;
  cancelCalculation: () => Promise<void>;
  
  // Schedule management
  getSchedule: () => Promise<SchedulingResult | null>;
  getScheduleHistory: (limit?: number) => Promise<void>;
  compareSchedules: (scheduleId1: string, scheduleId2: string) => Promise<any>;
  
  // Conflict management
  detectConflicts: (etag: string, context: any) => Promise<DetectedConflict[]>;
  refreshConflicts: () => Promise<void>;
  resolveConflict: (conflictId: string, strategy: any, options: any) => Promise<ConflictResolutionResult>;
  resolveBulkConflicts: (conflictIds: string[], strategy: any, options: any) => Promise<ConflictResolutionResult>;
  previewConflictResolution: (conflictIds: string[], strategy: any, options: any) => Promise<any>;
  
  // UI actions
  setCalculationProgress: (progress: number) => void;
  setConflictsPanelOpen: (open: boolean) => void;
  toggleConflictsPanel: () => void;
  selectConflicts: (conflictIds: string[]) => void;
  toggleConflictSelection: (conflictId: string) => void;
  clearConflictSelection: () => void;
  setPreviewMode: (enabled: boolean) => void;
  setAuditLogVisible: (visible: boolean) => void;
  
  // Notifications
  addNotification: (notification: Omit<SchedulingNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (notificationId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  
  // Preferences
  loadPreferences: () => Promise<void>;
  updatePreferences: (updates: Partial<SchedulingPreferences>) => Promise<void>;
  
  // Audit logs
  loadAuditLogs: (query?: any) => Promise<void>;
  searchAuditLogs: (criteria: any) => Promise<void>;
  exportAuditLogs: (options: any) => Promise<Blob>;
  
  // Utilities
  reset: () => void;
  getCalculationStatus: () => Promise<any>;
  validateSchedule: () => Promise<any>;
}

export type SchedulingStore = SchedulingState & SchedulingActions;

const initialState: SchedulingState = {
  currentProjectId: undefined,
  currentSchedule: undefined,
  scheduleHistory: [],
  isCalculating: false,
  calculationProgress: 0,
  calculationId: undefined,
  calculationError: undefined,
  detectedConflicts: [],
  conflictsPanelOpen: false,
  selectedConflicts: [],
  resolutionInProgress: false,
  previewMode: false,
  auditLogVisible: false,
  notifications: [],
  unreadNotifications: 0,
  preferences: undefined,
  auditLogs: [],
  auditLogsLoading: false,
  lastPerformanceMetrics: undefined,
};

export const useSchedulingStore = create<SchedulingStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Project management
        setCurrentProject: (projectId: string) => {
          set({ currentProjectId: projectId });
          // Clear project-specific state
          set({
            currentSchedule: undefined,
            detectedConflicts: [],
            selectedConflicts: [],
            calculationError: undefined,
          });
          // Load project preferences
          get().loadPreferences();
        },

        clearProject: () => {
          set(initialState);
        },

        // Schedule calculation
        calculateSchedule: async (options?: Partial<SchedulingOptions>) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          set({
            isCalculating: true,
            calculationProgress: 0,
            calculationError: undefined,
            previewMode: false,
          });

          try {
            const result = await schedulingApi.calculateSchedule(
              currentProjectId,
              options,
              get().currentSchedule?.etag
            );

            set({
              currentSchedule: result,
              isCalculating: false,
              calculationProgress: 100,
              lastPerformanceMetrics: result.metrics?.performanceMetrics,
            });

            // Add to history
            set((state) => ({
              scheduleHistory: [result, ...state.scheduleHistory].slice(0, 10),
            }));

            // Add success notification
            get().addNotification({
              type: 'CALCULATION_COMPLETE',
              severity: 'SUCCESS',
              title: 'Schedule Calculation Complete',
              message: `Successfully calculated schedule for ${result.tasks.length} tasks`,
              projectId: currentProjectId,
              metadata: {
                duration: result.metrics?.performanceMetrics?.calculationTime,
                criticalTasks: result.metrics?.criticalTasks,
              },
            });

            return result;
          } catch (error: any) {
            set({
              isCalculating: false,
              calculationError: error.message,
            });

            get().addNotification({
              type: 'ERROR',
              severity: 'ERROR',
              title: 'Schedule Calculation Failed',
              message: error.message,
              projectId: currentProjectId,
            });

            throw error;
          }
        },

        previewSchedule: async (options?: Partial<SchedulingOptions>) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          set({ previewMode: true });

          try {
            const result = await schedulingApi.previewSchedule(currentProjectId, options);
            return result;
          } catch (error) {
            set({ previewMode: false });
            throw error;
          }
        },

        applySchedule: async (scheduleId: string, etag: string) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          try {
            await schedulingApi.applySchedule(currentProjectId, scheduleId, etag);
            
            get().addNotification({
              type: 'CALCULATION_COMPLETE',
              severity: 'SUCCESS',
              title: 'Schedule Applied',
              message: 'Schedule has been successfully applied to the project',
              projectId: currentProjectId,
            });

            // Refresh current schedule
            await get().getSchedule();
          } catch (error: any) {
            get().addNotification({
              type: 'ERROR',
              severity: 'ERROR',
              title: 'Failed to Apply Schedule',
              message: error.message,
              projectId: currentProjectId,
            });
            throw error;
          }
        },

        cancelCalculation: async () => {
          const { currentProjectId } = get();
          if (!currentProjectId) return;

          try {
            await schedulingApi.cancelCalculation(currentProjectId);
            set({
              isCalculating: false,
              calculationProgress: 0,
            });
          } catch (error) {
            console.error('Failed to cancel calculation:', error);
          }
        },

        // Schedule management
        getSchedule: async () => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          try {
            const schedule = await schedulingApi.getSchedule(currentProjectId);
            set({ currentSchedule: schedule || undefined });
            return schedule;
          } catch (error) {
            console.error('Failed to fetch schedule:', error);
            return null;
          }
        },

        getScheduleHistory: async (limit = 10) => {
          const { currentProjectId } = get();
          if (!currentProjectId) return;

          try {
            const { schedules } = await schedulingApi.getScheduleHistory(currentProjectId, limit);
            set({ scheduleHistory: schedules });
          } catch (error) {
            console.error('Failed to fetch schedule history:', error);
          }
        },

        compareSchedules: async (scheduleId1: string, scheduleId2: string) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          return schedulingApi.compareSchedules(currentProjectId, scheduleId1, scheduleId2);
        },

        // Conflict management
        detectConflicts: async (etag: string, context: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          try {
            const conflicts = await conflictsApi.detectConflicts(currentProjectId, etag, context);
            set({ detectedConflicts: conflicts });

            if (conflicts.length > 0) {
              get().addNotification({
                type: 'CONFLICT_DETECTED',
                severity: 'WARNING',
                title: `${conflicts.length} Conflicts Detected`,
                message: 'Review and resolve conflicts before proceeding',
                projectId: currentProjectId,
                metadata: { conflictCount: conflicts.length },
                actions: [
                  {
                    label: 'View Conflicts',
                    action: 'VIEW_CONFLICTS',
                    style: 'primary',
                  },
                ],
              });
            }

            return conflicts;
          } catch (error: any) {
            get().addNotification({
              type: 'ERROR',
              severity: 'ERROR',
              title: 'Conflict Detection Failed',
              message: error.message,
              projectId: currentProjectId,
            });
            throw error;
          }
        },

        refreshConflicts: async () => {
          const { currentProjectId } = get();
          if (!currentProjectId) return;

          try {
            const conflicts = await conflictsApi.getConflicts(currentProjectId);
            set({ detectedConflicts: conflicts });
          } catch (error) {
            console.error('Failed to refresh conflicts:', error);
          }
        },

        resolveConflict: async (conflictId: string, strategy: any, options: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          set({ resolutionInProgress: true });

          try {
            const result = await conflictsApi.resolveConflict(
              currentProjectId,
              conflictId,
              strategy,
              options,
              'current-user' // TODO: Get from auth store
            );

            // Remove resolved conflicts from state
            set((state) => ({
              detectedConflicts: state.detectedConflicts.filter(
                (c) => !result.resolvedConflicts.includes(c.id)
              ),
              selectedConflicts: state.selectedConflicts.filter(
                (id) => !result.resolvedConflicts.includes(id)
              ),
              resolutionInProgress: false,
            }));

            get().addNotification({
              type: 'RESOLUTION_APPLIED',
              severity: 'SUCCESS',
              title: 'Conflict Resolved',
              message: `Successfully resolved conflict using ${strategy.type} strategy`,
              projectId: currentProjectId,
            });

            return result;
          } catch (error: any) {
            set({ resolutionInProgress: false });
            get().addNotification({
              type: 'ERROR',
              severity: 'ERROR',
              title: 'Conflict Resolution Failed',
              message: error.message,
              projectId: currentProjectId,
            });
            throw error;
          }
        },

        resolveBulkConflicts: async (conflictIds: string[], strategy: any, options: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          set({ resolutionInProgress: true });

          try {
            const result = await conflictsApi.resolveBulkConflicts(
              currentProjectId,
              conflictIds,
              strategy,
              options,
              'current-user' // TODO: Get from auth store
            );

            // Remove resolved conflicts from state
            set((state) => ({
              detectedConflicts: state.detectedConflicts.filter(
                (c) => !result.resolvedConflicts.includes(c.id)
              ),
              selectedConflicts: [],
              resolutionInProgress: false,
            }));

            get().addNotification({
              type: 'RESOLUTION_APPLIED',
              severity: 'SUCCESS',
              title: 'Bulk Conflicts Resolved',
              message: `Successfully resolved ${result.resolvedConflicts.length} conflicts`,
              projectId: currentProjectId,
            });

            return result;
          } catch (error: any) {
            set({ resolutionInProgress: false });
            get().addNotification({
              type: 'ERROR',
              severity: 'ERROR',
              title: 'Bulk Resolution Failed',
              message: error.message,
              projectId: currentProjectId,
            });
            throw error;
          }
        },

        previewConflictResolution: async (conflictIds: string[], strategy: any, options: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          return conflictsApi.previewResolution(currentProjectId, conflictIds, strategy, options);
        },

        // UI actions
        setCalculationProgress: (progress: number) => {
          set({ calculationProgress: Math.max(0, Math.min(100, progress)) });
        },

        setConflictsPanelOpen: (open: boolean) => {
          set({ conflictsPanelOpen: open });
        },

        toggleConflictsPanel: () => {
          set((state) => ({ conflictsPanelOpen: !state.conflictsPanelOpen }));
        },

        selectConflicts: (conflictIds: string[]) => {
          set({ selectedConflicts: conflictIds });
        },

        toggleConflictSelection: (conflictId: string) => {
          set((state) => ({
            selectedConflicts: state.selectedConflicts.includes(conflictId)
              ? state.selectedConflicts.filter((id) => id !== conflictId)
              : [...state.selectedConflicts, conflictId],
          }));
        },

        clearConflictSelection: () => {
          set({ selectedConflicts: [] });
        },

        setPreviewMode: (enabled: boolean) => {
          set({ previewMode: enabled });
        },

        setAuditLogVisible: (visible: boolean) => {
          set({ auditLogVisible: visible });
        },

        // Notifications
        addNotification: (notification: Omit<SchedulingNotification, 'id' | 'timestamp'>) => {
          const newNotification: SchedulingNotification = {
            ...notification,
            id: `notification-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
          };

          set((state) => ({
            notifications: [newNotification, ...state.notifications],
            unreadNotifications: state.unreadNotifications + 1,
          }));
        },

        removeNotification: (notificationId: string) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== notificationId),
          }));
        },

        markNotificationRead: (notificationId: string) => {
          set((state) => {
            const notification = state.notifications.find((n) => n.id === notificationId);
            if (notification && state.unreadNotifications > 0) {
              return { unreadNotifications: state.unreadNotifications - 1 };
            }
            return state;
          });
        },

        markAllNotificationsRead: () => {
          set({ unreadNotifications: 0 });
        },

        clearNotifications: () => {
          set({ notifications: [], unreadNotifications: 0 });
        },

        // Preferences
        loadPreferences: async () => {
          const { currentProjectId } = get();
          if (!currentProjectId) return;

          try {
            const preferences = await schedulingApi.getSchedulingPreferences(currentProjectId);
            set({ preferences });
          } catch (error) {
            console.error('Failed to load preferences:', error);
          }
        },

        updatePreferences: async (updates: Partial<SchedulingPreferences>) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          try {
            const updatedPreferences = await schedulingApi.updateSchedulingPreferences(
              currentProjectId,
              updates
            );
            set({ preferences: updatedPreferences });
          } catch (error) {
            console.error('Failed to update preferences:', error);
            throw error;
          }
        },

        // Audit logs
        loadAuditLogs: async (query?: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) return;

          set({ auditLogsLoading: true });

          try {
            const { entries } = await auditLogsApi.getAuditLogs(currentProjectId, query);
            set({ auditLogs: entries, auditLogsLoading: false });
          } catch (error) {
            set({ auditLogsLoading: false });
            console.error('Failed to load audit logs:', error);
          }
        },

        searchAuditLogs: async (criteria: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) return;

          set({ auditLogsLoading: true });

          try {
            const { results } = await auditLogsApi.searchAuditLogs(currentProjectId, criteria);
            set({ auditLogs: results, auditLogsLoading: false });
          } catch (error) {
            set({ auditLogsLoading: false });
            console.error('Failed to search audit logs:', error);
          }
        },

        exportAuditLogs: async (options: any) => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          return auditLogsApi.exportAuditLogs(currentProjectId, options);
        },

        // Utilities
        reset: () => {
          set(initialState);
        },

        getCalculationStatus: async () => {
          const { currentProjectId, calculationId } = get();
          if (!currentProjectId || !calculationId) return null;

          return schedulingApi.getCalculationStatus(currentProjectId, calculationId);
        },

        validateSchedule: async () => {
          const { currentProjectId } = get();
          if (!currentProjectId) {
            throw new Error('No project selected');
          }

          return schedulingApi.validateSchedule(currentProjectId);
        },
      }),
      {
        name: 'scheduling-store',
        partialize: (state) => ({
          preferences: state.preferences,
          // Don't persist sensitive or temporary data
        }),
      }
    ),
    { name: 'scheduling-store' }
  )
);