/**
 * Performance Dashboard Component
 * 
 * Implements T016 AC7: Performance dashboard components display real-time metrics and historical trends
 * 
 * Features:
 * - Real-time performance metrics display
 * - Historical trend visualization
 * - Memory usage monitoring and leak detection
 * - User interaction analytics with optimization opportunities
 * - Component-level performance breakdown
 * - Alerts and recommendations
 * - Telemetry data batching status
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAdvancedTelemetry, useMemoryMonitoring, useInteractionTracking } from '@/hooks/useAdvancedTelemetry'
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics'
import { ganttPerformanceMonitor } from '@/lib/performance'
import { advancedTelemetry } from '@/lib/advanced-telemetry'

interface PerformanceDashboardProps {
  /** Whether to show the dashboard in compact mode */
  compact?: boolean
  /** Refresh interval in milliseconds */
  refreshInterval?: number
  /** Whether to show historical trends */
  showTrends?: boolean
  /** Whether to show component breakdown */
  showComponents?: boolean
  /** Whether to enable real-time updates */
  realTimeUpdates?: boolean
  /** Project ID for filtering metrics */
  projectId?: string
}

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  status: 'good' | 'warning' | 'error'
  trend?: number
  description?: string
  onClick?: () => void
}

interface TrendData {
  timestamp: number
  value: number
}

