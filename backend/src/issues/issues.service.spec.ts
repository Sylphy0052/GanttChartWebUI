import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { CreateIssueDto, UpdateIssueDto } from './dto';

/**
 * IssuesService の単体テスト
 * 
 * テスト対象:
 * - CRUD操作（create, findAllByProject, findOne, update, remove）
 * - バリデーション機能
 * - 楽観的排他制御
 * - エラーハンドリング
 * - ChangeLogとNotification統合
 * 
 * テストカバレッジ:
 * - 正常系: 基本的なCRUD操作の成功ケース
 * - 異常系: 存在しないデータ、バリデーションエラー、楽観的排他制御エラー
 * - 境界値: 空データ、極端な値、null/undefined
 */
describe('IssuesService', () => {
  let service: IssuesService;
  let prismaService: PrismaService;
  let changeLogService: ChangeLogService;
  let uploadsService: UploadsService;
  let notificationGateway: NotificationGateway;

  // モック用サンプルデータ
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    is_deleted: false,
  };

  const mockIssue = {
    id: 'issue-1',
    project_id: 'project-1',
    parent_id: null,
    title: 'Test Issue',
    description_md: '# Test\n\nTest issue description',
    assignee: 'test-user',
    status: 'open' as const,
    start_date: new Date('2024-06-01'),
    end_date: new Date('2024-06-30'),
    progress_pct: 0,
    effort_hours: 8,
    sort_order: 0,
    is_blocked: false,
    labels: ['bug', 'urgent'],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    version: 1,
    is_deleted: false,
    deleted_at: null,
    children: [],
    parent: null,
  };

  const mockChildIssue = {
    ...mockIssue,
    id: 'issue-2',
    parent_id: 'issue-1',
    title: 'Child Issue',
    sort_order: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findFirst: jest.fn(),
            },
            issue: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ChangeLogService,
          useValue: {
            recordIssueChange: jest.fn(),
          },
        },
        {
          provide: UploadsService,
          useValue: {
            getImagesByIssue: jest.fn(),
          },
        },
        {
          provide: NotificationGateway,
          useValue: {
            notifyIssueChanged: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IssuesService>(IssuesService);
    prismaService = module.get<PrismaService>(PrismaService);
    changeLogService = module.get<ChangeLogService>(ChangeLogService);
    uploadsService = module.get<UploadsService>(UploadsService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    const createIssueDto: CreateIssueDto = {
      title: 'New Issue',
      description_md: 'Issue description',
      assignee: 'test-user',
      start_date: '2024-06-01',
      end_date: '2024-06-30',
      labels: ['feature'],
    };

    it('should create a new issue successfully', async () => {
      const newIssue = {
        ...mockIssue,
        ...createIssueDto,
        id: 'new-issue-id',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(newIssue);

      const result = await service.create('project-1', createIssueDto);

      expect(result).toEqual(newIssue);
      expect(prismaService.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 'project-1',
          title: createIssueDto.title,
          description_md: createIssueDto.description_md,
          assignee: createIssueDto.assignee,
          start_date: expect.any(Date),
          end_date: expect.any(Date),
          labels: createIssueDto.labels,
          status: 'open', // デフォルト値
          progress_pct: 0, // デフォルト値
          is_blocked: false, // デフォルト値
        }),
      });
    });

    it('should throw NotFoundException for non-existent project', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create('non-existent-project', createIssueDto)).rejects.toThrow(NotFoundException);
    });

    it('should create issue with minimal required fields', async () => {
      const minimalDto: CreateIssueDto = {
        title: 'Minimal Issue',
      };

      const minimalIssue = {
        ...mockIssue,
        ...minimalDto,
        id: 'minimal-issue-id',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(minimalIssue);

      const result = await service.create('project-1', minimalDto);

      expect(result).toEqual(minimalIssue);
      expect(prismaService.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: minimalDto.title,
          status: 'open', // デフォルト値
          progress_pct: 0, // デフォルト値
          is_blocked: false, // デフォルト値
          labels: [], // デフォルト値
        }),
      });
    });
  });

  describe('findAllByProject()', () => {
    it('should return all issues for a project', async () => {
      const mockIssues = [mockIssue, mockChildIssue];
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findMany as jest.Mock).mockResolvedValue(mockIssues);

      const result = await service.findAllByProject('project-1');

      expect(result).toHaveLength(2);
      expect(prismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', is_deleted: false },
      });
      expect(prismaService.issue.findMany).toHaveBeenCalledWith({
        where: { project_id: 'project-1', is_deleted: false },
        include: {
          children: {
            where: { is_deleted: false },
            orderBy: { sort_order: 'asc' },
          },
          parent: {
            where: { is_deleted: false },
          },
        },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      });
    });

    it('should return empty array for project with no issues', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAllByProject('project-1');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findAllByProject('non-existent-project')).rejects.toThrow(NotFoundException);
      await expect(service.findAllByProject('non-existent-project')).rejects.toThrow(
        'プロジェクトが見つかりません',
      );
    });
  });

  describe('findOne()', () => {
    it('should return a specific issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);

      const result = await service.findOne('project-1', 'issue-1');

      expect(result).toBeDefined();
      expect(prismaService.issue.findFirst).toHaveBeenCalledWith({
        where: { 
          id: 'issue-1', 
          project_id: 'project-1',
          is_deleted: false 
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
    });

    it('should throw NotFoundException for non-existent issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('project-1', 'non-existent-issue')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('project-1', 'non-existent-issue')).rejects.toThrow('指定されたIssueが見つかりません');
    });
  });

  describe('update()', () => {
    const updateIssueDto: UpdateIssueDto = {
      title: 'Updated Issue',
      status: 'in_progress',
      progress_pct: 50,
      assignee: 'updated-user',
    };

    it('should update an issue successfully', async () => {
      const updatedIssue = {
        ...mockIssue,
        ...updateIssueDto,
        version: 2,
        updated_at: new Date('2024-01-02'),
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(updatedIssue);

      const result = await service.update('project-1', 'issue-1', updateIssueDto);

      expect(result).toBeDefined();
      expect(prismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          ...updateIssueDto,
          version: { increment: 1 },
        }),
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
    });

    it('should handle partial updates', async () => {
      const partialUpdateDto: UpdateIssueDto = {
        progress_pct: 75,
      };

      const partiallyUpdatedIssue = {
        ...mockIssue,
        progress_pct: 75,
        version: 2,
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(partiallyUpdatedIssue);

      const result = await service.update('project-1', 'issue-1', partialUpdateDto);

      expect(result).toBeDefined();
      expect(prismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          progress_pct: 75,
          version: { increment: 1 },
        }),
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
    });

    it('should throw NotFoundException for non-existent issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('project-1', 'non-existent-issue', updateIssueDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('project-1', 'non-existent-issue', updateIssueDto)).rejects.toThrow(
        '指定されたIssueが見つかりません',
      );
    });

    it('should handle version conflict (optimistic locking)', async () => {
      const updateWithVersionDto: UpdateIssueDto = {
        title: 'Updated with version',
        version: 1, // 現在のバージョン
      };

      const conflictIssue = {
        ...mockIssue,
        version: 2, // より新しいバージョン
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(conflictIssue);

      await expect(
        service.update('project-1', 'issue-1', updateWithVersionDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove()', () => {
    it('should remove an issue successfully (soft delete)', async () => {
      const deletedIssue = {
        ...mockIssue,
        is_deleted: true,
        deleted_at: new Date(),
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(deletedIssue);

      const result = await service.remove('project-1', 'issue-1');

      expect(result).toEqual({ message: 'Issueが正常に削除されました' });
      expect(prismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        data: {
          is_deleted: true,
          deleted_at: expect.any(Date),
          version: { increment: 1 },
        },
      });
    });

    it('should throw NotFoundException for non-existent issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('project-1', 'issue-1')).rejects.toThrow(NotFoundException);
      await expect(service.remove('project-1', 'issue-1')).rejects.toThrow('指定されたIssueが見つかりません');
    });

    it('should throw BadRequestException for issue with children', async () => {
      const issueWithChildren = {
        ...mockIssue,
        children: [mockChildIssue],
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(issueWithChildren);

      await expect(service.remove('project-1', 'issue-1')).rejects.toThrow(BadRequestException);
      await expect(service.remove('project-1', 'issue-1')).rejects.toThrow(
        '子Issueが存在するため削除できません',
      );
    });
  });

  describe('Integration with ChangeLogService', () => {
    it('should record change log on create', async () => {
      const createIssueDto: CreateIssueDto = {
        title: 'New Issue with Log',
        description_md: 'Description for logging test',
      };

      const newIssue = {
        ...mockIssue,
        ...createIssueDto,
        id: 'logged-issue-id',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(newIssue);

      await service.create('project-1', createIssueDto);

      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        'logged-issue-id',
        expect.objectContaining({
          action: 'create',
          title: createIssueDto.title,
          author: expect.any(String),
        }),
      );
    });

    it('should record change log on update', async () => {
      const updateIssueDto: UpdateIssueDto = {
        title: 'Updated for Logging',
        status: 'in_progress',
      };

      const updatedIssue = {
        ...mockIssue,
        ...updateIssueDto,
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(updatedIssue);

      await service.update('project-1', 'issue-1', updateIssueDto);

      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({
          action: 'update',
          title: updateIssueDto.title,
          author: expect.any(String),
        }),
      );
    });

    it('should record change log on delete', async () => {
      const deletedIssue = {
        ...mockIssue,
        is_deleted: true,
        deleted_at: new Date(),
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(deletedIssue);

      await service.remove('project-1', 'issue-1');

      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({
          action: 'delete',
          title: mockIssue.title,
          author: expect.any(String),
        }),
      );
    });
  });

  describe('Integration with NotificationGateway', () => {
    it('should send notification on create', async () => {
      const createIssueDto: CreateIssueDto = {
        title: 'Issue for Notification',
      };

      const newIssue = {
        ...mockIssue,
        ...createIssueDto,
        id: 'notification-issue-id',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(newIssue);

      await service.create('project-1', createIssueDto);

      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalledWith({
        action: 'create',
        issue: newIssue,
        author: expect.any(String),
      });
    });

    it('should send notification on update', async () => {
      const updateIssueDto: UpdateIssueDto = {
        title: 'Updated for Notification',
      };

      const updatedIssue = {
        ...mockIssue,
        ...updateIssueDto,
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(updatedIssue);

      await service.update('project-1', 'issue-1', updateIssueDto);

      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalledWith({
        action: 'update',
        issue: updatedIssue,
        author: expect.any(String),
      });
    });

    it('should send notification on delete', async () => {
      const deletedIssue = {
        ...mockIssue,
        is_deleted: true,
        deleted_at: new Date(),
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue(deletedIssue);

      await service.remove('project-1', 'issue-1');

      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalledWith({
        action: 'delete',
        issue: mockIssue,
        author: expect.any(String),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully on create', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const createIssueDto: CreateIssueDto = {
        title: 'Error Test Issue',
      };

      await expect(service.create('project-1', createIssueDto)).rejects.toThrow('Database error');
    });

    it('should handle database errors gracefully on findAllByProject', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.findAllByProject('project-1')).rejects.toThrow('Database error');
    });

    it('should handle database errors gracefully on findOne', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.findOne('project-1', 'issue-1')).rejects.toThrow('Database error');
    });

    it('should handle database errors gracefully on update', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      const updateIssueDto: UpdateIssueDto = {
        title: 'Error Update',
      };

      await expect(service.update('project-1', 'issue-1', updateIssueDto)).rejects.toThrow('Database error');
    });

    it('should handle database errors gracefully on remove', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.remove('project-1', 'issue-1')).rejects.toThrow('Database error');
    });
  });
});