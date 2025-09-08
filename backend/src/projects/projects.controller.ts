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
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto, ProjectPasswordAuthDto, SetProjectPasswordDto } from './dto';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

/**
 * ProjectsController - プロジェクトRESTエンドポイント
 * 
 * エンドポイント:
 * - GET /projects - プロジェクト一覧取得 [viewer権限]
 * - GET /projects/:id - プロジェクト詳細取得 [viewer権限]
 * - POST /projects - プロジェクト作成 [editor権限]
 * - PATCH /projects/:id - プロジェクト更新 [editor権限]
 * - DELETE /projects/:id - プロジェクト削除（論理削除） [editor権限]
 * - POST /projects/:id/set-password - プロジェクト共有パスワード設定 [editor権限]
 * - POST /projects/auth-password - プロジェクト共有パスワード認証 [viewer権限]
 * 
 * 権限管理:
 * - viewer: GET系操作とパスワード認証のみ可能
 * - editor: 全ての操作が可能
 * 
 * 各エンドポイントには適切なHTTPステータスコードとバリデーションを適用
 */
@Controller('projects')
@UseGuards(RoleGuard)
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
  @RequireRole('editor')
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
  @RequireRole('viewer')
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
  @RequireRole('viewer')
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
  @RequireRole('editor')
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
  @RequireRole('editor')
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /projects/${id} - Deleting project`);
    
    await this.projectsService.remove(id);
    
    this.logger.log(`DELETE /projects/${id} - Project deleted successfully`);
  }

  /**
   * プロジェクト共有パスワード設定
   * @param id プロジェクトID
   * @param setPasswordDto パスワード設定データ
   * @returns 更新されたプロジェクト
   */
  @Post(':id/set-password')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async setSharedPassword(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) 
    setPasswordDto: SetProjectPasswordDto,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`POST /projects/${id}/set-password - Setting shared password`);
    
    const result = await this.projectsService.setSharedPassword(id, setPasswordDto);
    
    this.logger.log(`POST /projects/${id}/set-password - Shared password set successfully`);
    return result;
  }

  /**
   * プロジェクト共有パスワード認証
   * @param authDto 認証データ
   * @returns 認証結果
   */
  @Post('auth-password')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async authenticatePassword(
    @Body(new ValidationPipe({ whitelist: true, transform: true })) 
    authDto: ProjectPasswordAuthDto,
  ): Promise<{ success: boolean; project_id: string; permission: string }> {
    this.logger.log(`POST /projects/auth-password - Authenticating shared password for project: ${authDto.project_id}`);
    
    const isAuthenticated = await this.projectsService.authenticateSharedPassword(
      authDto.project_id, 
      authDto.password
    );
    
    const result = {
      success: isAuthenticated,
      project_id: authDto.project_id,
      permission: isAuthenticated ? 'editor' : 'viewer'
    };
    
    this.logger.log(`POST /projects/auth-password - Authentication ${isAuthenticated ? 'successful' : 'failed'} for project: ${authDto.project_id}`);
    return result;
  }
}