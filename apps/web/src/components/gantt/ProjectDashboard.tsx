'use client'

import React, { memo, useMemo } from 'react'
import { GanttTask, GanttMilestone, GanttProgressSummary } from '@/types/gantt'
import { CriticalPathAnalyzer } from '@/lib/critical-path'

interface ProjectDashboardProps {
  tasks: GanttTask[]
  milestones?: GanttMilestone[]
  projectName?: string
  className?: string
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  trend?: 'up' | 'down' | 'stable'
  icon?: string
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  color = 'blue',
  trend,
  icon
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  }

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    stable: '→'
  }

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium opacity-75">{title}</h3>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      
      <div className="flex items-baseline space-x-2">
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <span className="text-sm font-medium opacity-75">
            {trendIcons[trend]}
          </span>
        )}
      </div>
      
      {subtitle && (
        <p className="text-xs opacity-60 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

const ProgressBar: React.FC<{
  completed: number
  total: number
  label: string
  color?: string
}> = ({ completed, total, label, color = '#3b82f6' }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-gray-600">
          {completed}/{total} ({percentage.toFixed(1)}%)
        </span>
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  )
}

export const ProjectDashboard = memo<ProjectDashboardProps>(({
  tasks,
  milestones = [],
  projectName,
  className = ''
}) => {
  const dashboardData = useMemo(() => {
    if (tasks.length === 0) {
      return {
        overview: {
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          completionPercentage: 0
        },
        schedule: {
          projectStartDate: new Date(),
          projectEndDate: new Date(),
          daysRemaining: 0,
          isOnSchedule: true
        },
        critical: {
          criticalTasks: 0,
          atRiskTasks: 0,
          totalFloat: 0
        },
        milestones: {
          total: milestones.length,
          achieved: 0,
          pending: 0,
          missed: 0
        }
      }
    }

    // Calculate basic metrics
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'DONE').length
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const today = new Date()
    const overdueTasks = tasks.filter(t => t.endDate < today && t.status !== 'DONE').length
    const completionPercentage = (completedTasks / totalTasks) * 100

    // Calculate schedule metrics
    const taskDates = tasks.map(t => [t.startDate, t.endDate]).flat()
    const projectStartDate = new Date(Math.min(...taskDates.map(d => d.getTime())))
    const projectEndDate = new Date(Math.max(...taskDates.map(d => d.getTime())))
    const daysRemaining = Math.ceil((projectEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    // Calculate progress vs schedule
    const projectDuration = Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.ceil((today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
    const expectedProgress = Math.min(100, Math.max(0, (elapsedDays / projectDuration) * 100))
    const isOnSchedule = completionPercentage >= (expectedProgress * 0.9) // 10% tolerance

    // Calculate critical path metrics
    const criticalPathData = CriticalPathAnalyzer.getCriticalPathVisualization(tasks)
    const taskAnalysis = CriticalPathAnalyzer.getTaskAnalysis(tasks)
    const atRiskTasks = taskAnalysis.filter(a => !a.isCritical && a.totalFloat <= 2 && a.totalFloat > 0)
    const averageFloat = taskAnalysis.reduce((sum, a) => sum + a.totalFloat, 0) / taskAnalysis.length

    // Calculate milestone metrics
    const achievedMilestones = milestones.filter(m => m.status === 'ACHIEVED').length
    const pendingMilestones = milestones.filter(m => m.status === 'PENDING').length
    const missedMilestones = milestones.filter(m => m.status === 'MISSED').length

    return {
      overview: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        completionPercentage
      },
      schedule: {
        projectStartDate,
        projectEndDate,
        daysRemaining,
        isOnSchedule,
        expectedProgress,
        actualProgress: completionPercentage
      },
      critical: {
        criticalTasks: criticalPathData.criticalTasks.length,
        atRiskTasks: atRiskTasks.length,
        totalFloat: Math.round(averageFloat * 10) / 10
      },
      milestones: {
        total: milestones.length,
        achieved: achievedMilestones,
        pending: pendingMilestones,
        missed: missedMilestones
      }
    }
  }, [tasks, milestones])

  const healthScore = useMemo(() => {
    let score = 100
    
    // Penalize for overdue tasks
    score -= (dashboardData.overview.overdueTasks / dashboardData.overview.totalTasks) * 30
    
    // Penalize for being behind schedule
    if (!dashboardData.schedule.isOnSchedule) {
      score -= 20
    }
    
    // Penalize for many critical tasks
    score -= (dashboardData.critical.criticalTasks / dashboardData.overview.totalTasks) * 15
    
    // Penalize for at-risk tasks
    score -= (dashboardData.critical.atRiskTasks / dashboardData.overview.totalTasks) * 10
    
    // Penalize for missed milestones
    if (dashboardData.milestones.total > 0) {
      score -= (dashboardData.milestones.missed / dashboardData.milestones.total) * 15
    }
    
    return Math.max(0, Math.round(score))
  }, [dashboardData])

  const getHealthColor = (score: number): 'green' | 'yellow' | 'red' => {
    if (score >= 80) return 'green'
    if (score >= 60) return 'yellow'
    return 'red'
  }

  return (
    <div className={`project-dashboard space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {projectName || 'Project Dashboard'}
          </h2>
          <p className="text-sm text-gray-600">
            Overview and key metrics for your project
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {dashboardData.overview.completionPercentage.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Complete</div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Project Health"
          value={`${healthScore}%`}
          color={getHealthColor(healthScore)}
          icon="🎯"
          subtitle="Overall project status"
        />
        
        <MetricCard
          title="Tasks Complete"
          value={dashboardData.overview.completedTasks}
          subtitle={`of ${dashboardData.overview.totalTasks} tasks`}
          color="green"
          icon="✅"
        />
        
        <MetricCard
          title="Days Remaining"
          value={dashboardData.schedule.daysRemaining}
          color={dashboardData.schedule.daysRemaining < 7 ? 'red' : 'blue'}
          icon="📅"
          subtitle={dashboardData.schedule.isOnSchedule ? 'On schedule' : 'Behind schedule'}
        />
        
        <MetricCard
          title="Critical Tasks"
          value={dashboardData.critical.criticalTasks}
          color={dashboardData.critical.criticalTasks > 5 ? 'red' : 'yellow'}
          icon="⚠️"
          subtitle="Need immediate attention"
        />
      </div>

      {/* Progress Bars */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Task Progress</h3>
          <div className="space-y-4">
            <ProgressBar
              completed={dashboardData.overview.completedTasks}
              total={dashboardData.overview.totalTasks}
              label="Completed Tasks"
              color="#10b981"
            />
            
            <ProgressBar
              completed={dashboardData.overview.inProgressTasks}
              total={dashboardData.overview.totalTasks}
              label="In Progress"
              color="#3b82f6"
            />
            
            {dashboardData.overview.overdueTasks > 0 && (
              <ProgressBar
                completed={dashboardData.overview.overdueTasks}
                total={dashboardData.overview.totalTasks}
                label="Overdue"
                color="#ef4444"
              />
            )}
          </div>
        </div>

        {/* Schedule Analysis */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Schedule Analysis</h3>
          <div className="space-y-4">
            <ProgressBar
              completed={dashboardData.schedule.actualProgress || 0}
              total={100}
              label="Actual Progress"
              color="#3b82f6"
            />
            
            <ProgressBar
              completed={dashboardData.schedule.expectedProgress || 0}
              total={100}
              label="Expected Progress"
              color="#64748b"
            />
            
            <div className="flex justify-between text-sm">
              <span>Project End:</span>
              <span className="font-medium">
                {dashboardData.schedule.projectEndDate.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones & Critical Path */}
      <div className="grid md:grid-cols-2 gap-6">
        {milestones.length > 0 && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Milestones</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                  Achieved
                </span>
                <span className="font-medium">{dashboardData.milestones.achieved}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  Pending
                </span>
                <span className="font-medium">{dashboardData.milestones.pending}</span>
              </div>
              
              {dashboardData.milestones.missed > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    Missed
                  </span>
                  <span className="font-medium">{dashboardData.milestones.missed}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Risk Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                Critical Path Tasks
              </span>
              <span className="font-medium">{dashboardData.critical.criticalTasks}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center">
                <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                At Risk Tasks
              </span>
              <span className="font-medium">{dashboardData.critical.atRiskTasks}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                Avg Float Time
              </span>
              <span className="font-medium">{dashboardData.critical.totalFloat}d</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ProjectDashboard.displayName = 'ProjectDashboard'