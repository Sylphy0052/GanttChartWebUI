import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { ReorderIssuesDto, ChangeHierarchyDto } from './dto';

/**
 * IssuesService 並び替え・階層変更機能の単体テスト
 * 
 * テスト対象:
 * - reorderIssues() - 複数Issue並び替え
 * - changeHierarchy() - 階層変更
 * - checkCircularReference() - 循環参照チェック
 * 
 * テストケース:
 * - 正常系: 正常な並び替え・階層変更
 * - 異常系: 楽観的排他制御エラー、循環参照、バリデーションエラー
 * - 境界値: 空配列、重複ID、存在しないIssue
 */
describe('IssuesService - Reorder & Hierarchy Functions', () => {
  let service: IssuesService;
  let prismaService: PrismaService;
  let changeLogService: ChangeLogService;
  let uploadsService: UploadsService;
  let notificationGateway: NotificationGateway;

  // モック用サンプルデータ
  const mockIssues = [
    {
      id: 'issue-1',
      project_id: 'project-1',
      parent_id: null,
      title: 'Issue 1',
      sort_order: 10,
      version: 1,
      is_deleted: false,
      // 他のフィールドは省略
    },
    {
      id: 'issue-2', 
      project_id: 'project-1',
      parent_id: null,
      title: 'Issue 2',
      sort_order: 20,
      version: 2,
      is_deleted: false,
    },
    {
      id: 'issue-3',
      project_id: 'project-1', 
      parent_id: 'issue-1',
      title: 'Issue 3 (child)',
      sort_order: 30,
      version: 1,
      is_deleted: false,
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      issue: {
        findFirst: jest.fn(),
        update: jest.fn(),
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

  describe('reorderIssues()', () => {
    it('should successfully reorder multiple issues', async () => {
      const reorderDto: ReorderIssuesDto = {
        issues: [
          { id: 'issue-1', sort_order: 20, version: 1 },
          { id: 'issue-2', sort_order: 10, version: 2 },
        ],
      };

      // Prismaトランザクション内での処理をモック
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          issue: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(mockIssues[0]) // issue-1
              .mockResolvedValueOnce(mockIssues[1]), // issue-2
            update: jest.fn()
              .mockResolvedValueOnce({ ...mockIssues[0], sort_order: 20, version: 2 })
              .mockResolvedValueOnce({ ...mockIssues[1], sort_order: 10, version: 3 }),
          },
        });
      });

      const result = await service.reorderIssues(reorderDto);

      expect(result).toHaveLength(2);
      expect(result[0].sort_order).toBe(20);
      expect(result[1].sort_order).toBe(10);
      expect(changeLogService.recordIssueChange).toHaveBeenCalledTimes(2);
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for empty issues array', async () => {
      const reorderDto: ReorderIssuesDto = { issues: [] };

      await expect(service.reorderIssues(reorderDto)).rejects.toThrow(BadRequestException);
      await expect(service.reorderIssues(reorderDto)).rejects.toThrow('並び替え対象のIssueが指定されていません');
    });

    it('should throw BadRequestException for duplicate issue IDs', async () => {
      const reorderDto: ReorderIssuesDto = {
        issues: [
          { id: 'issue-1', sort_order: 10, version: 1 },
          { id: 'issue-1', sort_order: 20, version: 1 }, // 重複ID
        ],
      };

      await expect(service.reorderIssues(reorderDto)).rejects.toThrow(BadRequestException);
      await expect(service.reorderIssues(reorderDto)).rejects.toThrow('重複したIssue IDが含まれています');
    });

    it('should throw ConflictException for optimistic locking error', async () => {
      const reorderDto: ReorderIssuesDto = {
        issues: [{ id: 'issue-1', sort_order: 20, version: 1 }],
      };

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrisma = {
          issue: {
            findFirst: jest.fn().mockResolvedValue(mockIssues[0]),
            update: jest.fn().mockRejectedValue({ code: 'P2025' }), // 楽観的排他制御エラー
          },
        };
        return await callback(mockPrisma);
      });

      await expect(service.reorderIssues(reorderDto)).rejects.toThrow(ConflictException);
      await expect(service.reorderIssues(reorderDto)).rejects.toThrow('Issueが他のユーザーによって更新されています');
    });
  });

  describe('changeHierarchy()', () => {
    it('should successfully change issue hierarchy', async () => {
      const changeHierarchyDto: ChangeHierarchyDto = {
        new_parent_id: 'issue-2',
        version: 1,
      };

      (prismaService.issue.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockIssues[0]) // existing issue
        .mockResolvedValueOnce(mockIssues[1]) // new parent issue
        .mockResolvedValueOnce(null); // 循環参照チェック用（親が存在しない）

      (prismaService.issue.update as jest.Mock).mockResolvedValue({
        ...mockIssues[0],
        parent_id: 'issue-2',
        version: 2,
      });

      const result = await service.changeHierarchy('issue-1', changeHierarchyDto);

      expect(result.parent_id).toBe('issue-2');
      expect(result.version).toBe(2);
      expect(changeLogService.recordIssueChange).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({
          action: 'change_hierarchy',
          parent_id_from: null,
          parent_id_to: 'issue-2',
        }),
        'project-1',
        'system',
      );
      expect(notificationGateway.notifyIssueChanged).toHaveBeenCalled();
    });

    it('should throw BadRequestException for self-reference', async () => {
      const changeHierarchyDto: ChangeHierarchyDto = {
        new_parent_id: 'issue-1', // 自分自身を親に設定
        version: 1,
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue(mockIssues[0]);

      await expect(service.changeHierarchy('issue-1', changeHierarchyDto)).rejects.toThrow(BadRequestException);
      await expect(service.changeHierarchy('issue-1', changeHierarchyDto)).rejects.toThrow('自分自身を親Issueに設定することはできません');
    });

    it('should throw BadRequestException for circular reference', async () => {
      const changeHierarchyDto: ChangeHierarchyDto = {
        new_parent_id: 'issue-3', // issue-3 の親を issue-1 にしようとするが、issue-3 は issue-1 の子
        version: 1,
      };

      (prismaService.issue.findFirst as jest.Mock)
        .mockResolvedValueOnce({ ...mockIssues[0], id: 'issue-1' }) // existing issue
        .mockResolvedValueOnce({ ...mockIssues[2], id: 'issue-3' }) // new parent issue
        .mockResolvedValueOnce({ ...mockIssues[0], parent_id: null }); // 循環参照チェック：issue-3 -> issue-1

      await expect(service.changeHierarchy('issue-1', changeHierarchyDto)).rejects.toThrow(BadRequestException);
      await expect(service.changeHierarchy('issue-1', changeHierarchyDto)).rejects.toThrow('循環参照が発生するため');
    });

    it('should allow setting parent to null (remove parent)', async () => {
      const changeHierarchyDto: ChangeHierarchyDto = {
        new_parent_id: null,
        version: 1,
      };

      (prismaService.issue.findFirst as jest.Mock).mockResolvedValue({
        ...mockIssues[2],
        parent_id: 'issue-1',
      });

      (prismaService.issue.update as jest.Mock).mockResolvedValue({
        ...mockIssues[2],
        parent_id: null,
        version: 2,
      });

      const result = await service.changeHierarchy('issue-3', changeHierarchyDto);

      expect(result.parent_id).toBeNull();
      expect(prismaService.issue.update).toHaveBeenCalledWith({
        where: { id: 'issue-3', version: 1 },
        data: { parent_id: null, version: { increment: 1 } },
      });
    });
  });

  describe('checkCircularReference() (private method - integration test via changeHierarchy)', () => {
    it('should detect circular reference in hierarchy chain', async () => {
      const changeHierarchyDto: ChangeHierarchyDto = {
        new_parent_id: 'issue-child',
        version: 1,
      };

      // issue-1 -> issue-child -> issue-1 の循環を作成
      (prismaService.issue.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'issue-1', parent_id: null }) // existing issue
        .mockResolvedValueOnce({ id: 'issue-child', parent_id: 'issue-1' }) // new parent
        .mockResolvedValueOnce({ id: 'issue-1', parent_id: null }); // 循環参照チェック時

      await expect(service.changeHierarchy('issue-1', changeHierarchyDto)).rejects.toThrow(BadRequestException);
    });
  });
});