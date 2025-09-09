import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { IssueNotificationData } from '../websocket/interfaces/websocket-notification.interface';
import { CreateIssueDto, UpdateIssueDto, IssueResponseDto } from './dto';
import { ReorderIssuesDto, ReorderIssueItem } from './dto/reorder-issues.dto';
import { ChangeHierarchyDto } from './dto/change-hierarchy.dto';
import { generateWBSNumbers, calculateSingleWBSNumber, WBSIssueData } from './utils/wbs-number.util';
import { Issue } from '@prisma/client';
import { plainToClass } from 'class-transformer';

/**
 * IssuesService - Issue管理サービス
 * 
 * 責務:
 * - Issue CRUD操作（作成・取得・更新・削除）
 * - 階層構造（親子関係）管理
 * - WBS番号の自動生成・更新
 * - 論理削除対応（is_deleted, deleted_at）
 * - ChangeLog自動記録（作成・更新・削除時）
 * - WebSocket通知自動配信（作成・更新・削除時）
 * - ImagePath自動クリーンアップ（削除時）
 * - Issue並び替え（sort_order一括更新）
 * - 階層変更（親子関係変更）
 * - 楽観的排他制御対応
 */
@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLogService: ChangeLogService,
    private readonly uploadsService: UploadsService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Issue作成
   * @param projectId プロジェクトID
   * @param createIssueDto Issue作成データ
   * @returns 作成されたIssue
   * @throws NotFoundException プロジェクトまたは親Issueが存在しない場合
   * @throws BadRequestException 循環参照が発生する場合
   */
  async create(projectId: string, createIssueDto: CreateIssueDto): Promise<IssueResponseDto> {
    this.logger.log(`Creating issue in project: ${projectId}, title: ${createIssueDto.title}`);

    try {
      // プロジェクト存在確認
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, is_deleted: false },
      });

      if (!project) {
        throw new NotFoundException('指定されたプロジェクトが見つかりません');
      }

      // 親Issue存在確認（指定されている場合）
      if (createIssueDto.parent_id) {
        const parentIssue = await this.prisma.issue.findFirst({
          where: {
            id: createIssueDto.parent_id,
            project_id: projectId,
            is_deleted: false,
          },
        });

        if (!parentIssue) {
          throw new NotFoundException('指定された親Issueが見つかりません');
        }
      }

      // 新しいsort_orderの算出
      let nextSortOrder = 1;
      if (createIssueDto.parent_id) {
        // 同一親の子Issue間での最大sort_order + 10
        const lastChildIssue = await this.prisma.issue.findFirst({
          where: {
            parent_id: createIssueDto.parent_id,
            project_id: projectId,
            is_deleted: false,
          },
          orderBy: { sort_order: 'desc' },
        });
        nextSortOrder = lastChildIssue ? lastChildIssue.sort_order + 10 : 1;
      } else {
        // ルートレベルでの最大sort_order + 10
        const lastRootIssue = await this.prisma.issue.findFirst({
          where: {
            parent_id: null,
            project_id: projectId,
            is_deleted: false,
          },
          orderBy: { sort_order: 'desc' },
        });
        nextSortOrder = lastRootIssue ? lastRootIssue.sort_order + 10 : 1;
      }

      // Issue作成
      const newIssue = await this.prisma.issue.create({
        data: {
          project_id: projectId,
          parent_id: createIssueDto.parent_id || null,
          title: createIssueDto.title,
          description_md: createIssueDto.description_md || null,
          assignee: createIssueDto.assignee || null,
          status: createIssueDto.status || 'open',
          start_date: createIssueDto.start_date || null,
          end_date: createIssueDto.end_date || null,
          progress_pct: createIssueDto.progress_pct ?? 0,
          effort_hours: createIssueDto.effort_hours || null,
          is_blocked: createIssueDto.is_blocked ?? false,
          sort_order: createIssueDto.sort_order ?? nextSortOrder,
          labels: createIssueDto.labels || [],
          version: 1, // 新規作成時は必ず1
        },
      });

      // ChangeLog記録 - 作成
      try {
        await this.changeLogService.recordIssueChange(
          newIssue.id,
          { action: 'create' },
          projectId,
          'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue creation ${newIssue.id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Issue作成を阻害しない
      }

      // WebSocket通知配信 - 作成
      try {
        const issueNotificationData: IssueNotificationData = {
          action: 'create',
          issue: {
            id: newIssue.id,
            title: newIssue.title,
            description_md: newIssue.description_md,
            assignee: newIssue.assignee,
            status: newIssue.status,
            start_date: newIssue.start_date,
            end_date: newIssue.end_date,
            progress_pct: newIssue.progress_pct,
            project_id: newIssue.project_id,
            parent_id: newIssue.parent_id,
          },
          author: 'system',
        };
        
        await this.notificationGateway.notifyIssueChanged(issueNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for issue creation ${newIssue.id}: ${notificationError.message}`);
        // WebSocket通知エラーは Issue作成を阻害しない
      }

      this.logger.log(`Issue created successfully: ${newIssue.id}`);
      return this.toResponseDto(newIssue, projectId);
    } catch (error) {
      this.logger.error(`Failed to create issue in project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト内の全Issue取得
   * @param projectId プロジェクトID
   * @returns Issue一覧（WBS番号付き）
   * @throws NotFoundException プロジェクトが存在しない場合
   */
  async findAllByProject(projectId: string): Promise<IssueResponseDto[]> {
    this.logger.log(`Finding all issues in project: ${projectId}`);

    try {
      // プロジェクト存在確認
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, is_deleted: false },
      });

      if (!project) {
        throw new NotFoundException('指定されたプロジェクトが見つかりません');
      }

      // プロジェクト内の全Issue取得
      const issues = await this.prisma.issue.findMany({
        where: {
          project_id: projectId,
          is_deleted: false,
        },
        orderBy: [
          { parent_id: { sort: 'asc', nulls: 'first' } },
          { sort_order: 'asc' },
        ],
      });

      this.logger.log(`Found ${issues.length} issues in project: ${projectId}`);
      return this.toResponseDtoList(issues, projectId);
    } catch (error) {
      this.logger.error(`Failed to find issues in project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue詳細取得
   * @param projectId プロジェクトID
   * @param issueId IssueID
   * @returns Issue詳細（WBS番号付き）
   * @throws NotFoundException Issueが存在しない場合
   */
  async findOne(projectId: string, issueId: string): Promise<IssueResponseDto> {
    this.logger.log(`Finding issue: ${issueId} in project: ${projectId}`);

    try {
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          project_id: projectId,
          is_deleted: false,
        },
        include: {
          children: {
            where: { is_deleted: false },
            orderBy: { sort_order: 'asc' },
          },
          parent: {
            where: { is_deleted: false },
          },
        },
      });

      if (!issue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      this.logger.log(`Found issue: ${issueId}`);
      return this.toResponseDto(issue, projectId);
    } catch (error) {
      this.logger.error(`Failed to find issue ${issueId} in project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue詳細取得（コメント・変更履歴込み）
   * @param projectId プロジェクトID
   * @param issueId IssueID
   * @returns Issue詳細データ
   */
  /**
   * Issue詳細取得（コメント・変更履歴込み）
   * @param projectId プロジェクトID
   * @param issueId IssueID
   * @returns Issue詳細データ
   */
  /**
   * Issue詳細取得（コメント・変更履歴込み）
   * @param projectId プロジェクトID
   * @param issueId IssueID
   * @returns Issue詳細データ
   */
  async findOneWithDetails(projectId: string, issueId: string): Promise<any> {
    this.logger.log(`Finding issue with details: ${issueId} in project: ${projectId}`);

    try {
      // Issue基本情報を取得
      const issue = await this.findOne(projectId, issueId);

      // コメント取得（新しい順）
      const comments = await this.prisma.comment.findMany({
        where: {
          issue_id: issueId,
        },
        orderBy: { created_at: 'desc' },
      });

      // 変更履歴取得
      const changeLogs = await this.changeLogService.getChangeLogsByEntity(issueId);

      // 添付ファイル取得
      const uploadedFiles = await this.uploadsService.getImagesByIssue(issueId);

      this.logger.log(`Found issue with details: ${issueId} (${comments.length} comments, ${changeLogs.length} change logs, ${uploadedFiles.length} files)`);

      return {
        ...issue,
        comments: comments.map(comment => ({
          id: comment.id,
          body_md: comment.body_md,
          author: comment.author,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          is_edited: comment.edited || comment.created_at.getTime() !== comment.updated_at.getTime(),
        })),
        changeLog: changeLogs,
        uploadedFiles: uploadedFiles,
      };
    } catch (error) {
      this.logger.error(`Failed to find issue with details ${issueId} in project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue更新
   * @param projectId プロジェクトID
   * @param issueId IssueID
   * @param updateIssueDto 更新データ
   * @returns 更新されたIssue（WBS番号付き）
   * @throws NotFoundException Issueが存在しない場合
   * @throws ConflictException 楽観的排他制御エラー
   */
  async update(projectId: string, issueId: string, updateIssueDto: UpdateIssueDto): Promise<IssueResponseDto> {
    this.logger.log(`Updating issue: ${issueId} in project: ${projectId}`);

    try {
      // 既存Issue取得・検証
      const existingIssue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          project_id: projectId,
          is_deleted: false,
        },
      });

      if (!existingIssue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      // 更新前の値を記録（ChangeLog用）
      const previousValues = {
        title: existingIssue.title,
        description_md: existingIssue.description_md,
        assignee: existingIssue.assignee,
        status: existingIssue.status,
        start_date: existingIssue.start_date,
        end_date: existingIssue.end_date,
        progress_pct: existingIssue.progress_pct,
      };

      // 楽観的排他制御を使用して更新
      const updatedIssue = await this.prisma.issue.update({
        where: {
          id: issueId,
          version: updateIssueDto.version, // 楽観的排他制御
        },
        data: {
          title: updateIssueDto.title ?? existingIssue.title,
          description_md: updateIssueDto.description_md !== undefined 
            ? updateIssueDto.description_md 
            : existingIssue.description_md,
          assignee: updateIssueDto.assignee !== undefined 
            ? updateIssueDto.assignee 
            : existingIssue.assignee,
          status: updateIssueDto.status ?? existingIssue.status,
          start_date: updateIssueDto.start_date !== undefined 
            ? updateIssueDto.start_date 
            : existingIssue.start_date,
          end_date: updateIssueDto.end_date !== undefined 
            ? updateIssueDto.end_date 
            : existingIssue.end_date,
          progress_pct: updateIssueDto.progress_pct ?? existingIssue.progress_pct,
          effort_hours: updateIssueDto.effort_hours !== undefined 
            ? updateIssueDto.effort_hours 
            : existingIssue.effort_hours,
          is_blocked: updateIssueDto.is_blocked ?? existingIssue.is_blocked,
          sort_order: updateIssueDto.sort_order ?? existingIssue.sort_order,
          labels: updateIssueDto.labels ?? existingIssue.labels,
          version: { increment: 1 }, // バージョンをインクリメント
        },
      });

      // ChangeLog記録 - 更新
      try {
        await this.changeLogService.recordIssueChange(
          issueId,
          {
            action: 'update',
            title_from: previousValues.title,
            title_to: updatedIssue.title,
            status_from: previousValues.status,
            status_to: updatedIssue.status,
            assignee_from: previousValues.assignee,
            assignee_to: updatedIssue.assignee,
            progress_pct_from: previousValues.progress_pct,
            progress_pct_to: updatedIssue.progress_pct,
          },
          projectId,
          'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue update ${issueId}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Issue更新を阻害しない
      }

      // WebSocket通知配信 - 更新
      try {
        const issueNotificationData: IssueNotificationData = {
          action: 'update',
          issue: {
            id: updatedIssue.id,
            title: updatedIssue.title,
            description_md: updatedIssue.description_md,
            assignee: updatedIssue.assignee,
            status: updatedIssue.status,
            start_date: updatedIssue.start_date,
            end_date: updatedIssue.end_date,
            progress_pct: updatedIssue.progress_pct,
            project_id: updatedIssue.project_id,
            parent_id: updatedIssue.parent_id,
          },
          author: 'system',
        };
        
        await this.notificationGateway.notifyIssueChanged(issueNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for issue update ${issueId}: ${notificationError.message}`);
        // WebSocket通知エラーは Issue更新を阻害しない
      }

      this.logger.log(`Issue updated successfully: ${issueId}`);
      return this.toResponseDto(updatedIssue, projectId);
    } catch (error) {
      if (error.code === 'P2025') {
        // Prismaの「Record to update not found」エラー（楽観的排他制御エラー）
        throw new ConflictException('Issueが他のユーザーによって更新されています。最新データを取得してから再度更新してください');
      }
      this.logger.error(`Failed to update issue ${issueId} in project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue削除（論理削除）
   * @param projectId プロジェクトID
   * @param issueId IssueID
   * @throws NotFoundException Issueが存在しない場合
   */
  async remove(projectId: string, issueId: string): Promise<{ message: string }> {
    this.logger.log(`Removing issue: ${issueId} from project: ${projectId}`);

    try {
      // 既存Issue検証
      const existingIssue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          project_id: projectId,
          is_deleted: false,
        },
      });

      if (!existingIssue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      // 論理削除実行
      await this.prisma.issue.update({
        where: { id: issueId },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          version: { increment: 1 }, // バージョンをインクリメント
        },
      });

      // Issue添付画像の削除（物理削除）
      try {
        const images = await this.uploadsService.getImagesByIssue(issueId);
        for (const image of images) {
          await this.uploadsService.deleteImage(image.id);
        }
      } catch (imageError) {
        this.logger.warn(`Failed to delete images for issue ${issueId}: ${imageError.message}`);
        // 画像削除エラーは Issue削除を阻害しない
      }

      // ChangeLog記録 - 削除
      try {
        await this.changeLogService.recordIssueChange(
          issueId,
          { action: 'delete' },
          projectId,
          'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue deletion ${issueId}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Issue削除を阻害しない
      }

      // WebSocket通知配信 - 削除
      try {
        const issueNotificationData: IssueNotificationData = {
          action: 'delete',
          issue: {
            id: existingIssue.id,
            title: existingIssue.title,
            description_md: existingIssue.description_md,
            assignee: existingIssue.assignee,
            status: existingIssue.status,
            start_date: existingIssue.start_date,
            end_date: existingIssue.end_date,
            progress_pct: existingIssue.progress_pct,
            project_id: existingIssue.project_id,
            parent_id: existingIssue.parent_id,
          },
          author: 'system',
        };
        
        await this.notificationGateway.notifyIssueChanged(issueNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for issue deletion ${issueId}: ${notificationError.message}`);
        // WebSocket通知エラーは Issue削除を阻害しない
      }

      this.logger.log(`Issue removed successfully: ${issueId}`);
      return { message: 'Issueが正常に削除されました' };
    } catch (error) {
      this.logger.error(`Failed to remove issue ${issueId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 複数Issue並び替え（sort_order一括更新）
   * @param reorderIssuesDto 並び替えデータ
   * @returns 更新されたIssue一覧
   * @throws NotFoundException 対象Issueが存在しない場合
   * @throws ConflictException 楽観的排他制御エラー
   * @throws BadRequestException 空配列または重複IDの場合
   */
  // プロジェクト単位でのreorder操作の排他制御
  private static reorderLocks = new Map<string, Promise<any>>();

  async reorderIssues(reorderIssuesDto: ReorderIssuesDto): Promise<IssueResponseDto[]> {
    this.logger.log(`Reordering ${reorderIssuesDto.issues.length} issues`);

    if (reorderIssuesDto.issues.length === 0) {
      throw new BadRequestException('並び替え対象のIssueが指定されていません');
    }

    // プロジェクト単位での排他制御のためのロックキー生成
    const issueIds = reorderIssuesDto.issues.map(item => item.id).sort();
    const lockKey = `reorder_${issueIds.join('_')}`;
    
    // 同時実行を防ぐためのロック処理
    if (IssuesService.reorderLocks.has(lockKey)) {
      this.logger.warn(`Concurrent reorder operation detected for issues: ${issueIds.join(', ')} - waiting for previous operation to complete`);
      try {
        await IssuesService.reorderLocks.get(lockKey);
      } catch (error) {
        // 前の操作がエラーで終了してもこの操作は続行する
        this.logger.warn('Previous reorder operation failed, continuing with current operation');
      }
    }

    const currentOperation = this.executeReorderOperation(reorderIssuesDto);
    IssuesService.reorderLocks.set(lockKey, currentOperation);

    try {
      const result = await currentOperation;
      return result;
    } finally {
      IssuesService.reorderLocks.delete(lockKey);
    }
  }

  private async executeReorderOperation(reorderIssuesDto: ReorderIssuesDto): Promise<IssueResponseDto[]> {
    try {
      // 重複IDチェック
      const issueIds = reorderIssuesDto.issues.map(item => item.id);
      const uniqueIds = [...new Set(issueIds)];
      if (uniqueIds.length !== issueIds.length) {
        throw new BadRequestException('重複したIssue IDが含まれています');
      }

      const updatedIssues: IssueResponseDto[] = [];
      let projectId: string | null = null;

      // トランザクション内で一括更新
      await this.prisma.$transaction(async (prisma) => {
        // まず全てのIssueの最新版を取得してバージョンを確定
        const issueIds = reorderIssuesDto.issues.map(item => item.id);
        const uniqueIds = [...new Set(issueIds)]; // 重複除去
        
        const existingIssues = await prisma.issue.findMany({
          where: {
            id: { in: uniqueIds },
            is_deleted: false,
          },
        });

        if (existingIssues.length !== uniqueIds.length) {
          const foundIds = existingIssues.map(issue => issue.id);
          const missingIds = uniqueIds.filter(id => !foundIds.includes(id));
          throw new NotFoundException(`指定されたIssueが見つかりません: ${missingIds.join(', ')}`);
        }

        // プロジェクトIDを統一チェック
        const projectIds = [...new Set(existingIssues.map(issue => issue.project_id))];
        if (projectIds.length > 1) {
          throw new BadRequestException('異なるプロジェクトのIssueが混在しています');
        }
        projectId = projectIds[0];

        // IDからIssueのマップを作成（最新版を保持）
        const issueMap = new Map(existingIssues.map(issue => [issue.id, issue]));

        // 各アイテムを更新（最新のversionを使用）
        for (const item of reorderIssuesDto.issues) {
          const existingIssue = issueMap.get(item.id);
          if (!existingIssue) {
            throw new NotFoundException(`指定されたIssue ${item.id} が見つかりません`);
          }

          // 最新のversionを使用して楽観的排他制御
          const updatedIssue = await prisma.issue.update({
            where: {
              id: item.id,
              version: existingIssue.version, // 最新のversionを使用
            },
            data: {
              sort_order: item.sort_order,
              version: { increment: 1 }, // バージョンをインクリメント
            },
          });

          updatedIssues.push(await this.toResponseDto(updatedIssue, projectId));
          
          // 更新されたIssueの情報をマップにも反映（同じIssueが複数回更新される場合に備えて）
          issueMap.set(item.id, updatedIssue);
        }
      });

      // ChangeLog記録 - 並び替え操作
      try {
        for (let i = 0; i < reorderIssuesDto.issues.length; i++) {
          const item = reorderIssuesDto.issues[i];
          const updatedIssue = updatedIssues[i];
          
          await this.changeLogService.recordIssueChange(
            item.id,
            {
              action: 'reorder',
              sort_order_to: item.sort_order,
            },
            projectId!,
            'system',
          );
        }
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue reorder: ${changeLogError.message}`);
        // ChangeLog記録エラーは 並び替えを阻害しない
      }

      // WebSocket通知配信 - 並び替え操作
      try {
        for (const updatedIssue of updatedIssues) {
          const issueNotificationData: IssueNotificationData = {
            action: 'update',
            issue: {
              id: updatedIssue.id,
              title: updatedIssue.title,
              description_md: updatedIssue.description_md,
              assignee: updatedIssue.assignee,
              status: updatedIssue.status,
              start_date: updatedIssue.start_date,
              end_date: updatedIssue.end_date,
              progress_pct: updatedIssue.progress_pct,
              project_id: updatedIssue.project_id,
              parent_id: updatedIssue.parent_id,
            },
            author: 'system',
          };
          
          await this.notificationGateway.notifyIssueChanged(issueNotificationData);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for issue reorder: ${notificationError.message}`);
        // WebSocket通知エラーは 並び替えを阻害しない
      }

      this.logger.log(`Successfully reordered ${updatedIssues.length} issues`);
      return updatedIssues;
    } catch (error) {
      if (error.code === 'P2025') {
        // Prismaの「Record to update not found」エラー（楽観的排他制御エラー）
        throw new ConflictException('Issueが他のユーザーによって更新されています。最新データを取得してから再度並び替えしてください');
      }
      this.logger.error(`Failed to reorder issues: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue階層変更（親子関係変更）
   * @param id IssueID
   * @param changeHierarchyDto 階層変更データ
   * @returns 更新されたIssue
   * @throws NotFoundException Issueまたは親Issueが存在しない場合
   * @throws BadRequestException 循環参照または同一プロジェクト外の親を指定した場合
   * @throws ConflictException 楽観的排他制御エラー
   */
  async changeHierarchy(id: string, changeHierarchyDto: ChangeHierarchyDto): Promise<IssueResponseDto> {
    this.logger.log(`Changing hierarchy for issue: ${id}, new_parent_id: ${changeHierarchyDto.new_parent_id}`);

    try {
      // 既存Issueの取得・検証
      const existingIssue = await this.prisma.issue.findFirst({
        where: {
          id,
          is_deleted: false,
        },
        include: {
          children: {
            where: {
              is_deleted: false,
            },
            select: { id: true },
          },
        },
      });

      if (!existingIssue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      // 新しい親Issueの検証
      if (changeHierarchyDto.new_parent_id) {
        // 自分自身を親にしようとした場合
        if (changeHierarchyDto.new_parent_id === id) {
          throw new BadRequestException('自分自身を親Issueに設定することはできません');
        }

        // 親Issueの存在確認
        const newParentIssue = await this.prisma.issue.findFirst({
          where: {
            id: changeHierarchyDto.new_parent_id,
            is_deleted: false,
          },
        });

        if (!newParentIssue) {
          throw new NotFoundException('指定された親Issueが見つかりません');
        }

        // 同一プロジェクト内チェック
        if (newParentIssue.project_id !== existingIssue.project_id) {
          throw new BadRequestException('異なるプロジェクトのIssueを親として設定することはできません');
        }

        // 循環参照チェック - 子孫Issueが新しい親になろうとしていないかチェック
        const isCircularReference = await this.checkCircularReference(
          changeHierarchyDto.new_parent_id,
          id,
        );

        if (isCircularReference) {
          throw new BadRequestException('循環参照が発生するため、この親子関係を設定できません');
        }
      }

      // 更新前の値を記録
      const previousParentId = existingIssue.parent_id;

      // 楽観的排他制御を使用してIssue階層を更新
      const updatedIssue = await this.prisma.issue.update({
        where: {
          id,
          version: changeHierarchyDto.version, // 楽観的排他制御
        },
        data: {
          parent_id: changeHierarchyDto.new_parent_id || null,
          version: { increment: 1 }, // バージョンをインクリメント
        },
      });

      // ChangeLog記録 - 階層変更
      try {
        await this.changeLogService.recordIssueChange(
          id,
          {
            action: 'change_hierarchy',
            parent_id_from: previousParentId,
            parent_id_to: changeHierarchyDto.new_parent_id || null,
          },
          existingIssue.project_id,
          'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for hierarchy change ${id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは 階層変更を阻害しない
      }

      // WebSocket通知配信 - 階層変更
      try {
        const issueNotificationData: IssueNotificationData = {
          action: 'update',
          issue: {
            id: updatedIssue.id,
            title: updatedIssue.title,
            description_md: updatedIssue.description_md,
            assignee: updatedIssue.assignee,
            status: updatedIssue.status,
            start_date: updatedIssue.start_date,
            end_date: updatedIssue.end_date,
            progress_pct: updatedIssue.progress_pct,
            project_id: updatedIssue.project_id,
            parent_id: updatedIssue.parent_id,
          },
          author: 'system',
        };
        
        await this.notificationGateway.notifyIssueChanged(issueNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for hierarchy change ${id}: ${notificationError.message}`);
        // WebSocket通知エラーは 階層変更を阻害しない
      }

      this.logger.log(`Successfully changed hierarchy for issue: ${id}`);
      return this.toResponseDto(updatedIssue, existingIssue.project_id);
    } catch (error) {
      if (error.code === 'P2025') {
        // Prismaの「Record to update not found」エラー（楽観的排他制御エラー）
        throw new ConflictException('Issueが他のユーザーによって更新されています。最新データを取得してから再度階層変更してください');
      }
      this.logger.error(`Failed to change hierarchy for issue ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 循環参照チェック（再帰的に親→祖先を辿る）
   * @param candidateParentId 新しい親候補のID
   * @param targetIssueId 変更対象IssueID
   * @returns 循環参照が発生する場合はtrue
   */
  private async checkCircularReference(candidateParentId: string, targetIssueId: string): Promise<boolean> {
    let currentParentId = candidateParentId;
    const visitedIds = new Set<string>();

    while (currentParentId) {
      // 無限ループ回避
      if (visitedIds.has(currentParentId)) {
        this.logger.warn(`Detected existing circular reference at: ${currentParentId}`);
        return true;
      }
      visitedIds.add(currentParentId);

      // 対象IssueIDに到達した場合は循環参照
      if (currentParentId === targetIssueId) {
        return true;
      }

      // 親の親を取得
      const parentIssue = await this.prisma.issue.findFirst({
        where: {
          id: currentParentId,
          is_deleted: false,
        },
        select: {
          parent_id: true,
        },
      });

      if (!parentIssue) {
        break; // 親が見つからない場合は終了
      }

      currentParentId = parentIssue.parent_id;
    }

    return false;
  }

  /**
   * 複数IssueをIssueResponseDTOリストに変換（WBS番号付き）
   * @param issues Issueエンティティ配列
   * @param projectId プロジェクトID
   * @returns IssueResponseDTOリスト
   */
  private toResponseDtoList(issues: Issue[], projectId: string): IssueResponseDto[] {
    // WBS番号生成用データを準備
    const wbsData: WBSIssueData[] = issues.map(issue => ({
      id: issue.id,
      parent_id: issue.parent_id,
      sort_order: issue.sort_order,
    }));

    // WBS番号を生成
    const wbsResults = generateWBSNumbers(wbsData);
    const wbsMap = new Map(wbsResults.map(result => [result.id, result.wbs_number]));

    // DTOに変換してWBS番号を付与
    return issues.map(issue => {
      const dto = plainToClass(IssueResponseDto, {
        id: issue.id,
        project_id: issue.project_id,
        parent_id: issue.parent_id,
        title: issue.title,
        description_md: issue.description_md,
        assignee: issue.assignee,
        status: issue.status,
        start_date: issue.start_date,
        end_date: issue.end_date,
        progress_pct: issue.progress_pct,
        effort_hours: issue.effort_hours,
        is_blocked: issue.is_blocked,
        sort_order: issue.sort_order,
        labels: issue.labels,
        version: issue.version,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        wbs_number: wbsMap.get(issue.id) || '1', // フォールバック
      });
      return dto;
    });
  }

  /**
   * プロジェクト内の削除されていないIssueの担当者一覧を取得（重複排除）
   */
  async getProjectAssignees(projectId: string): Promise<string[]> {
    this.logger.log(`Getting assignees for project: ${projectId}`);

    // プロジェクト内の削除されていないIssueから担当者を取得
    const issues = await this.prisma.issue.findMany({
      where: {
        project_id: projectId,
        is_deleted: false,
        assignee: {
          not: null,
        },
      },
      select: {
        assignee: true,
      },
      distinct: ['assignee'],
    });

    // null チェックと重複排除を行い、アルファベット順にソート
    const assignees = issues
      .map(issue => issue.assignee)
      .filter((assignee): assignee is string => assignee !== null && assignee.trim() !== '')
      .sort();

    this.logger.log(`Found ${assignees.length} unique assignees for project ${projectId}`);
    return assignees;
  }

  /**
   * IssueをIssueResponseDTOに変換（WBS番号付き）
   * @param issue Issueエンティティ
   * @param projectId プロジェクトID
   * @returns IssueResponseDTO
   */
  private async toResponseDto(issue: any, projectId: string): Promise<IssueResponseDto> {
    // プロジェクト内の全Issue取得（WBS番号算出用）
    const allIssues = await this.prisma.issue.findMany({
      where: {
        project_id: projectId,
        is_deleted: false,
      },
      select: {
        id: true,
        parent_id: true,
        sort_order: true,
      },
    });

    const wbsData: WBSIssueData[] = allIssues.map(i => ({
      id: i.id,
      parent_id: i.parent_id,
      sort_order: i.sort_order,
    }));

    // 対象IssueのWBS番号を計算
    const wbsNumber = calculateSingleWBSNumber(issue.id, wbsData) || '1';

    // 親Issueの処理（再帰を避けるため基本情報のみ）
    let parentDto: IssueResponseDto | undefined;
    if (issue.parent) {
      const parentWbsNumber = calculateSingleWBSNumber(issue.parent.id, wbsData) || '1';
      parentDto = {
        id: issue.parent.id,
        project_id: issue.parent.project_id,
        parent_id: issue.parent.parent_id,
        title: issue.parent.title,
        description_md: issue.parent.description_md,
        assignee: issue.parent.assignee,
        status: issue.parent.status,
        start_date: issue.parent.start_date,
        end_date: issue.parent.end_date,
        progress_pct: issue.parent.progress_pct,
        effort_hours: issue.parent.effort_hours,
        is_blocked: issue.parent.is_blocked,
        sort_order: issue.parent.sort_order,
        labels: issue.parent.labels,
        version: issue.parent.version,
        created_at: issue.parent.created_at,
        updated_at: issue.parent.updated_at,
        wbs_number: parentWbsNumber,
      } as IssueResponseDto;
    }

    // 子Issueの処理（再帰を避けるため基本情報のみ）
    let childrenDto: IssueResponseDto[] | undefined;
    if (issue.children && issue.children.length > 0) {
      childrenDto = issue.children.map((child: any) => {
        const childWbsNumber = calculateSingleWBSNumber(child.id, wbsData) || '1';
        return {
          id: child.id,
          project_id: child.project_id,
          parent_id: child.parent_id,
          title: child.title,
          description_md: child.description_md,
          assignee: child.assignee,
          status: child.status,
          start_date: child.start_date,
          end_date: child.end_date,
          progress_pct: child.progress_pct,
          effort_hours: child.effort_hours,
          is_blocked: child.is_blocked,
          sort_order: child.sort_order,
          labels: child.labels,
          version: child.version,
          created_at: child.created_at,
          updated_at: child.updated_at,
          wbs_number: childWbsNumber,
        } as IssueResponseDto;
      });
    }

    return plainToClass(IssueResponseDto, {
      id: issue.id,
      project_id: issue.project_id,
      parent_id: issue.parent_id,
      title: issue.title,
      description_md: issue.description_md,
      assignee: issue.assignee,
      status: issue.status,
      start_date: issue.start_date,
      end_date: issue.end_date,
      progress_pct: issue.progress_pct,
      effort_hours: issue.effort_hours,
      is_blocked: issue.is_blocked,
      sort_order: issue.sort_order,
      labels: issue.labels,
      version: issue.version,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      wbs_number: wbsNumber,
      parent: parentDto,
      children: childrenDto,
    });
  }
}