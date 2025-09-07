import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  BadRequestException,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ProjectResponseDto } from './dto/project.dto';
import { WBSTreeResponseDto, WBSTreeQueryDto, GanttDataResponseDto, GanttDataQueryDto } from '../issues/dto/wbs-tree.dto';
import { AssignIssueToUserDto } from './dto/assign-issue.dto';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project successfully created.', type: ProjectResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBody({ type: CreateProjectDto })
  async create(@Body() createProjectDto: CreateProjectDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const project = await this.projectsService.create(createProjectDto, userId);
    return {
      success: true,
      data: project
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved projects.', type: [ProjectResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const projects = await this.projectsService.findAllForUser(userId);
    return {
      success: true,
      data: projects
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved project.', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const project = await this.projectsService.findOneWithAccess(id, userId);
    return {
      success: true,
      data: project
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project successfully updated.', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBody({ type: UpdateProjectDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProjectDto: UpdateProjectDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    const project = await this.projectsService.updateWithAccess(id, updateProjectDto, userId);
    return {
      success: true,
      data: project
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    await this.projectsService.removeWithAccess(id, userId);
    return {
      success: true,
      message: 'Project successfully deleted'
    };
  }

  @Get(':id/wbs')
  @ApiOperation({ summary: 'Get WBS (Work Breakdown Structure) tree for a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved WBS tree.', type: WBSTreeResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiQuery({ name: 'expandLevel', required: false, type: Number, description: 'Tree expansion level (default: 2)' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks (default: true)' })
  async getWBS(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Query('expandLevel') expandLevel?: number,
    @Query('includeCompleted') includeCompleted?: boolean
  ) {
    const userId = req.user?.sub || req.user?.id;
    
    // Verify project access
    await this.projectsService.findOneWithAccess(id, userId);
    
    const wbsData = await this.projectsService.getProjectWBS(id, {
      expandLevel,
      includeCompleted
    });

    return {
      success: true,
      data: wbsData
    };
  }

  @Get(':id/gantt')
  @ApiOperation({ summary: 'Get Gantt chart data for a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved Gantt data.', type: GanttDataResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for data range (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for data range (YYYY-MM-DD)' })
  @ApiQuery({ name: 'includeDependencies', required: false, type: Boolean, description: 'Include task dependencies (default: true)' })
  @ApiQuery({ name: 'includeCompleted', required: false, type: Boolean, description: 'Include completed tasks (default: true)' })
  async getGanttData(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeDependencies') includeDependencies?: boolean,
    @Query('includeCompleted') includeCompleted?: boolean
  ) {
    const userId = req.user?.sub || req.user?.id;
    
    // Verify project access
    await this.projectsService.findOneWithAccess(id, userId);
    
    const ganttData = await this.projectsService.getProjectGanttData(id, {
      startDate,
      endDate,
      includeDependencies,
      includeCompleted
    });

    return {
      success: true,
      data: ganttData
    };
  }

  @Post(':id/users/:userId/assign')
  @ApiOperation({ summary: 'Assign a user to an issue in the project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User successfully assigned to issue.' })
  @ApiResponse({ status: 404, description: 'Project or user not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBody({ type: AssignIssueToUserDto })
  async assignUserToIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() assignDto: AssignIssueToUserDto,
    @Request() req: any
  ) {
    const requestingUserId = req.user?.sub || req.user?.id;
    
    // Verify project access
    await this.projectsService.findOneWithAccess(id, requestingUserId);
    
    await this.projectsService.assignUserToIssue(id, userId, assignDto.issueId, requestingUserId);

    return {
      success: true,
      message: 'User successfully assigned to issue'
    };
  }

  @Delete(':id/users/:userId/unassign/:issueId')
  @ApiOperation({ summary: 'Unassign a user from an issue in the project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  @ApiResponse({ status: 200, description: 'User successfully unassigned from issue.' })
  @ApiResponse({ status: 404, description: 'Project, user, or issue not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async unassignUserFromIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Request() req: any
  ) {
    const requestingUserId = req.user?.sub || req.user?.id;
    
    // Verify project access
    await this.projectsService.findOneWithAccess(id, requestingUserId);
    
    await this.projectsService.unassignUserFromIssue(id, userId, issueId, requestingUserId);

    return {
      success: true,
      message: 'User successfully unassigned from issue'
    };
  }
}