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
 * - CRUD操作（create, findAll, findOne, update, remove）
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
    is_blocked: false,
    sort_order: 10,
    labels: ['bug', 'high-priority'],
    version: 1,
    is_deleted: false,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    deleted_at: null,
    wbs_number: '1',
    wbs_level: 1,
  };

  const mockChildIssue = {
    ...mockIssue,
    id: 'issue-child',
    parent_id: 'issue-1',
    title: 'Child Issue',
    wbs_number: '1.1',
    wbs_level: 2,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      project: {
        findFirst: jest.fn(),
      },
      issue: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockChangeLogService = {
      recordIssueChange: jest.fn().mockResolvedValue(undefined),
    };

    const mockUploadsService = {
      getImagesByIssue: jest.fn().mockResolvedValue([]),
      deleteImage: jest.fn().mockResolvedValue(undefined),
    };

    const mockNotificationGateway = {
      notifyIssueChanged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ChangeLogService, useValue: mockChangeLogService },
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: NotificationGateway, useValue: mockNotificationGateway },
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
      description_md: '# New Issue\n\nDescription',
      assignee: 'test-user',
      status: 'open',
      start_date: '2024-06-01',
      end_date: '2024-06-30',
      progress_pct: 0,
      effort_hours: 8,
      is_blocked: false,
      sort_order: 10,
      labels: ['feature'],
    };

    it('should create a new issue successfully', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(mockIssue);

      const result = await service.create('project-1', createIssueDto);

      expect(result).toEqual(mockIssue);
      expect(prismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', is_deleted: false },
      });
      expect(prismaService.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 'project-1',
          title: createIssueDto.title,
          description_md: createIssueDto.description_md,
          assignee: createIssueDto.assignee,
          status: createIssueDto.status,
          progress_pct: createIssueDto.progress_pct,
          effort_hours: createIssueDto.effort_hours,
          is_blocked: createIssueDto.is_blocked,
          sort_order: createIssueDto.sort_order,
          labels: createIssueDto.labels,
        }),
      });
      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        mockIssue.id,
        expect.objectContaining({
          action: 'create',
          title: createIssueDto.title,
        }),
        'project-1',
        'system',
      );
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();
    });

    it('should create issue with parent_id when provided', async () => {
      const createIssueWithParentDto: CreateIssueDto = {
        ...createIssueDto,
        parent_id: 'issue-1',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue); // 親Issue
      (prismaService.issue.create as jest.Mock).mockResolvedValue(mockChildIssue);

      const result = await service.create('project-1', createIssueWithParentDto);

      expect(result).toEqual(mockChildIssue);
      expect(prismaService.issue.findFirst).toHaveBeenCalledWith({
        where: { id: 'issue-1', is_deleted: false },
      });
    });

    it('should throw NotFoundException for non-existent project', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create('non-existent-project', createIssueDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create('non-existent-project', createIssueDto)).rejects.toThrow(
        'プロジェクトが見つかりません',
      );
    });

    it('should throw BadRequestException for non-existent parent issue', async () => {
      const createIssueWithInvalidParentDto: CreateIssueDto = {
        ...createIssueDto,
        parent_id: 'non-existent-issue',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null); // 親Issueが存在しない

      await expect(
        service.create('project-1', createIssueWithInvalidParentDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('project-1', createIssueWithInvalidParentDto),
      ).rejects.toThrow('指定された親Issueが存在しません');
    });

    it('should handle minimum required fields only', async () => {
      const minimalCreateDto: CreateIssueDto = {
        title: 'Minimal Issue',
      };

      const minimalIssue = {
        ...mockIssue,
        title: 'Minimal Issue',
        description_md: null,
        assignee: null,
        labels: [],
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(minimalIssue);

      const result = await service.create('project-1', minimalCreateDto);

      expect(result).toEqual(minimalIssue);
      expect(prismaService.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Minimal Issue',
          status: 'open', // デフォルト値
          progress_pct: 0, // デフォルト値
          is_blocked: false, // デフォルト値
          labels: [], // デフォルト値
        }),
      });
    });
  });

  describe('findAll()', () => {
    it('should return all issues for a project', async () => {
      const mockIssues = [mockIssue, mockChildIssue];
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findMany as jest.Mock).mockResolvedValue(mockIssues);

      const result = await service.findAll('project-1');

      expect(result).toEqual(mockIssues);
      expect(prismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', is_deleted: false },
      });
      expect(prismaService.issue.findMany).toHaveBeenCalledWith({
        where: { project_id: 'project-1', is_deleted: false },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      });
    });

    it('should return empty array for project with no issues', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll('project-1');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findAll('non-existent-project')).rejects.toThrow(NotFoundException);
      await expect(service.findAll('non-existent-project')).rejects.toThrow(
        'プロジェクトが見つかりません',
      );
    });
  });

  describe('findOne()', () => {
    it('should return a specific issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);

      const result = await service.findOne('issue-1');

      expect(result).toEqual(mockIssue);
      expect(prismaService.issue.findFirst).toHaveBeenCalledWith({
        where: { id: 'issue-1', is_deleted: false },
      });
    });

    it('should throw NotFoundException for non-existent issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent-issue')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent-issue')).rejects.toThrow('Issueが見つかりません');
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

      const result = await service.update('issue-1', updateIssueDto);

      expect(result).toEqual(updatedIssue);
      expect(prismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          ...updateIssueDto,
          version: { increment: 1 },
        }),
      });
      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({
          action: 'update',
          title: updateIssueDto.title,
        }),
        'project-1',
        'system',
      );
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();
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

      const result = await service.update('issue-1', partialUpdateDto);

      expect(result).toEqual(partiallyUpdatedIssue);
      expect(prismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          progress_pct: 75,
          version: { increment: 1 },
        }),
      });
    });

    it('should throw NotFoundException for non-existent issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('non-existent-issue', updateIssueDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('non-existent-issue', updateIssueDto)).rejects.toThrow(
        'Issueが見つかりません',
      );
    });

    it('should throw BadRequestException for self-reference parent_id', async () => {
      const selfReferenceDto: UpdateIssueDto = {
        parent_id: 'issue-1', // 自分自身を親に設定
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);

      await expect(service.update('issue-1', selfReferenceDto)).rejects.toThrow(BadRequestException);
      await expect(service.update('issue-1', selfReferenceDto)).rejects.toThrow(
        '自分自身を親Issueに設定することはできません',
      );
    });

    it('should throw ConflictException for Prisma optimistic locking error', async () => {
      const prismaError = { code: 'P2025' }; // Prismaの楽観的排他制御エラー

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockRejectedValue(prismaError);

      await expect(service.update('issue-1', updateIssueDto)).rejects.toThrow(ConflictException);
      await expect(service.update('issue-1', updateIssueDto)).rejects.toThrow(
        'Issueが他のユーザーによって更新されています',
      );
    });

    it('should validate and update parent_id correctly', async () => {
      const updateWithParentDto: UpdateIssueDto = {
        parent_id: 'new-parent-issue',
      };

      const newParentIssue = {
        ...mockIssue,
        id: 'new-parent-issue',
        title: 'New Parent Issue',
      };

      const updatedIssue = {
        ...mockIssue,
        parent_id: 'new-parent-issue',
        version: 2,
      };

      (prismaService.issue.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockIssue) // existing issue
        .mockResolvedValueOnce(newParentIssue); // new parent issue

      (prismaService.issue.update as jest.Mock).mockResolvedValue(updatedIssue);

      const result = await service.update('issue-1', updateWithParentDto);

      expect(result).toEqual(updatedIssue);
      expect(prismaService.issue.findFirst).toHaveBeenCalledTimes(2);
      expect(prismaService.issue.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: 'new-parent-issue', is_deleted: false },
      });
    });
  });

  describe('remove()', () => {
    it('should remove an issue successfully', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.count as jest.Mock).mockResolvedValue(0); // 子Issueなし
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          issue: {
            update: jest.fn().mockResolvedValue({
              ...mockIssue,
              is_deleted: true,
              deleted_at: new Date(),
            }),
          },
        });
      });

      await service.remove('issue-1');

      expect(prismaService.issue.count).toHaveBeenCalledWith({
        where: { parent_id: 'issue-1', is_deleted: false },
      });
      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({
          action: 'delete',
          title: mockIssue.title,
        }),
        'project-1',
        'system',
      );
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent issue', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('non-existent-issue')).rejects.toThrow(NotFoundException);
      await expect(service.remove('non-existent-issue')).rejects.toThrow('Issueが見つかりません');
    });

    it('should throw ConflictException when issue has children', async () => {
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.count as jest.Mock).mockResolvedValue(2); // 子Issueが2つ存在

      await expect(service.remove('issue-1')).rejects.toThrow(ConflictException);
      await expect(service.remove('issue-1')).rejects.toThrow(
        'このIssueには子Issueが存在するため削除できません',
      );
    });

    it('should handle image cleanup during removal', async () => {
      const mockImages = [
        { id: 'image-1', filename: 'image1.png' },
        { id: 'image-2', filename: 'image2.jpg' },
      ];

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.count as jest.Mock).mockResolvedValue(0);
      (uploadsService.getImagesByIssue as jest.Mock).mockResolvedValue(mockImages);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          issue: {
            update: jest.fn().mockResolvedValue({
              ...mockIssue,
              is_deleted: true,
              deleted_at: new Date(),
            }),
          },
        });
      });

      await service.remove('issue-1');

      expect(uploadsService.getImagesByIssue).toHaveBeenCalledWith('issue-1');
      expect(uploadsService.deleteImage).toHaveBeenCalledTimes(2);
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('image-1');
      expect(uploadsService.deleteImage).toHaveBeenCalledWith('image-2');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle database connection errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      (prismaService.project.findFirst as jest.Mock).mockRejectedValue(dbError);

      await expect(service.findAll('project-1')).rejects.toThrow('Database connection failed');
    });

    it('should handle null and undefined values properly', async () => {
      const createDtoWithNulls: CreateIssueDto = {
        title: 'Test Issue',
        description_md: null,
        assignee: null,
        start_date: null,
        end_date: null,
        effort_hours: null,
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue({
        ...mockIssue,
        description_md: null,
        assignee: null,
        start_date: null,
        end_date: null,
        effort_hours: null,
      });

      const result = await service.create('project-1', createDtoWithNulls);

      expect(result.description_md).toBeNull();
      expect(result.assignee).toBeNull();
      expect(result.start_date).toBeNull();
      expect(result.end_date).toBeNull();
      expect(result.effort_hours).toBeNull();
    });

    it('should handle extreme values correctly', async () => {
      const extremeUpdateDto: UpdateIssueDto = {
        progress_pct: 100, // 境界値
        effort_hours: 999999, // 極大値
        labels: [], // 空配列
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue({
        ...mockIssue,
        ...extremeUpdateDto,
        version: 2,
      });

      const result = await service.update('issue-1', extremeUpdateDto);

      expect(result.progress_pct).toBe(100);
      expect(result.effort_hours).toBe(999999);
      expect(result.labels).toEqual([]);
    });
  });

  describe('Integration with external services', () => {
    it('should call ChangeLogService with correct parameters on create', async () => {
      const createIssueDto: CreateIssueDto = {
        title: 'ChangeLog Test Issue',
      };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue({
        ...mockIssue,
        title: 'ChangeLog Test Issue',
      });

      await service.create('project-1', createIssueDto);

      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        mockIssue.id,
        expect.objectContaining({
          action: 'create',
          title: 'ChangeLog Test Issue',
          status: 'open',
        }),
        'project-1',
        'system',
      );
    });

    it('should call NotificationGateway on all operations', async () => {
      const createIssueDto: CreateIssueDto = { title: 'Notification Test' };
      const updateIssueDto: UpdateIssueDto = { status: 'completed' };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssue);
      (prismaService.issue.update as jest.Mock).mockResolvedValue({
        ...mockIssue,
        status: 'completed',
        version: 2,
      });
      (prismaService.issue.count as jest.Mock).mockResolvedValue(0);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          issue: { update: jest.fn().mockResolvedValue({ ...mockIssue, is_deleted: true }) },
        });
      });

      // Create
      await service.create('project-1', createIssueDto);
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();

      // Update
      jest.clearAllMocks();
      await service.update('issue-1', updateIssueDto);
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();

      // Remove
      jest.clearAllMocks();
      await service.remove('issue-1');
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();
    });

    it('should handle ChangeLogService failures gracefully', async () => {
      const createIssueDto: CreateIssueDto = { title: 'ChangeLog Error Test' };

      (prismaService.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      (prismaService.issue.create as jest.Mock).mockResolvedValue(mockIssue);
      (changeLogService.recordIssueChange as jest.Mock).mockRejectedValue(
        new Error('ChangeLog service failed'),
      );

      // ChangeLogServiceの失敗があってもIssue作成は成功するべき
      const result = await service.create('project-1', createIssueDto);

      expect(result).toEqual(mockIssue);
    });
  });
});