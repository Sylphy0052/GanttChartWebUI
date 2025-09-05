'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useScheduling } from '@/hooks/useScheduling';
import { DetectedConflict, ConflictType, ResolutionStrategy } from '@/types/scheduling';
import { cn } from '@/lib/utils';
import {
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  ListBulletIcon,
  FunnelIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface ConflictDetectionPanelProps {
  projectId: string;
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onConflictSelect?: (conflictIds: string[]) => void;
  onResolutionRequested?: (conflicts: DetectedConflict[], strategy: ResolutionStrategy) => void;
}

const SEVERITY_COLORS = {
  LOW: 'text-blue-600 bg-blue-100 border-blue-200',
  MEDIUM: 'text-amber-600 bg-amber-100 border-amber-200',
  HIGH: 'text-orange-600 bg-orange-100 border-orange-200',
  CRITICAL: 'text-red-600 bg-red-100 border-red-200',
};

const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  OPTIMISTIC_LOCKING: 'Optimistic Lock',
  SCHEDULING_CONFLICT: 'Schedule Conflict',
  RESOURCE_OVERALLOCATION: 'Resource Overallocation',
  CIRCULAR_DEPENDENCY: 'Circular Dependency',
  DATE_CONSTRAINT_VIOLATION: 'Date Constraint',
  DEPENDENCY_MISMATCH: 'Dependency Mismatch',
  DATA_INTEGRITY: 'Data Integrity',
};

