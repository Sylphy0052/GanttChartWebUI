'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useScheduling } from '@/hooks/useScheduling';
import { SchedulingOptions, WorkingHoursConfig } from '@/types/scheduling';
import { cn } from '@/lib/utils';
import { 
  PlayIcon, 
  EyeIcon, 
  CheckIcon, 
  XMarkIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface ScheduleCalculatorProps {
  projectId: string;
  className?: string;
  onCalculationComplete?: (result: any) => void;
  onPreviewComplete?: (result: any) => void;
  compact?: boolean;
}

export function ScheduleCalculator({
  projectId,
  className,
  onCalculationComplete,
  onPreviewComplete,
  compact = false,
}: ScheduleCalculatorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [calculationOptions, setCalculationOptions] = useState<Partial<SchedulingOptions>>({
    algorithm: 'CPM',
    bufferPercentage: 10,
    resourceConstraints: true,
    maxIterations: 100,
  });

  const {
    currentSchedule,
    isCalculating,
    calculationProgress,
    hasConflicts,
    criticalConflictsCount,
    isReadyToApply,
    calculationStatus,
    calculateSchedule,
    previewSchedule,
    applySchedule,
  } = useScheduling({
    projectId,
    onCalculationComplete,
    onError: (error) => {
      console.error('Scheduling error:', error);
    },
  });

  const handleCalculate = useCallback(async () => {
    setIsPreviewMode(false);
    try {
      await calculateSchedule.mutateAsync(calculationOptions);
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  }, [calculateSchedule, calculationOptions]);

  const handlePreview = useCallback(async () => {
    setIsPreviewMode(true);
    try {
      const result = await previewSchedule.mutateAsync(calculationOptions);
      if (onPreviewComplete) {
        onPreviewComplete(result);
      }
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setIsPreviewMode(false);
    }
  }, [previewSchedule, calculationOptions, onPreviewComplete]);

  const handleApply = useCallback(async () => {
    if (!currentSchedule?.etag) return;
    
    try {
      await applySchedule.mutateAsync({
        scheduleId: currentSchedule.projectId, // This would be the schedule ID
        etag: currentSchedule.etag,
      });
    } catch (error) {
      console.error('Apply failed:', error);
    }
  }, [applySchedule, currentSchedule]);

  const updateWorkingHours = useCallback((updates: Partial<WorkingHoursConfig>) => {
    setCalculationOptions(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        ...updates,
      } as WorkingHoursConfig,
    }));
  }, []);

  // Status indicator component
  const StatusIndicator = () => {
    const statusConfig = {
      idle: { 
        icon: InformationCircleIcon, 
        color: 'text-gray-500', 
        bgColor: 'bg-gray-100',
        message: 'Ready to calculate schedule' 
      },
      calculating: { 
        icon: ClockIcon, 
        color: 'text-blue-600', 
        bgColor: 'bg-blue-100',
        message: `Calculating... ${calculationProgress}%` 
      },
      completed: { 
        icon: CheckIcon, 
        color: 'text-green-600', 
        bgColor: 'bg-green-100',
        message: 'Schedule calculated successfully' 
      },
      error: { 
        icon: ExclamationTriangleIcon, 
        color: 'text-red-600', 
        bgColor: 'bg-red-100',
        message: 'Calculation failed' 
      },
    };

    const config = statusConfig[calculationStatus];
    const Icon = config.icon;

    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-md', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} />
        <span className={cn('text-sm font-medium', config.color)}>
          {config.message}
        </span>
      </div>
    );
  };

  // Progress bar component
  const ProgressBar = () => {
    if (!isCalculating || calculationProgress === 0) return null;

    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${calculationProgress}%` }}
        />
      </div>
    );
  };

  // Schedule metrics display
  const ScheduleMetrics = () => {
    if (!currentSchedule) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {currentSchedule.tasks.length}
          </div>
          <div className="text-sm text-gray-500">Tasks</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {currentSchedule.metrics?.criticalTasks || 0}
          </div>
          <div className="text-sm text-gray-500">Critical</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">
            {Math.round((currentSchedule.metrics?.totalProjectDuration || 0) / 24)} days
          </div>
          <div className="text-sm text-gray-500">Duration</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {currentSchedule.metrics?.performanceMetrics?.calculationTime}ms
          </div>
          <div className="text-sm text-gray-500">Calc Time</div>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCalculate}
          loading={isCalculating}
          disabled={isCalculating}
        >
          <PlayIcon className="h-4 w-4 mr-1" />
          Calculate
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          loading={previewSchedule.isPending}
          disabled={isCalculating || previewSchedule.isPending}
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          Preview
        </Button>

        {currentSchedule && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleApply}
            loading={applySchedule.isPending}
            disabled={!isReadyToApply || applySchedule.isPending}
          >
            <CheckIcon className="h-4 w-4 mr-1" />
            Apply
          </Button>
        )}

        {hasConflicts && (
          <div className="flex items-center text-amber-600">
            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
            <span className="text-sm">
              {criticalConflictsCount > 0 ? `${criticalConflictsCount} Critical` : 'Conflicts'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 p-6 bg-white rounded-lg border shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Schedule Calculator</h3>
          <p className="text-sm text-gray-500">
            Calculate and apply project schedules using Critical Path Method
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        >
          <ChartBarIcon className="h-4 w-4 mr-2" />
          Options
        </Button>
      </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Algorithm
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={calculationOptions.algorithm}
              onChange={(e) => setCalculationOptions(prev => ({
                ...prev,
                algorithm: e.target.value as 'CPM' | 'PERT' | 'CRITICAL_CHAIN'
              }))}
            >
              <option value="CPM">Critical Path Method (CPM)</option>
              <option value="PERT">PERT</option>
              <option value="CRITICAL_CHAIN">Critical Chain</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buffer Percentage
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="5"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={calculationOptions.bufferPercentage}
              onChange={(e) => setCalculationOptions(prev => ({
                ...prev,
                bufferPercentage: parseInt(e.target.value)
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Working Hours Per Day
            </label>
            <input
              type="number"
              min="1"
              max="24"
              step="1"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={calculationOptions.workingHours?.hoursPerDay || 8}
              onChange={(e) => updateWorkingHours({
                hoursPerDay: parseInt(e.target.value)
              })}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="resource-constraints"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={calculationOptions.resourceConstraints}
              onChange={(e) => setCalculationOptions(prev => ({
                ...prev,
                resourceConstraints: e.target.checked
              }))}
            />
            <label htmlFor="resource-constraints" className="ml-2 text-sm text-gray-700">
              Consider resource constraints
            </label>
          </div>
        </div>
      )}

      {/* Status and Progress */}
      <div className="space-y-3">
        <StatusIndicator />
        <ProgressBar />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={handleCalculate}
          loading={isCalculating}
          disabled={isCalculating}
          className="flex-1"
        >
          <PlayIcon className="h-4 w-4 mr-2" />
          Calculate Schedule
        </Button>

        <Button
          variant="outline"
          onClick={handlePreview}
          loading={previewSchedule.isPending}
          disabled={isCalculating || previewSchedule.isPending}
        >
          <EyeIcon className="h-4 w-4 mr-2" />
          Preview
        </Button>

        {currentSchedule && (
          <Button
            variant="secondary"
            onClick={handleApply}
            loading={applySchedule.isPending}
            disabled={!isReadyToApply || applySchedule.isPending}
          >
            <CheckIcon className="h-4 w-4 mr-2" />
            Apply Schedule
          </Button>
        )}
      </div>

      {/* Conflicts Warning */}
      {hasConflicts && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-amber-800">
              {criticalConflictsCount > 0 
                ? `${criticalConflictsCount} Critical Conflicts Detected`
                : `${hasConflicts} Conflicts Detected`
              }
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              {criticalConflictsCount > 0 
                ? 'Critical conflicts must be resolved before applying the schedule.'
                : 'Review and resolve conflicts for optimal results.'
              }
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // This would open the conflicts panel
              // Implementation would depend on parent component
            }}
          >
            View Conflicts
          </Button>
        </div>
      )}

      {/* Schedule Metrics */}
      <ScheduleMetrics />

      {/* Last Updated */}
      {currentSchedule && (
        <div className="text-xs text-gray-500 text-center">
          Last calculated: {format(currentSchedule.calculatedAt, 'PPpp')}
        </div>
      )}
    </div>
  );
}