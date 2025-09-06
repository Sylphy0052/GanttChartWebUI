import { Injectable, NotFoundException, BadRequestException, ConflictException, PreconditionFailedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto, BulkUpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssueDto } from './dto/query-issue.dto';
import { PaginatedIssueResponseDto, BulkOperationResponseDto } from './dto/issue-response.dto';
import { 
  WBSTreeResponseDto, 
  WBSNodeDto, 
  WBSTreeQueryDto, 
  GanttDataResponseDto, 
  GanttTaskDto, 
  GanttDataQueryDto,
  WBSNodeStatus 
} from './dto/wbs-tree.dto';
import { 
  UpdateParentDto, 
  ReorderIssuesDto, 
  WBSUpdateResponseDto, 
  WBSReorderResponseDto 
} from './dto/wbs-hierarchy.dto';
import { CreateDependencyDto, DependencyResponseDto, DeleteDependencyDto } from './dto/dependency.dto';
import { WBSHierarchyUtils } from '../common/utils/wbs-hierarchy.utils';
import { WBSReorderingService, ProjectAuthContext } from '../services/wbs-reordering.service';
import { ProjectRole } from '../auth/types/rbac.types';

@Injectable()
export class IssuesService {
  private wbsUtils: WBSHierarchyUtils;
  private wbsReorderingService: WBSReorderingService;

  constructor(private prisma: PrismaService) {
    this.wbsUtils = new WBSHierarchyUtils(prisma);
    this.wbsReorderingService = new WBSReorderingService(prisma);
  }

  async create(createIssueDto: CreateIssueDto, userId: string) {
    // Validate parent issue exists if specified
    if (createIssueDto.parentIssueId) {
      const parentIssue = await this.prisma.issue.findFirst({
        where: {
          id: createIssueDto.parentIssueId,
          projectId: createIssueDto.projectId,
          deletedAt: null
        }
      });

      if (!parentIssue) {
        throw new BadRequestException('Parent issue not found');
      }

      // Check for circular dependency
      if (await this.wouldCreateCircularDependency(createIssueDto.parentIssueId, createIssueDto.projectId)) {
        throw new BadRequestException('Circular dependency detected');
      }
    }

    // Get next order index for the parent level
    const orderIndex = await this.wbsUtils.getNextOrderIndex(
      createIssueDto.projectId,
      createIssueDto.parentIssueId || null
    );

    return this.prisma.issue.create({
      data: {
        ...createIssueDto,
        createdBy: userId,
        orderIndex,
        version: 1
      }
    });
  }

