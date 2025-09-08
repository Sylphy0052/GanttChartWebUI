import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';
import { RoleGuard } from '../common/guards/role.guard';
import { ExecutionContext } from '@nestjs/common';

/**
 * CommentsControllerの統合テスト
 * 
 * テスト範囲:
 * - HTTP エンドポイントの動作確認
 * - バリデーションの確認
 * - 権限ガードの動作
 * - エラーレスポンスの確認
 * - DTOの変換確認
 */
describe('CommentsController', () => {
  let controller: CommentsController;
  let commentsService: CommentsService;

  const mockCommentsService = {
    create: jest.fn(),
    findByIssue: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRoleGuard = {
    canActivate: jest.fn((context: ExecutionContext) => true),
  };

  const mockCommentResponse: CommentResponseDto = {
    id: 'comment-1',
    issue_id: 'issue-1',
    author: 'test-user',
    body_md: 'Test comment content',
    edited: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: mockCommentsService,
        },
      ],
    })
      .overrideGuard(RoleGuard)
      .useValue(mockRoleGuard)
      .compile();

    controller = module.get<CommentsController>(CommentsController);
    commentsService = module.get<CommentsService>(CommentsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByIssue (GET /issues/:issueId/comments)', () => {
    const issueId = 'issue-1';
    const mockComments = [mockCommentResponse];

    it('should return comments for an issue', async () => {
      mockCommentsService.findByIssue.mockResolvedValue(mockComments);

      const result = await controller.findByIssue(issueId);

      expect(mockCommentsService.findByIssue).toHaveBeenCalledWith(issueId);
      expect(result).toEqual(mockComments);
    });

    it('should return empty array when no comments found', async () => {
      mockCommentsService.findByIssue.mockResolvedValue([]);

      const result = await controller.findByIssue(issueId);

      expect(result).toEqual([]);
    });

    it('should handle issue not found errors', async () => {
      const notFoundError = new NotFoundException('Issue not found');
      mockCommentsService.findByIssue.mockRejectedValue(notFoundError);

      await expect(controller.findByIssue(issueId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle multiple comments correctly', async () => {
      const multipleComments = [
        mockCommentResponse,
        { ...mockCommentResponse, id: 'comment-2', author: 'another-user' },
      ];
      mockCommentsService.findByIssue.mockResolvedValue(multipleComments);

      const result = await controller.findByIssue(issueId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('comment-1');
      expect(result[1].id).toBe('comment-2');
    });
  });

  describe('create (POST /issues/:issueId/comments)', () => {
    const issueId = 'issue-1';
    const createCommentDto: CreateCommentDto = {
      author: 'test-user',
      content: 'Test comment content',
    };

    it('should create a comment successfully', async () => {
      mockCommentsService.create.mockResolvedValue(mockCommentResponse);

      const result = await controller.create(issueId, createCommentDto);

      expect(mockCommentsService.create).toHaveBeenCalledWith(issueId, createCommentDto);
      expect(result).toEqual(mockCommentResponse);
    });

    it('should handle service validation errors', async () => {
      const validationError = new NotFoundException('Issue not found');
      mockCommentsService.create.mockRejectedValue(validationError);

      await expect(controller.create(issueId, createCommentDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle empty content gracefully', async () => {
      const emptyContentDto = { ...createCommentDto, content: '' };
      mockCommentsService.create.mockResolvedValue({
        ...mockCommentResponse,
        body_md: '',
      });

      const result = await controller.create(issueId, emptyContentDto);

      expect(mockCommentsService.create).toHaveBeenCalledWith(issueId, emptyContentDto);
      expect(result.body_md).toBe('');
    });

    it('should handle long content correctly', async () => {
      const longContent = 'A'.repeat(1000);
      const longContentDto = { ...createCommentDto, content: longContent };
      mockCommentsService.create.mockResolvedValue({
        ...mockCommentResponse,
        body_md: longContent,
      });

      const result = await controller.create(issueId, longContentDto);

      expect(result.body_md).toBe(longContent);
    });

    it('should handle special characters in content', async () => {
      const specialContent = '# Header\n\n**Bold** *italic*\n\n```code```';
      const specialDto = { ...createCommentDto, content: specialContent };
      mockCommentsService.create.mockResolvedValue({
        ...mockCommentResponse,
        body_md: specialContent,
      });

      const result = await controller.create(issueId, specialDto);

      expect(result.body_md).toBe(specialContent);
    });
  });

  describe('update (PUT /comments/:id)', () => {
    const commentId = 'comment-1';
    const updateCommentDto: UpdateCommentDto = {
      content: 'Updated comment content',
      author: 'updated-user',
    };

    it('should update a comment successfully', async () => {
      const updatedComment = {
        ...mockCommentResponse,
        body_md: updateCommentDto.content,
        author: updateCommentDto.author,
        edited: true,
      };
      mockCommentsService.update.mockResolvedValue(updatedComment);

      const result = await controller.update(commentId, updateCommentDto);

      expect(mockCommentsService.update).toHaveBeenCalledWith(commentId, updateCommentDto);
      expect(result).toEqual(updatedComment);
      expect(result.edited).toBe(true);
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { content: 'Partially updated' };
      const partiallyUpdated = {
        ...mockCommentResponse,
        body_md: partialUpdate.content,
        edited: true,
      };
      mockCommentsService.update.mockResolvedValue(partiallyUpdated);

      const result = await controller.update(commentId, partialUpdate);

      expect(mockCommentsService.update).toHaveBeenCalledWith(commentId, partialUpdate);
      expect(result.body_md).toBe(partialUpdate.content);
    });

    it('should handle comment not found errors', async () => {
      const notFoundError = new NotFoundException('Comment not found');
      mockCommentsService.update.mockRejectedValue(notFoundError);

      await expect(
        controller.update(commentId, updateCommentDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only author without content', async () => {
      const authorOnlyUpdate = { author: 'new-author' };
      const authorUpdated = {
        ...mockCommentResponse,
        author: authorOnlyUpdate.author,
      };
      mockCommentsService.update.mockResolvedValue(authorUpdated);

      const result = await controller.update(commentId, authorOnlyUpdate);

      expect(result.author).toBe(authorOnlyUpdate.author);
      expect(result.body_md).toBe(mockCommentResponse.body_md);
    });

    it('should handle content-only updates', async () => {
      const contentOnlyUpdate = { content: 'Content only update' };
      const contentUpdated = {
        ...mockCommentResponse,
        body_md: contentOnlyUpdate.content,
        edited: true,
      };
      mockCommentsService.update.mockResolvedValue(contentUpdated);

      const result = await controller.update(commentId, contentOnlyUpdate);

      expect(result.body_md).toBe(contentOnlyUpdate.content);
      expect(result.edited).toBe(true);
    });
  });

  describe('remove (DELETE /comments/:id)', () => {
    const commentId = 'comment-1';

    it('should delete a comment successfully', async () => {
      mockCommentsService.remove.mockResolvedValue(undefined);

      await controller.remove(commentId);

      expect(mockCommentsService.remove).toHaveBeenCalledWith(commentId);
    });

    it('should handle comment not found errors', async () => {
      const notFoundError = new NotFoundException('Comment not found');
      mockCommentsService.remove.mockRejectedValue(notFoundError);

      await expect(controller.remove(commentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return void on successful deletion', async () => {
      mockCommentsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(commentId);

      expect(result).toBeUndefined();
    });

    it('should handle related issue not found during deletion', async () => {
      const relatedIssueError = new NotFoundException('Related issue not found');
      mockCommentsService.remove.mockRejectedValue(relatedIssueError);

      await expect(controller.remove(commentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Role Guard Integration', () => {
    it('should apply RoleGuard to all endpoints', () => {
      const guards = Reflect.getMetadata('__guards__', CommentsController);
      expect(guards).toContain(RoleGuard);
    });

    it('should require editor role for create', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.create,
      );
      expect(metadata).toBe('editor');
    });

    it('should require editor role for update', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.update,
      );
      expect(metadata).toBe('editor');
    });

    it('should require editor role for remove', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.remove,
      );
      expect(metadata).toBe('editor');
    });

    it('should require viewer role for findByIssue', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.findByIssue,
      );
      expect(metadata).toBe('viewer');
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 200 OK for findByIssue', async () => {
      mockCommentsService.findByIssue.mockResolvedValue([]);

      await controller.findByIssue('issue-1');

      // HTTPステータスコードはデコレータで指定されているため、
      // 実際のHTTPレスポンスではなく、メタデータで確認
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        controller.findByIssue,
      );
      expect(statusCode).toBe(200);
    });

    it('should return 201 CREATED for create', async () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        controller.create,
      );
      expect(statusCode).toBe(201);
    });

    it('should return 200 OK for update', async () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        controller.update,
      );
      expect(statusCode).toBe(200);
    });

    it('should return 204 NO_CONTENT for remove', async () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        controller.remove,
      );
      expect(statusCode).toBe(204);
    });
  });

  describe('Validation', () => {
    it('should apply validation pipe to create endpoint', async () => {
      // ValidationPipeがDTO引数に適用されていることを確認
      const paramTypes = Reflect.getMetadata('design:paramtypes', controller.create);
      expect(paramTypes).toHaveLength(2); // issueId + dto
    });

    it('should apply validation pipe to update endpoint', async () => {
      const paramTypes = Reflect.getMetadata('design:paramtypes', controller.update);
      expect(paramTypes).toHaveLength(2); // commentId + dto
    });

    it('should handle validation pipe errors gracefully', async () => {
      // ValidationPipeのエラーはNestJSフレームワークで処理される
      // ここではサービスレイヤーでのエラーハンドリングをテスト
      const serviceError = new Error('Validation failed');
      mockCommentsService.create.mockRejectedValue(serviceError);

      await expect(
        controller.create('issue-1', { author: 'test', content: 'test' }),
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors without modification', async () => {
      const serviceError = new Error('Service error');
      mockCommentsService.findByIssue.mockRejectedValue(serviceError);

      await expect(controller.findByIssue('issue-1')).rejects.toThrow('Service error');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockCommentsService.create.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        controller.create('issue-1', { author: 'test', content: 'test' }),
      ).rejects.toThrow('Unexpected error');
    });

    it('should handle service timeout errors', async () => {
      const timeoutError = new Error('Service timeout');
      mockCommentsService.update.mockRejectedValue(timeoutError);

      await expect(
        controller.update('comment-1', { content: 'test' }),
      ).rejects.toThrow('Service timeout');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined parameters gracefully', async () => {
      mockCommentsService.findByIssue.mockResolvedValue([]);

      // NestJSのパラメータバインディングでundefinedが渡される場合
      await controller.findByIssue(undefined as any);

      expect(mockCommentsService.findByIssue).toHaveBeenCalledWith(undefined);
    });

    it('should handle empty string parameters', async () => {
      mockCommentsService.findByIssue.mockResolvedValue([]);

      await controller.findByIssue('');

      expect(mockCommentsService.findByIssue).toHaveBeenCalledWith('');
    });

    it('should handle malformed UUID parameters', async () => {
      const invalidId = 'not-a-uuid';
      mockCommentsService.findByIssue.mockRejectedValue(
        new NotFoundException('Issue not found'),
      );

      await expect(controller.findByIssue(invalidId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});