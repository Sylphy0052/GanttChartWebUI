import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  Logger,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto, UpdateIssueDto, IssueResponseDto } from './dto';
import { ReorderIssuesDto } from './dto/reorder-issues.dto';
import { ChangeHierarchyDto } from './dto/change-hierarchy.dto';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

/**
 * IssuesController - Issue REST エンドポイント
 * 
 * エンドポイント:
 * - GET /projects/:projectId/issues - Issue一覧取得 [viewer権限]
 * - GET /projects/:projectId/issues/:id - 単一Issue取得 [viewer権限]
 * - POST /projects/:projectId/issues - Issue作成 [editor権限]
 * - PUT /projects/:projectId/issues/:id - Issue更新 [editor権限]
 * - DELETE /projects/:projectId/issues/:id - Issue削除 [editor権限]
 * - PATCH /issues/reorder - 複数Issue並び替え [editor権限]
 * - PATCH /issues/:id/hierarchy - Issue階層変更 [editor権限]
 * 
 * 権限管理:
 * - viewer: GET系操作のみ可能
 * - editor: 全ての操作が可能
 * 
 * 各エンドポイントには適切なHTTPステータスコードとバリデーションを適用
 */
@Controller()
@UseGuards(RoleGuard)
export class IssuesController {
  private readonly logger = new Logger(IssuesController.name);

  constructor(private readonly issuesService: IssuesService) {}

  /**
   * Issue作成
   * @param projectId プロジェクトID
   * @param createIssueDto 作成データ
   * @returns 作成されたIssue
   */
  @Post('projects/:projectId/issues')
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('editor')
  async create(
    @Param('projectId') projectId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) 
    createIssueDto: CreateIssueDto,
  ): Promise<IssueResponseDto> {
    this.logger.log(`POST /projects/${projectId}/issues - Creating issue: ${createIssueDto.title}`);
    
    // リクエストDTOにprojectIdを設定（URL参照）
    const issueData = { ...createIssueDto, project_id: projectId };
    const result = await this.issuesService.create(issueData);
    
    this.logger.log(`POST /projects/${projectId}/issues - Issue created successfully: ${result.id}`);
    return result;
  }

  /**
   * Issue一覧取得
   * @param projectId プロジェクトID
   * @returns プロジェクト内のIssue一覧
   */
  @Get('projects/:projectId/issues')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async findAll(@Param('projectId') projectId: string): Promise<IssueResponseDto[]> {
    this.logger.log(`GET /projects/${projectId}/issues - Fetching all issues`);
    
    const result = await this.issuesService.findAll(projectId);
    
    this.logger.log(`GET /projects/${projectId}/issues - Returned ${result.length} issues`);
    return result;
  }

  /**
   * 単一Issue取得
   * @param projectId プロジェクトID
   * @param id IssueID
   * @returns Issue詳細
   */
  @Get('projects/:projectId/issues/:id')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async findOne(@Param('projectId') projectId: string, @Param('id') id: string): Promise<IssueResponseDto> {
    this.logger.log(`GET /projects/${projectId}/issues/${id} - Fetching issue details`);
    
    const result = await this.issuesService.findOne(id);
    
    this.logger.log(`GET /projects/${projectId}/issues/${id} - Issue found: ${result.title}`);
    return result;
  }

  /**
   * Issue更新
   * @param projectId プロジェクトID
   * @param id IssueID
   * @param updateIssueDto 更新データ
   * @returns 更新されたIssue
   */
  @Put('projects/:projectId/issues/:id')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true })) 
    updateIssueDto: UpdateIssueDto,
  ): Promise<IssueResponseDto> {
    this.logger.log(`PUT /projects/${projectId}/issues/${id} - Updating issue`);
    
    const result = await this.issuesService.update(id, updateIssueDto);
    
    this.logger.log(`PUT /projects/${projectId}/issues/${id} - Issue updated successfully: ${result.title}`);
    return result;
  }

  /**
   * Issue削除（論理削除）
   * @param projectId プロジェクトID
   * @param id IssueID
   */
  @Delete('projects/:projectId/issues/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole('editor')
  async remove(@Param('projectId') projectId: string, @Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /projects/${projectId}/issues/${id} - Deleting issue`);
    
    await this.issuesService.remove(id);
    
    this.logger.log(`DELETE /projects/${projectId}/issues/${id} - Issue deleted successfully`);
  }

  /**
   * 複数Issue並び替え（sort_order一括更新）
   * @param reorderIssuesDto 並び替えデータ
   * @returns 更新されたIssue一覧
   */
  @Patch('issues/reorder')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async reorderIssues(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    reorderIssuesDto: ReorderIssuesDto,
  ): Promise<IssueResponseDto[]> {
    this.logger.log(`PATCH /issues/reorder - Reordering ${reorderIssuesDto.issues.length} issues`);
    
    const result = await this.issuesService.reorderIssues(reorderIssuesDto);
    
    this.logger.log(`PATCH /issues/reorder - Successfully reordered ${result.length} issues`);
    return result;
  }

  /**
   * Issue階層変更（親子関係変更）
   * @param id IssueID
   * @param changeHierarchyDto 階層変更データ
   * @returns 更新されたIssue
   */
  @Patch('issues/:id/hierarchy')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async changeHierarchy(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    changeHierarchyDto: ChangeHierarchyDto,
  ): Promise<IssueResponseDto> {
    this.logger.log(`PATCH /issues/${id}/hierarchy - Changing hierarchy, new_parent_id: ${changeHierarchyDto.new_parent_id}`);
    
    const result = await this.issuesService.changeHierarchy(id, changeHierarchyDto);
    
    this.logger.log(`PATCH /issues/${id}/hierarchy - Successfully changed hierarchy: ${result.title}`);
    return result;
  }
}