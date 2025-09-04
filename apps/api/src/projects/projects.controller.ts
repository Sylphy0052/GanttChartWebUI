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
  Request
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectPasswordDto, ProjectAccessDto, ProjectAccessResponseDto } from './dto/project-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data'
  })
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({
    status: 200,
    description: 'Projects retrieved successfully'
  })
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({
    status: 200,
    description: 'Project retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiResponse({
    status: 204,
    description: 'Project deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async remove(@Param('id') id: string) {
    await this.projectsService.remove(id);
  }

  @Put(':id/password')
  @ApiOperation({ summary: 'Set password for a project' })
  @ApiResponse({
    status: 200,
    description: 'Password set successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Project visibility must be set to "password"'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async setPassword(
    @Param('id') id: string,
    @Body() projectPasswordDto: ProjectPasswordDto
  ) {
    return this.projectsService.setProjectPassword(id, projectPasswordDto);
  }

  @Post(':id/access')
  @ApiOperation({ summary: 'Authenticate with project password to gain access' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: ProjectAccessResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Project does not require password authentication or password not set'
  })
  @ApiResponse({
    status: 403,
    description: 'Invalid password'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  @ApiResponse({
    status: 429,
    description: 'Too many password attempts'
  })
  async authenticateAccess(
    @Param('id') id: string,
    @Body() projectAccessDto: ProjectAccessDto,
    @Request() req: any
  ): Promise<ProjectAccessResponseDto> {
    // Use IP address as client identifier for rate limiting
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    return this.projectsService.authenticateProjectAccess(id, projectAccessDto, clientId);
  }
}