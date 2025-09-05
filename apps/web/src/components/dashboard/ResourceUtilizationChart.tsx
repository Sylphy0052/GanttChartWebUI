'use client'

import React, { useMemo } from 'react'
import { UserIcon, ClockIcon } from '@heroicons/react/24/outline'

export interface ResourceData {
  id: string
  name: string
  role: string
  totalCapacity: number // hours per week
  allocatedHours: number
  utilizationRate: number // percentage
  assignedTasks: number
  overdueAssignments: number
  availability: 'available' | 'busy' | 'overallocated'
}

export interface ResourceUtilizationChartProps {
  projectId: string
  resources?: ResourceData[]
  loading?: boolean
  timeframe?: 'week' | 'month' | 'quarter'
  onResourceClick?: (resource: ResourceData) => void
  className?: string
}

export const ResourceUtilizationChart: React.FC<ResourceUtilizationChartProps> = ({
  projectId,
  resources = [],
  loading = false,
  timeframe = 'week',
  onResourceClick,
  className = ''
}) => {
  // Mock data for demonstration - in real implementation, this would come from props or API
  const mockResources: ResourceData[] = useMemo(() => [
    {
      id: '1',
      name: 'John Smith',
      role: 'Senior Developer',
      totalCapacity: 40,
      allocatedHours: 45,
      utilizationRate: 112,
      assignedTasks: 8,
      overdueAssignments: 1,
      availability: 'overallocated'
    },
    {
      id: '2', 
      name: 'Sarah Johnson',
      role: 'UX Designer',
      totalCapacity: 40,
      allocatedHours: 32,
      utilizationRate: 80,
      assignedTasks: 5,
      overdueAssignments: 0,
      availability: 'busy'
    },
    {
      id: '3',
      name: 'Mike Chen',
      role: 'Project Manager',
      totalCapacity: 40,
      allocatedHours: 24,
      utilizationRate: 60,
      assignedTasks: 12,
      overdueAssignments: 0,
      availability: 'available'
    },
    {
      id: '4',
      name: 'Lisa Wang',
      role: 'QA Engineer',
      totalCapacity: 40,
      allocatedHours: 36,
      utilizationRate: 90,
      assignedTasks: 6,
      overdueAssignments: 2,
      availability: 'busy'
    },
    {
      id: '5',
      name: 'David Brown',
      role: 'DevOps Engineer',
      totalCapacity: 40,
      allocatedHours: 16,
      utilizationRate: 40,
      assignedTasks: 3,
      overdueAssignments: 0,
      availability: 'available'
    }
  ], [])

  const displayResources = resources.length > 0 ? resources : mockResources

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalResources = displayResources.length
    const overallocated = displayResources.filter(r => r.availability === 'overallocated').length
    const available = displayResources.filter(r => r.availability === 'available').length
    const avgUtilization = displayResources.reduce((sum, r) => sum + r.utilizationRate, 0) / totalResources
    const totalOverdueAssignments = displayResources.reduce((sum, r) => sum + r.overdueAssignments, 0)

    return {
      totalResources,
      overallocated,
      available,
      avgUtilization: Math.round(avgUtilization),
      totalOverdueAssignments
    }
  }, [displayResources])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Resource Utilization
          </h3>
          <select 
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
            value={timeframe}
            onChange={(e) => {/* Handle timeframe change */}}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <SummaryCard
            label="Total Resources"
            value={summary.totalResources}
            color="blue"
          />
          <SummaryCard
            label="Avg Utilization"
            value={`${summary.avgUtilization}%`}
            color={summary.avgUtilization > 90 ? 'red' : summary.avgUtilization > 70 ? 'amber' : 'green'}
          />
          <SummaryCard
            label="Overallocated"
            value={summary.overallocated}
            color={summary.overallocated > 0 ? 'red' : 'green'}
          />
          <SummaryCard
            label="Available"
            value={summary.available}
            color="green"
          />
        </div>
      </div>

      {/* Resource List */}
      <div className="p-6">
        <div className="space-y-4">
          {displayResources.map((resource) => (
            <ResourceItem
              key={resource.id}
              resource={resource}
              onClick={() => onResourceClick?.(resource)}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-gray-200 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span>Available (0-70%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-amber-400 rounded"></div>
            <span>Busy (70-100%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span>Overallocated (100%+)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: string | number
  color: 'blue' | 'green' | 'amber' | 'red'
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50'
  }

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

interface ResourceItemProps {
  resource: ResourceData
  onClick?: () => void
}

const ResourceItem: React.FC<ResourceItemProps> = ({ resource, onClick }) => {
  const getAvailabilityColor = (availability: ResourceData['availability']) => {
    switch (availability) {
      case 'available':
        return 'bg-green-400'
      case 'busy':
        return 'bg-amber-400'
      case 'overallocated':
        return 'bg-red-400'
    }
  }

  const getUtilizationBarColor = (rate: number) => {
    if (rate >= 100) return 'bg-red-500'
    if (rate >= 80) return 'bg-amber-500'
    if (rate >= 60) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const cappedRate = Math.min(resource.utilizationRate, 120) // Cap display at 120%

  return (
    <div 
      className={`
        flex items-center space-x-4 p-4 rounded-lg border border-gray-200 
        ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
        ${resource.availability === 'overallocated' ? 'border-red-200 bg-red-50' : ''}
      `}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <UserIcon className="w-6 h-6 text-gray-600" />
        </div>
        <div 
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getAvailabilityColor(resource.availability)}`}
          title={resource.availability}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {resource.name}
            </h4>
            <p className="text-xs text-gray-600">{resource.role}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {resource.utilizationRate}%
            </p>
            <p className="text-xs text-gray-600">
              {resource.allocatedHours}h / {resource.totalCapacity}h
            </p>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getUtilizationBarColor(resource.utilizationRate)}`}
              style={{ width: `${(cappedRate / 120) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
          <div className="flex items-center space-x-3">
            <span>{resource.assignedTasks} tasks</span>
            {resource.overdueAssignments > 0 && (
              <span className="flex items-center space-x-1 text-red-600">
                <ClockIcon className="w-3 h-3" />
                <span>{resource.overdueAssignments} overdue</span>
              </span>
            )}
          </div>
          <span className="font-medium capitalize">
            {resource.availability}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ResourceUtilizationChart