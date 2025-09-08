import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogResponseDto } from './dto';
import { ChangeEntityType, ChangeLog } from '@prisma/client';
import { plainToClass } from 'class-transformer';

/**
 * ChangeLogService - 変更履歴管理のビジネスロジック
 * 
 * 機能:
 * - Issue・Comment変更時の自動履歴記録
 * - 変更履歴の取得（Issue別、プロジェクト別）
 * - diff_jsonによる変更差分の記録
 * - エンティティタイプによる分類処理
 */
@Injectable()
export class ChangeLogService {
  private readonly logger = new Logger(ChangeLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issue変更記録
   * @param entityId エンティティID（IssueID）
   * @param diff 変更差分オブジェクト
   * @param projectId プロジェクトID
   * @param userHint ユーザー識別ヒント
   * @returns 作成された変更ログ
   */
  async recordIssueChange(
    entityId: string,
    diff: Record<string, any>,
    projectId: string,
    userHint?: string
  ): Promise<ChangeLogResponseDto> {
    this.logger.log(`Recording issue change for issue: ${entityId}`);

    try {
      const changeLog = await this.prisma.changeLog.create({
        data: {
          entity_type: ChangeEntityType.Issue,
          entity_id: entityId,
          project_id: projectId,
          diff_json: diff,
          user_hint: userHint || null,
        },
      });

      this.logger.log(`Issue change recorded successfully: ${changeLog.id}`);
      return this.toResponseDto(changeLog);
    } catch (error) {
      this.logger.error(`Failed to record issue change for ${entityId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Comment変更記録
   * @param entityId エンティティID（CommentID）
   * @param diff 変更差分オブジェクト
   * @param projectId プロジェクトID
   * @param userHint ユーザー識別ヒント
   * @returns 作成された変更ログ
   */
  async recordCommentChange(
    entityId: string,
    diff: Record<string, any>,
    projectId: string,
    userHint?: string
  ): Promise<ChangeLogResponseDto> {
    this.logger.log(`Recording comment change for comment: ${entityId}`);

    try {
      const changeLog = await this.prisma.changeLog.create({
        data: {
          entity_type: ChangeEntityType.Comment,
          entity_id: entityId,
          project_id: projectId,
          diff_json: diff,
          user_hint: userHint || null,
        },
      });

      this.logger.log(`Comment change recorded successfully: ${changeLog.id}`);
      return this.toResponseDto(changeLog);
    } catch (error) {
      this.logger.error(`Failed to record comment change for ${entityId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Issue別変更履歴取得
   * @param entityId エンティティID（IssueID）
   * @returns Issue変更履歴一覧（作成日時降順）
   */
  async getChangeLogsByEntity(entityId: string): Promise<ChangeLogResponseDto[]> {
    this.logger.log(`Finding change logs for entity: ${entityId}`);

    try {
      const changeLogs = await this.prisma.changeLog.findMany({
        where: {
          entity_id: entityId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      this.logger.log(`Found ${changeLogs.length} change logs for entity: ${entityId}`);
      return changeLogs.map(log => this.toResponseDto(log));
    } catch (error) {
      this.logger.error(`Failed to find change logs for entity ${entityId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト別変更履歴取得
   * @param projectId プロジェクトID
   * @returns プロジェクト変更履歴一覧（作成日時降順）
   * @throws NotFoundException プロジェクトが存在しない場合
   */
  async getChangeLogsByProject(projectId: string): Promise<ChangeLogResponseDto[]> {
    this.logger.log(`Finding change logs for project: ${projectId}`);

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

      const changeLogs = await this.prisma.changeLog.findMany({
        where: {
          project_id: projectId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      this.logger.log(`Found ${changeLogs.length} change logs for project: ${projectId}`);
      return changeLogs.map(log => this.toResponseDto(log));
    } catch (error) {
      this.logger.error(`Failed to find change logs for project ${projectId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * ChangeLogをChangeLogResponseDTOに変換
   * @param changeLog ChangeLogエンティティ
   * @returns ChangeLogResponseDTO
   */
  private toResponseDto(changeLog: ChangeLog): ChangeLogResponseDto {
    return plainToClass(ChangeLogResponseDto, {
      id: changeLog.id,
      entity_type: changeLog.entity_type,
      entity_id: changeLog.entity_id,
      project_id: changeLog.project_id,
      diff_json: changeLog.diff_json,
      user_hint: changeLog.user_hint,
      created_at: changeLog.created_at,
    });
  }
}