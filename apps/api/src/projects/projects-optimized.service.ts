import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaPerformanceService } from '../prisma/prisma-performance.service';
import { ProjectResponseDto } from './dto/project.dto';
import { GanttDataResponseDto, WBSNodeStatus } from '../issues/dto/wbs-tree.dto';

interface OptimizedProjectRow {
  id: string;
  name: string;
  visibility: string;
  schedulingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  issue_count: number;
  member_count: number;
  members: any[];
}

interface OptimizedGanttRow {
  id: string;
  title: string;
  description: string;
  parent_issue_id: string | null;
  start_date: Date | null;
  due_date: Date | null;
  progress: number;
  status: string;
  assignee_id: string | null;
  estimate_value: number;
  spent: number;
  order_index: number;
  assignee_name: string | null;
  assignee_email: string | null;
  hierarchy_level: number;
  dependencies: any[];
}

@Injectable()
export class ProjectsOptimizedService {
  private readonly logger = new Logger(ProjectsOptimizedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaPerf: PrismaPerformanceService,
  ) {}

  /**
   * Convert database status to WBSNodeStatus enum
   */
  private convertToWBSStatus(dbStatus: string): WBSNodeStatus {
    switch (dbStatus?.toLowerCase()) {
      case 'todo':
        return WBSNodeStatus.TODO;
      case 'doing':
      case 'in_progress':
        return WBSNodeStatus.IN_PROGRESS;
      case 'done':
        return WBSNodeStatus.DONE;
      case 'cancelled':
        return WBSNodeStatus.CANCELLED;
      default:
        return WBSNodeStatus.TODO;
    }
  }

  /**
   * Optimized project list query - eliminates N+1 problem
   * Single query with JOINs and aggregations
   */
  async findAllForUserOptimized(userId: string): Promise<ProjectResponseDto[]> {
    const startTime = Date.now();

    try {
      // Single optimized query instead of multiple queries
      const projectsWithCounts = await this.prisma.$queryRaw<OptimizedProjectRow[]>`
        SELECT 
          p.id,
          p.name,
          p.visibility,
          p.scheduling_enabled as "schedulingEnabled",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL) as issue_count,
          COUNT(DISTINCT pm_all.id) FILTER (WHERE pm_all.is_active = true) as member_count,
          JSON_AGG(
            DISTINCT CASE 
              WHEN pm_all.is_active = true THEN
                JSON_BUILD_OBJECT(
                  'userId', pm_all.user_id,
                  'role', pm_all.role,
                  'userName', u.name,
                  'userEmail', u.email
                )
              END
          ) FILTER (WHERE pm_all.is_active = true) as members
        FROM projects p
        INNER JOIN project_members pm_user ON p.id = pm_user.project_id 
          AND pm_user.user_id = ${userId}
          AND pm_user.is_active = true
        LEFT JOIN project_members pm_all ON p.id = pm_all.project_id
        LEFT JOIN users u ON pm_all.user_id = u.id
        LEFT JOIN issues i ON p.id = i.project_id
        GROUP BY p.id, p.name, p.visibility, p.scheduling_enabled, p.created_at, p.updated_at
        ORDER BY p.updated_at DESC
      `;

      const responseTime = Date.now() - startTime;
      
      if (responseTime > 100) {
        this.logger.warn(`Slow project list query: ${responseTime}ms for user ${userId}`);
      }

      // Transform to DTO format
      return projectsWithCounts.map(project => ({
        id: project.id,
        name: project.name,
        visibility: project.visibility,
        schedulingEnabled: project.schedulingEnabled,
        createdAt: new Date(project.createdAt).toISOString(),
        updatedAt: new Date(project.updatedAt).toISOString(),
        members: Array.isArray(project.members) ? project.members : [],
        issuesCount: Number(project.issue_count) || 0
      }));

    } catch (error) {
      this.logger.error(`Failed to fetch projects for user ${userId}:`, error);
      throw new BadRequestException(`Failed to fetch projects: ${error.message}`);
    }
  }

