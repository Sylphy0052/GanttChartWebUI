import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
  Request,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
  Res,
  Headers,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiHeader,
  ApiExcludeEndpoint
} from '@nestjs/swagger';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { 
  ProjectPasswordDto, 
  ProjectAccessDto, 
  ProjectAccessResponseDto,
  TokenRefreshDto,
  LogoutDto,
  AdminOverrideDto
} from './dto/project-access.dto';
import { WBSTreeResponseDto, WBSTreeQueryDto } from '../issues/dto/wbs-tree.dto';
import { DependencyResponseDto, CreateDependencyDto } from '../issues/dto/dependency.dto';
import { CreateIssueDto } from '../issues/dto/create-issue.dto';
import { QueryIssueDto } from '../issues/dto/query-issue.dto';
import { PaginatedIssueResponseDto } from '../issues/dto/issue-response.dto';
import { IssuesService } from '../issues/issues.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly issuesService: IssuesService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Project created successfully'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data'
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required'
  })
  async create(@Body() createProjectDto: CreateProjectDto, @Request() req: any) {
    try {
      return await this.projectsService.create(createProjectDto, req.user?.id);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Project with this name already exists');
      }
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects accessible by the user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Projects retrieved successfully'
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required'
  })
  async findAll(@Request() req: any) {
    return this.projectsService.findAll(req.user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project retrieved successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied'
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required'
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.projectsService.findOne(id, req.user?.id);
  }

  @Get(':id/gantt')
  @ApiOperation({ 
    summary: 'Get optimized Gantt chart schedule data',
    description: 'Retrieve pre-calculated schedule data from materialized view with ES/EF/LS/LF/TF values. Optimized for <200ms response time.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Gantt schedule data retrieved successfully with sub-200ms performance',
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', format: 'uuid' },
        schedule: {
          type: 'object',
          properties: {
            computedScheduleId: { type: 'string', format: 'uuid' },
            calculatedAt: { type: 'string', format: 'date-time' },
            algorithm: { type: 'string' },
            projectEndDate: { type: 'string', format: 'date-time' },
            totalDuration: { type: 'number' },
            criticalPath: { type: 'array', items: { type: 'string' } },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  taskId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  assigneeId: { type: 'string', format: 'uuid', nullable: true },
                  status: { type: 'string' },
                  progress: { type: 'number' },
                  earliestStartDate: { type: 'string', format: 'date-time' },
                  earliestFinishDate: { type: 'string', format: 'date-time' },
                  latestStartDate: { type: 'string', format: 'date-time' },
                  latestFinishDate: { type: 'string', format: 'date-time' },
                  totalFloat: { type: 'number', description: 'Total float time in days' },
                  criticalPath: { type: 'boolean' },
                  riskLevel: { type: 'string', enum: ['critical', 'near_critical', 'normal'] }
                }
              }
            }
          }
        },
        performance: {
          type: 'object',
          properties: {
            responseTime: { type: 'number' },
            cacheStatus: { type: 'string' },
            dataSource: { type: 'string', example: 'materialized_view' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found or no computed schedule available'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied'
  })
  async getGanttSchedule(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Query('includeHistory') includeHistory?: boolean,
    @Request() req: any
  ) {
    const startTime = Date.now();
    
    // Verify project access
    await this.projectsService.findOne(projectId, req.user?.id);
    
    // Get optimized schedule data from materialized view
    const scheduleData = await this.projectsService.getOptimizedGanttSchedule(
      projectId, 
      { includeHistory: includeHistory || false }
    );
    
    const responseTime = Date.now() - startTime;
    
    return {
      projectId,
      schedule: scheduleData.schedule,
      performance: {
        responseTime,
        cacheStatus: scheduleData.cacheStatus || 'materialized_view',
        dataSource: 'computed_schedule_view'
      }
    };
  }

  @Get(':id/issues')
  @ApiOperation({ summary: 'Get paginated list of issues for a specific project' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project issues retrieved successfully',
    type: PaginatedIssueResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied'
  })
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
  async getProjectIssues(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) queryDto: Omit<QueryIssueDto, 'projectId'>,
    @Request() req: any
  ): Promise<PaginatedIssueResponseDto> {
    // Verify project exists and user has access
    await this.projectsService.findOne(projectId, req.user?.id);
    
    // Add projectId to query and delegate to issues service
    const queryWithProjectId = { ...queryDto, projectId };
    return this.issuesService.findAll(queryWithProjectId);
  }

  @Post(':id/issues')
  @ApiOperation({ summary: 'Create a new issue for a specific project' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Issue created successfully for project',
    headers: {
      ETag: {
        description: 'Entity tag for optimistic locking',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - validation failed or business rules violated'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied'
  })
  async createProjectIssue(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) createIssueDto: Omit<CreateIssueDto, 'projectId'>,
    @Request() req: any,
    @Res() res: Response
  ) {
    // Verify project exists and user has access
    await this.projectsService.findOne(projectId, req.user?.id);
    
    // Add projectId to DTO and delegate to issues service
    const createIssueDtoWithProject = { ...createIssueDto, projectId };
    const issue = await this.issuesService.create(createIssueDtoWithProject, req.user.id);
    
    // Generate ETag from version and updatedAt
    const etag = this.generateETag(issue.version, issue.updatedAt);
    res.set('ETag', etag);
    
    return res.status(HttpStatus.CREATED).json(issue);
  }

  @Get(':id/wbs')
  @ApiOperation({ summary: 'Get WBS hierarchy tree for a project' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project WBS hierarchy retrieved successfully',
    type: WBSTreeResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - invalid query parameters'
  })
  @ApiQuery({ name: 'maxDepth', required: false, type: Number, description: 'Maximum depth to expand (default: 5)' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks (default: true)' })
  @ApiQuery({ name: 'expandLevel', required: false, type: Number, description: 'Default expand level (default: 2)' })
  async getProjectWBS(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Query(ValidationPipe) query: Omit<WBSTreeQueryDto, 'projectId'>
  ): Promise<WBSTreeResponseDto> {
    return this.projectsService.getProjectWBS(projectId, query);
  }

  @Get(':id/dependencies')
  @ApiOperation({ 
    summary: 'Get all dependencies in a project',
    description: 'Retrieve all task dependency relationships within a project, including both predecessor and successor information.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project dependencies retrieved successfully',
    type: [DependencyResponseDto]
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  async getProjectDependencies(
    @Param('id', ParseUUIDPipe) projectId: string
  ): Promise<DependencyResponseDto[]> {
    return this.projectsService.getProjectDependencies(projectId);
  }

  @Post(':id/dependencies')
  @ApiOperation({ 
    summary: 'Create a new dependency between tasks in a project',
    description: 'Create a Finish-to-Start (FS) dependency relationship between two issues in the project. The predecessor must finish before the successor can start.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Dependency created successfully',
    type: DependencyResponseDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - validation failed or business rules violated (e.g., circular dependency)'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found or one of the issues not found'
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Conflict - dependency already exists or would create circular dependency'
  })
  async createProjectDependency(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body(ValidationPipe) createDependencyDto: CreateDependencyDto,
    @Request() req: any
  ): Promise<DependencyResponseDto> {
    return this.projectsService.createDependency(projectId, createDependencyDto, req.user?.id);
  }

  @Delete('dependencies/:dependencyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete a dependency by ID',
    description: 'Remove a task dependency relationship. The user must have access to the project containing the dependency.'
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Dependency deleted successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Dependency not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - user does not have access to the project'
  })
  async deleteDependency(
    @Param('dependencyId', ParseUUIDPipe) dependencyId: string,
    @Request() req: any
  ): Promise<void> {
    await this.projectsService.deleteDependency(dependencyId, req.user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project updated successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data'
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Project deleted successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.projectsService.remove(id);
  }

  // Password Protection Endpoints

  @Put(':id/password')
  @ApiOperation({ 
    summary: 'Set password for a project',
    description: 'Set or update the password for a password-protected project. Password must meet strength requirements.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password set successfully'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project visibility must be set to "password" or password does not meet requirements'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  async setPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() projectPasswordDto: ProjectPasswordDto
  ) {
    return this.projectsService.setProjectPassword(id, projectPasswordDto);
  }

  @Post(':id/access')
  @ApiOperation({ 
    summary: 'Authenticate with project password to gain access',
    description: 'Authenticate with project password or admin override token. Returns access and refresh tokens with 24-hour/7-day expiration. Subject to rate limiting with exponential backoff.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication successful',
    type: ProjectAccessResponseDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Project does not require password authentication or password not set'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Invalid password or admin override token'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many password attempts - account locked with exponential backoff'
  })
  async authenticateAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() projectAccessDto: ProjectAccessDto,
    @Request() req: any
  ): Promise<ProjectAccessResponseDto> {
    // Use IP address as client identifier for rate limiting
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    return this.projectsService.authenticateProjectAccess(id, projectAccessDto, clientId);
  }

  @Post('auth/refresh')
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Use refresh token to obtain new access and refresh tokens. Old tokens are invalidated.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
    type: ProjectAccessResponseDto
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data'
  })
  async refreshToken(@Body() tokenRefreshDto: TokenRefreshDto): Promise<ProjectAccessResponseDto> {
    return this.projectsService.refreshProjectAccessToken(tokenRefreshDto.refreshToken);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Logout and blacklist tokens',
    description: 'Securely logout by blacklisting access and refresh tokens. Tokens cannot be used after logout.'
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Logout successful - tokens blacklisted'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data'
  })
  async logout(@Body() logoutDto: LogoutDto): Promise<void> {
    await this.projectsService.logoutProjectAccess(logoutDto.accessToken, logoutDto.refreshToken);
  }

  @Post(':id/admin-override')
  @ApiExcludeEndpoint() // Hide from public API docs
  @ApiOperation({ 
    summary: 'Create admin override token for emergency access',
    description: 'Internal endpoint for creating emergency access tokens. Requires admin privileges.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Admin override token created successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - admin privileges required'
  })
  async createAdminOverride(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() adminOverrideDto: AdminOverrideDto,
    @Request() req: any
  ): Promise<{ overrideToken: string }> {
    // TODO: Add admin role check here
    const overrideToken = await this.projectsService.createAdminOverride(
      projectId, 
      req.user?.id, 
      adminOverrideDto.reason,
      adminOverrideDto.expirationHours
    );
    
    return { overrideToken };
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