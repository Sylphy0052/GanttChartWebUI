import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsEnhancedService {
  private readonly logger = new Logger(ProjectsEnhancedService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get enhanced project data with computed schedule
   */
  async getEnhancedProjectData(
    projectId: string, 
    options: {
      algorithm?: 'cpm' | 'pert' | 'hybrid';
      includeHistory?: boolean;
      depth?: number;
    } = {}
  ) {
    const {
      algorithm = 'hybrid',
      includeHistory = false,
      depth = 3
    } = options;

    const startTime = Date.now();

    // Enhanced query with performance optimizations
    const scheduleQuery = `
      WITH latest_schedule AS (
        SELECT 
          cs.id as schedule_id,
          cs.calculated_at,
          cs.algorithm,
          cs.computed_end_date,
          cs.total_duration,
          cs.critical_path,
          JSON_OBJECT(
            'scheduleId', cs.id,
            'calculatedAt', cs.calculated_at,
            'algorithm', cs.algorithm,
            'projectEndDate', cs.computed_end_date,
            'totalDuration', cs.total_duration,
            'criticalPath', JSON_EXTRACT(cs.critical_path, '$'),
            'tasks', (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', i.id,
                  'title', i.title,
                  'wbsCode', i.wbs_code,
                  'estimatedHours', i.estimated_hours,
                  'startDate', i.start_date,
                  'dueDate', i.due_date,
                  'status', i.status,
                  'priority', i.priority,
                  'parentId', i.parent_id
                )
              )
              FROM Issue i 
              WHERE i.project_id = cs.project_id
              ORDER BY i.wbs_code
              LIMIT ?
            ),
            'dependencies', (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', d.id,
                  'predecessorId', d.predecessor_id,
                  'successorId', d.successor_id,
                  'type', d.type,
                  'lag', d.lag
                )
              )
              FROM Dependency d
              WHERE d.project_id = cs.project_id
            )
          ) as schedule_data
        FROM ComputedSchedule cs 
        WHERE cs.project_id = ?
          AND cs.algorithm = ?
        ORDER BY cs.calculated_at DESC
        LIMIT 1
      )
      SELECT 
        schedule_id,
        calculated_at,
        algorithm,
        computed_end_date,
        total_duration,
        critical_path,
        schedule_data
      FROM latest_schedule;
    `;

    const scheduleData = await this.prisma.$queryRawUnsafe(
      scheduleQuery, 
      depth * 100, // Task limit based on depth
      projectId, 
      algorithm
    ) as any[];

    const queryTime = Date.now() - startTime;

    // Type guard for scheduleData
    if (!Array.isArray(scheduleData) || scheduleData.length === 0) {
      throw new NotFoundException('No computed schedule found for this project');
    }

    const schedule = scheduleData[0];
    const scheduleDataObj = schedule.schedule_data as any;

    let history = [];
    if (includeHistory) {
      const historyQuery = `
        SELECT 
          id, calculated_at, algorithm, total_duration, computed_end_date
        FROM ComputedSchedule 
        WHERE project_id = ? 
        ORDER BY calculated_at DESC 
        LIMIT 10;
      `;
      history = await this.prisma.$queryRawUnsafe(historyQuery, projectId) as any[];
    }

    const responseTime = Date.now() - startTime;

    return {
      schedule: scheduleDataObj,
      history,
      performance: {
        queryTime,
        responseTime,
        taskCount: scheduleDataObj?.tasks?.length || 0,
        dependencyCount: scheduleDataObj?.dependencies?.length || 0
      },
      cacheStatus: 'computed',
      metadata: {
        algorithm,
        depth,
        includeHistory,
        timestamp: new Date()
      }
    };
  }

  /**
   * Get project statistics with performance metrics
   */
  async getProjectStatistics(projectId: string) {
    const stats = await this.prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM Issue WHERE project_id = ${projectId}) as total_issues,
        (SELECT COUNT(*) FROM Issue WHERE project_id = ${projectId} AND status = 'done') as completed_issues,
        (SELECT COUNT(*) FROM Dependency WHERE project_id = ${projectId}) as total_dependencies,
        (SELECT SUM(estimated_hours) FROM Issue WHERE project_id = ${projectId}) as total_estimated_hours,
        (SELECT SUM(actual_hours) FROM Issue WHERE project_id = ${projectId}) as total_actual_hours,
        (SELECT COUNT(DISTINCT assignee_id) FROM Issue WHERE project_id = ${projectId} AND assignee_id IS NOT NULL) as team_size
    ` as any[];

    return stats[0] || {
      total_issues: 0,
      completed_issues: 0,
      total_dependencies: 0,
      total_estimated_hours: 0,
      total_actual_hours: 0,
      team_size: 0
    };
  }

  /**
   * Calculate project health score
   */
  async calculateProjectHealth(projectId: string) {
    const stats = await this.getProjectStatistics(projectId);
    
    const completionRate = stats.total_issues > 0 
      ? (stats.completed_issues / stats.total_issues) * 100 
      : 0;
    
    const estimateAccuracy = stats.total_estimated_hours > 0 
      ? Math.min(100, (stats.total_estimated_hours / Math.max(stats.total_actual_hours, 1)) * 100)
      : 100;

    const teamUtilization = stats.total_issues > 0 && stats.team_size > 0
      ? (stats.total_issues / stats.team_size)
      : 0;

    // Health score calculation (0-100)
    const healthScore = Math.round(
      (completionRate * 0.4) + 
      (estimateAccuracy * 0.3) + 
      (Math.min(100, teamUtilization * 10) * 0.3)
    );

    return {
      healthScore,
      metrics: {
        completionRate: Math.round(completionRate),
        estimateAccuracy: Math.round(estimateAccuracy),
        teamUtilization: Math.round(teamUtilization),
        totalIssues: stats.total_issues,
        completedIssues: stats.completed_issues,
        totalDependencies: stats.total_dependencies,
        teamSize: stats.team_size
      }
    };
  }

  /**
   * Get project Gantt chart data
   */
  async getProjectGanttData(projectId: string, options: any = {}) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          issues: {
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: [
              { parentIssueId: { sort: 'asc', nulls: 'first' } },
              { orderIndex: 'asc' }
            ]
          }
        }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const tasks = project.issues.map((issue, index) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description,
        parentId: issue.parentIssueId,
        startDate: issue.startDate?.toISOString() || new Date().toISOString(),
        endDate: issue.dueDate?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: issue.progress,
        status: issue.status,
        assigneeId: issue.assigneeId,
        assigneeName: issue.assignee?.name,
        estimatedHours: issue.estimateValue,
        actualHours: issue.spent,
        level: this.calculateIssueLevel(issue, project.issues),
        order: index,
        color: this.getStatusColor(issue.status)
      }));

      const dependencies = await this.prisma.dependency.findMany({
        where: {
          projectId: projectId,
          predecessorId: {
            in: project.issues.map(i => i.id)
          },
          successorId: {
            in: project.issues.map(i => i.id)
          }
        }
      }).then(deps => deps.map(dep => ({
        id: dep.id,
        predecessorId: dep.predecessorId,
        successorId: dep.successorId,
        type: dep.type as 'FS' | 'SS' | 'FF' | 'SF',
        lag: dep.lag,
        lagUnit: 'hours' as 'days' | 'hours'
      })));

      const projectStartDate = this.getProjectStartDate(tasks);
      const projectEndDate = this.getProjectEndDate(tasks);

      return {
        tasks,
        dependencies,
        projectStartDate: projectStartDate.toISOString(),
        projectEndDate: projectEndDate.toISOString(),
        totalTasks: tasks.length,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to get Gantt data for project ${projectId}:`, error);
      throw error;
    }
  }

  private calculateIssueLevel(issue: any, allIssues: any[]): number {
    let level = 0;
    let currentParentId = issue.parentIssueId;
    
    while (currentParentId) {
      const parent = allIssues.find(i => i.id === currentParentId);
      if (!parent) break;
      level++;
      currentParentId = parent.parentIssueId;
    }
    
    return level;
  }

  private getStatusColor(status: string): string {
    const colors = {
      'todo': '#6b7280',
      'doing': '#3b82f6',
      'blocked': '#ef4444',
      'review': '#f59e0b',
      'done': '#10b981'
    };
    return colors[status] || '#6b7280';
  }

  private getProjectStartDate(tasks: any[]): Date {
    const dates = tasks
      .map(task => new Date(task.startDate))
      .filter(date => !isNaN(date.getTime()));
    
    return dates.length > 0 
      ? new Date(Math.min(...dates.map(d => d.getTime())))
      : new Date();
  }

  private getProjectEndDate(tasks: any[]): Date {
    const dates = tasks
      .map(task => new Date(task.endDate))
      .filter(date => !isNaN(date.getTime()));
    
    return dates.length > 0 
      ? new Date(Math.max(...dates.map(d => d.getTime())))
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
}