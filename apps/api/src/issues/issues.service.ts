import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto, BulkUpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssueDto } from './dto/query-issue.dto';
import { PaginatedIssueResponseDto, BulkOperationResponseDto } from './dto/issue-response.dto';
import { CreateDependencyDto, DependencyResponseDto, DeleteDependencyDto, DependencyType } from './dto/dependency.dto';
import {
  ProgressUpdateDto,
  ProgressBulkUpdateDto,
  ProgressResponseDto,
  ProgressBulkResponseDto
} from './dto/progress.dto';
import { Issue, User } from '@prisma/client';

// T032: Enhanced interface with dependency support
export interface IssueWithRelations extends Issue {
  parentIssue?: Issue | null;
  childIssues?: Issue[];
  assignee?: User | null;
  creator?: User;
  predecessors?: Array<{ id: string; predecessorId: string; type: string; lag: number; }>;
  successors?: Array<{ id: string; successorId: string; type: string; lag: number; }>;
}

@Injectable()
export class IssuesService {
  constructor(private prisma: PrismaService) {}

  // Basic CRUD operations
  async create(projectId: string, createIssueDto: CreateIssueDto, userId: string): Promise<IssueWithRelations> {
    await this.validateProjectExists(projectId);
    
    const issue = await this.prisma.issue.create({
      data: {
        projectId,
        title: createIssueDto.title,
        description: createIssueDto.description || '',
        status: createIssueDto.status || 'todo',
        type: createIssueDto.type || 'feature',
        priority: createIssueDto.priority || 5,
        estimateValue: createIssueDto.estimateValue || 1,
        estimateUnit: createIssueDto.estimateUnit || 'h',
        assigneeId: createIssueDto.assigneeId,
        parentIssueId: createIssueDto.parentIssueId,
        startDate: createIssueDto.startDate ? new Date(createIssueDto.startDate) : null,
        dueDate: createIssueDto.dueDate ? new Date(createIssueDto.dueDate) : null,
        labels: createIssueDto.labels || [],
        progress: createIssueDto.progress || 0,
        spent: 0,
        createdBy: userId,
        orderIndex: await this.getNextOrderIndex(projectId, createIssueDto.parentIssueId)
      },
      include: {
        parentIssue: true,
        childIssues: { where: { deletedAt: null } },
        assignee: true,
        creator: true,
        predecessors: true,
        successors: true
      }
    });

    return issue;
  }

  async findOne(projectId: string, id: string): Promise<IssueWithRelations> {
    const issue = await this.prisma.issue.findFirst({
      where: { id, projectId, deletedAt: null },
      include: { 
        parentIssue: true,
        childIssues: { where: { deletedAt: null } },
        assignee: true,
        creator: true,
        predecessors: { include: { predecessor: true } },
        successors: { include: { successor: true } }
      }
    });
    
    if (!issue) {
      throw new NotFoundException(`Issue not found: ${id}`);
    }
    
    return issue;
  }

  // T032 Core Feature: Enhanced dependency management with 4 types (FS/SS/SF/FF) + lag support
  async createDependency(projectId: string, createDependencyDto: CreateDependencyDto): Promise<DependencyResponseDto> {
    await this.validateProjectExists(projectId);

    const { predecessorId, successorId, type = DependencyType.FS, lag = 0 } = createDependencyDto;

    // Validate both issues exist
    const [predecessor, successor] = await Promise.all([
      this.prisma.issue.findFirst({ where: { id: predecessorId, projectId, deletedAt: null } }),
      this.prisma.issue.findFirst({ where: { id: successorId, projectId, deletedAt: null } })
    ]);

    if (!predecessor) throw new NotFoundException(`Predecessor issue not found: ${predecessorId}`);
    if (!successor) throw new NotFoundException(`Successor issue not found: ${successorId}`);
    if (predecessorId === successorId) throw new BadRequestException('An issue cannot depend on itself');

    // Check for existing dependency
    const existingDependency = await this.prisma.dependency.findFirst({
      where: { projectId, predecessorId, successorId, type: type as string }
    });

    if (existingDependency) {
      throw new ConflictException('Dependency relationship already exists');
    }

    // Validate no circular dependency
    if (await this.wouldCreateCircularDependencyGraph(predecessorId, successorId)) {
      throw new BadRequestException('Cannot create circular dependency relationship');
    }

    const dependency = await this.prisma.dependency.create({
      data: { projectId, predecessorId, successorId, type: type as string, lag }
    });

    return {
      id: dependency.id,
      projectId: dependency.projectId,
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type as DependencyType,
      lag: dependency.lag,
      createdAt: dependency.createdAt.toISOString(),
      updatedAt: dependency.updatedAt.toISOString()
    };
  }