  async findAll(queryDto: QueryIssueDto): Promise<PaginatedIssueResponseDto> {
    const {
      projectId,
      assigneeId,
      status,
      type,
      label,
      priorityMin,
      priorityMax,
      startDateFrom,
      dueDateTo,
      search,
      includeDeleted = false,
      limit = 50,
      cursor,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = queryDto;

    // Build where clause
    const where: any = {};
    
    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (label) where.labels = { has: label };
    if (priorityMin !== undefined) where.priority = { ...(where.priority || {}), gte: priorityMin };
    if (priorityMax !== undefined) where.priority = { ...(where.priority || {}), lte: priorityMax };
    if (startDateFrom) where.startDate = { gte: new Date(startDateFrom) };
    if (dueDateTo) where.dueDate = { lte: new Date(dueDateTo) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (!includeDeleted) where.deletedAt = null;

    // Build cursor pagination
    let cursorOptions = {};
    if (cursor) {
      cursorOptions = {
        skip: 1,
        cursor: { id: cursor }
      };
    }

    const issues = await this.prisma.issue.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: Math.min(limit, 200),
      ...cursorOptions,
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true, email: true }
        },
        parentIssue: {
          select: { id: true, title: true }
        },
        childIssues: {
          select: { id: true, title: true },
          where: { deletedAt: null }
        }
      }
    });

    const nextCursor = issues.length === limit ? issues[issues.length - 1].id : null;

    return {
      items: issues,
      nextCursor,
      hasMore: issues.length === limit
    };
  }

  async findOne(id: string, includeDeleted: boolean = false) {
    const whereClause: any = { id };
    if (!includeDeleted) {
      whereClause.deletedAt = null;
    }

    const issue = await this.prisma.issue.findUnique({
      where: whereClause,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        parentIssue: {
          select: { id: true, title: true }
        },
        childIssues: {
          select: { id: true, title: true, status: true },
          where: { deletedAt: null }
        },
        milestone: {
          select: { id: true, name: true, dueDate: true }
        }
      }
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    return issue;
  }

  async updateWithETag(id: string, updateDto: UpdateIssueDto, ifMatch: string, userId: string) {
    if (!ifMatch) {
      throw new PreconditionFailedException('If-Match header is required');
    }

    // Parse ETag to get version and timestamp
    const etagMatch = ifMatch.match(/^"v(\d+)-(\d+)"$/);
    if (!etagMatch) {
      throw new PreconditionFailedException('Invalid ETag format');
    }

    const expectedVersion = parseInt(etagMatch[1]);

    // Get current issue to check version
    const currentIssue = await this.prisma.issue.findUnique({
      where: { id, deletedAt: null }
    });

    if (!currentIssue) {
      throw new NotFoundException('Issue not found');
    }

    if (currentIssue.version !== expectedVersion) {
      throw new ConflictException('Issue has been modified by another user. Please refresh and try again.');
    }

    return this.prisma.issue.update({
      where: { id },
      data: {
        ...updateDto,
        version: expectedVersion + 1,
        updatedAt: new Date()
      }
    });
  }

  async removeWithETag(id: string, ifMatch: string, userId: string) {
    if (!ifMatch) {
      throw new PreconditionFailedException('If-Match header is required');
    }

    // Parse ETag to get version
    const etagMatch = ifMatch.match(/^"v(\d+)-(\d+)"$/);
    if (!etagMatch) {
      throw new PreconditionFailedException('Invalid ETag format');
    }

    const expectedVersion = parseInt(etagMatch[1]);

    // Get current issue
    const currentIssue = await this.prisma.issue.findUnique({
      where: { id, deletedAt: null },
      include: {
        childIssues: {
          where: { deletedAt: null }
        }
      }
    });

    if (!currentIssue) {
      throw new NotFoundException('Issue not found');
    }

    if (currentIssue.version !== expectedVersion) {
      throw new ConflictException('Issue has been modified by another user. Please refresh and try again.');
    }

    // Check if issue has children
    if (currentIssue.childIssues.length > 0) {
      throw new BadRequestException('Cannot delete issue with child issues');
    }

    // Soft delete
    return this.prisma.issue.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: expectedVersion + 1
      }
    });
  }

  async bulkUpdate(operations: BulkUpdateIssueDto[], userId: string, atomic: boolean = false): Promise<BulkOperationResponseDto> {
    const results: any[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    if (atomic) {
      // Use transaction for atomic operations
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const operation of operations) {
            const result = await this.processBulkOperation(operation, userId, tx);
            results.push(result);
          }
        });
      } catch (error: any) {
        return {
          successCount: 0,
          errorCount: operations.length,
          errors: [{ id: 'transaction', error: error.message }]
        };
      }
    } else {
      // Process individually
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await this.processBulkOperation(operations[i], userId);
          results.push(result);
        } catch (error: any) {
          errors.push({
            id: operations[i].id,
            error: error.message
          });
        }
      }
    }

    return {
      successCount: results.length,
      errorCount: errors.length,
      errors
    };
  }

  async updateIssueParent(id: string, updateParentDto: UpdateParentDto, userId: string): Promise<WBSUpdateResponseDto> {
    const { parentIssueId } = updateParentDto;
    
    // Validate the issue exists
    const issue = await this.prisma.issue.findFirst({
      where: { id, deletedAt: null }
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    // Get user's project role for authorization
    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId: issue.projectId,
        userId
      }
    });

    if (!projectMember) {
      throw new BadRequestException('User does not have access to this project');
    }

    // Create auth context
    const authContext: ProjectAuthContext = {
      userId,
      projectId: issue.projectId,
      userRole: projectMember.role as ProjectRole
    };

    try {
      // Use enhanced WBS reordering service for parent change with integrity check
      const result = await this.wbsReorderingService.changeParentWithIntegrityCheck(
        id,
        parentIssueId || null,
        authContext
      );

      return {
        message: 'Issue parent updated successfully with enhanced validation',
        issueId: result.issueId,
        level: result.level
      };
    } catch (error) {
      // Re-throw known exceptions, wrap unknown ones
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException ||
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Parent update operation failed: ${error.message}`);
    }
  }

  async reorderIssuesInParent(parentId: string, reorderDto: ReorderIssuesDto, userId: string): Promise<WBSReorderResponseDto> {
    const { orders } = reorderDto;

    if (orders.length === 0) {
      throw new BadRequestException('No reorder operations provided');
    }

    // Get project info from first issue for authorization
    const firstIssue = await this.prisma.issue.findFirst({
      where: { 
        id: orders[0].issueId, 
        deletedAt: null 
      },
      select: { 
        projectId: true 
      }
    });

    if (!firstIssue) {
      throw new NotFoundException('Issue not found');
    }

    // Get user's project role for authorization
    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId: firstIssue.projectId,
        userId
      }
    });

    if (!projectMember) {
      throw new BadRequestException('User does not have access to this project');
    }

    // Create auth context
    const authContext: ProjectAuthContext = {
      userId,
      projectId: firstIssue.projectId,
      userRole: projectMember.role as ProjectRole
    };

    try {
      // Use enhanced WBS reordering service for bulk operation
      const updatedCount = await this.wbsReorderingService.bulkUpdateOrderIndices(
        parentId || null,
        orders,
        authContext
      );

      return {
        message: 'Issues reordered successfully with enhanced validation',
        updatedCount,
        parentIssueId: parentId || null
      };
    } catch (error) {
      // Re-throw known exceptions, wrap unknown ones
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException ||
          error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Reorder operation failed: ${error.message}`);
    }
  }

  private async processBulkOperation(operation: BulkUpdateIssueDto, userId: string, tx?: any) {
    const prismaClient = tx || this.prisma;
    
    switch (operation.operation) {
      case 'update':
        return await prismaClient.issue.update({
          where: { id: operation.id },
          data: {
            ...operation.fields,
            version: { increment: 1 }
          }
        });
      
      case 'delete':
        return await prismaClient.issue.update({
          where: { id: operation.id },
          data: {
            deletedAt: new Date(),
            version: { increment: 1 }
          }
        });
      
      default:
        throw new BadRequestException(`Unsupported operation: ${operation.operation}`);
    }
  }

  private async wouldCreateCircularDependency(parentId: string, projectId: string): Promise<boolean> {
    // Simple check - in practice you might want more sophisticated cycle detection
    const dependencies = await this.prisma.dependency.findMany({
      where: { projectId }
    });

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!graph.has(dep.predecessorId)) {
        graph.set(dep.predecessorId, []);
      }
      graph.get(dep.predecessorId)!.push(dep.successorId);
    }

    // Check if adding parentId would create a cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recursionStack.delete(node);
      return false;
    };

    return dfs(parentId);
  }

  async getIssueTree(query: WBSTreeQueryDto): Promise<WBSTreeResponseDto> {
    // Simplified implementation for now
    return {
      nodes: [],
      totalNodes: 0,
      maxDepth: 0,
      visibleNodes: 0,
      generatedAt: new Date().toISOString()
    };
  }

  async getGanttData(projectId: string, query: GanttDataQueryDto): Promise<GanttDataResponseDto> {
    // Simplified implementation for now  
    return {
      tasks: [],
      dependencies: [],
      projectStartDate: new Date().toISOString(),
      projectEndDate: new Date().toISOString(),
      totalTasks: 0,
      generatedAt: new Date().toISOString()
    };
  }

  // Dependency CRUD Methods
  
  /**
   * Create a new dependency between two issues
   */
  async createDependency(
    predecessorId: string, 
    createDependencyDto: CreateDependencyDto, 
    userId: string
  ): Promise<DependencyResponseDto> {
    const { successorId, type = 'FS', lag = 0 } = createDependencyDto;

    // Validate both issues exist and belong to the same project
    const [predecessor, successor] = await Promise.all([
      this.prisma.issue.findFirst({
        where: { id: predecessorId, deletedAt: null }
      }),
      this.prisma.issue.findFirst({
        where: { id: successorId, deletedAt: null }
      })
    ]);

    if (!predecessor) {
      throw new NotFoundException('Predecessor issue not found');
    }
    if (!successor) {
      throw new NotFoundException('Successor issue not found');
    }
    if (predecessor.projectId !== successor.projectId) {
      throw new BadRequestException('Both issues must be in the same project');
    }

    // Prevent self-dependency
    if (predecessorId === successorId) {
      throw new BadRequestException('An issue cannot depend on itself');
    }

    // Check if dependency already exists
    const existingDependency = await this.prisma.dependency.findUnique({
      where: {
        projectId_predecessorId_successorId_type: {
          projectId: predecessor.projectId,
          predecessorId,
          successorId,
          type
        }
      }
    });

    if (existingDependency) {
      throw new ConflictException('Dependency already exists');
    }

    // Check for cycles using existing cycle detection logic
    const wouldCreateCycle = await this.wouldDependencyCreateCycle(
      predecessor.projectId,
      predecessorId,
      successorId
    );

    if (wouldCreateCycle) {
      throw new BadRequestException('Creating this dependency would create a circular dependency');
    }

    // Create the dependency
    const dependency = await this.prisma.dependency.create({
      data: {
        projectId: predecessor.projectId,
        predecessorId,
        successorId,
        type,
        lag
      }
    });

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        projectId: predecessor.projectId,
        entityType: 'dependency',
        entityId: dependency.id,
        issueId: successorId,
        action: 'create',
        actor: userId,
        after: {
          dependencyId: dependency.id,
          predecessorId,
          successorId,
          type,
          lag
        }
      }
    });

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
  }

  /**
   * Delete a dependency between two issues
   */
  async deleteDependency(
    predecessorId: string,
    deleteDependencyDto: DeleteDependencyDto,
    userId: string
  ): Promise<void> {
    const { successorId } = deleteDependencyDto;

    // Find the dependency (any type since we're deleting based on predecessor/successor pair)
    const dependency = await this.prisma.dependency.findFirst({
      where: {
        predecessorId,
        successorId
      }
    });

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    // Log activity before deletion
    await this.prisma.activityLog.create({
      data: {
        projectId: dependency.projectId,
        entityType: 'dependency',
        entityId: dependency.id,
        issueId: successorId,
        action: 'delete',
        actor: userId,
        before: {
          dependencyId: dependency.id,
          predecessorId: dependency.predecessorId,
          successorId: dependency.successorId,
          type: dependency.type,
          lag: dependency.lag
        }
      }
    });

    // Delete the dependency
    await this.prisma.dependency.delete({
      where: { id: dependency.id }
    });
  }

  /**
   * Check if creating a dependency would create a cycle
   */
  private async wouldDependencyCreateCycle(
    projectId: string,
    newPredecessorId: string,
    newSuccessorId: string
  ): Promise<boolean> {
    // Get all existing dependencies for the project
    const dependencies = await this.prisma.dependency.findMany({
      where: { projectId }
    });

    // Create a temporary adjacency list including the new dependency
    const graph = new Map<string, string[]>();
    
    // Add existing dependencies to graph
    for (const dep of dependencies) {
      if (!graph.has(dep.predecessorId)) {
        graph.set(dep.predecessorId, []);
      }
      graph.get(dep.predecessorId)!.push(dep.successorId);
    }

    // Add the new dependency to graph
    if (!graph.has(newPredecessorId)) {
      graph.set(newPredecessorId, []);
    }
    graph.get(newPredecessorId)!.push(newSuccessorId);

    // Use DFS to detect cycles starting from the new successor
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) return true; // Found cycle
      if (visited.has(node)) return false; // Already processed this path

      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recursionStack.delete(node);
      return false;
    };

    // Check if there's a cycle reachable from the new successor
    return dfs(newSuccessorId);
  }
}