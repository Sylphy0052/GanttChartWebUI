import { Injectable, NotFoundException, BadRequestException, ForbiddenException, HttpException, HttpStatus, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectPasswordDto, ProjectAccessDto, ProjectAccessResponseDto } from './dto/project-access.dto';
import { WBSTreeResponseDto, WBSTreeQueryDto } from '../issues/dto/wbs-tree.dto';
import { DependencyResponseDto, CreateDependencyDto } from '../issues/dto/dependency.dto';
import { WBSHierarchyUtils } from '../common/utils/wbs-hierarchy.utils';
import { ProjectAuthService } from '../auth/project-auth.service';
import * as argon2 from 'argon2';

@Injectable()
export class ProjectsService {
  private wbsUtils: WBSHierarchyUtils;

  constructor(
    private prisma: PrismaService,
    private projectAuthService: ProjectAuthService
  ) {
    this.wbsUtils = new WBSHierarchyUtils(prisma);
  }

  async create(data: CreateProjectDto, userId?: string) {
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        visibility: data.visibility || 'private'
      }
    });

    // If userId is provided, add the creator as project owner
    if (userId) {
      await this.prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: userId,
          role: 'owner'
        }
      });
    }

    return project;
  }

  async findAll(userId?: string) {
    if (!userId) {
      // If no user context, only return public projects
      return this.prisma.project.findMany({
        where: {
          visibility: 'public'
        },
        select: {
          id: true,
          name: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          // Don't return passwordHash
        }
      });
    }

    // For authenticated users, return projects they have access to
    return this.prisma.project.findMany({
      where: {
        OR: [
          { visibility: 'public' },
          { visibility: 'password' }, // List password-protected projects (require auth to access)
          { 
            AND: [
              { visibility: 'private' },
              { members: { some: { userId: userId, isActive: true } } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Include membership info for the requesting user
        members: {
          where: { userId: userId },
          select: { role: true, isActive: true }
        }
      }
    });
  }

  async findOne(id: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Include membership info if userId provided
        members: userId ? {
          where: { userId: userId },
          select: { role: true, isActive: true }
        } : false
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Access control logic
    if (project.visibility === 'private') {
      if (!userId) {
        throw new ForbiddenException('Access denied. Project is private.');
      }
      const membership = project.members?.[0];
      if (!membership?.isActive) {
        throw new ForbiddenException('Access denied. You are not a member of this project.');
      }
    }

    return project;
  }

  // AC3: Get optimized Gantt schedule data from materialized view
  async getOptimizedGanttSchedule(
    projectId: string,
    options: { includeHistory?: boolean } = {}
  ) {
    const startTime = Date.now();

    try {
      // Query materialized view for optimized performance
      const scheduleData = await this.prisma.$queryRaw`
        SELECT 
          csv.computed_schedule_id,
          csv.calculated_at,
          csv.algorithm,
          csv.computed_end_date as project_end_date,
          csv.total_duration,
          csv.critical_path,
          
          -- Aggregate task data for optimal transfer
          json_agg(
            json_build_object(
              'taskId', csv.task_id,
              'title', csv.task_title,
              'assigneeId', csv.assignee_id,
              'status', csv.task_status,
              'progress', csv.progress,
              'earliestStartDate', csv.earliest_start_date,
              'earliestFinishDate', csv.earliest_finish_date,
              'latestStartDate', csv.latest_start_date,
              'latestFinishDate', csv.latest_finish_date,
              'totalFloat', ROUND((csv.total_float / 1440.0)::numeric, 2), -- Convert minutes to days
              'criticalPath', csv.critical_path,
              'riskLevel', csv.risk_level,
              'estimateValue', csv.estimate_value,
              'estimateUnit', csv.estimate_unit
            ) ORDER BY csv.earliest_start_date ASC
          ) as tasks
          
        FROM computed_schedule_view csv
        WHERE csv.project_id = ${projectId}::uuid
        GROUP BY 
          csv.computed_schedule_id,
          csv.calculated_at,
          csv.algorithm,
          csv.computed_end_date,
          csv.total_duration,
          csv.critical_path
        ORDER BY csv.calculated_at DESC
        LIMIT 1;
      `;

      const queryTime = Date.now() - startTime;

      if (!scheduleData || scheduleData.length === 0) {
        throw new NotFoundException('No computed schedule found for this project');
      }

      const schedule = scheduleData[0];

      // Include historical data if requested
      let history = null;
      if (options.includeHistory) {
        history = await this.prisma.$queryRaw`
          SELECT 
            cs.id,
            cs.calculated_at,
            cs.algorithm,
            cs.applied,
            cs.applied_at,
            COUNT(tsh.task_id) as task_count
          FROM computed_schedules cs
          LEFT JOIN task_schedule_history tsh ON cs.id = tsh.computed_schedule_id
          WHERE cs.project_id = ${projectId}::uuid
          GROUP BY cs.id, cs.calculated_at, cs.algorithm, cs.applied, cs.applied_at
          ORDER BY cs.calculated_at DESC
          LIMIT 10;
        `;
      }

      const responseTime = Date.now() - startTime;

      return {
        schedule: {
          computedScheduleId: schedule.computed_schedule_id,
          calculatedAt: schedule.calculated_at,
          algorithm: schedule.algorithm,
          projectEndDate: schedule.project_end_date,
          totalDuration: schedule.total_duration,
          criticalPath: schedule.critical_path,
          tasks: schedule.tasks
        },
        history,
        performance: {
          queryTime,
          responseTime,
          taskCount: schedule.tasks?.length || 0
        },
        cacheStatus: responseTime < 200 ? 'optimal' : 'slow'
      };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to retrieve schedule data: ${error.message}`);
    }
  }

  async getProjectWBS(projectId: string, query: Omit<WBSTreeQueryDto, 'projectId'>): Promise<WBSTreeResponseDto> {
    // Validate project exists first
    await this.findOne(projectId);

    const { maxDepth = 5, includeCompleted = true, expandLevel = 2 } = query;

    // Get hierarchical issues using WBS utils
    const issues = await this.wbsUtils.getHierarchicalIssues(
      projectId, 
      null, // Start from root level
      { maxDepth, includeDeleted: false }
    );

    // Convert to WBS nodes
    const nodes = await this.convertToWBSNodes(issues, expandLevel);
    const totalNodes = this.countTotalNodes(nodes);
    const maxTreeDepth = this.calculateMaxDepth(nodes);
    const visibleNodes = this.countVisibleNodes(nodes);

    return {
      nodes,
      totalNodes,
      maxDepth: maxTreeDepth,
      visibleNodes,
      generatedAt: new Date().toISOString()
    };
  }

  private async convertToWBSNodes(issues: any[], expandLevel: number = 2, currentLevel: number = 0): Promise<any[]> {
    const nodes = [];
    
    for (const issue of issues) {
      const node = {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        parentId: issue.parentIssueId,
        projectId: issue.projectId,
        assigneeId: issue.assigneeId,
        status: this.mapIssueStatus(issue.status),
        startDate: issue.startDate?.toISOString(),
        dueDate: issue.dueDate?.toISOString(),
        estimatedHours: issue.estimateValue,
        progress: issue.progress,
        version: issue.version,
        level: issue.level || currentLevel,
        order: issue.orderIndex || 0,
        isExpanded: currentLevel < expandLevel,
        children: await this.convertToWBSNodes(issue.children || [], expandLevel, currentLevel + 1),
        hasChildren: (issue.children || []).length > 0,
        isVisible: true,
        path: await this.buildPath(issue.id, issue.parentIssueId)
      };
      
      nodes.push(node);
    }
    
    return nodes;
  }

  private mapIssueStatus(status: string): string {
    // Map database status to WBS status enum
    switch (status?.toUpperCase()) {
      case 'TODO': return 'TODO';
      case 'IN_PROGRESS': return 'IN_PROGRESS';
      case 'DONE': return 'DONE';
      case 'CANCELLED': return 'CANCELLED';
      default: return 'TODO';
    }
  }

  private async buildPath(issueId: string, parentIssueId: string | null): Promise<string[]> {
    const path = [issueId];
    
    if (parentIssueId) {
      const parent = await this.prisma.issue.findUnique({
        where: { id: parentIssueId },
        select: { id: true, parentIssueId: true, title: true }
      });
      
      if (parent) {
        const parentPath = await this.buildPath(parent.id, parent.parentIssueId);
        path.unshift(...parentPath.slice(0, -1)); // Remove the duplicate issueId
      }
    }
    
    return path;
  }

  private countTotalNodes(nodes: any[]): number {
    let count = nodes.length;
    for (const node of nodes) {
      count += this.countTotalNodes(node.children || []);
    }
    return count;
  }

  private calculateMaxDepth(nodes: any[], currentDepth: number = 0): number {
    let maxDepth = currentDepth;
    for (const node of nodes) {
      const childDepth = this.calculateMaxDepth(node.children || [], currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
    return maxDepth;
  }

  private countVisibleNodes(nodes: any[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.isVisible) {
        count++;
      }
      if (node.isExpanded) {
        count += this.countVisibleNodes(node.children || []);
      }
    }
    return count;
  }

  async update(id: string, data: UpdateProjectDto) {
    const project = await this.findOne(id); // Validates existence
    
    return this.prisma.project.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Validates existence
    
    return this.prisma.project.delete({
      where: { id }
    });
  }

  // Password management methods with enhanced validation
  async setProjectPassword(id: string, passwordDto: ProjectPasswordDto) {
    const project = await this.findOne(id); // Validates existence

    if (project.visibility !== 'password') {
      throw new BadRequestException('Project must have password visibility to set a password');
    }

    // AC4: Enhanced password validation is handled by DTO validation
    const passwordHash = await this.hashPassword(passwordDto.password);
    
    return this.prisma.project.update({
      where: { id },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Don't return passwordHash
      }
    });
  }

  /**
   * Enhanced authentication with rate limiting, session management, and activity logging
   */
  async authenticateProjectAccess(
    id: string, 
    accessDto: ProjectAccessDto, 
    clientId: string
  ): Promise<ProjectAccessResponseDto> {
    // AC6: Check for admin override token first
    if (accessDto.overrideToken) {
      const isValidOverride = await this.projectAuthService.validateAdminOverride(id, accessDto.overrideToken);
      if (isValidOverride) {
        // Create session for admin override
        const sessionInfo = await this.projectAuthService.createSession(id, clientId);
        await this.projectAuthService.logAuthenticationEvent(id, clientId, 'login_success', {
          type: 'admin_override',
          overrideToken: accessDto.overrideToken.substring(0, 20) + '...'
        });
        
        return {
          accessToken: sessionInfo.accessToken,
          expiresAt: sessionInfo.expiresAt.getTime(),
          refreshToken: sessionInfo.refreshToken,
          refreshExpiresAt: sessionInfo.refreshExpiresAt.getTime()
        };
      }
    }

    // AC1: Enhanced rate limiting with exponential backoff
    const rateLimitResult = await this.projectAuthService.checkRateLimit(clientId, id);
    if (!rateLimitResult.allowed) {
      // AC3: Log lockout event
      await this.projectAuthService.logAuthenticationEvent(id, clientId, 'lockout', {
        attemptsRemaining: rateLimitResult.attemptsRemaining,
        lockedUntil: rateLimitResult.lockedUntil?.toISOString(),
        nextAttemptIn: rateLimitResult.nextAttemptIn
      });

      throw new HttpException({
        message: 'Too many password attempts. Account locked.',
        error: 'Too Many Requests',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        attemptsRemaining: rateLimitResult.attemptsRemaining,
        lockedUntil: rateLimitResult.lockedUntil?.toISOString(),
        nextAttemptIn: rateLimitResult.nextAttemptIn
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Get project and validate
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        visibility: true,
        passwordHash: true,
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.visibility !== 'password') {
      throw new BadRequestException('Project does not require password authentication');
    }

    if (!project.passwordHash) {
      throw new BadRequestException('Project password not set');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(accessDto.password, project.passwordHash);
    if (!isValidPassword) {
      // AC3: Log failed attempt
      await this.projectAuthService.logAuthenticationEvent(id, clientId, 'login_failure', {
        attemptsRemaining: rateLimitResult.attemptsRemaining - 1
      });
      
      throw new ForbiddenException('Invalid password');
    }

    // AC2: Create session with refresh token capability
    const sessionInfo = await this.projectAuthService.createSession(id, clientId);
    
    // AC3: Log successful authentication
    await this.projectAuthService.logAuthenticationEvent(id, clientId, 'login_success', {
      sessionId: sessionInfo.accessToken.substring(0, 20) + '...'
    });

    return {
      accessToken: sessionInfo.accessToken,
      expiresAt: sessionInfo.expiresAt.getTime(),
      refreshToken: sessionInfo.refreshToken,
      refreshExpiresAt: sessionInfo.refreshExpiresAt.getTime()
    };
  }

  /**
   * AC2: Refresh access token
   */
  async refreshProjectAccessToken(refreshToken: string): Promise<ProjectAccessResponseDto> {
    const sessionInfo = await this.projectAuthService.refreshAccessToken(refreshToken);
    
    // Log token refresh
    await this.projectAuthService.logAuthenticationEvent(
      sessionInfo.accessToken.split(':')[0], // Extract project ID from token
      'system', 
      'token_refresh'
    );

    return {
      accessToken: sessionInfo.accessToken,
      expiresAt: sessionInfo.expiresAt.getTime(),
      refreshToken: sessionInfo.refreshToken,
      refreshExpiresAt: sessionInfo.refreshExpiresAt.getTime()
    };
  }

  /**
   * AC5: Secure logout with token blacklisting
   */
  async logoutProjectAccess(accessToken: string, refreshToken?: string): Promise<void> {
    // Extract project and client info from token for logging
    let projectId: string = '';
    let clientId: string = '';
    
    try {
      const tokenInfo = await this.projectAuthService.verifyAccessToken(accessToken);
      projectId = tokenInfo.projectId;
      clientId = tokenInfo.clientId;
    } catch (error) {
      // Token might be invalid, but still try to blacklist it
    }

    await this.projectAuthService.logout(accessToken, refreshToken, clientId, projectId);
  }

  /**
   * AC6: Create admin override token for emergency access
   */
  async createAdminOverride(projectId: string, adminUserId: string, reason: string, expirationHours?: number): Promise<string> {
    // Validate project exists
    await this.findOne(projectId);
    
    return this.projectAuthService.createAdminOverride(projectId, adminUserId, reason, expirationHours);
  }

  // Password hashing functionality using Argon2id
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 32768,    // 32MB
      timeCost: 3,          // 3 iterations
      parallelism: 1,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      // Log error for security monitoring
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Get all dependencies in a project
   */
  async getProjectDependencies(projectId: string): Promise<DependencyResponseDto[]> {
    // Validate project exists
    await this.findOne(projectId);

    const dependencies = await this.prisma.dependency.findMany({
      where: { projectId },
      include: {
        predecessor: {
          select: { id: true, title: true, status: true }
        },
        successor: {
          select: { id: true, title: true, status: true }
        }
      },
      orderBy: [
        { predecessorId: 'asc' },
        { successorId: 'asc' }
      ]
    });

    return dependencies.map(dependency => ({
      id: dependency.id,
      projectId: dependency.projectId,
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type,
      lag: dependency.lag,
      createdAt: dependency.createdAt.toISOString(),
      updatedAt: dependency.updatedAt.toISOString()
    }));
  }

  /**
   * Create a new dependency between tasks in a project
   */
  async createDependency(projectId: string, createDto: CreateDependencyDto, userId?: string): Promise<DependencyResponseDto> {
    // Validate project exists and user has access
    await this.findOne(projectId, userId);

    const { predecessorId, successorId, type = 'FS', lag = 0 } = createDto;

    return await this.prisma.$transaction(async (tx) => {
      // Check if predecessor and successor issues exist and belong to the project
      const [predecessor, successor] = await Promise.all([
        tx.issue.findFirst({
          where: { 
            id: predecessorId,
            projectId: projectId,
            deletedAt: null
          }
        }),
        tx.issue.findFirst({
          where: { 
            id: successorId,
            projectId: projectId,
            deletedAt: null
          }
        })
      ]);

      if (!predecessor) {
        throw new NotFoundException('Predecessor issue not found in project');
      }
      if (!successor) {
        throw new NotFoundException('Successor issue not found in project');
      }

      // Check if dependency already exists
      const existingDependency = await tx.dependency.findUnique({
        where: {
          projectId_predecessorId_successorId_type: {
            projectId: projectId,
            predecessorId: predecessor.id,
            successorId: successor.id,
            type: type
          }
        }
      });

      if (existingDependency) {
        throw new ConflictException('Dependency already exists between these issues');
      }

      // Check for circular dependency
      const wouldCreateCircularDependency = await this.checkCircularDependency(
        tx, 
        projectId,
        predecessor.id,
        successor.id
      );

      if (wouldCreateCircularDependency) {
        throw new ConflictException('Creating this dependency would create a circular dependency');
      }

      // Create the dependency
      const dependency = await tx.dependency.create({
        data: {
          projectId: projectId,
          predecessorId: predecessor.id,
          successorId: successor.id,
          type: type,
          lag: lag
        }
      });

      // Log the activity
      await this.logDependencyActivity(tx, 'CREATED', dependency, userId);

      return {
        id: dependency.id,
        projectId: dependency.projectId,
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: dependency.type,
        lag: dependency.lag,
        createdAt: dependency.createdAt.toISOString(),
        updatedAt: dependency.updatedAt.toISOString()
      };
    });
  }

  /**
   * Delete a dependency by ID
   */
  async deleteDependency(dependencyId: string, userId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // First, find the dependency and verify it exists
      const dependency = await tx.dependency.findUnique({
        where: { id: dependencyId },
        include: {
          project: {
            select: {
              id: true,
              visibility: true,
              members: userId ? {
                where: { userId: userId },
                select: { role: true, isActive: true }
              } : undefined
            }
          }
        }
      });

      if (!dependency) {
        throw new NotFoundException('Dependency not found');
      }

      // Check access permissions for private projects
      if (dependency.project.visibility === 'private') {
        if (!userId) {
          throw new ForbiddenException('Access denied. Project is private.');
        }
        const membership = dependency.project.members?.[0];
        if (!membership?.isActive) {
          throw new ForbiddenException('Access denied. You are not a member of this project.');
        }
      }

      // Log the activity before deletion
      await this.logDependencyActivity(tx, 'DELETED', dependency, userId);

      // Delete the dependency
      await tx.dependency.delete({
        where: { id: dependencyId }
      });
    });
  }

  /**
   * Check if creating a dependency would create a circular dependency
   */
  private async checkCircularDependency(
    tx: any,
    projectId: string,
    newPredecessorId: string,
    newSuccessorId: string
  ): Promise<boolean> {
    // Use depth-first search to check if there's already a path from newSuccessorId to newPredecessorId
    const visited = new Set<string>();
    
    const hasPath = async (fromIssueId: string, toIssueId: string): Promise<boolean> => {
      if (fromIssueId === toIssueId) return true;
      if (visited.has(fromIssueId)) return false;
      
      visited.add(fromIssueId);
      
      // Get all successors of the current issue
      const dependencies = await tx.dependency.findMany({
        where: {
          projectId: projectId,
          predecessorId: fromIssueId
        },
        select: { successorId: true }
      });
      
      for (const dep of dependencies) {
        if (await hasPath(dep.successorId, toIssueId)) {
          return true;
        }
      }
      
      return false;
    };
    
    return await hasPath(newSuccessorId, newPredecessorId);
  }

  /**
   * Log dependency activity to ActivityLog
   */
  private async logDependencyActivity(tx: any, action: string, dependency: any, userId?: string) {
    try {
      await tx.activityLog.create({
        data: {
          entityType: 'DEPENDENCY',
          entityId: dependency.id,
          action: action,
          details: {
            projectId: dependency.projectId,
            predecessorId: dependency.predecessorId,
            successorId: dependency.successorId,
            type: dependency.type,
            lag: dependency.lag
          },
          userId: userId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to log dependency activity:', error);
    }
  }
}