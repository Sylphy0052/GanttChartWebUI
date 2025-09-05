'use client'

import React, { useState } from 'react'
import { 
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'
import { ResourceUtilizationChart } from './ResourceUtilizationChart'
import { PerformanceAnalytics } from './PerformanceAnalytics'

export interface ProjectMetrics {
  projectId: string
  projectName: string
  lastUpdated: number
  
  // Schedule metrics
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  upcomingTasks: number
  
  // Time metrics
  plannedDuration: number // in days
  actualDuration: number // in days
  remainingDuration: number // in days
  scheduleVariance: number // percentage
  
  // Resource metrics
  totalResources: number
  activeResources: number
  utilizationRate: number // percentage
  
  // Quality metrics
  conflictsCount: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  
  // Progress metrics
  completionPercentage: number
  velocityTrend: 'up' | 'down' | 'stable'
  
  // Financial metrics (optional)
  budgetUsed?: number
  budgetRemaining?: number
  costVariance?: number
}

export interface ProjectMetricsDashboardProps {
  projectId: string
  metrics?: ProjectMetrics
  loading?: boolean
  error?: string
  onRefresh?: () => void
  className?: string
}

export const ProjectMetricsDashboard: React.FC<ProjectMetricsDashboardProps> = ({
  projectId,
  metrics,
  loading = false,
  error,
  onRefresh,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'performance'>('overview')

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 p-6 ${className}`}>
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load metrics</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <ChartBarIcon className="w-12 h-12 mx-auto mb-3" />
          <p>No metrics data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Project Metrics
            </h2>
            <p className="text-sm text-gray-600">
              {metrics.projectName} • Last updated {formatTimestamp(metrics.lastUpdated)}
            </p>
          </div>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'overview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'resources'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Resources
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'performance'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Performance
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab metrics={metrics} />}
        {activeTab === 'resources' && <ResourcesTab metrics={metrics} />}
        {activeTab === 'performance' && <PerformanceTab metrics={metrics} />}
      </div>
    </div>
  )
}

// Overview Tab Component
const OverviewTab: React.FC<{ metrics: ProjectMetrics }> = ({ metrics }) => (
  <div className="space-y-6">
    {/* Key Metrics Grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        title="Total Tasks"
        value={metrics.totalTasks}
        icon={CalendarDaysIcon}
        color="blue"
      />
      <MetricCard
        title="Completed"
        value={metrics.completedTasks}
        subtitle={`${Math.round((metrics.completedTasks / metrics.totalTasks) * 100)}%`}
        icon={CheckCircleIcon}
        color="green"
      />
      <MetricCard
        title="Overdue"
        value={metrics.overdueTasks}
        icon={ExclamationTriangleIcon}
        color="red"
      />
      <MetricCard
        title="Remaining Days"
        value={metrics.remainingDuration}
        subtitle={`${metrics.plannedDuration} planned`}
        icon={ClockIcon}
        color="gray"
      />
    </div>

    {/* Progress Section */}
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h3>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Completion</span>
          <span>{metrics.completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${metrics.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Schedule Variance */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Schedule Variance</span>
        <div className="flex items-center space-x-1">
          {metrics.scheduleVariance > 0 ? (
            <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
          ) : metrics.scheduleVariance < 0 ? (
            <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
          ) : null}
          <span className={
            metrics.scheduleVariance > 0 ? 'text-red-600' :
            metrics.scheduleVariance < 0 ? 'text-green-600' :
            'text-gray-600'
          }>
            {metrics.scheduleVariance > 0 ? '+' : ''}{metrics.scheduleVariance}%
          </span>
        </div>
      </div>
    </div>

    {/* Risk Assessment */}
    <RiskAssessment metrics={metrics} />
  </div>
)

// Resources Tab Component  
const ResourcesTab: React.FC<{ metrics: ProjectMetrics }> = ({ metrics }) => (
  <div className="space-y-6">
    {/* Resource Metrics */}
    <div className="grid grid-cols-3 gap-4">
      <MetricCard
        title="Total Resources"
        value={metrics.totalResources}
        icon={UserGroupIcon}
        color="blue"
      />
      <MetricCard
        title="Active Resources"
        value={metrics.activeResources}
        subtitle={`${Math.round((metrics.activeResources / metrics.totalResources) * 100)}% active`}
        icon={UserGroupIcon}
        color="green"
      />
      <MetricCard
        title="Utilization Rate"
        value={`${metrics.utilizationRate}%`}
        icon={ChartBarIcon}
        color={metrics.utilizationRate > 80 ? 'red' : metrics.utilizationRate > 60 ? 'amber' : 'green'}
      />
    </div>

    {/* Resource Utilization Chart */}
    <ResourceUtilizationChart projectId={metrics.projectId} />
  </div>
)

// Performance Tab Component
const PerformanceTab: React.FC<{ metrics: ProjectMetrics }> = ({ metrics }) => (
  <div className="space-y-6">
    <PerformanceAnalytics projectId={metrics.projectId} />
  </div>
)

// Metric Card Component
interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'red' | 'amber' | 'gray'
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color 
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    gray: 'bg-gray-50 text-gray-600'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

// Risk Assessment Component
const RiskAssessment: React.FC<{ metrics: ProjectMetrics }> = ({ metrics }) => {
  const getRiskConfig = (level: ProjectMetrics['riskLevel']) => {
    switch (level) {
      case 'low':
        return { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Low Risk' }
      case 'medium':
        return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium Risk' }
      case 'high':
        return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'High Risk' }
      case 'critical':
        return { color: 'text-red-800', bg: 'bg-red-100', border: 'border-red-300', label: 'Critical Risk' }
    }
  }

  const config = getRiskConfig(metrics.riskLevel)

  return (
    <div className={`rounded-lg border p-4 ${config.bg} ${config.border}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Risk Assessment</h3>
      
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-lg font-semibold ${config.color}`}>
            {config.label}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {metrics.conflictsCount} active conflicts detected
          </p>
        </div>
        
        <ExclamationTriangleIcon className={`w-8 h-8 ${config.color}`} />
      </div>
      
      {metrics.conflictsCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-700">
            Immediate attention required for conflict resolution to prevent project delays.
          </p>
        </div>
      )}
    </div>
  )
}

// Utility function
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return date.toLocaleDateString()
}

export default ProjectMetricsDashboard