'use client'

import React, { useMemo, useState } from 'react'
import { 
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  ClockIcon,
  CalendarDaysIcon,
  BoltIcon
} from '@heroicons/react/24/outline'

export interface PerformanceDataPoint {
  date: string
  completedTasks: number
  plannedTasks: number
  velocity: number
  burndownActual: number
  burndownIdeal: number
  cumulativeFlow: {
    todo: number
    inProgress: number
    done: number
  }
}

export interface PerformanceMetric {
  name: string
  current: number
  previous: number
  target?: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  status: 'good' | 'warning' | 'critical'
}

export interface PerformanceAnalyticsProps {
  projectId: string
  data?: PerformanceDataPoint[]
  metrics?: PerformanceMetric[]
  loading?: boolean
  timeRange?: 'week' | 'month' | 'quarter'
  onTimeRangeChange?: (range: 'week' | 'month' | 'quarter') => void
  className?: string
}

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  projectId,
  data = [],
  metrics = [],
  loading = false,
  timeRange = 'month',
  onTimeRangeChange,
  className = ''
}) => {
  const [activeChart, setActiveChart] = useState<'burndown' | 'velocity' | 'cumulative'>('burndown')

  // Mock data for demonstration
  const mockData: PerformanceDataPoint[] = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      
      return {
        date: date.toISOString().split('T')[0],
        completedTasks: Math.floor(Math.random() * 8) + 2,
        plannedTasks: Math.floor(Math.random() * 10) + 5,
        velocity: Math.floor(Math.random() * 15) + 10,
        burndownActual: 100 - (i * 3) - Math.random() * 10,
        burndownIdeal: 100 - (i * 3.33),
        cumulativeFlow: {
          todo: Math.max(0, 50 - i * 1.5 + Math.random() * 5),
          inProgress: Math.min(20, i * 0.5 + Math.random() * 3),
          done: i * 1.8 + Math.random() * 2
        }
      }
    }), []
  )

  const mockMetrics: PerformanceMetric[] = useMemo(() => [
    {
      name: 'Velocity',
      current: 24,
      previous: 19,
      target: 25,
      unit: 'story points',
      trend: 'up',
      status: 'good'
    },
    {
      name: 'Cycle Time',
      current: 3.2,
      previous: 4.1,
      target: 3.0,
      unit: 'days',
      trend: 'down',
      status: 'good'
    },
    {
      name: 'Lead Time',
      current: 8.5,
      previous: 7.2,
      target: 7.0,
      unit: 'days',
      trend: 'up',
      status: 'warning'
    },
    {
      name: 'Throughput',
      current: 12,
      previous: 15,
      target: 15,
      unit: 'tasks/week',
      trend: 'down',
      status: 'warning'
    },
    {
      name: 'Defect Rate',
      current: 2.1,
      previous: 1.8,
      target: 2.0,
      unit: '%',
      trend: 'up',
      status: 'critical'
    },
    {
      name: 'Sprint Completion',
      current: 87,
      previous: 92,
      target: 90,
      unit: '%',
      trend: 'down',
      status: 'warning'
    }
  ], [])

  const displayData = data.length > 0 ? data : mockData
  const displayMetrics = metrics.length > 0 ? metrics : mockMetrics

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Performance Analytics
        </h3>
        
        <div className="flex items-center space-x-3">
          {/* Chart Type Selector */}
          <select
            value={activeChart}
            onChange={(e) => setActiveChart(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="burndown">Burndown Chart</option>
            <option value="velocity">Velocity Trend</option>
            <option value="cumulative">Cumulative Flow</option>
          </select>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange?.(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {displayMetrics.map((metric) => (
          <PerformanceMetricCard key={metric.name} metric={metric} />
        ))}
      </div>

      {/* Charts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeChart === 'burndown' && <BurndownChart data={displayData} />}
        {activeChart === 'velocity' && <VelocityChart data={displayData} />}
        {activeChart === 'cumulative' && <CumulativeFlowChart data={displayData} />}
      </div>

      {/* Insights Panel */}
      <InsightsPanel metrics={displayMetrics} data={displayData} />
    </div>
  )
}

interface PerformanceMetricCardProps {
  metric: PerformanceMetric
}

const PerformanceMetricCard: React.FC<PerformanceMetricCardProps> = ({ metric }) => {
  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200'
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200'  
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  const getTrendIcon = (trend: PerformanceMetric['trend']) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="w-4 h-4" />
      case 'down':
        return <ArrowTrendingDownIcon className="w-4 h-4" />
      case 'stable':
        return <div className="w-4 h-4 border-b-2 border-gray-400" />
    }
  }

  const change = ((metric.current - metric.previous) / metric.previous * 100)
  const changeDisplay = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor(metric.status)}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">{metric.name}</h4>
        <div className="flex items-center space-x-1">
          {getTrendIcon(metric.trend)}
          <span className="text-xs font-medium">{changeDisplay}</span>
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-2xl font-bold">
          {metric.current} <span className="text-sm font-normal">{metric.unit}</span>
        </p>
        
        <div className="flex items-center justify-between text-xs">
          <span>Previous: {metric.previous} {metric.unit}</span>
          {metric.target && (
            <span>Target: {metric.target} {metric.unit}</span>
          )}
        </div>
      </div>
    </div>
  )
}