  /**
   * Optimized Gantt data query - single query with CTEs
   */
  async getProjectGanttDataOptimized(projectId: string, options: {
    startDate?: string;
    endDate?: string;
    includeCompleted?: boolean;
    includeDependencies?: boolean;
  } = {}): Promise<GanttDataResponseDto> {
    const startTime = Date.now();
    const {
      startDate,
      endDate,
      includeCompleted = true,
      includeDependencies = true
    } = options;

    try {
      // Use the optimized query from performance service
      const { result: ganttData, duration } = await this.prismaPerf.findGanttDataOptimized(
        projectId,
        { includeCompleted, startDate, endDate }
      );

      // Ensure ganttData is an array
      const ganttArray = Array.isArray(ganttData) ? ganttData as OptimizedGanttRow[] : [];

      // Transform the raw data to the expected format
      const tasks = ganttArray.map((row, index) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        parentId: row.parent_issue_id,
        startDate: row.start_date?.toISOString() || new Date().toISOString(),
        endDate: row.due_date?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: row.progress,
        status: this.convertToWBSStatus(row.status), // Convert to enum
        assigneeId: row.assignee_id,
        assigneeName: row.assignee_name,
        estimatedHours: row.estimate_value,
        actualHours: row.spent,
        level: row.hierarchy_level || 0,
        order: index,
        color: this.getStatusColor(row.status)
      }));

      // Extract dependencies from the aggregated JSON
      let dependencies: any[] = [];
      if (includeDependencies && ganttArray.length > 0) {
        const allDependencies = ganttArray.reduce((acc, row) => {
          if (row.dependencies && Array.isArray(row.dependencies)) {
            acc.push(...row.dependencies);
          }
          return acc;
        }, [] as any[]);

        // Deduplicate dependencies
        const uniqueDeps = new Map();
        allDependencies.forEach(dep => {
          if (dep.id) {
            uniqueDeps.set(dep.id, {
              id: dep.id,
              predecessorId: dep.predecessorId,
              successorId: dep.successorId,
              type: dep.type as 'FS' | 'SS' | 'FF' | 'SF',
              lag: dep.lag,
              lagUnit: 'hours' as 'days' | 'hours'
            });
          }
        });
        dependencies = Array.from(uniqueDeps.values());
      }

      const projectStartDate = this.getProjectStartDate(tasks);
      const projectEndDate = this.getProjectEndDate(tasks);

