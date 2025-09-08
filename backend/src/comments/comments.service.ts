import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { CommentNotificationData } from '../websocket/interfaces/websocket-notification.interface';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';
import { Comment } from '@prisma/client';
import { plainToClass } from 'class-transformer';

/**
 * CommentsService - Comment管理のビジネスロジック（ChangeLog・WebSocket通知統合版）
 * 
 * 機能:
 * - Comment基本CRUD操作（create, findByIssue, findOne, update, remove）
 * - Issue存在確認
 * - editedフラグ自動管理（更新時にtrueに設定）
 * - レスポンスDTO変換
 * - ChangeLog自動記録（作成・更新・削除時）
 * - WebSocket通知自動配信（作成・更新・削除時）
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLogService: ChangeLogService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Comment作成
   * @param issueId Issue ID
   * @param createCommentDto 作成データ
   * @returns 作成されたComment
   * @throws NotFoundException 指定されたIssueが存在しない場合
   */
  async create(issueId: string, createCommentDto: CreateCommentDto): Promise<CommentResponseDto> {
    this.logger.log(`Creating comment for issue: ${issueId}`);

    try {
      // Issue存在確認
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          is_deleted: false,
        },
      });

      if (!issue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      // Comment作成（CreateCommentDtoのcontentをbody_mdにマッピング）
      const comment = await this.prisma.comment.create({
        data: {
          issue_id: issueId,
          author: createCommentDto.author,
          body_md: createCommentDto.content,
          edited: false,
        },
      });

      // ChangeLog記録 - Comment作成
      try {
        await this.changeLogService.recordCommentChange(
          comment.id,
          {
            action: 'create',
            author: comment.author,
            body_md: comment.body_md,
            issue_id: issueId,
          },
          issue.project_id,
          createCommentDto.author,
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for comment creation ${comment.id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Comment作成を阻害しない
      }

      // WebSocket通知配信 - Comment作成
      try {
        const commentNotificationData: CommentNotificationData = {
          action: 'create',
          comment: {
            id: comment.id,
            author: comment.author,
            body_md: comment.body_md,
            issue_id: comment.issue_id,
            edited: comment.edited,
          },
          issue: {
            id: issue.id,
            title: issue.title,
            project_id: issue.project_id,
          },
          author: createCommentDto.author,
        };
        
        await this.notificationGateway.notifyCommentChanged(commentNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for comment creation ${comment.id}: ${notificationError.message}`);
        // WebSocket通知エラーは Comment作成を阻害しない
      }

      this.logger.log(`Comment created with ID: ${comment.id}`);
      return plainToClass(CommentResponseDto, comment);
    } catch (error) {
      this.logger.error(`Failed to create comment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Issue別コメント一覧取得
   * @param issueId Issue ID
   * @returns コメント配列（作成日時昇順）
   * @throws NotFoundException 指定されたIssueが存在しない場合
   */
  async findByIssue(issueId: string): Promise<CommentResponseDto[]> {
    this.logger.log(`Finding comments for issue: ${issueId}`);

    try {
      // Issue存在確認
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          is_deleted: false,
        },
      });

      if (!issue) {
        throw new NotFoundException('指定されたIssueが見つかりません');
      }

      const comments = await this.prisma.comment.findMany({
        where: {
          issue_id: issueId,
        },
        orderBy: {
          created_at: 'asc',
        },
      });

      return comments.map(comment => plainToClass(CommentResponseDto, comment));
    } catch (error) {
      this.logger.error(`Failed to find comments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 単一コメント取得
   * @param id Comment ID
   * @returns コメント情報
   * @throws NotFoundException コメントが存在しない場合
   */
  async findOne(id: string): Promise<CommentResponseDto> {
    this.logger.log(`Finding comment with ID: ${id}`);

    try {
      const comment = await this.prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        throw new NotFoundException('指定されたコメントが見つかりません');
      }

      return plainToClass(CommentResponseDto, comment);
    } catch (error) {
      this.logger.error(`Failed to find comment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * コメント更新
   * @param id Comment ID
   * @param updateCommentDto 更新データ
   * @returns 更新されたComment
   * @throws NotFoundException コメントが存在しない場合
   */
  async update(id: string, updateCommentDto: UpdateCommentDto): Promise<CommentResponseDto> {
    this.logger.log(`Updating comment with ID: ${id}`);

    try {
      // コメント存在確認
      const existingComment = await this.prisma.comment.findUnique({
        where: { id },
      });

      if (!existingComment) {
        throw new NotFoundException('指定されたコメントが見つかりません');
      }

      // Issue情報取得（ChangeLog用project_id取得のため）
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: existingComment.issue_id,
          is_deleted: false,
        },
      });

      if (!issue) {
        throw new NotFoundException('関連するIssueが見つかりません');
      }

      // 更新前の値を記録（ChangeLog用）
      const previousValues = {
        author: existingComment.author,
        body_md: existingComment.body_md,
        edited: existingComment.edited,
      };

      // 更新データ準備（contentがある場合はbody_mdにマッピングし、editedをtrueに）
      const updateData: any = {};
      
      if (updateCommentDto.content !== undefined) {
        updateData.body_md = updateCommentDto.content;
        updateData.edited = true; // contentが更新される場合はeditedフラグをtrueに
      }
      
      if (updateCommentDto.author !== undefined) {
        updateData.author = updateCommentDto.author;
      }

      const updatedComment = await this.prisma.comment.update({
        where: { id },
        data: updateData,
      });

      // ChangeLog記録 - 変更差分のみ記録
      try {
        const changes: Record<string, any> = { action: 'update' };
        let hasChanges = false;

        Object.keys(updateData).forEach(key => {
          if (previousValues[key] !== updateData[key]) {
            changes[`${key}_from`] = previousValues[key];
            changes[`${key}_to`] = updateData[key];
            hasChanges = true;
          }
        });

        if (hasChanges) {
          await this.changeLogService.recordCommentChange(
            updatedComment.id,
            changes,
            issue.project_id,
            updateCommentDto.author || existingComment.author,
          );
        }
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for comment update ${id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Comment更新を阻害しない
      }

      // WebSocket通知配信 - Comment更新（変更があった場合のみ）
      try {
        let hasChanges = false;
        Object.keys(updateData).forEach(key => {
          if (previousValues[key] !== updateData[key]) {
            hasChanges = true;
          }
        });

        if (hasChanges) {
          const commentNotificationData: CommentNotificationData = {
            action: 'update',
            comment: {
              id: updatedComment.id,
              author: updatedComment.author,
              body_md: updatedComment.body_md,
              issue_id: updatedComment.issue_id,
              edited: updatedComment.edited,
            },
            issue: {
              id: issue.id,
              title: issue.title,
              project_id: issue.project_id,
            },
            author: updateCommentDto.author || existingComment.author,
          };
          
          await this.notificationGateway.notifyCommentChanged(commentNotificationData);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for comment update ${id}: ${notificationError.message}`);
        // WebSocket通知エラーは Comment更新を阻害しない
      }

      this.logger.log(`Comment updated with ID: ${updatedComment.id}`);
      return plainToClass(CommentResponseDto, updatedComment);
    } catch (error) {
      this.logger.error(`Failed to update comment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * コメント削除
   * @param id Comment ID
   * @throws NotFoundException コメントが存在しない場合
   */
  async remove(id: string): Promise<void> {
    this.logger.log(`Removing comment with ID: ${id}`);

    try {
      // コメント存在確認
      const existingComment = await this.prisma.comment.findUnique({
        where: { id },
      });

      if (!existingComment) {
        throw new NotFoundException('指定されたコメントが見つかりません');
      }

      // Issue情報取得（ChangeLog用project_id取得のため）
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: existingComment.issue_id,
          is_deleted: false,
        },
      });

      if (!issue) {
        throw new NotFoundException('関連するIssueが見つかりません');
      }

      // 物理削除
      await this.prisma.comment.delete({
        where: { id },
      });

      // ChangeLog記録 - Comment削除
      try {
        await this.changeLogService.recordCommentChange(
          id,
          {
            action: 'delete',
            author: existingComment.author,
            body_md: existingComment.body_md,
            deleted_at: new Date(),
          },
          issue.project_id,
          'system',
        );
      } catch (changeLogError) {
        this.logger.warn(`Failed to record change log for comment deletion ${id}: ${changeLogError.message}`);
        // ChangeLog記録エラーは Comment削除を阻害しない
      }

      // WebSocket通知配信 - Comment削除
      try {
        const commentNotificationData: CommentNotificationData = {
          action: 'delete',
          comment: {
            id: existingComment.id,
            author: existingComment.author,
            body_md: existingComment.body_md,
            issue_id: existingComment.issue_id,
            edited: existingComment.edited,
          },
          issue: {
            id: issue.id,
            title: issue.title,
            project_id: issue.project_id,
          },
          author: 'system',
        };
        
        await this.notificationGateway.notifyCommentChanged(commentNotificationData);
      } catch (notificationError) {
        this.logger.warn(`Failed to send WebSocket notification for comment deletion ${id}: ${notificationError.message}`);
        // WebSocket通知エラーは Comment削除を阻害しない
      }

      this.logger.log(`Comment removed with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to remove comment: ${error.message}`, error.stack);
      throw error;
    }
  }
}