  async removeDependency(projectId: string, deleteDependencyDto: DeleteDependencyDto): Promise<{ success: boolean; message: string }> {
    const dependency = await this.prisma.dependency.findFirst({
      where: { projectId, successorId: deleteDependencyDto.successorId },
      include: { predecessor: { select: { title: true } }, successor: { select: { title: true } } }
    });

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.prisma.dependency.delete({ where: { id: dependency.id } });

    return {
      success: true,
      message: `Dependency removed between "${dependency.predecessor.title}" and "${dependency.successor.title}"`
    };
  }

  async getDependencies(projectId: string): Promise<DependencyResponseDto[]> {
    await this.validateProjectExists(projectId);

    const dependencies = await this.prisma.dependency.findMany({
      where: { projectId },
      include: { predecessor: { select: { id: true, title: true } }, successor: { select: { id: true, title: true } } }
    });

    return dependencies.map(dependency => ({
      id: dependency.id,
      projectId: dependency.projectId,
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type as DependencyType,
      lag: dependency.lag,
      createdAt: dependency.createdAt.toISOString(),
      updatedAt: dependency.updatedAt.toISOString()
    }));
  }

  // Minimal placeholder methods - to be enhanced in future iterations
  async findAll(projectId: string, queryDto: QueryIssueDto): Promise<any> {
    return { issues: [], total: 0 };
  }

  async update(projectId: string, id: string, updateIssueDto: UpdateIssueDto, userId: string): Promise<IssueWithRelations> {
    return this.findOne(projectId, id);
  }

  async remove(projectId: string, id: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Removed' };
  }

  async bulkUpdate(projectId: string, bulkUpdateDto: BulkUpdateIssueDto, userId: string): Promise<any> {
    return { success: true };
  }

  async getWBSTree(projectId: string, queryDto?: any): Promise<any> {
    return { tree: [] };
  }

  async getGanttData(projectId: string, queryDto?: any): Promise<any> {
    return { tasks: [] };
  }

  async updateProgress(projectId: string, issueId: string, progressDto: ProgressUpdateDto, userId: string): Promise<ProgressResponseDto> {
    return { id: issueId, previousProgress: 0, newProgress: progressDto.progress, statusChanged: false, newStatus: 'todo', spentTotal: 0, updatedAt: new Date().toISOString() };
  }

  async bulkUpdateProgress(projectId: string, bulkProgressDto: ProgressBulkUpdateDto, userId: string): Promise<ProgressBulkResponseDto> {
    return { totalProcessed: 0, successCount: 0, failureCount: 0, results: [] };
  }

  // Utility methods
  private async validateProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }
  }

  private async getNextOrderIndex(projectId: string, parentIssueId?: string | null): Promise<number> {
    const maxOrder = await this.prisma.issue.findFirst({
      where: { projectId, parentIssueId: parentIssueId || null, deletedAt: null },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });
    return (maxOrder?.orderIndex || 0) + 1;
  }

  private async wouldCreateCircularDependencyGraph(predecessorId: string, successorId: string): Promise<boolean> {
    const predecessors = await this.getAllPredecessors(predecessorId);
    return predecessors.includes(successorId);
  }

  private async getAllPredecessors(issueId: string): Promise<string[]> {
    const predecessors: string[] = [];
    const directPredecessors = await this.prisma.dependency.findMany({
      where: { successorId: issueId },
      select: { predecessorId: true }
    });

    for (const dep of directPredecessors) {
      predecessors.push(dep.predecessorId);
      const indirectPredecessors = await this.getAllPredecessors(dep.predecessorId);
      predecessors.push(...indirectPredecessors);
    }

    return predecessors;
  }
}