interface ComponentPerformance {
  componentName: string
  renderTime: number
  rerenderCount: number
  memoryUsage: number
  score: number
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  status, 
  trend, 
  description,
  onClick 
}) => {
  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200'
  }

  const trendIcon = trend ? (
    trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️'
  ) : null

  return (
    <div 
      className={`p-4 rounded-lg border-2 ${statusColors[status]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''} transition-all`}
      onClick={onClick}
      title={description}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium opacity-75">{title}</h3>
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold">{value}</span>
            {unit && <span className="text-sm opacity-60">{unit}</span>}
          </div>
        </div>
        {trendIcon && (
          <div className="flex items-center space-x-1">
            <span className="text-lg">{trendIcon}</span>
            <span className="text-xs font-mono">
              {trend > 0 ? '+' : ''}{Math.round(trend)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const TrendChart: React.FC<{ data: TrendData[], title: string, color: string }> = ({ 
  data, 
  title, 
  color 
}) => {
  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue || 1

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 300,
    y: 100 - ((d.value - minValue) / range) * 80
  }))

  const pathData = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ')

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <div className="h-24">
        <svg width="300" height="100" className="w-full h-full">
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={2}
            className="drop-shadow-sm"
          />
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={2}
              fill={color}
              className="drop-shadow-sm"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

const ComponentBreakdown: React.FC<{ components: ComponentPerformance[] }> = ({ 
  components 
}) => {
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4">Component Performance</h3>
      <div className="space-y-3">
        {components.map((component, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <span className="font-medium">{component.componentName}</span>
              <div className="text-sm text-gray-500">
                {component.rerenderCount} renders • {component.memoryUsage}MB
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono">{component.renderTime}ms</span>
              <div className={`w-12 h-2 rounded-full ${
                component.score > 80 ? 'bg-green-400' : 
                component.score > 60 ? 'bg-yellow-400' : 'bg-red-400'
              }`}>
                <div 
                  className="h-full rounded-full bg-white"
                  style={{ width: `${100 - component.score}%` }}
                />
              </div>
              <span className="text-sm font-medium">{component.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const AlertsPanel: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  if (alerts.length === 0) return null

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4 text-red-600">Performance Alerts</h3>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div key={index} className={`p-3 rounded border-l-4 ${
            alert.severity === 'high' ? 'bg-red-50 border-red-400' : 
            alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-400' : 
            'bg-blue-50 border-blue-400'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium">{alert.title}</h4>
                <p className="text-sm opacity-75 mt-1">{alert.description}</p>
              </div>
              <span className="text-xs bg-white px-2 py-1 rounded font-mono">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  compact = false,
  refreshInterval = 5000,
  showTrends = true,
  showComponents = true,
  realTimeUpdates = true,
  projectId
}) => {
  // State for metrics and trends
  const [performanceTrends, setPerformanceTrends] = useState<TrendData[]>([])
  const [memoryTrends, setMemoryTrends] = useState<TrendData[]>([])
  const [interactionTrends, setInteractionTrends] = useState<TrendData[]>([])
  const [componentMetrics, setComponentMetrics] = useState<ComponentPerformance[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [telemetryStatus, setTelemetryStatus] = useState<any>(null)

  // Advanced telemetry hooks
  const {
    componentMetrics: currentMetrics,
    advancedKPIs,
    getRecommendations
  } = useAdvancedTelemetry({
    componentName: 'PerformanceDashboard',
    autoTrack: true
  })

  // Memory monitoring
  const { memoryUsage, memoryWarnings, hasMemoryIssues, getMemoryLeaks } = useMemoryMonitoring('Dashboard')

  // Interaction tracking
  const { getInteractionPatterns, getOptimizationOpportunities } = useInteractionTracking('Dashboard')

  // Performance metrics
  const { performanceReport, isAcceptable } = usePerformanceMetrics()

  // AC7: Real-time metrics calculation
  const realTimeMetrics = useMemo(() => {
    const performance = ganttPerformanceMonitor.getMetrics()
    const kpis = advancedKPIs
    
    return {
      renderTime: {
        value: Math.round(performance.initialRenderTime || currentMetrics?.renderTime || 0),
        status: (performance.initialRenderTime || 0) < 100 ? 'good' : 
               (performance.initialRenderTime || 0) < 200 ? 'warning' : 'error' as const,
        trend: 0 // Would be calculated from historical data
      },
      memoryUsage: {
        value: Math.round(memoryUsage),
        status: memoryUsage < 50 ? 'good' : memoryUsage < 100 ? 'warning' : 'error' as const,
        trend: 0
      },
      framerate: {
        value: Math.round(kpis?.performance?.framerate || 60),
        status: (kpis?.performance?.framerate || 60) >= 55 ? 'good' : 
               (kpis?.performance?.framerate || 60) >= 40 ? 'warning' : 'error' as const,
        trend: 0
      },
      interactions: {
        value: kpis?.interaction?.totalInteractions || 0,
        status: 'good' as const,
        trend: 0
      },
      errorRate: {
        value: Math.round(((kpis?.errors?.totalErrors || 0) / Math.max(1, kpis?.interaction?.totalInteractions || 1)) * 100),
        status: (kpis?.errors?.totalErrors || 0) === 0 ? 'good' : 
               (kpis?.errors?.totalErrors || 0) < 5 ? 'warning' : 'error' as const,
        trend: 0
      }
    }
  }, [currentMetrics, advancedKPIs, memoryUsage])

  // Update trends data
  const updateTrends = useCallback(() => {
    const timestamp = Date.now()
    const maxDataPoints = compact ? 20 : 50

    setPerformanceTrends(prev => {
      const newTrends = [...prev, { timestamp, value: realTimeMetrics.renderTime.value }]
      return newTrends.slice(-maxDataPoints)
    })

    setMemoryTrends(prev => {
      const newTrends = [...prev, { timestamp, value: realTimeMetrics.memoryUsage.value }]
      return newTrends.slice(-maxDataPoints)
    })

    setInteractionTrends(prev => {
      const newTrends = [...prev, { timestamp, value: realTimeMetrics.interactions.value }]
      return newTrends.slice(-maxDataPoints)
    })
  }, [realTimeMetrics, compact])

  // Update component metrics
  const updateComponentMetrics = useCallback(() => {
    const components = advancedTelemetry.getComponentMetrics()
    const formattedComponents: ComponentPerformance[] = components.map(component => ({
      componentName: component.componentName,
      renderTime: component.renderTime,
      rerenderCount: component.rerenderCount,
      memoryUsage: component.memoryUsage,
      score: Math.max(0, 100 - (component.renderTime / 2) - (component.rerenderCount * 2))
    }))

    setComponentMetrics(formattedComponents)
  }, [])

  // Update alerts
  const updateAlerts = useCallback(() => {
    const newAlerts = []

    // Performance alerts
    if (realTimeMetrics.renderTime.status === 'error') {
      newAlerts.push({
        severity: 'high',
        title: 'High Render Time',
        description: `Render time is ${realTimeMetrics.renderTime.value}ms, which may impact user experience`,
        timestamp: Date.now()
      })
    }

    // Memory alerts
    if (hasMemoryIssues) {
      newAlerts.push({
        severity: memoryUsage > 100 ? 'high' : 'medium',
        title: 'Memory Usage Warning',
        description: `Memory usage is ${memoryUsage}MB. ${memoryWarnings.map(w => w.description).join(', ')}`,
        timestamp: Date.now()
      })
    }

    // Memory leak alerts
    const memoryLeaks = getMemoryLeaks()
    if (memoryLeaks.length > 0) {
      newAlerts.push({
        severity: 'high',
        title: 'Memory Leak Detected',
        description: `${memoryLeaks.length} potential memory leak(s) detected in components`,
        timestamp: Date.now()
      })
    }

    setAlerts(newAlerts)
  }, [realTimeMetrics, hasMemoryIssues, memoryUsage, memoryWarnings, getMemoryLeaks])

  // Fetch telemetry system status
  const fetchTelemetryStatus = useCallback(async () => {
    try {
      // In a real implementation, this would call the API
      // const response = await fetch('/api/telemetry/status')
      // const status = await response.json()
      
      // Mock status for now
      setTelemetryStatus({
        status: 'healthy',
        queues: {
          processing: 2,
          pending: 5,
          failed: 0,
          avgProcessingTime: 150
        },
        performance: {
          throughput: 45.2,
          errorRate: 0.01,
          uptime: Date.now() - 1000 * 60 * 60 * 24 // 1 day
        }
      })
    } catch (error) {
      console.error('Failed to fetch telemetry status:', error)
    }
  }, [])

  // Real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return

    const interval = setInterval(() => {
      updateTrends()
      updateComponentMetrics()
      updateAlerts()
      fetchTelemetryStatus()
    }, refreshInterval)

    // Initial load
    updateTrends()
    updateComponentMetrics()
    updateAlerts()
    fetchTelemetryStatus()

    return () => clearInterval(interval)
  }, [refreshInterval, realTimeUpdates, updateTrends, updateComponentMetrics, updateAlerts, fetchTelemetryStatus])

  if (compact) {
    return (
      <div className="bg-white rounded-lg border p-4 max-w-md">
        <h2 className="text-lg font-semibold mb-4">Performance Monitor</h2>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            title="Render"
            value={realTimeMetrics.renderTime.value}
            unit="ms"
            status={realTimeMetrics.renderTime.status}
          />
          <MetricCard
            title="Memory"
            value={realTimeMetrics.memoryUsage.value}
            unit="MB"
            status={realTimeMetrics.memoryUsage.status}
          />
          <MetricCard
            title="FPS"
            value={realTimeMetrics.framerate.value}
            status={realTimeMetrics.framerate.status}
          />
          <MetricCard
            title="Errors"
            value={realTimeMetrics.errorRate.value}
            unit="%"
            status={realTimeMetrics.errorRate.status}
          />
        </div>
        {alerts.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
            <span className="font-medium text-red-600">{alerts.length} alert(s)</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex items-center space-x-3">
          {realTimeUpdates && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live</span>
            </div>
          )}
          {telemetryStatus && (
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              telemetryStatus.status === 'healthy' ? 'bg-green-100 text-green-800' :
              telemetryStatus.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              Telemetry: {telemetryStatus.status}
            </div>
          )}
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Render Time"
          value={realTimeMetrics.renderTime.value}
          unit="ms"
          status={realTimeMetrics.renderTime.status}
          trend={realTimeMetrics.renderTime.trend}
          description="Average component render time"
        />
        <MetricCard
          title="Memory Usage"
          value={realTimeMetrics.memoryUsage.value}
          unit="MB"
          status={realTimeMetrics.memoryUsage.status}
          trend={realTimeMetrics.memoryUsage.trend}
          description="Current heap memory usage"
        />
        <MetricCard
          title="Frame Rate"
          value={realTimeMetrics.framerate.value}
          unit="FPS"
          status={realTimeMetrics.framerate.status}
          trend={realTimeMetrics.framerate.trend}
          description="Current rendering frame rate"
        />
        <MetricCard
          title="Interactions"
          value={realTimeMetrics.interactions.value}
          status={realTimeMetrics.interactions.status}
          trend={realTimeMetrics.interactions.trend}
          description="Total user interactions"
        />
        <MetricCard
          title="Error Rate"
          value={realTimeMetrics.errorRate.value}
          unit="%"
          status={realTimeMetrics.errorRate.status}
          trend={realTimeMetrics.errorRate.trend}
          description="Error rate per interaction"
        />
      </div>

      {/* Telemetry System Status */}
      {telemetryStatus && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-4">Telemetry System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <h4 className="font-medium text-blue-900">Queue Status</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div>Processing: {telemetryStatus.queues.processing}</div>
                <div>Pending: {telemetryStatus.queues.pending}</div>
                <div>Failed: {telemetryStatus.queues.failed}</div>
                <div>Avg Time: {telemetryStatus.queues.avgProcessingTime}ms</div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <h4 className="font-medium text-green-900">Performance</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div>Throughput: {telemetryStatus.performance.throughput} ops/min</div>
                <div>Error Rate: {(telemetryStatus.performance.errorRate * 100).toFixed(2)}%</div>
                <div>Uptime: {Math.round(telemetryStatus.performance.uptime / 1000 / 60 / 60)}h</div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <h4 className="font-medium text-purple-900">Optimization</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div>Components: {componentMetrics.length}</div>
                <div>Patterns: {getInteractionPatterns().length}</div>
                <div>Opportunities: {getOptimizationOpportunities().length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trends Charts */}
      {showTrends && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TrendChart
            data={performanceTrends}
            title="Performance Trend"
            color="#3B82F6"
          />
          <TrendChart
            data={memoryTrends}
            title="Memory Usage Trend"
            color="#EF4444"
          />
          <TrendChart
            data={interactionTrends}
            title="User Interactions"
            color="#10B981"
          />
        </div>
      )}

      {/* Component Breakdown */}
      {showComponents && componentMetrics.length > 0 && (
        <ComponentBreakdown components={componentMetrics} />
      )}

      {/* Alerts Panel */}
      <AlertsPanel alerts={alerts} />

      {/* Recommendations */}
      {getRecommendations().length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-4">Performance Recommendations</h3>
          <div className="space-y-3">
            {getRecommendations().map((rec, index) => (
              <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-medium text-blue-900">{rec.title}</h4>
                <p className="text-sm text-blue-700 mt-1">{rec.description}</p>
                {rec.impact && (
                  <p className="text-xs text-blue-600 mt-2">Impact: {rec.impact}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && advancedKPIs && (
        <div className="bg-gray-900 text-white rounded-lg p-4 font-mono text-sm">
          <h3 className="font-bold mb-3">Debug Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div>Components Tracked: {advancedTelemetry.getComponentCount()}</div>
              <div>Memory Growth: {memoryUsage > 0 ? '+' : ''}{memoryUsage}MB</div>
              <div>Render Cycles: {currentMetrics?.rerenderCount || 0}</div>
            </div>
            <div>
              <div>Performance Score: {isAcceptable ? '✅' : '❌'}</div>
              <div>Memory Leaks: {getMemoryLeaks().length}</div>
              <div>Optimization Ops: {getOptimizationOpportunities().length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceDashboard