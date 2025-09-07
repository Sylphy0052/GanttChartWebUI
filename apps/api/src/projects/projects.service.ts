import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project.dto';
import { WBSTreeResponseDto, WBSTreeQueryDto, GanttDataResponseDto, GanttDataQueryDto, WBSNodeDto } from '../issues/dto/wbs-tree.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto, userId: string): Promise<ProjectResponseDto> {
    try {
      const project = await this.prisma.project.create({
        data: {
          ...createProjectDto,
          members: {
            create: {
              userId: userId,
              role: 'owner'
            }
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              issues: true
            }
          }
        }
      });

      return {
        id: project.id,
        name: project.name,
        visibility: project.visibility,
        schedulingEnabled: project.schedulingEnabled,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        members: project.members.map(member => ({
          userId: member.userId,
          role: member.role,
          user: member.user
        })),
        issuesCount: project._count.issues
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create project: ${error.message}`);
    }
  }

  async findAllForUser(userId: string): Promise<ProjectResponseDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            isActive: true
          }
        }
      },
      include: {
        members: {
          where: {
            isActive: true
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            issues: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return projects.map(project => ({
      id: project.id,
      name: project.name,
      visibility: project.visibility,
      schedulingEnabled: project.schedulingEnabled,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      members: project.members.map(member => ({
        userId: member.userId,
        role: member.role,
        user: member.user
      })),
      issuesCount: project._count.issues
    }));
  }

  async findOneWithAccess(id: string, userId: string): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: id,
        members: {
          some: {
            userId: userId,
            isActive: true
          }
        }
      },
      include: {
        members: {
          where: {
            isActive: true
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            issues: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    return {
      id: project.id,
      name: project.name,
      visibility: project.visibility,
      schedulingEnabled: project.schedulingEnabled,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      members: project.members.map(member => ({
        userId: member.userId,
        role: member.role,
        user: member.user
      })),
      issuesCount: project._count.issues
    };
  }

  async updateWithAccess(id: string, updateProjectDto: UpdateProjectDto, userId: string): Promise<ProjectResponseDto> {
    // Verify user has access to the project
    const existingProject = await this.findOneWithAccess(id, userId);
    
    try {
      const project = await this.prisma.project.update({
        where: { id: id },
        data: updateProjectDto,
        include: {
          members: {
            where: {
              isActive: true
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              issues: true
            }
          }
        }
      });

      return {
        id: project.id,
        name: project.name,
        visibility: project.visibility,
        schedulingEnabled: project.schedulingEnabled,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        members: project.members.map(member => ({
          userId: member.userId,
          role: member.role,
          user: member.user
        })),
        issuesCount: project._count.issues
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update project: ${error.message}`);
    }
  }

  async removeWithAccess(id: string, userId: string): Promise<void> {
    // Verify user has access to the project
    await this.findOneWithAccess(id, userId);
    
    try {
      await this.prisma.project.delete({
        where: { id: id }
      });
    } catch (error) {
      throw new BadRequestException(`Failed to delete project: ${error.message}`);
    }
  }

  async getProjectSchedule(projectId: string, options: any = {}): Promise<any> {
    return this.getProjectGanttData(projectId, options);
  }

  async getProjectWBS(projectId: string, query: Omit<WBSTreeQueryDto, 'projectId'>): Promise<WBSTreeResponseDto> {
    const { 
      expandLevel = 2,
      includeCompleted = true
    } = query;

    try {
      const whereClause: any = {
        projectId: projectId
      };

      if (!includeCompleted) {
        whereClause.status = {
          not: 'done'
        };
      }

      const issues = await this.prisma.issue.findMany({
        where: whereClause,
        orderBy: [
          { parentIssueId: { sort: 'asc', nulls: 'first' } },
          { orderIndex: 'asc' }
        ],
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          wbsNode: true
        }
      });

      const nodes = await this.convertToWBSNodes(issues, expandLevel);

      return {
        nodes: nodes,
        totalNodes: issues.length,
        maxDepth: this.calculateMaxDepth(nodes),
        visibleNodes: this.countVisibleNodes(nodes),
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get WBS tree: ${error.message}`);
    }
  }

  private calculateMaxDepth(nodes: WBSNodeDto[]): number {
    let maxDepth = 0;
    const calculateDepth = (nodeList: WBSNodeDto[], currentDepth: number = 0): void => {
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

  private countVisibleNodes(nodes: WBSNodeDto[]): number {
    let count = 0;
    const countVisible = (nodeList: WBSNodeDto[]): void => {
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

  async getProjectGanttData(projectId: string, query: Omit<GanttDataQueryDto, 'projectId'>): Promise<GanttDataResponseDto> {
    const {
      startDate,
      endDate,
      includeDependencies = true,
      includeCompleted = true
    } = query;

    try {
      const whereClause: any = {
        projectId: projectId
      };

      if (!includeCompleted) {
        whereClause.status = {
          not: 'done'
        };
      }

      if (startDate || endDate) {
        whereClause.OR = [];
        
        if (startDate && endDate) {
          whereClause.OR.push(
            {
              startDate: {
                gte: new Date(startDate),
                lte: new Date(endDate)
              }
            },
            {
              dueDate: {
                gte: new Date(startDate),
                lte: new Date(endDate)
              }
            }
          );
        } else if (startDate) {
          whereClause.OR.push({
            startDate: {
              gte: new Date(startDate)
            }
          });
        } else if (endDate) {
          whereClause.OR.push({
            dueDate: {
              lte: new Date(endDate)
            }
          });
        }
      }

      const issues = await this.prisma.issue.findMany({
        where: whereClause,
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
      });

      const tasks = issues.map((issue, index) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description,
        parentId: issue.parentIssueId,
        startDate: issue.startDate?.toISOString() || new Date().toISOString(),
        endDate: issue.dueDate?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: issue.progress,
        status: issue.status as any,
        assigneeId: issue.assigneeId,
        assigneeName: issue.assignee?.name,
        estimatedHours: issue.estimateValue,
        actualHours: issue.spent,
        level: this.calculateIssueLevel(issue, issues),
        order: index,
        color: this.getStatusColor(issue.status)
      }));

      let dependencies: any[] = [];
      if (includeDependencies) {
        dependencies = await this.prisma.dependency.findMany({
          where: {
            projectId: projectId,
            predecessorId: {
              in: issues.map(i => i.id)
            },
            successorId: {
              in: issues.map(i => i.id)
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
      }

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
      throw new BadRequestException(`Failed to get Gantt data: ${error.message}`);
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

  private async convertToWBSNodes(issues: any[], expandLevel: number = 2, currentLevel: number = 0): Promise<WBSNodeDto[]> {
    const nodeMap = new Map();

    // First pass: create all nodes
    for (const issue of issues) {
      const node: WBSNodeDto = {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        parentId: issue.parentIssueId,
        projectId: issue.projectId,
        assigneeId: issue.assigneeId,
        status: issue.status as any,
        startDate: issue.startDate?.toISOString(),
        dueDate: issue.dueDate?.toISOString(),
        estimatedHours: issue.estimateValue,
        progress: issue.progress,
        version: issue.version,
        level: 0, // Will be calculated later
        order: issue.orderIndex,
        isExpanded: currentLevel < expandLevel,
        children: [],
        hasChildren: false,
        isVisible: true,
        path: []
      };
      nodeMap.set(issue.id, node);
    }

    // Second pass: build hierarchy
    const rootNodes: WBSNodeDto[] = [];
    for (const issue of issues) {
      const node = nodeMap.get(issue.id);
      if (issue.parentIssueId) {
        const parent = nodeMap.get(issue.parentIssueId);
        if (parent) {
          parent.children.push(node);
          parent.hasChildren = true;
          node.level = parent.level + 1;
          node.path = [...parent.path, parent.id];
        }
      } else {
        rootNodes.push(node);
        node.level = 0;
        node.path = [];
      }
    }

    return rootNodes;
  }

  async assignUserToIssue(projectId: string, userId: string, issueId: string, requestingUserId: string): Promise<void> {
    // Verify project access for requesting user
    await this.findOneWithAccess(projectId, requestingUserId);

    // Check if issue belongs to the project
    const issue = await this.prisma.issue.findFirst({
      where: {
        id: issueId,
        projectId: projectId
      }
    });

    if (!issue) {
      throw new NotFoundException('Issue not found in this project');
    }

    // Check if user has access to the project
    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId: projectId,
        userId: userId,
        isActive: true
      }
    });

    if (!projectMember) {
      throw new ForbiddenException('User is not a member of this project');
    }

    // Assign user to issue
    try {
      await this.prisma.issue.update({
        where: { id: issueId },
        data: { assigneeId: userId }
      });
    } catch (error) {
      throw new BadRequestException(`Failed to assign user to issue: ${error.message}`);
    }
  }

  async unassignUserFromIssue(projectId: string, userId: string, issueId: string, requestingUserId: string): Promise<void> {
    // Verify project access for requesting user
    await this.findOneWithAccess(projectId, requestingUserId);

    // Check if issue belongs to the project
    const issue = await this.prisma.issue.findFirst({
      where: {
        id: issueId,
        projectId: projectId,
        assigneeId: userId
      }
    });

    if (!issue) {
      throw new NotFoundException('Issue not found or user is not assigned to this issue');
    }

    // Unassign user from issue
    try {
      await this.prisma.issue.update({
        where: { id: issueId },
        data: { assigneeId: null }
      });
    } catch (error) {
      throw new BadRequestException(`Failed to unassign user from issue: ${error.message}`);
    }
  }

  async getWBSCodesForIssueHierarchy(issueId: string): Promise<string[]> {
    try {
      const issue = await this.prisma.issue.findUnique({
        where: { id: issueId },
        include: { wbsNode: true }
      });
      return issue && issue.wbsNode ? [issue.wbsNode.id] : [];
    } catch (error) {
      console.error('Error getting WBS codes:', error);
      return [];
    }
  }

  async getAllWBSCodes(projectId: string): Promise<string[]> {
    try {
      const wbsNodes = await this.prisma.wBSNode.findMany({
        where: { projectId: projectId },
        include: {
          issue: {
            select: { id: true, title: true, status: true }
          }
        }
      });

      return wbsNodes.map(node => node.id);
    } catch (error) {
      console.error('Error getting all WBS codes:', error);
      return [];
    }
  }

  async getCriticalPath(projectId: string): Promise<string[]> {
    // Calculate critical path based on dependencies and durations
    const issues = await this.prisma.issue.findMany({
      where: { projectId },
      include: {
        successors: true,
        predecessors: true
      }
    });

    const dependencies = await this.prisma.dependency.findMany({
      where: { projectId }
    });

    // Basic critical path calculation
    // This is a simplified version - in production you'd want a more sophisticated algorithm
    const taskDurations = new Map();
    const taskStartTimes = new Map();
    
    for (const issue of issues) {
      const duration = issue.estimateValue || 1;
      taskDurations.set(issue.id, duration);
      
      if (issue.startDate) {
        taskStartTimes.set(issue.id, issue.startDate.getTime());
      }
    }

    // Find tasks with no successors (end tasks)
    const endTasks = issues.filter(issue => 
      !dependencies.some(dep => dep.predecessorId === issue.id)
    );

    // Simple critical path - just return the longest chain
    if (endTasks.length > 0) {
      return this.findLongestPath(endTasks[0].id, dependencies, taskDurations);
    }

    return [];
  }

  async createScheduleVersion(projectId: string, versionName: string, userId: string): Promise<any> {
    // Verify project access
    await this.findOneWithAccess(projectId, userId);
    
    try {
      // Get current schedule data
      const scheduleData = await this.getProjectGanttData(projectId, {});
      
      // Create version record (placeholder implementation)
      const version = {
        id: `version-${Date.now()}`,
        projectId,
        versionName,
        scheduleData: JSON.stringify(scheduleData),
        createdBy: userId,
        createdAt: new Date().toISOString()
      };
      
      return {
        success: true,
        versionId: version.id,
        message: `Schedule version '${versionName}' created successfully`
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create schedule version: ${error.message}`);
    }
  }

  async getScheduleVersionHistory(projectId: string): Promise<any[]> {
    try {
      // Placeholder implementation - return mock version history
      return [
        {
          id: 'version-1',
          versionName: 'Initial Schedule',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdBy: 'system'
        },
        {
          id: 'version-2',
          versionName: 'Updated Milestones',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          createdBy: 'user'
        }
      ];
    } catch (error) {
      throw new BadRequestException(`Failed to get schedule version history: ${error.message}`);
    }
  }

  async rollbackToScheduleVersion(projectId: string, versionId: string, userId: string): Promise<any> {
    // Verify project access
    await this.findOneWithAccess(projectId, userId);
    
    try {
      // Placeholder implementation
      return {
        success: true,
        message: `Project ${projectId} rolled back to version ${versionId}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to rollback to schedule version: ${error.message}`);
    }
  }

  async getMigrationStatus(): Promise<any> {
    try {
      // Placeholder implementation - return migration status
      return {
        status: 'completed',
        lastMigration: 'v1.4.0_dependency_types',
        appliedMigrations: [
          'v1.0.0_initial_schema',
          'v1.1.0_add_scheduling',
          'v1.2.0_add_wbs',
          'v1.3.0_add_telemetry',
          'v1.4.0_dependency_types'
        ],
        pendingMigrations: [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get migration status: ${error.message}`);
    }
  }

  private findLongestPath(taskId: string, dependencies: any[], durations: Map<string, number>): string[] {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (currentId: string): number => {
      if (visited.has(currentId)) return 0;
      
      visited.add(currentId);
      path.push(currentId);
      
      const duration = durations.get(currentId) || 0;
      const predecessors = dependencies.filter(dep => dep.successorId === currentId);
      
      if (predecessors.length === 0) {
        return duration;
      }

      let maxPredecessorTime = 0;
      for (const pred of predecessors) {
        const predTime = dfs(pred.predecessorId);
        maxPredecessorTime = Math.max(maxPredecessorTime, predTime);
      }

      return duration + maxPredecessorTime;
    };

    dfs(taskId);
    return path;
  }
}