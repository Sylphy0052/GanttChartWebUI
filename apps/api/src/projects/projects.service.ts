import { Injectable, NotFoundException, BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectPasswordDto, ProjectAccessDto } from './dto/project-access.dto';
import { WBSTreeResponseDto, WBSTreeQueryDto } from '../issues/dto/wbs-tree.dto';
import { DependencyResponseDto } from '../issues/dto/dependency.dto';
import { WBSHierarchyUtils } from '../common/utils/wbs-hierarchy.utils';
import * as argon2 from 'argon2';

@Injectable()
export class ProjectsService {
  // Rate limiting for password attempts
  private readonly attemptTracker = new Map<string, {count: number, resetAt: number}>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  private wbsUtils: WBSHierarchyUtils;

  constructor(private prisma: PrismaService) {
    this.wbsUtils = new WBSHierarchyUtils(prisma);
  }

  async create(data: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        visibility: data.visibility || 'private'
      }
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
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

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Don't return passwordHash
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
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

  // Password management methods
  async setProjectPassword(id: string, passwordDto: ProjectPasswordDto) {
    const project = await this.findOne(id); // Validates existence

    if (project.visibility !== 'password') {
      throw new BadRequestException('Project must have password visibility to set a password');
    }

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

  async authenticateProjectAccess(id: string, accessDto: ProjectAccessDto, clientId: string): Promise<{ accessToken: string; expiresAt: number }> {
    // Check rate limit first
    if (!this.checkRateLimit(clientId)) {
      const remainingAttempts = this.getRemainingAttempts(clientId);
      throw new HttpException(`Too many password attempts. Try again later. Remaining attempts: ${remainingAttempts}`, HttpStatus.TOO_MANY_REQUESTS);
    }
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

    const isValidPassword = await this.verifyPassword(accessDto.password, project.passwordHash);
    if (!isValidPassword) {
      this.recordFailedAttempt(clientId);
      throw new ForbiddenException('Invalid password');
    }

    // Generate simple access token (24-hour expiry)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    const accessToken = Buffer.from(`${project.id}:${expiresAt}`).toString('base64');

    return {
      accessToken,
      expiresAt
    };
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

  // Rate limiting methods
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const attempts = this.attemptTracker.get(clientId);
    
    if (!attempts || now > attempts.resetAt) {
      this.attemptTracker.set(clientId, {count: 1, resetAt: now + this.WINDOW_MS});
      return true;
    }
    
    if (attempts.count >= this.MAX_ATTEMPTS) {
      return false;
    }
    
    attempts.count++;
    return true;
  }

  recordFailedAttempt(clientId: string): void {
    // Failed attempts are already recorded in checkRateLimit
    // This method can be used for additional logging/monitoring
    console.warn(`Failed password attempt for client: ${clientId}`);
  }

  getRemainingAttempts(clientId: string): number {
    const now = Date.now();
    const attempts = this.attemptTracker.get(clientId);
    
    if (!attempts || now > attempts.resetAt) {
      return this.MAX_ATTEMPTS;
    }
    
    return Math.max(0, this.MAX_ATTEMPTS - attempts.count);
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
}