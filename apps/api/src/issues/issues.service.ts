import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto, BulkUpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssueDto } from './dto/query-issue.dto';
import { PaginatedIssueResponseDto, BulkOperationResponseDto } from './dto/issue-response.dto';

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

    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where: { ...where, ...cursorCondition },
        take: limit + 1, // Take one extra to check if there are more items
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.issue.count({ where })
    ]);

    const hasMore = items.length > limit;
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
      if (cleanUpdateData[key] === undefined) {
        delete cleanUpdateData[key];
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
}