"use client"

/**
 * T029: ROI Dashboard Component
 * 
 * Displays comprehensive ROI metrics and KPI tracking
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface ROIMetrics {
  overview: {
    roiPercentage: number
    netBenefit: number
    paybackPeriod: number
    status: 'on_track' | 'needs_improvement'
  }
  metrics: {
    productivity: {
      planningTimeReduction: number
      updateFrequency: number
      taskCompletionRate: number
      collaborationEfficiency: number
    }
    visibility: {
      dashboardUsage: number
      reportGeneration: number
      dataAccuracy: number
      decisionSpeed: number
    }
    manualWork: {
      automatedTasks: number
      timeSaved: number
      errorReduction: number
      processEfficiency: number
    }
    adoption: {
      activeUsers: number
      totalUsers: number
      adoptionRate: number
      engagementScore: number
      retentionRate: number
    }
  }
  kpis: {
    productivityImprovement: number
    visibilityIncrease: number
    manualWorkReduction: number
    adoptionRate: number
  }
  trends: {
    period: string
    direction: 'up' | 'down'
  }
}

interface ROIDashboardProps {
  projectId: string
}

export const ROIDashboard: React.FC<ROIDashboardProps> = ({ projectId }) => {
  const [metrics, setMetrics] = useState<ROIMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchROIMetrics()
  }, [projectId])

  const fetchROIMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/metrics/roi/dashboard/${projectId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch ROI metrics')
      }
      
      const data = await response.json()
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateROIReport = async () => {
    try {
      const response = await fetch(`/api/metrics/roi/report/${projectId}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate ROI report')
      }
      
      // Refresh metrics after generating report
      await fetchROIMetrics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-64 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">Error loading ROI metrics: {error}</p>
            <button 
              onClick={fetchROIMetrics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'text-green-600 bg-green-100'
      case 'needs_improvement':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ROI Dashboard</h1>
          <p className="text-gray-600">Business value measurement and KPI tracking</p>
        </div>
        <button
          onClick={generateROIReport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Generate Report
        </button>
      </div>

      {/* ROI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ROI Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(metrics.overview.roiPercentage)}
            </div>
            <p className={`text-sm px-2 py-1 rounded-full inline-flex items-center ${getStatusColor(metrics.overview.status)}`}>
              {metrics.overview.status.replace('_', ' ').toUpperCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Net Benefit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(metrics.overview.netBenefit)}
            </div>
            <p className="text-sm text-gray-500">Monthly</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Payback Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {metrics.overview.paybackPeriod.toFixed(1)}
            </div>
            <p className="text-sm text-gray-500">Months</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Adoption Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(metrics.kpis.adoptionRate)}
            </div>
            <p className="text-sm text-gray-500">
              {metrics.metrics.adoption.activeUsers}/{metrics.metrics.adoption.totalUsers} users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Productivity Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Productivity Improvements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Planning Time Saved</span>
              <span className="font-semibold">{metrics.metrics.productivity.planningTimeReduction} min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Update Frequency</span>
              <span className="font-semibold">{metrics.metrics.productivity.updateFrequency.toFixed(1)}/week</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Task Completion Rate</span>
              <span className="font-semibold">{formatPercentage(metrics.metrics.productivity.taskCompletionRate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Collaboration Efficiency</span>
              <span className="font-semibold">{metrics.metrics.productivity.collaborationEfficiency}/100</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Improvement vs Baseline</span>
                <span className="text-lg font-bold text-green-600">
                  +{formatPercentage(metrics.kpis.productivityImprovement)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visibility Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Project Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Dashboard Usage</span>
              <span className="font-semibold">{metrics.metrics.visibility.dashboardUsage} views/day</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Report Generation</span>
              <span className="font-semibold">{metrics.metrics.visibility.reportGeneration}/month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Data Accuracy</span>
              <span className="font-semibold">{formatPercentage(metrics.metrics.visibility.dataAccuracy)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Decision Speed</span>
              <span className="font-semibold">{(metrics.metrics.visibility.decisionSpeed / 24).toFixed(1)} days</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Visibility Increase</span>
                <span className="text-lg font-bold text-blue-600">
                  +{formatPercentage(metrics.kpis.visibilityIncrease)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Work Reduction */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Manual Work Reduction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Automated Tasks</span>
              <span className="font-semibold">{metrics.metrics.manualWork.automatedTasks}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Time Saved</span>
              <span className="font-semibold">{metrics.metrics.manualWork.timeSaved} hrs</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Error Reduction</span>
              <span className="font-semibold">{formatPercentage(metrics.metrics.manualWork.errorReduction)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Process Efficiency</span>
              <span className="font-semibold">{metrics.metrics.manualWork.processEfficiency}/100</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Manual Work Reduction</span>
                <span className="text-lg font-bold text-purple-600">
                  -{formatPercentage(metrics.kpis.manualWorkReduction)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Adoption */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">User Adoption & Engagement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Users</span>
              <span className="font-semibold">
                {metrics.metrics.adoption.activeUsers}/{metrics.metrics.adoption.totalUsers}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Adoption Rate</span>
              <span className="font-semibold">{formatPercentage(metrics.metrics.adoption.adoptionRate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Engagement Score</span>
              <span className="font-semibold">{metrics.metrics.adoption.engagementScore}/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Retention Rate</span>
              <span className="font-semibold">{formatPercentage(metrics.metrics.adoption.retentionRate)}</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">vs Target (80%)</span>
                <span className={`text-lg font-bold ${metrics.metrics.adoption.adoptionRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                  {metrics.metrics.adoption.adoptionRate >= 80 ? '✓ Achieved' : 'In Progress'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">ROI Targets & Projections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">22%</div>
              <div className="text-sm text-gray-600">Year 1 Target</div>
              <div className="text-xs text-gray-500">Currently: {formatPercentage(metrics.overview.roiPercentage)}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">267%</div>
              <div className="text-sm text-gray-600">3-Year Target</div>
              <div className="text-xs text-gray-500">$382k net benefit</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">$175k</div>
              <div className="text-sm text-gray-600">Annual Benefit</div>
              <div className="text-xs text-gray-500">Productivity gains</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">60%</div>
              <div className="text-sm text-gray-600">Automation Target</div>
              <div className="text-xs text-gray-500">Manual work reduction</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}