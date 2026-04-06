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
import { ChangeLogService } from '../changelog/changelog.service';
import { ChangeLogResponseDto } from '../changelog/dto';
import { UploadsService } from '../uploads/uploads.service';
import { UploadResponseDto } from '../uploads/dto';

/**
 * IssuesController - Issue REST エンドポイント
 *
 * エンドポイント:
 * - GET /projects/:projectId/issues - Issue一覧取得 [viewer権限]
 * - GET /projects/:projectId/issues/:id - 単一Issue取得 [viewer権限]
 * - GET /projects/:projectId/issues/:id/changelog - Issue変更履歴取得 [viewer権限]
 * - GET /projects/:projectId/issues/:id/uploads - Issue画像一覧取得 [viewer権限]
 * - POST /projects/:projectId/issues - Issue作成 [editor権限]
 * - PUT /projects/:projectId/issues/:id - Issue更新 [editor権限]
 * - PATCH /projects/:projectId/issues/:id - Issue部分更新（オプティミスティックロック対応） [editor権限]
 * - DELETE /projects/:projectId/issues/:id - Issue削除 [editor権限]
 * - PATCH /projects/:projectId/issues/reorder - 複数Issue並び替え [editor権限]
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

  constructor(
    private readonly issuesService: IssuesService,
    private readonly changeLogService: ChangeLogService,
    private readonly uploadsService: UploadsService,
  ) {}

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

    // CreateIssueDtoをそのまま渡す（project_idはService内で処理）
    const result = await this.issuesService.create(projectId, createIssueDto);

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

    const result = await this.issuesService.findAllByProject(projectId);

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

    const result = await this.issuesService.findOne(projectId, id);

    this.logger.log(`GET /projects/${projectId}/issues/${id} - Issue found: ${result.title}`);
    return result;
  }

  /**
   * Issue詳細取得（コメント・変更履歴込み）
   * @param projectId プロジェクトID
   * @param id IssueID
   * @returns Issue詳細データ
   */
  @Get('projects/:projectId/issues/:id/detail')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async findOneWithDetails(
    @Param('projectId') projectId: string,
    @Param('id') id: string
  ): Promise<any> {
    this.logger.log(`GET /projects/${projectId}/issues/${id}/detail - Fetching issue with details`);

    const result = await this.issuesService.findOneWithDetails(projectId, id);

    this.logger.log(`GET /projects/${projectId}/issues/${id}/detail - Issue details found: ${result.title}`);
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

    const result = await this.issuesService.update(projectId, id, updateIssueDto);

    this.logger.log(`PUT /projects/${projectId}/issues/${id} - Issue updated successfully: ${result.title}`);
    return result;
  }

  /**
   * Issue部分更新（オプティミスティックロック対応）
   * @param projectId プロジェクトID
   * @param id IssueID
   * @param updateIssueDto 更新データ（version含む）
   * @returns 更新されたIssue
   */
  @Patch('projects/:projectId/issues/:id')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async patch(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true }))
    updateIssueDto: UpdateIssueDto,
  ): Promise<IssueResponseDto> {
    this.logger.log(`PATCH /projects/${projectId}/issues/${id} - Patching issue with version: ${updateIssueDto.version}`);

    const result = await this.issuesService.update(projectId, id, updateIssueDto);

    this.logger.log(`PATCH /projects/${projectId}/issues/${id} - Issue patched successfully: ${result.title}`);
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

    await this.issuesService.remove(projectId, id);

    this.logger.log(`DELETE /projects/${projectId}/issues/${id} - Issue deleted successfully`);
  }

  /**
   * 複数Issue並び替え（sort_order一括更新）
   * @param projectId プロジェクトID
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

  /**
   * Issue変更履歴取得
   * @param projectId プロジェクトID
   * @param id IssueID
   * @returns 変更履歴一覧
   */
  @Get('projects/:projectId/issues/:id/changelog')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async getIssueChangelog(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<ChangeLogResponseDto[]> {
    this.logger.log(`GET /projects/${projectId}/issues/${id}/changelog - Fetching changelog for issue: ${id}`);

    const changeLogs = await this.changeLogService.getChangeLogsByEntity(id);

    this.logger.log(`GET /projects/${projectId}/issues/${id}/changelog - Found ${changeLogs.length} change logs`);
    return changeLogs;
  }

  /**
   * Issue画像一覧取得
   * @param projectId プロジェクトID
   * @param id IssueID
   * @returns Issue内の画像一覧
   */
  @Get('projects/:projectId/issues/:id/uploads')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async getIssueUploads(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<UploadResponseDto[]> {
    this.logger.log(`GET /projects/${projectId}/issues/${id}/uploads - Fetching uploads for issue: ${id}`);

    const uploads = await this.uploadsService.getImagesByIssue(id);

    this.logger.log(`GET /projects/${projectId}/issues/${id}/uploads - Found ${uploads.length} uploads`);
    return uploads;
  }

  /**
   * プロジェクト内の削除されていないIssueの担当者一覧を取得
   */
  @Get('/projects/:projectId/assignees')
  async getProjectAssignees(
    @Param('projectId') projectId: string,
  ): Promise<string[]> {
    this.logger.log(`Getting assignees for project: ${projectId}`);
    return this.issuesService.getProjectAssignees(projectId);
  }
}