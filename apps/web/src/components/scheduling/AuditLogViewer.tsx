'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useScheduling } from '@/hooks/useScheduling';
import { AuditLogEntry, AuditOperation } from '@/types/scheduling';
import { cn } from '@/lib/utils';
import {
  ClockIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  UserIcon,
  XMarkIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface AuditLogViewerProps {
  projectId: string;
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  compact?: boolean;
}

const OPERATION_LABELS: Record<AuditOperation, string> = {
  calculate: 'Schedule Calculation',
  apply: 'Schedule Applied',
  resolve: 'Conflict Resolution',
  bulk_resolve: 'Bulk Resolution',
  preview: 'Preview Generation',
  integrity_check: 'Integrity Check',
};

const OPERATION_COLORS: Record<AuditOperation, string> = {
  calculate: 'text-blue-600 bg-blue-100',
  apply: 'text-green-600 bg-green-100',
  resolve: 'text-amber-600 bg-amber-100',
  bulk_resolve: 'text-orange-600 bg-orange-100',
  preview: 'text-purple-600 bg-purple-100',
  integrity_check: 'text-gray-600 bg-gray-100',
};

const RESULT_COLORS = {
  SUCCESS: 'text-green-600 bg-green-100',
  FAILURE: 'text-red-600 bg-red-100',
  PARTIAL: 'text-amber-600 bg-amber-100',
};

export function AuditLogViewer({
  projectId,
  className,
  isOpen = true,
  onClose,
  compact = false,
}: AuditLogViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperation, setFilterOperation] = useState<AuditOperation | 'ALL'>('ALL');
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [filterUser, setFilterUser] = useState('');
  const [dateRange, setDateRange] = useState<{
    start?: Date;
    end?: Date;
  }>({});
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(false);

  const { auditLogsQuery } = useScheduling({
    projectId,
    onError: (error) => {
      console.error('Audit log error:', error);
    },
  });

  const auditLogs = auditLogsQuery.data?.entries || [];

  const filteredLogs = useMemo(() => {
    let filtered = auditLogs;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((log: AuditLogEntry) =>
        log.operation.toLowerCase().includes(term) ||
        log.userName.toLowerCase().includes(term) ||
        log.metadata?.algorithm?.toLowerCase().includes(term)
      );
    }

    // Operation filter
    if (filterOperation !== 'ALL') {
      filtered = filtered.filter((log: AuditLogEntry) => log.operation === filterOperation);
    }

    // Result filter
    if (filterResult !== 'ALL') {
      filtered = filtered.filter((log: AuditLogEntry) => log.result === filterResult);
    }

    // User filter
    if (filterUser) {
      filtered = filtered.filter((log: AuditLogEntry) => 
        log.userName.toLowerCase().includes(filterUser.toLowerCase())
      );
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter((log: AuditLogEntry) => new Date(log.timestamp) >= dateRange.start!);
    }
    if (dateRange.end) {
      filtered = filtered.filter((log: AuditLogEntry) => new Date(log.timestamp) <= dateRange.end!);
    }

    return filtered.sort((a: AuditLogEntry, b: AuditLogEntry) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [auditLogs, searchTerm, filterOperation, filterResult, filterUser, dateRange]);

  const performanceStats = useMemo(() => {
    if (!filteredLogs.length) return null;

    const calculations = filteredLogs.filter((log: AuditLogEntry) => log.operation === 'calculate');
    const avgCalcTime = calculations.length > 0
      ? calculations.reduce((sum: number, log: AuditLogEntry) => sum + (log.performanceData?.calculationTime || 0), 0) / calculations.length
      : 0;

    const successRate = filteredLogs.length > 0
      ? (filteredLogs.filter((log: AuditLogEntry) => log.result === 'SUCCESS').length / filteredLogs.length) * 100
      : 0;

    return {
      totalOperations: filteredLogs.length,
      averageCalculationTime: avgCalcTime,
      successRate,
      uniqueUsers: new Set(filteredLogs.map((log: AuditLogEntry) => log.userId)).size,
    };
  }, [filteredLogs]);

  const handleExport = useCallback(async () => {
    try {
      // This would call the audit logs API to export data
      const blob = await fetch(`/api/projects/${projectId}/audit-logs/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'CSV',
          includeMetadata: true,
          includePerformanceData: true,
        }),
      }).then(r => r.blob());

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${projectId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [projectId]);

  const LogEntry = ({ log }: { log: AuditLogEntry }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'px-2 py-1 text-xs font-medium rounded-full',
                OPERATION_COLORS[log.operation as AuditOperation]
              )}>
                {OPERATION_LABELS[log.operation as AuditOperation]}
              </span>
              
              <span className={cn(
                'px-2 py-1 text-xs font-medium rounded-full',
                RESULT_COLORS[log.result as keyof typeof RESULT_COLORS]
              )}>
                {log.result}
              </span>
              
              <span className="text-xs text-gray-500">
                {format(log.timestamp, 'PPpp')}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <UserIcon className="h-4 w-4" />
                <span>{log.userName}</span>
              </div>
              
              {log.performanceData?.calculationTime && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  <span>{log.performanceData.calculationTime}ms</span>
                </div>
              )}
              
              {log.metadata?.tasksAffected && (
                <span>{log.metadata.tasksAffected} tasks affected</span>
              )}
            </div>

            {isExpanded && (
              <div className="mt-3 p-3 bg-gray-100 rounded text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-700 mb-1">Metadata</h5>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-gray-700 mb-1">Performance</h5>
                    <div className="space-y-1">
                      <div>Calculation: {log.performanceData?.calculationTime}ms</div>
                      <div>Memory: {log.performanceData?.memoryUsage} bytes</div>
                      <div>API Response: {log.performanceData?.apiResponseTime}ms</div>
                      <div>DB Query: {log.performanceData?.databaseQueryTime}ms</div>
                    </div>
                  </div>
                </div>
                
                {log.changes.length > 0 && (
                  <div className="mt-3">
                    <h5 className="font-medium text-gray-700 mb-1">Changes ({log.changes.length})</h5>
                    <div className="max-h-32 overflow-auto">
                      {log.changes.slice(0, 10).map((change, idx) => (
                        <div key={idx} className="text-xs py-1 border-b border-gray-200 last:border-0">
                          <span className="font-medium">{change.action}</span> {change.entityType} ({change.entityId})
                          {change.field && (
                            <span className="text-gray-500"> - {change.field}</span>
                          )}
                        </div>
                      ))}
                      {log.changes.length > 10 && (
                        <div className="text-xs text-gray-500 py-1">
                          ... and {log.changes.length - 10} more changes
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 text-xs"
          >
            {isExpanded ? 'Less' : 'More'}
          </Button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  if (compact) {
    return (
      <div className={cn('bg-white rounded-lg border p-4', className)}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">Recent Activity</h4>
          <Button variant="ghost" size="sm" onClick={() => setShowPerformanceMetrics(!showPerformanceMetrics)}>
            <ChartBarIcon className="h-4 w-4" />
          </Button>
        </div>

        {showPerformanceMetrics && performanceStats && (
          <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{performanceStats.totalOperations}</div>
              <div className="text-xs text-gray-500">Operations</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{performanceStats.successRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Success Rate</div>
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredLogs.slice(0, 5).map((log: AuditLogEntry) => (
            <div key={log.id} className="flex items-center gap-2 text-sm">
              <span className={cn(
                'px-2 py-1 text-xs rounded',
                OPERATION_COLORS[log.operation as AuditOperation]
              )}>
                {OPERATION_LABELS[log.operation as AuditOperation]}
              </span>
              <span className="text-gray-500 text-xs">
                {format(log.timestamp, 'HH:mm')}
              </span>
              <span className={cn(
                'px-1 py-0.5 text-xs rounded',
                RESULT_COLORS[log.result as keyof typeof RESULT_COLORS]
              )}>
                {log.result}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-white rounded-lg border shadow-lg max-h-96 flex flex-col',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
          <p className="text-sm text-gray-500">
            {filteredLogs.length} entries ({auditLogs.length} total)
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPerformanceMetrics(!showPerformanceMetrics)}
          >
            <ChartBarIcon className="h-4 w-4 mr-1" />
            Metrics
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      {showPerformanceMetrics && performanceStats && (
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{performanceStats.totalOperations}</div>
              <div className="text-xs text-gray-500">Operations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{performanceStats.successRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{performanceStats.averageCalculationTime.toFixed(0)}ms</div>
              <div className="text-xs text-gray-500">Avg Calc Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{performanceStats.uniqueUsers}</div>
              <div className="text-xs text-gray-500">Users</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={filterOperation}
            onChange={(e) => setFilterOperation(e.target.value as AuditOperation | 'ALL')}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Operations</option>
            {Object.entries(OPERATION_LABELS).map(([op, label]) => (
              <option key={op} value={op}>{label}</option>
            ))}
          </select>
          
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
            <option value="PARTIAL">Partial</option>
          </select>
          
          <input
            type="text"
            placeholder="Filter by user..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-4">
        {auditLogsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <ClockIcon className="h-6 w-6 text-gray-400 animate-spin mr-2" />
            <span className="text-sm text-gray-500">Loading audit logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No Audit Logs</h3>
            <p className="text-xs text-gray-500">
              No operations matching your filters were found.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log: AuditLogEntry) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}