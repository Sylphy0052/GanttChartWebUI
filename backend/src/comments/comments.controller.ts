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
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

/**
 * CommentsController - Comment REST エンドポイント
 * 
 * エンドポイント:
 * - GET /issues/:issueId/comments - コメント一覧取得 [viewer権限]
 * - POST /issues/:issueId/comments - コメント作成 [editor権限]
 * - PUT /comments/:id - コメント編集 [editor権限]
 * - DELETE /comments/:id - コメント削除 [editor権限]
 * 
 * 権限管理:
 * - viewer: GET系操作のみ可能
 * - editor: 全ての操作が可能
 * 
 * 各エンドポイントには適切なHTTPステータスコードとバリデーションを適用
 */
@Controller()
@UseGuards(RoleGuard)
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Issue別コメント一覧取得
   * @param issueId Issue ID
   * @returns コメント一覧（作成日時昇順）
   */
  @Get('issues/:issueId/comments')
  @HttpCode(HttpStatus.OK)
  @RequireRole('viewer')
  async findByIssue(@Param('issueId') issueId: string): Promise<CommentResponseDto[]> {
    this.logger.log(`GET /issues/${issueId}/comments - Fetching comments for issue`);
    
    const result = await this.commentsService.findByIssue(issueId);
    
    this.logger.log(`GET /issues/${issueId}/comments - Returned ${result.length} comments`);
    return result;
  }

  /**
   * コメント作成
   * @param issueId Issue ID
   * @param createCommentDto 作成データ
   * @returns 作成されたコメント
   */
  @Post('issues/:issueId/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('editor')
  async create(
    @Param('issueId') issueId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) 
    createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    this.logger.log(`POST /issues/${issueId}/comments - Creating comment: ${createCommentDto.content?.substring(0, 50) || 'N/A'}...`);
    
    const result = await this.commentsService.create(issueId, createCommentDto);
    
    this.logger.log(`POST /issues/${issueId}/comments - Comment created successfully: ${result.id}`);
    return result;
  }

  /**
   * コメント編集
   * @param id Comment ID
   * @param updateCommentDto 更新データ
   * @returns 更新されたコメント
   */
  @Put('comments/:id')
  @HttpCode(HttpStatus.OK)
  @RequireRole('editor')
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true, skipMissingProperties: true })) 
    updateCommentDto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    this.logger.log(`PUT /comments/${id} - Updating comment`);
    
    const result = await this.commentsService.update(id, updateCommentDto);
    
    this.logger.log(`PUT /comments/${id} - Comment updated successfully`);
    return result;
  }

  /**
   * コメント削除
   * @param id Comment ID
   */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole('editor')
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /comments/${id} - Deleting comment`);
    
    await this.commentsService.remove(id);
    
    this.logger.log(`DELETE /comments/${id} - Comment deleted successfully`);
  }
}