const BurndownChart: React.FC<{ data: PerformanceDataPoint[] }> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => Math.max(d.burndownActual, d.burndownIdeal)))
  
  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Burndown Chart</h4>
      
      <div className="relative h-64">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={200 - (y / maxValue * 200)}
              x2="400"
              y2={200 - (y / maxValue * 200)}
              stroke="#f3f4f6"
              strokeWidth="1"
            />
          ))}
          
          {/* Ideal line */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4,4"
            points={data.map((d, i) => 
              `${(i / (data.length - 1)) * 400},${200 - (d.burndownIdeal / maxValue * 200)}`
            ).join(' ')}
          />
          
          {/* Actual line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            points={data.map((d, i) => 
              `${(i / (data.length - 1)) * 400},${200 - (d.burndownActual / maxValue * 200)}`
            ).join(' ')}
          />
        </svg>
        
        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded border shadow-sm">
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0 border-t-2 border-dashed border-green-500"></div>
              <span>Ideal</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0 border-t-2 border-blue-500"></div>
              <span>Actual</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const VelocityChart: React.FC<{ data: PerformanceDataPoint[] }> = ({ data }) => {
  const maxVelocity = Math.max(...data.map(d => d.velocity))
  
  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Velocity Trend</h4>
      
      <div className="relative h-64">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          {/* Bars */}
          {data.slice(-12).map((d, i) => (
            <rect
              key={i}
              x={i * 30 + 10}
              y={200 - (d.velocity / maxVelocity * 180)}
              width="20"
              height={d.velocity / maxVelocity * 180}
              fill="#3b82f6"
              className="hover:fill-blue-700 transition-colors"
            />
          ))}
          
          {/* Average line */}
          {(() => {
            const avg = data.reduce((sum, d) => sum + d.velocity, 0) / data.length
            return (
              <line
                x1="0"
                y1={200 - (avg / maxVelocity * 180)}
                x2="400"
                y2={200 - (avg / maxVelocity * 180)}
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
            )
          })()}
        </svg>
        
        <div className="absolute top-4 right-4 bg-white p-2 rounded border shadow-sm">
          <div className="flex items-center space-x-2 text-xs">
            <div className="w-3 h-0 border-t-2 border-dashed border-red-500"></div>
            <span>Average</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const CumulativeFlowChart: React.FC<{ data: PerformanceDataPoint[] }> = ({ data }) => {
  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Cumulative Flow Diagram</h4>
      
      <div className="relative h-64">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          {/* Todo area */}
          <path
            d={`M 0,200 ${data.map((d, i) => 
              `L ${(i / (data.length - 1)) * 400},${200 - d.cumulativeFlow.todo}`
            ).join(' ')} L 400,200 Z`}
            fill="#fbbf24"
            fillOpacity={0.7}
          />
          
          {/* In Progress area */}
          <path
            d={`M 0,200 ${data.map((d, i) => 
              `L ${(i / (data.length - 1)) * 400},${200 - d.cumulativeFlow.todo - d.cumulativeFlow.inProgress}`
            ).join(' ')} ${data.map((d, i) => 
              `L ${400 - (i / (data.length - 1)) * 400},${200 - d.cumulativeFlow.todo}`
            ).reverse().join(' ')} Z`}
            fill="#3b82f6"
            fillOpacity={0.7}
          />
          
          {/* Done area */}
          <path
            d={`M 0,200 ${data.map((d, i) => 
              `L ${(i / (data.length - 1)) * 400},${200 - d.cumulativeFlow.todo - d.cumulativeFlow.inProgress - d.cumulativeFlow.done}`
            ).join(' ')} ${data.map((d, i) => 
              `L ${400 - (i / (data.length - 1)) * 400},${200 - d.cumulativeFlow.todo - d.cumulativeFlow.inProgress}`
            ).reverse().join(' ')} Z`}
            fill="#10b981"
            fillOpacity={0.7}
          />
        </svg>
        
        <div className="absolute top-4 right-4 bg-white p-2 rounded border shadow-sm">
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Done</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>In Progress</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Todo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const InsightsPanel: React.FC<{ 
  metrics: PerformanceMetric[]
  data: PerformanceDataPoint[]
}> = ({ metrics, data }) => {
  const insights = useMemo(() => {
    const insights: Array<{
      type: 'good' | 'warning' | 'critical'
      icon: React.ComponentType<{ className?: string }>
      message: string
    }> = []
    
    // Velocity insight
    const velocityMetric = metrics.find(m => m.name === 'Velocity')
    if (velocityMetric && velocityMetric.trend === 'up') {
      insights.push({
        type: 'good',
        icon: BoltIcon,
        message: `Team velocity increased by ${((velocityMetric.current - velocityMetric.previous) / velocityMetric.previous * 100).toFixed(1)}% this period`
      })
    }
    
    // Defect rate insight
    const defectMetric = metrics.find(m => m.name === 'Defect Rate')
    if (defectMetric && defectMetric.status === 'critical') {
      insights.push({
        type: 'critical',
        icon: ChartBarIcon,
        message: 'Defect rate is above target - consider increasing testing efforts'
      })
    }
    
    return insights
  }, [metrics])
  
  if (insights.length === 0) return null
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h4>
      
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 p-3 rounded-lg ${
              insight.type === 'good' ? 'bg-green-50 border border-green-200' :
              insight.type === 'warning' ? 'bg-amber-50 border border-amber-200' :
              'bg-red-50 border border-red-200'
            }`}
          >
            <insight.icon className={`w-5 h-5 flex-shrink-0 ${
              insight.type === 'good' ? 'text-green-600' :
              insight.type === 'warning' ? 'text-amber-600' :
              'text-red-600'
            }`} />
            <p className="text-sm text-gray-700">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PerformanceAnalytics