export function ConflictDetectionPanel({
  projectId,
  className,
  isOpen = true,
  onClose,
  onConflictSelect,
  onResolutionRequested,
}: ConflictDetectionPanelProps) {
  const [selectedConflicts, setSelectedConflicts] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<ConflictType | 'ALL'>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'severity' | 'type' | 'date'>('severity');

  const {
    detectedConflicts,
    conflictsQuery,
    hasConflicts,
    criticalConflictsCount,
    resolveConflict,
    resolveBulkConflicts,
    // previewConflictResolution,
  } = useScheduling({
    projectId,
    onError: (error) => {
      console.error('Conflict panel error:', error);
    },
  });

  const filteredAndSortedConflicts = useMemo(() => {
    let filtered = detectedConflicts;

    // Filter by type
    if (filterType !== 'ALL') {
      filtered = filtered.filter(conflict => conflict.type === filterType);
    }

    // Filter by severity
    if (filterSeverity !== 'ALL') {
      filtered = filtered.filter(conflict => conflict.severity === filterSeverity);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        case 'type':
          return a.type.localeCompare(b.type);
        case 'date':
          return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [detectedConflicts, filterType, filterSeverity, sortBy]);

  const selectedConflictDetails = useMemo(() => {
    return detectedConflicts.filter(c => selectedConflicts.includes(c.id));
  }, [detectedConflicts, selectedConflicts]);

  const handleConflictSelect = useCallback((conflictId: string, selected: boolean) => {
    const newSelection = selected
      ? [...selectedConflicts, conflictId]
      : selectedConflicts.filter(id => id !== conflictId);
    
    setSelectedConflicts(newSelection);
    onConflictSelect?.(newSelection);
  }, [selectedConflicts, onConflictSelect]);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredAndSortedConflicts.map(c => c.id);
    setSelectedConflicts(allIds);
    onConflictSelect?.(allIds);
  }, [filteredAndSortedConflicts, onConflictSelect]);

  const handleClearSelection = useCallback(() => {
    setSelectedConflicts([]);
    onConflictSelect?.([]);
  }, [onConflictSelect]);

  const handleBulkResolve = useCallback(async (strategy: ResolutionStrategy) => {
    if (selectedConflicts.length === 0) return;

    try {
      await resolveBulkConflicts.mutateAsync({
        conflictIds: selectedConflicts,
        strategy,
        options: {
          validateAfterResolution: true,
          recalculateSchedule: true,
          notifyStakeholders: false,
          createBackup: true,
        },
      });
      
      setSelectedConflicts([]);
      onResolutionRequested?.(selectedConflictDetails, strategy);
    } catch (error) {
      console.error('Bulk resolution failed:', error);
    }
  }, [selectedConflicts, resolveBulkConflicts, selectedConflictDetails, onResolutionRequested]);

  const handleSingleResolve = useCallback(async (conflict: DetectedConflict, strategy: ResolutionStrategy) => {
    try {
      await resolveConflict.mutateAsync({
        conflictId: conflict.id,
        strategy,
        options: {
          validateAfterResolution: true,
          recalculateSchedule: true,
          notifyStakeholders: false,
          createBackup: true,
        },
      });
      
      onResolutionRequested?.([conflict], strategy);
    } catch (error) {
      console.error('Resolution failed:', error);
    }
  }, [resolveConflict, onResolutionRequested]);

  const ConflictItem = ({ conflict }: { conflict: DetectedConflict }) => {
    const isSelected = selectedConflicts.includes(conflict.id);
    
    return (
      <div className={cn(
        'p-4 border rounded-lg transition-all duration-200',
        isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      )}>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleConflictSelect(conflict.id, e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'px-2 py-1 text-xs font-medium rounded-full border',
                SEVERITY_COLORS[conflict.severity]
              )}>
                {conflict.severity}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {CONFLICT_TYPE_LABELS[conflict.type]}
              </span>
            </div>
            
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              {conflict.description}
            </h4>
            
            <div className="text-xs text-gray-500 space-y-1">
              <div>Entity: {conflict.entityType} ({conflict.entityId})</div>
              {conflict.conflictingEntityId && (
                <div>Conflicts with: {conflict.conflictingEntityId}</div>
              )}
              <div>Detected: {format(conflict.detectedAt, 'PPpp')}</div>
            </div>

            {conflict.suggestedResolution.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Suggested:</span>
                {conflict.suggestedResolution.slice(0, 2).map((resolution, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSingleResolve(conflict, {
                      type: resolution.strategy as any,
                      bulkApply: false,
                      preserveUserChanges: true,
                    })}
                    disabled={resolveConflict.isPending}
                    className="text-xs h-6 px-2"
                  >
                    {resolution.strategy}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      'bg-white rounded-lg border shadow-lg',
      'max-h-96 flex flex-col',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Conflicts Detected ({detectedConflicts.length})
            </h3>
            {criticalConflictsCount > 0 && (
              <p className="text-xs text-red-600">
                {criticalConflictsCount} critical conflicts require immediate attention
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => conflictsQuery.refetch()}
            loading={conflictsQuery.isRefetching}
          >
            <ArrowPathIcon className="h-4 w-4" />
          </Button>
          
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ConflictType | 'ALL')}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="ALL">All Types</option>
              {Object.entries(CONFLICT_TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'severity' | 'type' | 'date')}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="severity">Sort by Severity</option>
            <option value="type">Sort by Type</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={filteredAndSortedConflicts.length === 0}
            >
              <ListBulletIcon className="h-4 w-4 mr-1" />
              Select All ({filteredAndSortedConflicts.length})
            </Button>
            
            {selectedConflicts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
              >
                Clear ({selectedConflicts.length})
              </Button>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedConflicts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Resolve:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkResolve({ type: 'CURRENT', bulkApply: true, preserveUserChanges: false })}
                loading={resolveBulkConflicts.isPending}
              >
                Keep Current
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkResolve({ type: 'INCOMING', bulkApply: true, preserveUserChanges: false })}
                loading={resolveBulkConflicts.isPending}
              >
                Accept Incoming
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Conflicts List */}
      <div className="flex-1 overflow-y-auto p-4">
        {conflictsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <ClockIcon className="h-6 w-6 text-gray-400 animate-spin mr-2" />
            <span className="text-sm text-gray-500">Loading conflicts...</span>
          </div>
        ) : filteredAndSortedConflicts.length === 0 ? (
          <div className="text-center py-8">
            <CheckIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No Conflicts</h3>
            <p className="text-xs text-gray-500">
              {detectedConflicts.length === 0 
                ? 'All clear! No conflicts detected.'
                : 'All conflicts matching your filters have been resolved.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedConflicts.map((conflict) => (
              <ConflictItem key={conflict.id} conflict={conflict} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasConflicts && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {selectedConflicts.length > 0 
                ? `${selectedConflicts.length} conflicts selected`
                : `${filteredAndSortedConflicts.length} conflicts shown`
              }
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // This would open a detailed resolution dialog
                }}
                disabled={selectedConflicts.length === 0}
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                Preview Resolution
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkResolve({ type: 'MERGE', bulkApply: true, preserveUserChanges: true })}
                disabled={selectedConflicts.length === 0}
                loading={resolveBulkConflicts.isPending}
              >
                Smart Resolve ({selectedConflicts.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}