      const responseTime = Date.now() - startTime;
      if (responseTime > 200) {
        this.logger.warn(`Slow Gantt query: ${responseTime}ms for project ${projectId}`);
      }

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
      throw new BadRequestException(`Failed to get Gantt data: ${error.message}`);
    }
  }

  /**
   * Optimized WBS tree query using recursive CTE
   */
  async getProjectWBSOptimized(projectId: string, options: {
    expandLevel?: number;
    includeCompleted?: boolean;
    maxDepth?: number;
  } = {}) {
    const startTime = Date.now();
    const { expandLevel = 2, includeCompleted = true, maxDepth = 10 } = options;

    try {
      // Use optimized WBS tree query
      const { result: wbsData, duration } = await this.prismaPerf.findWBSTreeOptimized(
        projectId, 
        { includeCompleted, maxDepth }
      );

      // Ensure wbsData is an array
      const wbsArray = Array.isArray(wbsData) ? wbsData : [];

      // Convert to node structure
      const nodes = this.convertToWBSNodesOptimized(wbsArray, expandLevel);

      const responseTime = Date.now() - startTime;
      if (responseTime > 150) {
        this.logger.warn(`Slow WBS query: ${responseTime}ms for project ${projectId}`);
      }

      return {
        nodes,
        totalNodes: wbsArray.length,
        maxDepth: this.calculateMaxDepth(nodes),
        visibleNodes: this.countVisibleNodes(nodes),
        generatedAt: new Date().toISOString(),
        performance: {
          queryTime: duration,
          responseTime
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get WBS tree for project ${projectId}:`, error);
      throw new BadRequestException(`Failed to get WBS tree: ${error.message}`);
    }
  }

  /**
   * Optimized single project query with access check
   */
  async findOneWithAccessOptimized(id: string, userId: string): Promise<ProjectResponseDto> {
    const startTime = Date.now();

    try {
      const projectData = await this.prisma.$queryRaw<OptimizedProjectRow[]>`
        SELECT 
          p.id,
          p.name,
          p.visibility,
          p.scheduling_enabled as "schedulingEnabled",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL) as issue_count,
          JSON_AGG(
            DISTINCT CASE 
              WHEN pm.is_active = true THEN
                JSON_BUILD_OBJECT(
                  'userId', pm.user_id,
                  'role', pm.role,
                  'user', JSON_BUILD_OBJECT(
                    'id', u.id,
                    'name', u.name,
                    'email', u.email
                  )
                )
              END
          ) FILTER (WHERE pm.is_active = true) as members
        FROM projects p
        INNER JOIN project_members pm_access ON p.id = pm_access.project_id 
          AND pm_access.user_id = ${userId}
          AND pm_access.is_active = true
        LEFT JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN users u ON pm.user_id = u.id
        LEFT JOIN issues i ON p.id = i.project_id
        WHERE p.id = ${id}
        GROUP BY p.id, p.name, p.visibility, p.scheduling_enabled, p.created_at, p.updated_at
      `;

      if (projectData.length === 0) {
        throw new NotFoundException('Project not found or access denied');
      }

      const project = projectData[0];
      const responseTime = Date.now() - startTime;

      if (responseTime > 50) {
        this.logger.warn(`Slow single project query: ${responseTime}ms`);
      }

      return {
        id: project.id,
        name: project.name,
        visibility: project.visibility,
        schedulingEnabled: project.schedulingEnabled,
        createdAt: new Date(project.createdAt).toISOString(),
        updatedAt: new Date(project.updatedAt).toISOString(),
        members: Array.isArray(project.members) ? project.members : [],
        issuesCount: Number(project.issue_count) || 0
      };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch project ${id}:`, error);
      throw new BadRequestException(`Failed to fetch project: ${error.message}`);
    }
  }

  /**
   * Batch operation for multiple project updates
   */
  async batchUpdateProjects(updates: Array<{ id: string; data: any }>, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const results = [];
      
      for (const update of updates) {
        // Verify access for each project
        const hasAccess = await tx.projectMember.findFirst({
          where: {
            projectId: update.id,
            userId: userId,
            isActive: true,
            role: { in: ['owner', 'admin'] }
          }
        });

        if (!hasAccess) {
          throw new BadRequestException(`No access to project ${update.id}`);
        }

        const result = await tx.project.update({
          where: { id: update.id },
          data: update.data
        });

        results.push(result);
      }

      return results;
    });
  }

  private convertToWBSNodesOptimized(rawData: any[], expandLevel: number) {
    // Build the tree structure from the hierarchical query result
    const nodeMap = new Map();
    const rootNodes: any[] = [];

    // First pass: create all nodes
    for (const row of rawData) {
      const node = {
        id: row.id,
        title: row.title,
        description: row.description,
        parentId: row.parent_issue_id,
        projectId: row.project_id,
        assigneeId: row.assignee_id,
        status: this.convertToWBSStatus(row.status), // Convert to enum
        startDate: row.start_date?.toISOString(),
        dueDate: row.due_date?.toISOString(),
        estimatedHours: row.estimate_value,
        progress: row.progress,
        version: row.version,
        level: row.level,
        order: row.order_index,
        isExpanded: row.level < expandLevel,
        children: [],
        hasChildren: false,
        isVisible: true,
        path: row.path || []
      };

      nodeMap.set(row.id, node);

      if (row.level === 0) {
        rootNodes.push(node);
      }
    }

    // Second pass: build parent-child relationships
    for (const row of rawData) {
      if (row.parent_issue_id) {
        const parent = nodeMap.get(row.parent_issue_id);
        const child = nodeMap.get(row.id);
        
        if (parent && child) {
          parent.children.push(child);
          parent.hasChildren = true;
        }
      }
    }

    return rootNodes;
  }

  private calculateMaxDepth(nodes: any[]): number {
    let maxDepth = 0;
    const calculateDepth = (nodeList: any[], currentDepth: number = 0): void => {
      for (const node of nodeList) {
        maxDepth = Math.max(maxDepth, currentDepth);
        if (node.children && node.children.length > 0) {
          calculateDepth(node.children, currentDepth + 1);
        }
      }
    };
    calculateDepth(nodes);
    return maxDepth;
  }

  private countVisibleNodes(nodes: any[]): number {
    let count = 0;
    const countVisible = (nodeList: any[]): void => {
      for (const node of nodeList) {
        if (node.isVisible) {
          count++;
        }
        if (node.children && node.children.length > 0) {
          countVisible(node.children);
        }
      }
    };
    countVisible(nodes);
    return count;
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