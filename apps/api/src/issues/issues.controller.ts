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
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto, BulkUpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssueDto } from './dto/query-issue.dto';
import { IssueResponseDto, PaginatedIssueResponseDto, BulkOperationResponseDto } from './dto/issue-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new issue' })
  @ApiResponse({
    status: 201,
    description: 'Issue created successfully',
    type: IssueResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized'
  })
  async create(
    @Body() createIssueDto: CreateIssueDto,
    @Request() req: any
  ): Promise<IssueResponseDto> {
    return this.issuesService.create(createIssueDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get issues with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Issues retrieved successfully',
    type: PaginatedIssueResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid query parameters'
  })
  async findAll(
    @Query() queryDto: QueryIssueDto
  ): Promise<PaginatedIssueResponseDto> {
    return this.issuesService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get issue by ID' })
  @ApiResponse({
    status: 200,
    description: 'Issue retrieved successfully',
    type: IssueResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    description: 'Include deleted issues',
    type: Boolean
  })
  async findOne(
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted?: boolean
  ): Promise<IssueResponseDto> {
    return this.issuesService.findOne(id, includeDeleted);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update issue by ID' })
  @ApiResponse({
    status: 200,
    description: 'Issue updated successfully',
    type: IssueResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed'
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - issue was modified by another user'
  })
  async update(
    @Param('id') id: string,
    @Body() updateIssueDto: UpdateIssueDto,
    @Request() req: any
  ): Promise<IssueResponseDto> {
    return this.issuesService.update(id, updateIssueDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete issue by ID' })
  @ApiResponse({
    status: 204,
    description: 'Issue deleted successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot delete issue with children'
  })
  @ApiResponse({
    status: 404,
    description: 'Issue not found'
  })
  async remove(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<void> {
    await this.issuesService.remove(id, req.user.id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk operations on issues' })
  @ApiResponse({
    status: 200,
    description: 'Bulk operations completed',
    type: BulkOperationResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed'
  })
  async bulkUpdate(
    @Body() operations: BulkUpdateIssueDto[],
    @Request() req: any
  ): Promise<BulkOperationResponseDto> {
    return this.issuesService.bulkUpdate(operations, req.user.id);
  }

  @Get(':id/children')
  @ApiOperation({ summary: 'Get child issues' })
  @ApiResponse({
    status: 200,
    description: 'Child issues retrieved successfully',
    type: [IssueResponseDto]
  })
  async getChildren(
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted?: boolean
  ): Promise<IssueResponseDto[]> {
    const queryDto: QueryIssueDto = {
      includeDeleted: includeDeleted,
      limit: 1000, // High limit for children
      sortBy: 'createdAt',
      sortOrder: 'asc'
    };

    // Find all children recursively
    const result = await this.issuesService.findAll({
      ...queryDto,
      // Note: This is a simplified implementation
      // In production, you might want to add a specific method for hierarchical queries
    });

    return result.items.filter(issue => issue.parentIssueId === id);
  }

  @Get('projects/:projectId/hierarchy')
  @ApiOperation({ summary: 'Get project issues hierarchy' })
  @ApiResponse({
    status: 200,
    description: 'Project hierarchy retrieved successfully',
    type: [IssueResponseDto]
  })
  async getProjectHierarchy(
    @Param('projectId') projectId: string,
    @Query('includeDeleted') includeDeleted?: boolean
  ): Promise<IssueResponseDto[]> {
    const queryDto: QueryIssueDto = {
      projectId,
      includeDeleted: includeDeleted,
      limit: 1000, // High limit for full project
      sortBy: 'createdAt',
      sortOrder: 'asc'
    };

    const result = await this.issuesService.findAll(queryDto);
    return result.items;
  }
}