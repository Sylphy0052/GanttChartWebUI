import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Put, 
  Patch,
  Query, 
  Headers,
  ValidationPipe,
  Request,
  Res,
  HttpCode,
  ParseUUIDPipe,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto, BulkUpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssueDto } from './dto/query-issue.dto';
import { 
  PaginatedIssueResponseDto, 
  BulkOperationResponseDto 
} from './dto/issue-response.dto';
import { 
  WBSTreeResponseDto, 
  WBSTreeQueryDto, 
  GanttDataResponseDto, 
  GanttDataQueryDto 
} from './dto/wbs-tree.dto';
import { 
  CreateDependencyDto, 
  DependencyResponseDto, 
  DeleteDependencyDto 
} from './dto/dependency.dto';
import {
  ProgressUpdateDto,
  ProgressBulkUpdateDto,
  ProgressResponseDto,
  ProgressBulkResponseDto
} from './dto/progress.dto';
import { Response } from 'express';

@ApiTags('issues')
@Controller('projects/:projectId/issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new issue',
    description: 'Create a new issue with hierarchical WBS support and optimistic locking'
  })
  @ApiResponse({
    status: 201,
    description: 'Issue created successfully',
    headers: {
      'ETag': {
        description: 'Resource version for optimistic locking',
        schema: { type: 'string' }
      },
      'Location': {
        description: 'URL of the created issue',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or business rules violated'
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) createIssueDto: CreateIssueDto, 
    @Request() req: any,
    @Res() res: Response
  ) {
    const issue = await this.issuesService.create(projectId, createIssueDto, req.user?.id || 'system');
    
    // Generate ETag from version and updatedAt
    const etag = this.generateETag(issue.version, issue.updatedAt);
    res.set('ETag', etag);
    res.set('Location', `/api/projects/${projectId}/issues/${issue.id}`);
    
    return res.status(201).json(issue);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of issues with cursor pagination' })
  @ApiResponse({
    status: 200,
    description: 'Issues retrieved successfully',
    type: PaginatedIssueResponseDto
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) queryDto: QueryIssueDto
  ): Promise<PaginatedIssueResponseDto> {
    return this.issuesService.findAll(projectId, queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get issue by ID with ETag support' })
  @ApiResponse({
    status: 200,
    description: 'Issue retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  async findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('If-None-Match') ifNoneMatch?: string,
    @Res() res?: Response
  ) {
    const issue = await this.issuesService.findOne(projectId, id);
    
    const etag = this.generateETag(issue.version, issue.updatedAt);
    
    // Handle conditional request
    if (ifNoneMatch === etag) {
      return res?.status(304).end();
    }
    
    if (res) {
      res.set('ETag', etag);
      res.set('Cache-Control', 'private, max-age=60');
      return res.json(issue);
    }
    
    return issue;
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update issue with optimistic locking',
    description: 'Update issue using ETag for optimistic concurrency control'
  })
  @ApiResponse({
    status: 200,
    description: 'Issue updated successfully'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Resource was modified by another user'
  })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateIssueDto: UpdateIssueDto,
    @Headers('If-Match') ifMatch: string,
    @Request() req: any,
    @Res() res: Response
  ) {
    const updatedIssue = await this.issuesService.update(projectId, id, updateIssueDto, req.user?.id || 'system');
    
    const newETag = this.generateETag(updatedIssue.version, updatedIssue.updatedAt);
    res.set('ETag', newETag);
    
    return res.json(updatedIssue);
  }

  @Patch(':id/progress')
  @ApiOperation({ 
    summary: 'Update issue progress',
    description: 'Update progress with automatic status transitions and spent time tracking'
  })
  @ApiResponse({
    status: 200,
    description: 'Progress updated successfully',
    type: ProgressResponseDto
  })
  async updateProgress(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) progressUpdateDto: ProgressUpdateDto,
    @Request() req?: any
  ): Promise<ProgressResponseDto> {
    return this.issuesService.updateProgress(projectId, id, progressUpdateDto, req?.user?.id || 'system');
  }

  @Patch('progress/bulk')
  @ApiOperation({ 
    summary: 'Bulk update progress for multiple issues',
    description: 'Efficiently update progress for multiple issues in a single request'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk progress update completed',
    type: ProgressBulkResponseDto
  })
  async bulkUpdateProgress(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) batchProgressUpdateDto: ProgressBulkUpdateDto,
    @Request() req: any
  ): Promise<ProgressBulkResponseDto> {
    return this.issuesService.bulkUpdateProgress(projectId, batchProgressUpdateDto, req?.user?.id || 'system');
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Soft delete issue',
    description: 'Move issue to trash (soft delete) with dependency validation'
  })
  @ApiResponse({
    status: 204,
    description: 'Issue deleted successfully'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Cannot delete issue with dependencies or children'
  })
  @HttpCode(204)
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    await this.issuesService.remove(projectId, id);
  }

  @Patch('bulk')
  @ApiOperation({ 
    summary: 'Bulk update multiple issues',
    description: 'Perform bulk operations on multiple issues atomically'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update completed',
    type: BulkOperationResponseDto
  })
  async bulkUpdate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) operations: BulkUpdateIssueDto,
    @Query('atomic') atomic: boolean = false,
    @Request() req: any
  ): Promise<BulkOperationResponseDto> {
    return this.issuesService.bulkUpdate(projectId, operations, req?.user?.id || 'system');
  }

  @Get('tree')
  @ApiOperation({ 
    summary: 'Get WBS tree structure',
    description: 'Retrieve hierarchical Work Breakdown Structure for all issues'
  })
  @ApiResponse({
    status: 200,
    description: 'WBS tree retrieved successfully',
    type: WBSTreeResponseDto
  })
  async getTree(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) query: WBSTreeQueryDto
  ): Promise<WBSTreeResponseDto> {
    return this.issuesService.getWBSTree(projectId, query);
  }

  @Get('gantt')
  @ApiOperation({ 
    summary: 'Get Gantt chart data',
    description: 'Retrieve optimized data structure for Gantt chart visualization with dependencies'
  })
  @ApiResponse({
    status: 200,
    description: 'Gantt data retrieved successfully',
    type: GanttDataResponseDto
  })
  async getGanttData(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) query: GanttDataQueryDto
  ): Promise<GanttDataResponseDto> {
    return this.issuesService.getGanttData(projectId, query);
  }

  // Dependency Management Endpoints

  @Post('dependencies')
  @ApiOperation({ 
    summary: 'Create issue dependency',
    description: 'Create dependency relationship between issues with T032 enhanced types (FS/SS/SF/FF + lag)'
  })
  @ApiResponse({
    status: 201,
    description: 'Dependency created successfully',
    type: DependencyResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - circular dependency or invalid relationship'
  })
  async createDependency(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) createDependencyDto: CreateDependencyDto
  ): Promise<DependencyResponseDto> {
    return this.issuesService.createDependency(projectId, createDependencyDto);
  }

  @Delete('dependencies')
  @ApiOperation({ 
    summary: 'Remove issue dependency',
    description: 'Remove dependency relationship between issues'
  })
  @ApiResponse({
    status: 200,
    description: 'Dependency removed successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Dependency not found'
  })
  async deleteDependency(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) deleteDependencyDto: DeleteDependencyDto
  ): Promise<{ success: boolean; message: string }> {
    return this.issuesService.removeDependency(projectId, deleteDependencyDto);
  }

  @Get('dependencies')
  @ApiOperation({ 
    summary: 'Get all dependencies for project',
    description: 'Retrieve all dependency relationships in the project'
  })
  @ApiResponse({
    status: 200,
    description: 'Dependencies retrieved successfully',
    type: [DependencyResponseDto]
  })
  async getDependencies(
    @Param('projectId', ParseUUIDPipe) projectId: string
  ): Promise<DependencyResponseDto[]> {
    return this.issuesService.getDependencies(projectId);
  }

  // Private utility methods

  private generateETag(version: number, updatedAt: Date): string {
    const timestamp = updatedAt.getTime();
    return `"${version}-${timestamp}"`;
  }

  private validateETag(ifMatch?: string): void {
    if (!ifMatch) {
      throw new BadRequestException('If-Match header is required for updates');
    }
    
    // Basic ETag format validation
    if (!ifMatch.match(/^"[\w-]+"$/)) {
      throw new BadRequestException('Invalid ETag format');
    }
  }
}