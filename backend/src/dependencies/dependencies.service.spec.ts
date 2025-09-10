import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { PrismaService } from '../database/prisma.service';
import { ChangeLogService } from '../changelog/changelog.service';
import { NotificationGateway } from '../websocket/websocket.gateway';
import { SettingsService } from '../settings/settings.service';
import { CreateDependencyDto } from './dto';
import { BusinessDayConfig } from './interfaces/schedule-adjustment.interface';

/**
 * DependenciesService の単体テスト
 * 
 * テスト対象:
 * - CRUD操作（create, findByProjectId, remove）
 * - 循環依存検証アルゴリズム
 * - 日程調整ロジック
 * - バリデーション機能
 * - エラーハンドリング
 * - ChangeLogとNotification統合
 * 
 * テストカバレッジ:
 * - 正常系: 基本的なCRUD操作の成功ケース、日程調整機能
 * - 異常系: 循環依存、存在しないデータ、バリデーションエラー
 * - 境界値: 空データ、極端な値、null/undefined
 */
describe('DependenciesService', () => {
  let service: DependenciesService;
  let prismaService: PrismaService;
  let changeLogService: ChangeLogService;
  let notificationGateway: NotificationGateway;
  let settingsService: SettingsService;

  // モック用サンプルデータ
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    is_deleted: false,
  };

  const mockPredecessorIssue = {
    id: 'issue-1',
    project_id: 'project-1',
    title: 'Predecessor Issue',
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-01-05'),
    effort_hours: 40,
    is_deleted: false,
  };

  const mockSuccessorIssue = {
    id: 'issue-2',
    project_id: 'project-1',
    title: 'Successor Issue',
    start_date: new Date('2024-01-03'),
    end_date: new Date('2024-01-07'),
    effort_hours: 32,
    is_deleted: false,
  };

  const mockDependency = {
    id: 'dependency-1',
    project_id: 'project-1',
    predecessor_issue_id: 'issue-1',
    successor_issue_id: 'issue-2',
    type: 'FS' as const,
    created_at: new Date('2024-01-01'),
    predecessor: {
      id: 'issue-1',
      title: 'Predecessor Issue',
    },
    successor: {
      id: 'issue-2',
      title: 'Successor Issue',
    },
  };

  const mockBusinessDayConfig: BusinessDayConfig = {
    weekend_off: true,
    holiday_dates: ['2024-01-01', '2024-01-08'],
  };

  // モックサービスの設定
  const mockPrismaService = {
    dependency: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    issue: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockChangeLogService = {
    recordIssueChange: jest.fn(),
  };

  const mockNotificationGateway = {
    sendNotification: jest.fn(),
  };

  const mockSettingsService = {
    getGlobalSettings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependenciesService,
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
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    service = module.get<DependenciesService>(DependenciesService);
    prismaService = module.get<PrismaService>(PrismaService);
    changeLogService = module.get<ChangeLogService>(ChangeLogService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
    settingsService = module.get<SettingsService>(SettingsService);

    // モックの初期化
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateDependencyDto = {
      predecessor_issue_id: 'issue-1',
      successor_issue_id: 'issue-2',
      type: 'FS',
    };

    beforeEach(() => {
      // デフォルトのモック設定
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue) // predecessor
        .mockResolvedValueOnce(mockSuccessorIssue);   // successor
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);
      mockPrismaService.dependency.findMany.mockResolvedValue([]);
      mockPrismaService.dependency.create.mockResolvedValue(mockDependency);
      
      mockSettingsService.getGlobalSettings.mockResolvedValue({
        weekend_off: true,
        holiday_dates: ['2024-01-01'],
      });

      mockChangeLogService.recordIssueChange.mockResolvedValue(undefined);
      mockNotificationGateway.sendNotification.mockResolvedValue(undefined);
    });

    it('正常系: 依存関係を正常に作成できる', async () => {
      const result = await service.create('project-1', createDto);

      expect(result).toBeDefined();
      expect(result.predecessor_issue_id).toBe('issue-1');
      expect(result.successor_issue_id).toBe('issue-2');
      expect(result.type).toBe('FS');

      // Issue存在確認が呼ばれることを検証
      expect(mockPrismaService.issue.findFirst).toHaveBeenCalledTimes(2);
      
      // 循環依存チェックが呼ばれることを検証
      expect(mockPrismaService.dependency.findMany).toHaveBeenCalled();
      
      // 依存関係が作成されることを検証
      expect(mockPrismaService.dependency.create).toHaveBeenCalledWith({
        data: {
          project_id: 'project-1',
          predecessor_issue_id: 'issue-1',
          successor_issue_id: 'issue-2',
          type: 'FS',
        },
        include: {
          predecessor: { select: { id: true, title: true } },
          successor: { select: { id: true, title: true } },
        },
      });

      // ChangeLog記録が呼ばれることを検証
      expect(mockChangeLogService.recordIssueChange).toHaveBeenCalled();

      // WebSocket通知が呼ばれることを検証
      expect(mockNotificationGateway.sendNotification).toHaveBeenCalled();
    });

    it('異常系: 自己依存の場合はエラーを投げる', async () => {
      const selfDependencyDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-1',
      };

      await expect(
        service.create('project-1', selfDependencyDto)
      ).rejects.toThrow(new BadRequestException('Issue cannot depend on itself'));
    });

    it('異常系: 先行Issueが存在しない場合はエラーを投げる', async () => {
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(null) // predecessor not found
        .mockResolvedValueOnce(mockSuccessorIssue);

      await expect(
        service.create('project-1', createDto)
      ).rejects.toThrow(new NotFoundException('Predecessor issue issue-1 not found'));
    });

    it('異常系: 後続Issueが存在しない場合はエラーを投げる', async () => {
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(null); // successor not found

      await expect(
        service.create('project-1', createDto)
      ).rejects.toThrow(new NotFoundException('Successor issue issue-2 not found'));
    });

    it('異常系: 既存の依存関係がある場合はエラーを投げる', async () => {
      mockPrismaService.dependency.findFirst.mockResolvedValue(mockDependency);

      await expect(
        service.create('project-1', createDto)
      ).rejects.toThrow(new BadRequestException('Dependency already exists between these issues'));
    });

    it('異常系: 循環依存が発生する場合はエラーを投げる', async () => {
      // 循環依存シナリオ: issue-2 -> issue-3 -> issue-1 -> issue-2
      mockPrismaService.dependency.findMany
        .mockResolvedValueOnce([{ successor_issue_id: 'issue-3' }]) // issue-1 -> issue-3
        .mockResolvedValueOnce([{ successor_issue_id: 'issue-1' }]) // issue-3 -> issue-1
        .mockResolvedValueOnce([]); // issue-1 already visited

      await expect(
        service.create('project-1', createDto)
      ).rejects.toThrow(new BadRequestException('Cyclic dependency detected'));
    });

    it('境界値: typeが未指定の場合はデフォルトでFSが設定される', async () => {
      const dtoWithoutType: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-2',
      };

      await service.create('project-1', dtoWithoutType);

      expect(mockPrismaService.dependency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'FS',
          }),
        })
      );
    });
  });

  describe('findByProjectId', () => {
    it('正常系: プロジェクトの依存関係一覧を取得できる', async () => {
      const mockDependencies = [mockDependency];
      mockPrismaService.dependency.findMany.mockResolvedValue(mockDependencies);

      const result = await service.findByProjectId('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dependency-1');
      expect(result[0].predecessor_issue_id).toBe('issue-1');
      expect(result[0].successor_issue_id).toBe('issue-2');

      expect(mockPrismaService.dependency.findMany).toHaveBeenCalledWith({
        where: { project_id: 'project-1' },
        include: {
          predecessor: { select: { id: true, title: true } },
          successor: { select: { id: true, title: true } },
        },
        orderBy: { created_at: 'asc' },
      });
    });

    it('境界値: 依存関係が存在しない場合は空配列を返す', async () => {
      mockPrismaService.dependency.findMany.mockResolvedValue([]);

      const result = await service.findByProjectId('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      mockPrismaService.dependency.findUnique.mockResolvedValue(mockDependency);
      mockPrismaService.dependency.delete.mockResolvedValue(mockDependency);
      mockChangeLogService.recordIssueChange.mockResolvedValue(undefined);
      mockNotificationGateway.sendNotification.mockResolvedValue(undefined);
    });

    it('正常系: 依存関係を正常に削除できる', async () => {
      await service.remove('dependency-1');

      expect(mockPrismaService.dependency.findUnique).toHaveBeenCalledWith({
        where: { id: 'dependency-1' },
        include: {
          predecessor: { select: { id: true, title: true } },
          successor: { select: { id: true, title: true } },
        },
      });

      expect(mockPrismaService.dependency.delete).toHaveBeenCalledWith({
        where: { id: 'dependency-1' },
      });

      expect(mockChangeLogService.recordIssueChange).toHaveBeenCalled();
      expect(mockNotificationGateway.sendNotification).toHaveBeenCalled();
    });

    it('異常系: 存在しない依存関係を削除しようとするとエラーを投げる', async () => {
      mockPrismaService.dependency.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('non-existent-id')
      ).rejects.toThrow(new NotFoundException('Dependency with ID non-existent-id not found'));
    });
  });

  describe('日程調整機能', () => {
    beforeEach(() => {
      mockSettingsService.getGlobalSettings.mockResolvedValue({
        weekend_off: true,
        holiday_dates: ['2024-01-01'],
      });
    });

    it('adjustScheduleForDependency: 特定Issueの日程調整を実行できる', async () => {
      const mockIssues = [mockPredecessorIssue, mockSuccessorIssue];
      const mockDependencies = [mockDependency];

      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);
      mockPrismaService.dependency.findMany.mockResolvedValue(mockDependencies);
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockSuccessorIssue,
        start_date: new Date('2024-01-08'),
        end_date: new Date('2024-01-12'),
      });

      const result = await service.adjustScheduleForDependency('project-1', 'issue-2');

      expect(result.success).toBe(true);
      expect(result.adjusted_issues).toHaveLength(1);
      expect(result.adjusted_issues[0].issue_id).toBe('issue-2');
      expect(result.adjusted_issues[0].adjustment_reason).toBe('依存関係制約による自動調整');
    });

    it('adjustScheduleForProject: プロジェクト全体の日程調整を実行できる', async () => {
      const mockIssues = [mockPredecessorIssue, mockSuccessorIssue];
      const mockDependencies = [mockDependency];

      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);
      mockPrismaService.dependency.findMany.mockResolvedValue(mockDependencies);
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockSuccessorIssue,
        start_date: new Date('2024-01-08'),
        end_date: new Date('2024-01-12'),
      });

      const result = await service.adjustScheduleForProject('project-1');

      expect(result.success).toBe(true);
      expect(result.critical_path).toBeNull(); // MVPでは未実装
    });

    it('境界値: 日程調整が不要な場合は空の結果を返す', async () => {
      // 後続タスクが先行タスクより後に開始されている場合（調整不要）
      const adjustedSuccessor = {
        ...mockSuccessorIssue,
        start_date: new Date('2024-01-10'), // 先行タスク終了後に開始
      };

      mockPrismaService.issue.findMany.mockResolvedValue([mockPredecessorIssue, adjustedSuccessor]);
      mockPrismaService.dependency.findMany.mockResolvedValue([mockDependency]);

      const result = await service.adjustScheduleForDependency('project-1', 'issue-2');

      expect(result.success).toBe(true);
      expect(result.adjusted_issues).toHaveLength(0);
    });

    it('異常系: 日程調整でエラーが発生した場合は失敗結果を返す', async () => {
      mockPrismaService.issue.findMany.mockRejectedValue(new Error('Database error'));

      const result = await service.adjustScheduleForDependency('project-1', 'issue-2');

      expect(result.success).toBe(false);
      expect(result.constraint_violations).toHaveLength(1);
      expect(result.constraint_violations[0].type).toBe('adjustment_error');
      expect(result.constraint_violations[0].description).toContain('Database error');
    });
  });

  describe('循環依存検証アルゴリズム', () => {
    it('正常系: 循環依存がない場合は検証を通過する', async () => {
      // 線形の依存関係: A -> B -> C
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(mockSuccessorIssue);
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);
      mockPrismaService.dependency.findMany
        .mockResolvedValueOnce([{ successor_issue_id: 'issue-3' }]) // issue-1 -> issue-3
        .mockResolvedValueOnce([]); // issue-3 has no dependencies

      mockPrismaService.dependency.create.mockResolvedValue(mockDependency);
      mockSettingsService.getGlobalSettings.mockResolvedValue(mockBusinessDayConfig);

      const createDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-2',
      };

      await expect(service.create('project-1', createDto)).resolves.toBeDefined();
    });

    it('境界値: 複雑な依存関係グラフでも循環依存を正しく検出する', async () => {
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(mockSuccessorIssue);
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);

      // 複雑な循環: issue-1 -> issue-2 -> issue-3 -> issue-4 -> issue-1
      mockPrismaService.dependency.findMany
        .mockResolvedValueOnce([]) // issue-2 has no existing deps
        .mockResolvedValueOnce([{ successor_issue_id: 'issue-3' }]) // issue-2 -> issue-3
        .mockResolvedValueOnce([{ successor_issue_id: 'issue-4' }]) // issue-3 -> issue-4
        .mockResolvedValueOnce([{ successor_issue_id: 'issue-1' }]); // issue-4 -> issue-1 (cycle!)

      const createDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-2',
        successor_issue_id: 'issue-1', // これが循環を作る
      };

      await expect(service.create('project-1', createDto))
        .rejects.toThrow(new BadRequestException('Cyclic dependency detected'));
    });

    it('境界値: 自分自身への依存は即座に検出される', async () => {
      const selfDependencyDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-1',
      };

      await expect(service.create('project-1', selfDependencyDto))
        .rejects.toThrow(new BadRequestException('Issue cannot depend on itself'));
    });
  });

  describe('営業日設定の取得', () => {
    it('正常系: グローバル設定から営業日設定を取得できる', async () => {
      const mockSettings = {
        weekend_off: false,
        holiday_dates: ['2024-12-25', '2024-12-31'],
      };
      mockSettingsService.getGlobalSettings.mockResolvedValue(mockSettings);

      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(mockSuccessorIssue);
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);
      mockPrismaService.dependency.findMany.mockResolvedValue([]);
      mockPrismaService.dependency.create.mockResolvedValue(mockDependency);

      const createDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-2',
      };

      await service.create('project-1', createDto);

      expect(mockSettingsService.getGlobalSettings).toHaveBeenCalled();
    });

    it('異常系: グローバル設定取得に失敗した場合はデフォルト設定を使用する', async () => {
      mockSettingsService.getGlobalSettings.mockRejectedValue(new Error('Settings service error'));

      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(mockSuccessorIssue);
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);
      mockPrismaService.dependency.findMany.mockResolvedValue([]);
      mockPrismaService.dependency.create.mockResolvedValue(mockDependency);

      const createDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-2',
      };

      // エラーが発生してもデフォルト設定でサービスが動作することを確認
      await expect(service.create('project-1', createDto)).resolves.toBeDefined();
    });
  });

  describe('統合機能テスト', () => {
    it('正常系: 依存関係作成→日程調整→通知→ログ記録の一連の流れが正常に動作する', async () => {
      // セットアップ
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(mockSuccessorIssue);
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);
      mockPrismaService.dependency.findMany.mockResolvedValue([]);
      mockPrismaService.dependency.create.mockResolvedValue(mockDependency);
      
      mockSettingsService.getGlobalSettings.mockResolvedValue(mockBusinessDayConfig);

      // 日程調整のモック
      const mockIssues = [mockPredecessorIssue, mockSuccessorIssue];
      const mockDependencies = [mockDependency];
      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);
      mockPrismaService.dependency.findMany.mockResolvedValue(mockDependencies);
      mockPrismaService.issue.update.mockResolvedValue({
        ...mockSuccessorIssue,
        start_date: new Date('2024-01-08'),
      });

      const createDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-2',
      };

      // 実行
      const result = await service.create('project-1', createDto);

      // 検証
      expect(result).toBeDefined();
      expect(mockPrismaService.dependency.create).toHaveBeenCalled();
      expect(mockChangeLogService.recordIssueChange).toHaveBeenCalled();
      expect(mockNotificationGateway.sendNotification).toHaveBeenCalledTimes(2); // 作成通知と日程調整通知
    });

    it('例外ハンドリング: 通知失敗しても依存関係作成は成功する', async () => {
      mockPrismaService.issue.findFirst
        .mockResolvedValueOnce(mockPredecessorIssue)
        .mockResolvedValueOnce(mockSuccessorIssue);
      
      mockPrismaService.dependency.findFirst.mockResolvedValue(null);
      mockPrismaService.dependency.findMany.mockResolvedValue([]);
      mockPrismaService.dependency.create.mockResolvedValue(mockDependency);
      
      mockSettingsService.getGlobalSettings.mockResolvedValue(mockBusinessDayConfig);
      
      // 通知で例外が発生
      mockNotificationGateway.sendNotification.mockRejectedValue(new Error('Notification failed'));

      const createDto: CreateDependencyDto = {
        predecessor_issue_id: 'issue-1',
        successor_issue_id: 'issue-2',
      };

      // 通知失敗してもサービス全体は成功する
      await expect(service.create('project-1', createDto)).resolves.toBeDefined();
      
      expect(mockPrismaService.dependency.create).toHaveBeenCalled();
    });
  });
});