import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';
import { Comment } from '@prisma/client';
import { plainToClass } from 'class-transformer';

/**
 * CommentsService - Comment管理のビジネスロジック
 * 
 * 機能:
 * - Comment基本CRUD操作（create, findByIssue, findOne, update, remove）
 * - Issue存在確認
 * - editedフラグ自動管理（更新時にtrueに設定）
 * - レスポンスDTO変換
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

      // 物理削除
      await this.prisma.comment.delete({
        where: { id },
      });

      this.logger.log(`Comment removed with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to remove comment: ${error.message}`, error.stack);
      throw error;
    }
  }
}