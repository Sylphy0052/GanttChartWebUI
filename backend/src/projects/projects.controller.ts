import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto';

/**
 * ProjectsController - プロジェクトRESTエンドポイント
 * 
 * エンドポイント:
 * - GET /projects - プロジェクト一覧取得
 * - GET /projects/:id - プロジェクト詳細取得
 * - POST /projects - プロジェクト作成
 * - PATCH /projects/:id - プロジェクト更新
 * - DELETE /projects/:id - プロジェクト削除（論理削除）
 * 
 * 各エンドポイントには適切なHTTPステータスコードとバリデーションを適用
 */
@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * プロジェクト作成
   * @param createProjectDto 作成データ
   * @returns 作成されたプロジェクト
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ValidationPipe({ whitelist: true, transform: true })) 
    createProjectDto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`POST /projects - Creating project: ${createProjectDto.name}`);
    
    const result = await this.projectsService.create(createProjectDto);
    
    this.logger.log(`POST /projects - Project created successfully: ${result.id}`);
    return result;
  }

  /**
   * プロジェクト一覧取得
   * @returns プロジェクト一覧
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<ProjectResponseDto[]> {
    this.logger.log('GET /projects - Fetching all projects');
    
    const result = await this.projectsService.findAll();
    
    this.logger.log(`GET /projects - Returned ${result.length} projects`);
    return result;
  }

  /**
   * プロジェクト詳細取得
   * @param id プロジェクトID
   * @returns プロジェクト詳細
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<ProjectResponseDto> {
    this.logger.log(`GET /projects/${id} - Fetching project details`);
    
    const result = await this.projectsService.findOne(id);
    
    this.logger.log(`GET /projects/${id} - Project found: ${result.name}`);
    return result;
  }

  /**
   * プロジェクト更新
   * @param id プロジェクトID
   * @param updateProjectDto 更新データ
   * @returns 更新されたプロジェクト
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true })) 
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`PATCH /projects/${id} - Updating project`);
    
    const result = await this.projectsService.update(id, updateProjectDto);
    
    this.logger.log(`PATCH /projects/${id} - Project updated successfully: ${result.name}`);
    return result;
  }

  /**
   * プロジェクト削除（論理削除）
   * @param id プロジェクトID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /projects/${id} - Deleting project`);
    
    await this.projectsService.remove(id);
    
    this.logger.log(`DELETE /projects/${id} - Project deleted successfully`);
  }
}