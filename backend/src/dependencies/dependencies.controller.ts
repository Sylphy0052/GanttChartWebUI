import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Logger,
} from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { CreateDependencyDto, DependencyResponseDto } from './dto';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

/**
 * DependenciesController - 依存関係管理API
 * 
 * エンドポイント:
 * - POST /projects/:projectId/dependencies - 依存関係作成（Editor権限）
 * - GET /projects/:projectId/dependencies - プロジェクト内依存関係一覧
 * - DELETE /dependencies/:id - 依存関係削除（Editor権限）
 */
@Controller()
@UseGuards(RoleGuard)
export class DependenciesController {
  private readonly logger = new Logger(DependenciesController.name);

  constructor(private readonly dependenciesService: DependenciesService) {}

  /**
   * 依存関係作成
   * POST /projects/:projectId/dependencies
   */
  @Post('projects/:projectId/dependencies')
  @RequireRole('editor')
  async create(
    @Param('projectId') projectId: string,
    @Body() createDependencyDto: CreateDependencyDto,
  ): Promise<DependencyResponseDto> {
    this.logger.log(`Creating dependency in project ${projectId}`);
    return this.dependenciesService.create(projectId, createDependencyDto);
  }

  /**
   * プロジェクト内依存関係一覧取得
   * GET /projects/:projectId/dependencies
   */
  @Get('projects/:projectId/dependencies')
  @RequireRole('viewer')
  async findByProject(@Param('projectId') projectId: string): Promise<DependencyResponseDto[]> {
    this.logger.log(`Getting dependencies for project ${projectId}`);
    return this.dependenciesService.findByProjectId(projectId);
  }

  /**
   * 依存関係削除
   * DELETE /dependencies/:id
   */
  @Delete('dependencies/:id')
  @RequireRole('editor')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`Deleting dependency ${id}`);
    await this.dependenciesService.remove(id);
    return { message: 'Dependency deleted successfully' };
  }
}