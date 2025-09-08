import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { IssueNotificationData } from '../websocket/interfaces/websocket-notification.interface';
import { CreateIssueDto, UpdateIssueDto, IssueResponseDto } from './dto';
import { Issue } from '@prisma/client';
import { plainToClass } from 'class-transformer';

/**
 * IssuesService - Issue管理のビジネスロジック（ChangeLog・WebSocket通知統合版）
 * 
 * 機能:
 * - Issue基本CRUD操作（create, findAll, findOne, update, remove）
 * - 論理削除対応（is_deleted=true）
 * - 階層構造（parent-child関係）の処理
 * - レスポンスDTO変換
 * - ChangeLog自動記録（作成・更新・削除時）
 * - WebSocket通知自動配信（作成・更新・削除時）
 * - ImagePath自動クリーンアップ（削除時）
 */
@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLogService: ChangeLogService,
    @Inject(forwardRef(() => UploadsService))
    private readonly uploadsService: UploadsService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Issue作成
   * @param createIssueDto 作成データ
   * @returns 作成されたIssue
   * @throws BadRequestException parent_idが無効な場合
   * @throws NotFoundException 関連するプロジェクトまたは親Issueが存在しない場合
   */
  async create(createIssueDto: CreateIssueDto): Promise<IssueResponseDto> {
    this.logger.log(`Creating issue: ${createIssueDto.title}`);

    try {
      // プロジェクトの存在確認
      const project = await this.prisma.project.findFirst({
        where: {
          id: createIssueDto.project_id,
          is_deleted: false,
        },
      });

      if (!project) {
        throw new NotFoundException('指定されたプロジェクトが見つかりません');
      }

      // parent_id が指定されている場合の親Issue検証
      if (createIssueDto.parent_id) {
        const parentIssue = await this.prisma.issue.findFirst({
          where: {
            id: createIssueDto.parent_id,
            project_id: createIssueDto.project_id, // 同一プロジェクト内であること
            is_deleted: false,
          },
        });

        if (!parentIssue) {
          throw new BadRequestException('指定された親Issueが見つかりません、または異なるプロジェクトに所属しています');
        }
      }

      // Issueの作成
      const issue = await this.prisma.issue.create({
        data: {
          project_id: createIssueDto.project_id,
          parent_id: createIssueDto.parent_id || null,
          title: createIssueDto.title,
          description_md: createIssueDto.description_md || null,
          assignee: createIssueDto.assignee || null,
          status: createIssueDto.status || 'open',
          start_date: createIssueDto.start_date ? new Date(createIssueDto.start_date) : null,
          end_date: createIssueDto.end_date ? new Date(createIssueDto.end_date) : null,
          progress_pct: createIssueDto.progress_pct || 0,
          effort_hours: createIssueDto.effort_hours || null,
          is_blocked: createIssueDto.is_blocked || false,
          sort_order: createIssueDto.sort_order || 0,
          labels: createIssueDto.labels || [],
        },
      });

      // ChangeLog記録 - Issue作成
      try {
        await this.changeLogService.recordIssueChange(
          issue.id,
          {
            action: 'create',
            title: issue.title,
            assignee: issue.assignee,
            status: issue.status,
            start_date: issue.start_date,
            end_date: issue.end_date,
            progress_pct: issue.progress_pct,
          },
          issue.project_id,
          createIssueDto.assignee || 'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue creation ${issue.id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Issue作成を阻害しない
      }

      // WebSocket通知配信 - Issue作成
      try {
        const issueNotificationData: IssueNotificationData = {
          action: 'create',
          issue: {
            id: issue.id,
            title: issue.title,
            description_md: issue.description_md,
            assignee: issue.assignee,
            status: issue.status,
            start_date: issue.start_date,
            end_date: issue.end_date,
            progress_pct: issue.progress_pct,
            project_id: issue.project_id,
            parent_id: issue.parent_id,
          },
          author: createIssueDto.assignee || 'system',
        };
        
        await this.notificationGateway.notifyIssueChanged(issueNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for issue creation ${issue.id}: ${notificationError.message}`);
        // WebSocket通知エラーは Issue作成を阻害しない
      }

      this.logger.log(`Issue created successfully: ${issue.id}`);
      return this.toResponseDto(issue);
    } catch (error) {
      this.logger.error(`Failed to create issue: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト内Issue一覧取得
   * @param projectId プロジェクトID
   * @returns プロジェクト内のIssue一覧（論理削除済み除外）
   * @throws NotFoundException プロジェクトが存在しない場合
   */
  async findAll(projectId: string): Promise<IssueResponseDto[]> {
    this.logger.log(`Finding all issues for project: ${projectId}`);

    try {
      // プロジェクトの存在確認
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          is_deleted: false,
        },
      });

      if (!project) {
        throw new NotFoundException('指定されたプロジェクトが見つかりません');
      }

      // プロジェクト内のIssue一覧を取得（論理削除済み除外）
      const issues = await this.prisma.issue.findMany({
        where: {
          project_id: projectId,
          is_deleted: false,
        },
        include: {
          children: {
            where: {
              is_deleted: false,
            },
          },
          parent: true,
        },
        orderBy: [
          { sort_order: 'asc' },
          { created_at: 'desc' },
        ],
      });

      this.logger.log(`Found ${issues.length} issues for project: ${projectId}`);
      return issues.map(issue => this.toResponseDto(issue));
    } catch (error) {
      this.logger.error(`Failed to find issues for project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 単一Issue取得
   * @param id IssueID
   * @returns Issue詳細（階層情報含む）
   * @throws NotFoundException Issueが存在しない、または論理削除済みの場合
   */
  async findOne(id: string): Promise<IssueResponseDto> {
    this.logger.log(`Finding issue by id: ${id}`);

    try {
      const issue = await this.prisma.issue.findFirst({
        where: {
          id,
          is_deleted: false,
        },
        include: {
          children: {
            where: {
              is_deleted: false,
            },
            orderBy: [
              { sort_order: 'asc' },
              { created_at: 'desc' },
            ],
          },
          parent: true,
        },
      });

      if (!issue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      this.logger.log(`Found issue: ${issue.id} - ${issue.title}`);
      return this.toResponseDto(issue);
    } catch (error) {
      this.logger.error(`Failed to find issue ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue更新
   * @param id IssueID
   * @param updateIssueDto 更新データ
   * @returns 更新されたIssue
   * @throws NotFoundException Issueが存在しない、または論理削除済みの場合
   * @throws BadRequestException parent_idが無効な場合
   * @throws ConflictException 楽観的排他制御エラー
   */
  async update(id: string, updateIssueDto: UpdateIssueDto): Promise<IssueResponseDto> {
    this.logger.log(`Updating issue: ${id}`);

    try {
      // 既存Issueの存在確認
      const existingIssue = await this.prisma.issue.findFirst({
        where: {
          id,
          is_deleted: false,
        },
      });

      if (!existingIssue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      // parent_id が指定されている場合の検証
      if (updateIssueDto.parent_id !== undefined) {
        if (updateIssueDto.parent_id === id) {
          throw new BadRequestException('自分自身を親Issueに設定することはできません');
        }

        if (updateIssueDto.parent_id) {
          const parentIssue = await this.prisma.issue.findFirst({
            where: {
              id: updateIssueDto.parent_id,
              project_id: existingIssue.project_id, // 同一プロジェクト内であること
              is_deleted: false,
            },
          });

          if (!parentIssue) {
            throw new BadRequestException('指定された親Issueが見つかりません、または異なるプロジェクトに所属しています');
          }
        }
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
        effort_hours: existingIssue.effort_hours,
        is_blocked: existingIssue.is_blocked,
        sort_order: existingIssue.sort_order,
        labels: existingIssue.labels,
        parent_id: existingIssue.parent_id,
      };

      // 更新データの準備
      const updateData: any = {};
      
      if (updateIssueDto.title !== undefined) updateData.title = updateIssueDto.title;
      if (updateIssueDto.description_md !== undefined) updateData.description_md = updateIssueDto.description_md;
      if (updateIssueDto.assignee !== undefined) updateData.assignee = updateIssueDto.assignee;
      if (updateIssueDto.status !== undefined) updateData.status = updateIssueDto.status;
      if (updateIssueDto.start_date !== undefined) {
        updateData.start_date = updateIssueDto.start_date ? new Date(updateIssueDto.start_date) : null;
      }
      if (updateIssueDto.end_date !== undefined) {
        updateData.end_date = updateIssueDto.end_date ? new Date(updateIssueDto.end_date) : null;
      }
      if (updateIssueDto.progress_pct !== undefined) updateData.progress_pct = updateIssueDto.progress_pct;
      if (updateIssueDto.effort_hours !== undefined) updateData.effort_hours = updateIssueDto.effort_hours;
      if (updateIssueDto.is_blocked !== undefined) updateData.is_blocked = updateIssueDto.is_blocked;
      if (updateIssueDto.sort_order !== undefined) updateData.sort_order = updateIssueDto.sort_order;
      if (updateIssueDto.labels !== undefined) updateData.labels = updateIssueDto.labels;
      if (updateIssueDto.parent_id !== undefined) updateData.parent_id = updateIssueDto.parent_id || null;

      // 楽観的排他制御を使用してIssueを更新
      const updatedIssue = await this.prisma.issue.update({
        where: {
          id,
          version: existingIssue.version, // 楽観的排他制御
        },
        data: {
          ...updateData,
          version: { increment: 1 }, // バージョンをインクリメント
        },
      });

      // ChangeLog記録 - 変更差分のみ記録
      try {
        const changes: Record<string, any> = { action: 'update' };
        let hasChanges = false;

        Object.keys(updateData).forEach(key => {
          if (key !== 'version' && previousValues[key] !== updateData[key]) {
            changes[`${key}_from`] = previousValues[key];
            changes[`${key}_to`] = updateData[key];
            hasChanges = true;
          }
        });

        if (hasChanges) {
          await this.changeLogService.recordIssueChange(
            updatedIssue.id,
            changes,
            updatedIssue.project_id,
            updateIssueDto.assignee || existingIssue.assignee || 'system',
          );
        }
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue update ${id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Issue更新を阻害しない
      }

      // WebSocket通知配信 - Issue更新（変更があった場合のみ）
      try {
        let hasChanges = false;
        Object.keys(updateData).forEach(key => {
          if (key !== 'version' && previousValues[key] !== updateData[key]) {
            hasChanges = true;
          }
        });

        if (hasChanges) {
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
            author: updateIssueDto.assignee || existingIssue.assignee || 'system',
          };
          
          await this.notificationGateway.notifyIssueChanged(issueNotificationData);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for issue update ${id}: ${notificationError.message}`);
        // WebSocket通知エラーは Issue更新を阻害しない
      }

      this.logger.log(`Issue updated successfully: ${updatedIssue.id}`);
      return this.toResponseDto(updatedIssue);
    } catch (error) {
      if (error.code === 'P2025') {
        // Prismaの「Record to update not found」エラー（楽観的排他制御エラー）
        throw new ConflictException('Issueが他のユーザーによって更新されています。最新データを取得してから再度更新してください');
      }
      this.logger.error(`Failed to update issue ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue論理削除（ImagePathクリーンアップ・WebSocket通知統合版）
   * @param id IssueID
   * @returns 削除処理結果
   * @throws NotFoundException Issueが存在しない、または既に論理削除済みの場合
   * @throws ConflictException 子Issueが存在する場合
   */
  async remove(id: string): Promise<{ message: string }> {
    this.logger.log(`Removing issue: ${id}`);

    try {
      // 既存Issueの存在確認
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
          },
        },
      });

      if (!existingIssue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      // 子Issueが存在する場合は削除を拒否
      if (existingIssue.children && existingIssue.children.length > 0) {
        throw new ConflictException('子Issueが存在するため削除できません。先に子Issueを削除してください');
      }

      // Issue関連画像の削除（ImagePathクリーンアップ）
      try {
        const images = await this.uploadsService.getImagesByIssue(id);
        for (const image of images) {
          await this.uploadsService.deleteImage(image.id);
          this.logger.log(`Deleted image ${image.id} for issue ${id}`);
        }
      } catch (imageCleanupError) {
        this.logger.warn(`Failed to cleanup images for issue ${id}: ${imageCleanupError.message}`);
        // 画像削除エラーはIssue削除を阻害しない
      }

      // 論理削除の実行
      await this.prisma.issue.update({
        where: {
          id,
        },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          version: { increment: 1 }, // バージョンをインクリメント
        },
      });

      // ChangeLog記録 - Issue削除
      try {
        await this.changeLogService.recordIssueChange(
          id,
          {
            action: 'delete',
            title: existingIssue.title,
            deleted_at: new Date(),
          },
          existingIssue.project_id,
          'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for issue deletion ${id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Issue削除を阻害しない
      }

      // WebSocket通知配信 - Issue削除
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
        this.logger.warn(`Failed to send WebSocket notification for issue deletion ${id}: ${notificationError.message}`);
        // WebSocket通知エラーは Issue削除を阻害しない
      }

      this.logger.log(`Issue removed successfully: ${id}`);
      return { message: 'Issueが正常に削除されました' };
    } catch (error) {
      this.logger.error(`Failed to remove issue ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * IssueをIssueResponseDTOに変換
   * @param issue Issueエンティティ
   * @returns IssueResponseDTO
   */
  private toResponseDto(issue: Issue): IssueResponseDto {
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
    });
  }
}