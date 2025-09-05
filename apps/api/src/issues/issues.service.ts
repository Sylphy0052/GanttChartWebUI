import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
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

@Injectable()
export class IssuesService {
  constructor(private prisma: PrismaService) {}

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

    // Validate dates
    if (createIssueDto.startDate && createIssueDto.dueDate) {
      const startDate = new Date(createIssueDto.startDate);
      const dueDate = new Date(createIssueDto.dueDate);
      if (startDate > dueDate) {
        throw new BadRequestException('Start date must be before due date');
      }
    }

    const data = {
      ...createIssueDto,
      startDate: createIssueDto.startDate ? new Date(createIssueDto.startDate) : null,
      dueDate: createIssueDto.dueDate ? new Date(createIssueDto.dueDate) : null,
      description: createIssueDto.description || '',
      progress: createIssueDto.progress || 0,
      labels: createIssueDto.labels || [],
      spent: 0,
      version: 1,
    };

    return this.prisma.issue.create({ data });
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
      includeDeleted,
      limit,
      cursor,
      sortBy,
      sortOrder
    } = queryDto;

    const where: any = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (priorityMin || priorityMax) {
      where.priority = {};
      if (priorityMin) where.priority.gte = priorityMin;
      if (priorityMax) where.priority.lte = priorityMax;
    }

    if (startDateFrom) {
      where.startDate = { gte: new Date(startDateFrom) };
    }

    if (dueDateTo) {
      where.dueDate = { lte: new Date(dueDateTo) };
    }

    if (label) {
      where.labels = { has: label };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    let cursorCondition = {};
    if (cursor) {
      try {
        const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
        cursorCondition = { id: decodedCursor.id };
      } catch (error) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const safeLimitValue = limit ?? 10;
    const safeSortBy = sortBy ?? 'createdAt';
    
    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where: { ...where, ...cursorCondition },
        take: safeLimitValue + 1, // Take one extra to check if there are more items
        orderBy: { [safeSortBy]: sortOrder },
      }),
      this.prisma.issue.count({ where })
    ]);

    const hasMore = items.length > safeLimitValue;
    if (hasMore) {
      items.pop(); // Remove the extra item
    }

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64');
    }

    return {
      items,
      total,
      nextCursor,
      hasMore
    };
  }

  async findOne(id: string, includeDeleted: boolean = false) {
    const where: any = { id };
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    const issue = await this.prisma.issue.findUnique({ where });
    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    return issue;
  }

  async update(id: string, updateIssueDto: UpdateIssueDto, userId: string) {
    const existingIssue = await this.findOne(id);

    // Optimistic locking check
    if (updateIssueDto.version && existingIssue.version !== updateIssueDto.version) {
      throw new ConflictException('Issue has been modified by another user. Please refresh and try again.');
    }

    // Validate parent issue if changing
    if (updateIssueDto.parentIssueId !== undefined && updateIssueDto.parentIssueId !== existingIssue.parentIssueId) {
      if (updateIssueDto.parentIssueId) {
        const parentIssue = await this.prisma.issue.findFirst({
          where: {
            id: updateIssueDto.parentIssueId,
            projectId: existingIssue.projectId,
            deletedAt: null
          }
        });

        if (!parentIssue) {
          throw new BadRequestException('Parent issue not found');
        }

        // Check for circular dependency
        if (await this.wouldCreateCircularDependency(updateIssueDto.parentIssueId, existingIssue.projectId, id)) {
          throw new BadRequestException('Circular dependency detected');
        }
      }
    }

    // Validate dates
    const startDate = updateIssueDto.startDate ? new Date(updateIssueDto.startDate) : existingIssue.startDate;
    const dueDate = updateIssueDto.dueDate ? new Date(updateIssueDto.dueDate) : existingIssue.dueDate;
    
    if (startDate && dueDate && startDate > dueDate) {
      throw new BadRequestException('Start date must be before due date');
    }

    const updateData = {
      ...updateIssueDto,
      startDate: updateIssueDto.startDate ? new Date(updateIssueDto.startDate) : undefined,
      dueDate: updateIssueDto.dueDate ? new Date(updateIssueDto.dueDate) : undefined,
      version: existingIssue.version + 1,
    };

    // Remove undefined fields and version from update data
    const { version: _, ...cleanUpdateData } = updateData;
    Object.keys(cleanUpdateData).forEach(key => {
      if (cleanUpdateData[key as keyof typeof cleanUpdateData] === undefined) {
        delete cleanUpdateData[key as keyof typeof cleanUpdateData];
      }
    });

    return this.prisma.issue.update({
      where: { id },
      data: { ...cleanUpdateData, version: existingIssue.version + 1 }
    });
  }

  async remove(id: string, userId: string) {
    const issue = await this.findOne(id);
    
    // Check if issue has children
    const childrenCount = await this.prisma.issue.count({
      where: {
        parentIssueId: id,
        deletedAt: null
      }
    });

    if (childrenCount > 0) {
      throw new BadRequestException('Cannot delete issue with children. Delete or move children first.');
    }

    // Soft delete
    return this.prisma.issue.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: issue.version + 1
      }
    });
  }

  async bulkUpdate(operations: BulkUpdateIssueDto[], userId: string): Promise<BulkOperationResponseDto> {
    const results: BulkOperationResponseDto = {
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    for (const operation of operations) {
      try {
        switch (operation.operation) {
          case 'update':
            if (operation.fields) {
              await this.update(operation.id, operation.fields, userId);
            }
            break;
          case 'delete':
            await this.remove(operation.id, userId);
            break;
          default:
            throw new BadRequestException(`Unknown operation: ${operation.operation}`);
        }
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        results.errors.push({
          id: operation.id,
          error: error.message || 'Unknown error'
        });
      }
    }

    return results;
  }

  private async wouldCreateCircularDependency(
    parentId: string, 
    projectId: string, 
    excludeId?: string
  ): Promise<boolean> {
    const visited = new Set<string>();
    const stack = [parentId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (visited.has(currentId)) {
        continue;
      }
      
      visited.add(currentId);
      
      if (excludeId && currentId === excludeId) {
        return true;
      }

      const children = await this.prisma.issue.findMany({
        where: {
          parentIssueId: currentId,
          projectId,
          deletedAt: null
        },
        select: { id: true }
      });

      for (const child of children) {
        if (excludeId && child.id === excludeId) {
          return true;
        }
        stack.push(child.id);
      }
    }

    return false;
  }

  // WBS Tree Methods
  async getIssueTree(query: WBSTreeQueryDto): Promise<WBSTreeResponseDto> {
    const {
      projectId,
      maxDepth = 10,
      includeCompleted = true,
      expandLevel = 2
    } = query;

    // Build where clause
    const whereClause: any = {
      deletedAt: null
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (!includeCompleted) {
      whereClause.status = {
        not: 'done'
      };
    }

    // Get all issues with their relationships
    const issues = await this.prisma.issue.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { title: 'asc' }
      ]
    });

    // Build hierarchy tree
    const tree = this.buildWBSTree(issues, expandLevel, maxDepth);
    const stats = this.calculateTreeStats(tree);

    return {
      nodes: tree,
      totalNodes: stats.totalNodes,
      maxDepth: stats.maxDepth,
      visibleNodes: stats.visibleNodes,
      generatedAt: new Date().toISOString()
    };
  }

  async getGanttData(query: GanttDataQueryDto): Promise<GanttDataResponseDto> {
    const {
      projectId,
      startDate,
      endDate,
      includeDependencies = true,
      includeCompleted = true
    } = query;

    // Build where clause
    const whereClause: any = {
      deletedAt: null
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (startDate || endDate) {
      whereClause.OR = [];
      
      if (startDate) {
        whereClause.OR.push({
          startDate: {
            gte: new Date(startDate)
          }
        });
      }
      
      if (endDate) {
        whereClause.OR.push({
          dueDate: {
            lte: new Date(endDate)
          }
        });
      }
    }

    if (!includeCompleted) {
      whereClause.status = {
        not: 'done'
      };
    }

    // Get issues for gantt display
    const issues = await this.prisma.issue.findMany({
      where: whereClause,
      orderBy: [
        { startDate: 'asc' },
        { priority: 'desc' },
        { title: 'asc' }
      ]
    });

    // Convert to gantt tasks
    const tasks = this.convertToGanttTasks(issues);
    
    // Calculate project date range
    const dateRange = this.calculateProjectDateRange(tasks);

    // Dependencies would be fetched from a separate table in a real implementation
    const dependencies: any[] = []; // TODO: Implement dependency fetching

    return {
      tasks,
      dependencies,
      projectStartDate: dateRange.startDate.toISOString(),
      projectEndDate: dateRange.endDate.toISOString(),
      totalTasks: tasks.length,
      generatedAt: new Date().toISOString()
    };
  }

  private buildWBSTree(issues: any[], expandLevel: number, maxDepth: number): WBSNodeDto[] {
    const issueMap = new Map<string, any>();
    const roots: WBSNodeDto[] = [];

    // Create issue map for fast lookup
    issues.forEach(issue => {
      issueMap.set(issue.id, {
        ...issue,
        children: [],
        level: 0,
        hasChildren: issue.children.length > 0
      });
    });

    // Build tree structure
    issues.forEach(issue => {
      const node = issueMap.get(issue.id);
      
      if (issue.parentIssueId) {
        const parent = issueMap.get(issue.parentIssueId);
        if (parent) {
          parent.children.push(node);
          node.level = parent.level + 1;
        } else {
          // Orphaned node - add to roots
          roots.push(this.convertToWBSNode(node, [], expandLevel));
        }
      } else {
        roots.push(this.convertToWBSNode(node, [], expandLevel));
      }
    });

    // Convert to WBS nodes and apply hierarchy
    return this.processWBSNodes(roots, issueMap, expandLevel, maxDepth);
  }

  private processWBSNodes(
    nodes: any[], 
    issueMap: Map<string, any>, 
    expandLevel: number, 
    maxDepth: number,
    currentLevel: number = 0
  ): WBSNodeDto[] {
    return nodes.map((node, index) => {
      const wbsNode = this.convertToWBSNode(node, [node.id], expandLevel);
      wbsNode.level = currentLevel;
      wbsNode.order = index;
      wbsNode.isVisible = currentLevel <= maxDepth;

      if (node.children && node.children.length > 0) {
        wbsNode.children = this.processWBSNodes(
          node.children,
          issueMap,
          expandLevel,
          maxDepth,
          currentLevel + 1
        );
      }

      return wbsNode;
    });
  }

  private convertToWBSNode(issue: any, path: string[], expandLevel: number): WBSNodeDto {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description || undefined,
      parentId: issue.parentIssueId || undefined,
      projectId: issue.projectId,
      assigneeId: issue.assigneeId || undefined,
      status: this.mapIssueStatusToWBSStatus(issue.status),
      startDate: issue.startDate?.toISOString() || undefined,
      dueDate: issue.dueDate?.toISOString() || undefined,
      estimatedHours: issue.estimateValue * (issue.estimateUnit === 'h' ? 1 : 8),
      progress: issue.progress,
      version: issue.version,
      level: issue.level,
      order: 0, // Will be set during processing
      isExpanded: issue.level < expandLevel,
      children: [],
      hasChildren: issue.hasChildren,
      isVisible: true,
      path: path
    };
  }

  private convertToGanttTasks(issues: any[]): GanttTaskDto[] {
    return issues.map((issue, index) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description || undefined,
      parentId: issue.parentIssueId || undefined,
      startDate: (issue.startDate || new Date()).toISOString(),
      endDate: (issue.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).toISOString(),
      progress: issue.progress,
      status: this.mapIssueStatusToWBSStatus(issue.status),
      assigneeId: issue.assigneeId || undefined,
      assigneeName: undefined, // TODO: Fetch from user service
      estimatedHours: issue.estimateValue * (issue.estimateUnit === 'h' ? 1 : 8),
      actualHours: issue.spent || 0,
      level: 0, // Will be calculated based on hierarchy
      order: index,
      color: this.getTaskColorByStatus(issue.status, issue.type)
    }));
  }

  private mapIssueStatusToWBSStatus(status: string): WBSNodeStatus {
    const statusMap: Record<string, WBSNodeStatus> = {
      'todo': WBSNodeStatus.TODO,
      'doing': WBSNodeStatus.IN_PROGRESS,
      'blocked': WBSNodeStatus.IN_PROGRESS,
      'review': WBSNodeStatus.IN_PROGRESS,
      'done': WBSNodeStatus.DONE
    };
    
    return statusMap[status.toLowerCase()] || WBSNodeStatus.TODO;
  }

  private getTaskColorByStatus(status: string, type: string): string {
    const statusColors: Record<string, string> = {
      todo: '#94a3b8',      // gray
      doing: '#3b82f6',     // blue  
      blocked: '#ef4444',   // red
      review: '#f59e0b',    // amber
      done: '#10b981'       // emerald
    };

    const typeColors: Record<string, string> = {
      feature: '#8b5cf6',   // violet
      bug: '#ef4444',       // red
      spike: '#06b6d4',     // cyan
      chore: '#6b7280'      // gray
    };

    return statusColors[status.toLowerCase()] || typeColors[type?.toLowerCase()] || '#6b7280';
  }

  private calculateProjectDateRange(tasks: GanttTaskDto[]): { startDate: Date; endDate: Date } {
    if (tasks.length === 0) {
      const now = new Date();
      return {
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      };
    }

    const startDates = tasks.map(task => new Date(task.startDate).getTime());
    const endDates = tasks.map(task => new Date(task.endDate).getTime());
    
    const minStart = Math.min(...startDates);
    const maxEnd = Math.max(...endDates);
    
    const totalDuration = maxEnd - minStart;
    const paddingTime = totalDuration * 0.1; // 10% padding
    
    return {
      startDate: new Date(minStart - paddingTime),
      endDate: new Date(maxEnd + paddingTime)
    };
  }

  private calculateTreeStats(nodes: WBSNodeDto[]): {
    totalNodes: number;
    maxDepth: number;
    visibleNodes: number;
  } {
    let totalNodes = 0;
    let maxDepth = 0;
    let visibleNodes = 0;

    const traverse = (nodeList: WBSNodeDto[], depth: number) => {
      nodeList.forEach(node => {
        totalNodes++;
        maxDepth = Math.max(maxDepth, depth);
        
        if (node.isVisible) {
          visibleNodes++;
        }
        
        if (node.children && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      });
    };

    traverse(nodes, 0);

    return { totalNodes, maxDepth: maxDepth + 1, visibleNodes };
  }
}