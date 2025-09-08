import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { CreateCommentDto, UpdateCommentDto } from './dto';

/**
 * CommentsServiceの単体テスト
 * 
 * テスト範囲:
 * - Comment CRUD操作
 * - Issue存在確認
 * - ChangeLog記録統合
 * - WebSocket通知統合
 * - エラーハンドリング
 * - DTO変換
 */
describe('CommentsService', () => {
  let service: CommentsService;
  let prismaService: PrismaService;
  let changeLogService: ChangeLogService;
  let notificationGateway: NotificationGateway;

  const mockPrismaService = {
    issue: {
      findFirst: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockChangeLogService = {
    recordCommentChange: jest.fn(),
  };

  const mockNotificationGateway = {
    notifyCommentChanged: jest.fn(),
  };

  const mockIssue = {
    id: 'issue-1',
    title: 'Test Issue',
    project_id: 'project-1',
    is_deleted: false,
  };

  const mockComment = {
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
      providers: [
        CommentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ChangeLogService,
          useValue: mockChangeLogService,
        },
        {
          provide: NotificationGateway,
          useValue: mockNotificationGateway,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    changeLogService = module.get<ChangeLogService>(ChangeLogService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const issueId = 'issue-1';
    const createCommentDto: CreateCommentDto = {
      author: 'test-user',
      content: 'Test comment content',
    };

    beforeEach(() => {
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssue);
      mockPrismaService.comment.create.mockResolvedValue(mockComment);
      mockChangeLogService.recordCommentChange.mockResolvedValue(undefined);
      mockNotificationGateway.notifyCommentChanged.mockResolvedValue(undefined);
    });

    it('should create a comment successfully', async () => {
      const result = await service.create(issueId, createCommentDto);

      expect(mockPrismaService.issue.findFirst).toHaveBeenCalledWith({
        where: {
          id: issueId,
          is_deleted: false,
        },
      });
      expect(mockPrismaService.comment.create).toHaveBeenCalledWith({
        data: {
          issue_id: issueId,
          author: createCommentDto.author,
          body_md: createCommentDto.content,
          edited: false,
        },
      });
      expect(result.id).toBe(mockComment.id);
      expect(result.author).toBe(createCommentDto.author);
      expect(result.body_md).toBe(createCommentDto.content);
    });

    it('should record change log on comment creation', async () => {
      await service.create(issueId, createCommentDto);

      expect(mockChangeLogService.recordCommentChange).toHaveBeenCalledWith(
        mockComment.id,
        {
          action: 'create',
          author: mockComment.author,
          body_md: mockComment.body_md,
          issue_id: issueId,
        },
        mockIssue.project_id,
        createCommentDto.author,
      );
    });

    it('should send WebSocket notification on comment creation', async () => {
      await service.create(issueId, createCommentDto);

      expect(mockNotificationGateway.notifyCommentChanged).toHaveBeenCalledWith({
        action: 'create',
        comment: {
          id: mockComment.id,
          author: mockComment.author,
          body_md: mockComment.body_md,
          issue_id: mockComment.issue_id,
          edited: mockComment.edited,
        },
        issue: {
          id: mockIssue.id,
          title: mockIssue.title,
          project_id: mockIssue.project_id,
        },
        author: createCommentDto.author,
      });
    });

    it('should throw NotFoundException when issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.create(issueId, createCommentDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it('should continue when change log fails', async () => {
      mockChangeLogService.recordCommentChange.mockRejectedValue(
        new Error('ChangeLog error'),
      );

      const result = await service.create(issueId, createCommentDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.comment.create).toHaveBeenCalled();
    });

    it('should continue when WebSocket notification fails', async () => {
      mockNotificationGateway.notifyCommentChanged.mockRejectedValue(
        new Error('WebSocket error'),
      );

      const result = await service.create(issueId, createCommentDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.comment.create).toHaveBeenCalled();
    });
  });

  describe('findByIssue', () => {
    const issueId = 'issue-1';
    const mockComments = [mockComment, { ...mockComment, id: 'comment-2' }];

    beforeEach(() => {
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssue);
      mockPrismaService.comment.findMany.mockResolvedValue(mockComments);
    });

    it('should return comments for an issue', async () => {
      const result = await service.findByIssue(issueId);

      expect(mockPrismaService.issue.findFirst).toHaveBeenCalledWith({
        where: {
          id: issueId,
          is_deleted: false,
        },
      });
      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith({
        where: {
          issue_id: issueId,
        },
        orderBy: {
          created_at: 'asc',
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('comment-1');
    });

    it('should return empty array when no comments found', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([]);

      const result = await service.findByIssue(issueId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.findByIssue(issueId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const commentId = 'comment-1';

    it('should return a single comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);

      const result = await service.findOne(commentId);

      expect(mockPrismaService.comment.findUnique).toHaveBeenCalledWith({
        where: { id: commentId },
      });
      expect(result.id).toBe(mockComment.id);
      expect(result.author).toBe(mockComment.author);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(commentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const commentId = 'comment-1';
    const updateCommentDto: UpdateCommentDto = {
      content: 'Updated comment content',
      author: 'updated-user',
    };

    const updatedComment = {
      ...mockComment,
      body_md: updateCommentDto.content,
      author: updateCommentDto.author,
      edited: true,
    };

    beforeEach(() => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssue);
      mockPrismaService.comment.update.mockResolvedValue(updatedComment);
      mockChangeLogService.recordCommentChange.mockResolvedValue(undefined);
      mockNotificationGateway.notifyCommentChanged.mockResolvedValue(undefined);
    });

    it('should update a comment successfully', async () => {
      const result = await service.update(commentId, updateCommentDto);

      expect(mockPrismaService.comment.findUnique).toHaveBeenCalledWith({
        where: { id: commentId },
      });
      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: {
          body_md: updateCommentDto.content,
          edited: true,
          author: updateCommentDto.author,
        },
      });
      expect(result.body_md).toBe(updateCommentDto.content);
      expect(result.edited).toBe(true);
    });

    it('should set edited flag to true when content is updated', async () => {
      const contentOnlyUpdate = { content: 'Only content updated' };
      const resultComment = { ...mockComment, body_md: contentOnlyUpdate.content, edited: true };
      mockPrismaService.comment.update.mockResolvedValue(resultComment);

      const result = await service.update(commentId, contentOnlyUpdate);

      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: {
          body_md: contentOnlyUpdate.content,
          edited: true,
        },
      });
      expect(result.edited).toBe(true);
    });

    it('should record change log on comment update', async () => {
      await service.update(commentId, updateCommentDto);

      expect(mockChangeLogService.recordCommentChange).toHaveBeenCalledWith(
        commentId,
        expect.objectContaining({
          action: 'update',
          body_md_from: mockComment.body_md,
          body_md_to: updateCommentDto.content,
          author_from: mockComment.author,
          author_to: updateCommentDto.author,
          edited_from: mockComment.edited,
          edited_to: true,
        }),
        mockIssue.project_id,
        updateCommentDto.author,
      );
    });

    it('should send WebSocket notification on comment update', async () => {
      await service.update(commentId, updateCommentDto);

      expect(mockNotificationGateway.notifyCommentChanged).toHaveBeenCalledWith({
        action: 'update',
        comment: {
          id: updatedComment.id,
          author: updatedComment.author,
          body_md: updatedComment.body_md,
          issue_id: updatedComment.issue_id,
          edited: updatedComment.edited,
        },
        issue: {
          id: mockIssue.id,
          title: mockIssue.title,
          project_id: mockIssue.project_id,
        },
        author: updateCommentDto.author,
      });
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.update(commentId, updateCommentDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when related issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.update(commentId, updateCommentDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { content: 'Partially updated' };
      const partiallyUpdated = { ...mockComment, body_md: partialUpdate.content, edited: true };
      mockPrismaService.comment.update.mockResolvedValue(partiallyUpdated);

      const result = await service.update(commentId, partialUpdate);

      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: {
          body_md: partialUpdate.content,
          edited: true,
        },
      });
      expect(result.body_md).toBe(partialUpdate.content);
    });

    it('should continue when change log fails', async () => {
      mockChangeLogService.recordCommentChange.mockRejectedValue(
        new Error('ChangeLog error'),
      );

      const result = await service.update(commentId, updateCommentDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.comment.update).toHaveBeenCalled();
    });

    it('should continue when WebSocket notification fails', async () => {
      mockNotificationGateway.notifyCommentChanged.mockRejectedValue(
        new Error('WebSocket error'),
      );

      const result = await service.update(commentId, updateCommentDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.comment.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const commentId = 'comment-1';

    beforeEach(() => {
      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssue);
      mockPrismaService.comment.delete.mockResolvedValue(mockComment);
      mockChangeLogService.recordCommentChange.mockResolvedValue(undefined);
      mockNotificationGateway.notifyCommentChanged.mockResolvedValue(undefined);
    });

    it('should remove a comment successfully', async () => {
      await service.remove(commentId);

      expect(mockPrismaService.comment.findUnique).toHaveBeenCalledWith({
        where: { id: commentId },
      });
      expect(mockPrismaService.comment.delete).toHaveBeenCalledWith({
        where: { id: commentId },
      });
    });

    it('should record change log on comment deletion', async () => {
      await service.remove(commentId);

      expect(mockChangeLogService.recordCommentChange).toHaveBeenCalledWith(
        commentId,
        {
          action: 'delete',
          author: mockComment.author,
          body_md: mockComment.body_md,
          deleted_at: expect.any(Date),
        },
        mockIssue.project_id,
        'system',
      );
    });

    it('should send WebSocket notification on comment deletion', async () => {
      await service.remove(commentId);

      expect(mockNotificationGateway.notifyCommentChanged).toHaveBeenCalledWith({
        action: 'delete',
        comment: {
          id: mockComment.id,
          author: mockComment.author,
          body_md: mockComment.body_md,
          issue_id: mockComment.issue_id,
          edited: mockComment.edited,
        },
        issue: {
          id: mockIssue.id,
          title: mockIssue.title,
          project_id: mockIssue.project_id,
        },
        author: 'system',
      });
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.remove(commentId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when related issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.remove(commentId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.delete).not.toHaveBeenCalled();
    });

    it('should continue when change log fails', async () => {
      mockChangeLogService.recordCommentChange.mockRejectedValue(
        new Error('ChangeLog error'),
      );

      await expect(service.remove(commentId)).resolves.not.toThrow();
      expect(mockPrismaService.comment.delete).toHaveBeenCalled();
    });

    it('should continue when WebSocket notification fails', async () => {
      mockNotificationGateway.notifyCommentChanged.mockRejectedValue(
        new Error('WebSocket error'),
      );

      await expect(service.remove(commentId)).resolves.not.toThrow();
      expect(mockPrismaService.comment.delete).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.issue.findFirst.mockRejectedValue(dbError);

      await expect(service.findByIssue('issue-1')).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockPrismaService.comment.create.mockRejectedValue(unexpectedError);
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssue);

      await expect(
        service.create('issue-1', { author: 'test', content: 'test' }),
      ).rejects.toThrow('Unexpected error');
    });
  });
});