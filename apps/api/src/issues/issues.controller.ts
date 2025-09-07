import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Res,
  ParseUUIDPipe,
  ValidationPipe,
  Put
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Response } from 'express';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto, BulkUpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssueDto } from './dto/query-issue.dto';
import { PaginatedIssueResponseDto, BulkOperationResponseDto } from './dto/issue-response.dto';
import { 
  WBSTreeResponseDto, 
  WBSTreeQueryDto, 
  GanttDataResponseDto, 
  GanttDataQueryDto
} from './dto/wbs-tree.dto';
import { 
  UpdateParentDto, 
  ReorderIssuesDto, 
  WBSUpdateResponseDto, 
  WBSReorderResponseDto 
} from './dto/wbs-hierarchy.dto';
import { 
  CreateDependencyDto, 
  DependencyResponseDto, 
  DeleteDependencyDto 
} from './dto/dependency.dto';
import {
  ProgressUpdateDto,
  BatchProgressUpdateDto,
  ProgressUpdateResponseDto,
  BatchProgressUpdateResponseDto
} from './dto/progress-update.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Issues')
@ApiBearerAuth()
@Controller('issues')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(
    private readonly issuesService: IssuesService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new issue' })
  @ApiResponse({
    status: 201,
    description: 'Issue created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        projectId: { type: 'string' },
        parentIssueId: { type: 'string' },
        assigneeId: { type: 'string' },
        priority: { type: 'number' },
        estimateValue: { type: 'number' },
        estimateUnit: { type: 'string' },
        version: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    headers: {
      ETag: {
        description: 'Entity tag for optimistic locking',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or business rules violated'
  })
  async create(
    @Body(ValidationPipe) createIssueDto: CreateIssueDto, 
    @Request() req: any,
    @Res() res: Response
  ) {
    const issue = await this.issuesService.create(createIssueDto, req.user.id);
    
    // Generate ETag from version and updatedAt
    const etag = this.generateETag(issue.version, issue.updatedAt);
    res.set('ETag', etag);
    
    return res.status(201).json(issue);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of issues with cursor pagination' })
  @ApiResponse({
    status: 200,
    description: 'Issues retrieved successfully',
    type: PaginatedIssueResponseDto
  })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'Filter by assignee ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by issue type' })
  @ApiQuery({ name: 'label', required: false, description: 'Filter by label' })
  @ApiQuery({ name: 'priorityMin', required: false, type: Number, description: 'Minimum priority (1-10)' })
  @ApiQuery({ name: 'priorityMax', required: false, type: Number, description: 'Maximum priority (1-10)' })
  @ApiQuery({ name: 'startDateFrom', required: false, description: 'Filter by start date from (ISO string)' })
  @ApiQuery({ name: 'dueDateTo', required: false, description: 'Filter by due date to (ISO string)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in title and description' })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean, description: 'Include deleted issues' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (max 200)', example: 50 })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'], description: 'Sort field', example: 'updatedAt' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order', example: 'desc' })
  async findAll(@Query(ValidationPipe) queryDto: QueryIssueDto): Promise<PaginatedIssueResponseDto> {
    return this.issuesService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get issue by ID with ETag support' })
  @ApiResponse({
    status: 200,
    description: 'Issue retrieved successfully',
    headers: {
      ETag: {
        description: 'Entity tag for optimistic locking',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean, description: 'Include deleted issues' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @Query('includeDeleted') includeDeleted?: boolean
  ) {
    const issue = await this.issuesService.findOne(id, includeDeleted);
    
    // Generate ETag from version and updatedAt
    const etag = this.generateETag(issue.version, issue.updatedAt);
    res.set('ETag', etag);
    
    return res.json(issue);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update issue with optimistic locking' })
  @ApiHeader({
    name: 'If-Match',
    description: 'ETag value for optimistic locking',
    required: true,
    schema: { type: 'string' }
  })
  @ApiResponse({
    status: 200,
    description: 'Issue updated successfully',
    headers: {
      ETag: {
        description: 'Updated entity tag',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - issue has been modified by another user'
  })
  @ApiResponse({
    status: 412,
    description: 'Precondition Failed - If-Match header missing or invalid'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed'
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateIssueDto: UpdateIssueDto,
    @Headers('if-match') ifMatch: string,
    @Request() req: any,
    @Res() res: Response
  ) {
    const updatedIssue = await this.issuesService.updateWithETag(id, updateIssueDto, ifMatch, req.user.id);
    
    // Generate new ETag
    const etag = this.generateETag(updatedIssue.version, updatedIssue.updatedAt);
    res.set('ETag', etag);
    
    return res.json(updatedIssue);
  }

  @Patch(':id/progress')
  @ApiOperation({ 
    summary: 'Update issue progress with leaf-task validation',
    description: 'Updates progress for leaf tasks only. Parent task progress is automatically calculated from children.'
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'ETag value for optimistic locking',
    required: true,
    schema: { type: 'string' }
  })
  @ApiResponse({
    status: 200,
    description: 'Progress updated successfully',
    type: ProgressUpdateResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot update progress on parent tasks or validation failed'
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - issue has been modified by another user'
  })
  @ApiResponse({
    status: 412,
    description: 'Precondition Failed - If-Match header missing or invalid'
  })
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) progressUpdateDto: ProgressUpdateDto,
    @Headers('if-match') ifMatch: string,
    @Request() req: any
  ): Promise<ProgressUpdateResponseDto> {
    return this.issuesService.updateProgress(id, progressUpdateDto, ifMatch, req.user.id);
  }

  @Post('progress/batch')
  @ApiOperation({ 
    summary: 'Batch update progress for multiple issues',
    description: 'Updates progress for multiple leaf tasks in a single transaction with automatic parent aggregation.'
  })
  @ApiResponse({
    status: 200,
    description: 'Batch progress update completed',
    type: BatchProgressUpdateResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or contains parent task updates'
  })
  async batchUpdateProgress(
    @Body(ValidationPipe) batchProgressUpdateDto: BatchProgressUpdateDto,
    @Request() req: any
  ): Promise<BatchProgressUpdateResponseDto> {
    return this.issuesService.batchUpdateProgress(batchProgressUpdateDto, req.user.id);
  }

  @Put(':id/parent')
  @ApiOperation({ summary: 'Update issue parent with hierarchy validation' })
  @ApiResponse({
    status: 200,
    description: 'Issue parent updated successfully',
    type: WBSUpdateResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid parent or would create cycle/exceed depth'
  })
  async updateParent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateParentDto: UpdateParentDto,
    @Request() req: any
  ): Promise<WBSUpdateResponseDto> {
    return this.issuesService.updateIssueParent(id, updateParentDto, req.user.id);
  }

  @Put(':id/reorder')
  @ApiOperation({ summary: 'Reorder issues within same parent level' })
  @ApiResponse({
    status: 200,
    description: 'Issues reordered successfully',
    type: WBSReorderResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid order data or issues not in same parent'
  })
  async reorderIssues(
    @Param('id', ParseUUIDPipe) parentId: string,
    @Body(ValidationPipe) reorderDto: ReorderIssuesDto,
    @Request() req: any
  ): Promise<WBSReorderResponseDto> {
    return this.issuesService.reorderIssuesInParent(parentId, reorderDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete issue (soft delete) with optimistic locking' })
  @ApiHeader({
    name: 'If-Match',
    description: 'ETag value for optimistic locking',
    required: true,
    schema: { type: 'string' }
  })
  @ApiResponse({
    status: 200,
    description: 'Issue deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot delete issue with children'
  })
  @ApiResponse({
    status: 412,
    description: 'Precondition Failed - If-Match header missing or invalid'
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string, 
    @Headers('if-match') ifMatch: string,
    @Request() req: any
  ) {
    await this.issuesService.removeWithETag(id, ifMatch, req.user.id);
    return { message: 'Issue deleted successfully' };
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update or delete multiple issues with atomic option' })
  @ApiQuery({ name: 'atomic', required: false, type: Boolean, description: 'If true, all operations succeed or all fail', example: true })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation completed',
    type: BulkOperationResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid operation or validation failed'
  })
  async bulkUpdate(
    @Body(ValidationPipe) operations: BulkUpdateIssueDto[],
    @Query('atomic') atomic: boolean = false,
    @Request() req: any
  ): Promise<BulkOperationResponseDto> {
    return this.issuesService.bulkUpdate(operations, req.user.id, atomic);
  }

  // Tree and Gantt Chart endpoints
  
  @Get('tree')
  @ApiOperation({ summary: 'Get WBS tree view of issues' })
  @ApiResponse({
    status: 200,
    description: 'WBS tree retrieved successfully',
    type: WBSTreeResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid query parameters'
  })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'maxDepth', required: false, type: Number, description: 'Maximum depth to expand' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks' })
  @ApiQuery({ name: 'expandLevel', required: false, type: Number, description: 'Default expand level' })
  async getWBSTree(@Query(ValidationPipe) query: WBSTreeQueryDto): Promise<WBSTreeResponseDto> {
    return this.issuesService.getIssueTree(query);
  }

  @Get('gantt')
  @ApiOperation({ summary: 'Get Gantt chart data' })
  @ApiResponse({
    status: 200,
    description: 'Gantt data retrieved successfully',
    type: GanttDataResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid query parameters'
  })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for data range (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for data range (ISO string)' })
  @ApiQuery({ name: 'includeDependencies', required: false, type: Boolean, description: 'Include task dependencies' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks' })
  async getGanttData(@Query(ValidationPipe) query: GanttDataQueryDto): Promise<GanttDataResponseDto> {
    // For simplified placeholder, pass empty projectId - this is just to match signature
    return this.issuesService.getGanttData(query.projectId || '', query);
  }

  @Get('projects/:projectId/tree')
  @ApiOperation({ summary: 'Get WBS tree for specific project' })
  @ApiResponse({
    status: 200,
    description: 'Project WBS tree retrieved successfully',
    type: WBSTreeResponseDto
  })
  @ApiQuery({ name: 'maxDepth', required: false, type: Number, description: 'Maximum depth to expand' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks' })
  @ApiQuery({ name: 'expandLevel', required: false, type: Number, description: 'Default expand level' })
  async getProjectWBSTree(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) query: Omit<WBSTreeQueryDto, 'projectId'>
  ): Promise<WBSTreeResponseDto> {
    return this.issuesService.getIssueTree({ ...query, projectId });
  }

  @Get('projects/:projectId/gantt')
  @ApiOperation({ summary: 'Get Gantt chart data for specific project' })
  @ApiResponse({
    status: 200,
    description: 'Project Gantt data retrieved successfully',
    type: GanttDataResponseDto
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for data range (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for data range (ISO string)' })
  @ApiQuery({ name: 'includeDependencies', required: false, type: Boolean, description: 'Include task dependencies' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks' })
  async getProjectGanttData(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) query: Omit<GanttDataQueryDto, 'projectId'>
  ): Promise<GanttDataResponseDto> {
    return this.issuesService.getGanttData(projectId, { ...query, projectId });
  }

  // Dependency CRUD endpoints
  
  @Post(':id/dependencies')
  @ApiOperation({ 
    summary: 'Create a dependency where the issue is the predecessor',
    description: 'Create a new Finish-to-Start (FS) dependency where the specified issue must be completed before the successor issue can start.'
  })
  @ApiResponse({
    status: 201,
    description: 'Dependency created successfully',
    type: DependencyResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed, circular dependency detected, or issues not in same project'
  })
  @ApiResponse({
    status: 404,
    description: 'Predecessor or successor issue not found'
  })
  @ApiResponse({
    status: 409,
    description: 'Dependency already exists'
  })
  async createDependency(
    @Param('id', ParseUUIDPipe) predecessorId: string,
    @Body(ValidationPipe) createDependencyDto: CreateDependencyDto,
    @Request() req: any
  ): Promise<DependencyResponseDto> {
    return this.issuesService.createDependency(predecessorId, createDependencyDto, req.user.id);
  }

  @Delete(':id/dependencies')
  @ApiOperation({ 
    summary: 'Delete a dependency where the issue is the predecessor',
    description: 'Remove a dependency relationship between the predecessor issue and a successor issue.'
  })
  @ApiResponse({
    status: 200,
    description: 'Dependency deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Dependency not found'
  })
  @HttpCode(HttpStatus.OK)
  async deleteDependency(
    @Param('id', ParseUUIDPipe) predecessorId: string,
    @Body(ValidationPipe) deleteDependencyDto: DeleteDependencyDto,
    @Request() req: any
  ): Promise<{ message: string }> {
    await this.issuesService.deleteDependency(predecessorId, deleteDependencyDto, req.user.id);
    return { message: 'Dependency deleted successfully' };
  }

  /**
   * Generate ETag from version and updatedAt timestamp
   * Format: "v{version}-{timestamp}"
   */
  private generateETag(version: number, updatedAt: Date): string {
    const timestamp = updatedAt.getTime();
    return `"v${version}-${timestamp}"`;
  }
}